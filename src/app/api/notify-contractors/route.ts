import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';
import { generateJobSheetPDF, JobSheetInput } from '@/lib/pdf-job-sheet';
import { uploadJobSheetToDrive, shareFileWithLink, FolderType } from '@/lib/google-drive';
import { readJobSheetData } from '@/lib/google-sheets';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

function getJobSheetFolderType(bookingType: string | null): FolderType {
  if (bookingType === 'backline') return 'backline';
  if (bookingType === 'soundgear' || bookingType === 'full_system') return 'fullsystem';
  return 'soundtech'; // default for contractor bookings
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, bookingId } = body;

    if (!token || !bookingId) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: 'Database not configured' }, { status: 500 });
    }

    // Validate booking and token - include inquiry for original form data AND quote_data
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, inquiries(form_data_json, quote_data)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Verify token
    if (booking.contractor_selection_token !== token && booking.approval_token !== token) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 403 });
    }

    // Fetch assignments with contractor details
    const { data: assignments, error: assignmentsError } = await supabase
      .from('booking_contractor_assignments')
      .select('*, contractors(*)')
      .eq('booking_id', bookingId)
      .eq('status', 'pending');

    if (assignmentsError || !assignments || assignments.length === 0) {
      return NextResponse.json({ message: 'No assignments to notify' }, { status: 400 });
    }

    // Use original form data from inquiry, fallback to booking.details_json
    const inquiryData = booking.inquiries as { form_data_json: Record<string, unknown>; quote_data: Record<string, unknown> } | null;
    const originalFormData = inquiryData?.form_data_json;
    const quoteData = inquiryData?.quote_data;
    const details = originalFormData || (booking.details_json as Record<string, unknown> | null);

    // Read suggestedGear and executionNotes from Google Sheet (source of truth for admin edits)
    // Fallback to quote_data if sheet read fails
    let suggestedGear: Array<{ item: string; quantity: number; notes?: string }> | undefined;
    let executionNotes: string[] | undefined;

    if (booking.jobsheet_sheet_id) {
      try {
        const jobSheetData = await readJobSheetData(booking.jobsheet_sheet_id);
        if (jobSheetData) {
          suggestedGear = jobSheetData.suggestedGear;
          executionNotes = jobSheetData.executionNotes;
          console.log(`Read AI content from Google Sheet: ${suggestedGear?.length || 0} gear items, ${executionNotes?.length || 0} notes`);
        }
      } catch (sheetError) {
        console.warn('Failed to read from jobsheet sheet, falling back to quote_data:', sheetError);
      }
    }

    // Fallback to quote_data if sheet read failed or sheet doesn't exist
    if (!suggestedGear) {
      suggestedGear = quoteData?.suggestedGear as Array<{ item: string; quantity: number; notes?: string }> | undefined;
    }
    if (!executionNotes) {
      executionNotes = quoteData?.executionNotes as string[] | undefined;
    }
    let equipmentWithNotes: Array<{ name: string; quantity: number; notes?: string | null }> = [];
    if (details?.equipment && Array.isArray(details.equipment)) {
      const equipmentNames = (details.equipment as Array<{ name: string }>).map(e => e.name);
      const { data: equipmentItems } = await supabase
        .from('equipment')
        .select('name, notes')
        .in('name', equipmentNames);

      equipmentWithNotes = (details.equipment as Array<{ name: string; quantity: number }>).map(item => ({
        name: item.name,
        quantity: item.quantity,
        notes: equipmentItems?.find(e => e.name === item.name)?.notes || null,
      }));
    }

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-NZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    const formatTime = (timeStr: string | null) => {
      if (!timeStr) return null;
      const cleanTime = timeStr.trim().toLowerCase();
      if (/^\d{1,2}(:\d{2})?\s*(am|pm)$/i.test(cleanTime)) {
        return timeStr.trim();
      }
      const match24 = cleanTime.match(/^(\d{1,2}):(\d{2})$/);
      if (match24) {
        let hours = parseInt(match24[1], 10);
        const mins = match24[2];
        const period = hours >= 12 ? 'pm' : 'am';
        if (hours > 12) hours -= 12;
        if (hours === 0) hours = 12;
        return mins === '00' ? `${hours}${period}` : `${hours}:${mins}${period}`;
      }
      return timeStr;
    };

    let notifiedCount = 0;

    // Send personalized email to each contractor
    for (const assignment of assignments) {
      const contractor = assignment.contractors;
      if (!contractor) continue;

      // Generate unique assignment token
      const assignmentToken = randomUUID();

      // Update assignment with token
      await supabase
        .from('booking_contractor_assignments')
        .update({
          assignment_token: assignmentToken,
          status: 'notified',
          notified_at: new Date().toISOString(),
        })
        .eq('id', assignment.id);

      // Build accept/decline URLs
      const acceptUrl = `${baseUrl}/api/contractor-respond?token=${assignmentToken}&action=accept`;
      const declineUrl = `${baseUrl}/api/contractor-respond?token=${assignmentToken}&action=decline`;

      // Send email
      if (resend) {
        try {
          // Build pay breakdown string
          const hourlyRate = Number(assignment.hourly_rate) || 0;
          const hours = Number(assignment.estimated_hours) || 0;
          const totalPay = Number(assignment.pay_amount) || (hourlyRate * hours);
          const payBreakdown = hourlyRate && hours
            ? `$${hourlyRate}/hr × ${hours} hrs = $${totalPay.toFixed(0)}`
            : `$${totalPay.toFixed(0)}`;

          // Build content requirements array from boolean flags
          const contentRequirements: string[] = [];
          if (details?.contentRequirements && Array.isArray(details.contentRequirements)) {
            contentRequirements.push(...(details.contentRequirements as string[]));
          }
          // Also build from individual boolean flags if present
          if (details?.hasDJ) contentRequirements.push('DJ');
          if (details?.hasBand) contentRequirements.push('Live Band');
          if (details?.hasLiveMusic) contentRequirements.push('Live Music');
          if (details?.hasSpeeches) contentRequirements.push('Speeches/Presentations');
          if (details?.needsMic) contentRequirements.push('Microphone Required');
          if (details?.playbackFromDevice) contentRequirements.push('Playback from Device');

          // Generate Job Sheet PDF
          const jobSheetInput: JobSheetInput = {
            eventName: booking.event_name || 'Event',
            eventDate: booking.event_date,
            eventTime: booking.event_time,
            eventEndTime: (details?.eventEndTime as string) || null,
            location: booking.location || 'TBC',
            quoteNumber: booking.quote_number || '',
            contractorName: contractor.name,
            hourlyRate: hourlyRate || null,
            estimatedHours: hours || null,
            payAmount: totalPay,
            tasksDescription: assignment.tasks_description || null,
            equipment: equipmentWithNotes,
            eventType: (details?.eventType as string) || null,
            attendance: (details?.attendance as string) || null,
            setupTime: (details?.setupTime as string) || null,
            indoorOutdoor: (details?.indoorOutdoor as string) || null,
            contentRequirements,
            additionalNotes: (details?.additionalNotes as string) || (details?.additionalInfo as string) || null,
            // Venue details
            venueContact: (details?.venueContact as string) || null,
            hasStage: (details?.hasStage as boolean) || false,
            stageDetails: (details?.stageDetails as string) || null,
            powerAccess: (details?.powerAccess as string) || null,
            wetWeatherPlan: (details?.wetWeatherPlan as string) || null,
            needsGenerator: (details?.needsGenerator as boolean) || false,
            // Client
            clientName: booking.client_name,
            clientPhone: booking.client_phone || '',
            clientEmail: booking.client_email,
            // AI-generated content from quote_data
            suggestedGear,
            executionNotes,
          };

          let jobSheetDriveLink: string | null = null;
          const jobSheetFilename = `JobSheet-${booking.quote_number || 'Job'}-${contractor.name.split(' ')[0]}.pdf`;
          try {
            const jobSheetBuffer = await generateJobSheetPDF(jobSheetInput);
            // Upload to Google Drive and get shareable link
            if (jobSheetBuffer) {
              const folderType = getJobSheetFolderType(booking.booking_type);
              const fileId = await uploadJobSheetToDrive(jobSheetBuffer, jobSheetFilename, folderType);
              if (fileId) {
                jobSheetDriveLink = await shareFileWithLink(fileId);
              }
            }
          } catch (pdfError) {
            console.error('Error generating Job Sheet PDF:', pdfError);
          }

          // Extract gear list from details_json if available
          let gearListHtml = '';
          if (details?.equipment && Array.isArray(details.equipment)) {
            const gearItems = (details.equipment as Array<{ name: string; quantity: number }>)
              .map(item => `<li>${item.quantity}x ${item.name}</li>`)
              .join('');
            gearListHtml = `
              <div style="margin: 15px 0;">
                <strong style="color: #374151;">GEAR:</strong>
                <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #4b5563;">
                  ${gearItems}
                </ul>
              </div>
            `;
          }

          // Build event details from details_json
          let eventDetailsHtml = '';
          const eventDetailItems: string[] = [];
          if (details?.eventType) eventDetailItems.push(`Type: ${details.eventType}`);
          if (details?.package) eventDetailItems.push(`Package: ${details.package}`);
          if (details?.attendance) eventDetailItems.push(`Attendance: ${details.attendance}`);
          if (details?.setupTime) eventDetailItems.push(`Setup: ${details.setupTime}`);
          if (details?.indoorOutdoor) eventDetailItems.push(`Environment: ${details.indoorOutdoor}`);
          if (details?.hasStage || details?.stageDetails) {
            eventDetailItems.push(`Stage: ${details.stageDetails || (details.hasStage ? 'Yes' : 'No')}`);
          }
          if (contentRequirements.length > 0) {
            eventDetailItems.push(`Content: ${contentRequirements.join(', ')}`);
          }
          if (details?.powerAccess) eventDetailItems.push(`Power: ${details.powerAccess}`);
          if (details?.needsGenerator) eventDetailItems.push(`Generator: Required`);
          if (details?.wetWeatherPlan) eventDetailItems.push(`Wet Weather: ${details.wetWeatherPlan}`);
          if (eventDetailItems.length > 0) {
            eventDetailsHtml = `
              <div style="margin: 15px 0;">
                <strong style="color: #374151;">EVENT DETAILS:</strong>
                <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #4b5563;">
                  ${eventDetailItems.map(item => `<li>${item}</li>`).join('')}
                </ul>
              </div>
            `;
          }

          // Build venue contact section
          let venueContactHtml = '';
          if (details?.venueContact) {
            venueContactHtml = `
              <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 15px; margin: 15px 0; font-size: 14px;">
                <strong>VENUE CONTACT:</strong> ${details.venueContact}
              </div>
            `;
          }

          await resend.emails.send({
            from: 'Accent Productions <notifications@accent-productions.co.nz>',
            to: [contractor.email],
            subject: `Job Offer: ${formatDate(booking.event_date)} - ${payBreakdown}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; text-align: left;">
                <div style="margin-bottom: 20px;">
                  <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
                </div>

                <p style="color: #374151; margin-bottom: 20px;">Hi ${contractor.name.split(' ')[0]},</p>

                <!-- Main Offer Box -->
                <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin-bottom: 20px; text-align: left;">
                  <div style="margin-bottom: 15px;">
                    <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px;">YOUR OFFER</div>
                    <div style="font-size: 32px; font-weight: bold; color: #15803d; margin: 8px 0;">${payBreakdown}</div>
                  </div>
                  <div style="border-top: 1px solid #bbf7d0; padding-top: 15px; font-size: 15px;">
                    <div style="margin-bottom: 8px;">
                      <strong>DATE:</strong> ${formatDate(booking.event_date)}${formatTime(booking.event_time) ? `, ${formatTime(booking.event_time)} start` : ''}
                    </div>
                    <div>
                      <strong>LOCATION:</strong> ${booking.location || 'TBC'}
                    </div>
                  </div>
                </div>

                <!-- Tasks Section -->
                ${assignment.tasks_description ? `
                <div style="margin: 15px 0;">
                  <strong style="color: #374151;">YOUR TASKS:</strong>
                  <ul style="margin: 5px 0 0 0; padding-left: 20px; color: #4b5563;">
                    ${assignment.tasks_description.split('\n').filter((t: string) => t.trim()).map((task: string) => `<li>${task.trim()}</li>`).join('')}
                  </ul>
                </div>
                ` : ''}

                <!-- Gear List -->
                ${gearListHtml}

                <!-- Event Details -->
                ${eventDetailsHtml}

                <!-- Venue Contact -->
                ${venueContactHtml}

                <!-- Client Contact -->
                <div style="background: #f8fafc; border-radius: 8px; padding: 12px 15px; margin: 20px 0; font-size: 14px;">
                  <strong>CLIENT:</strong> ${booking.client_name}${booking.client_phone ? ` | ${booking.client_phone}` : ''}
                </div>

                <!-- Action Buttons -->
                <div style="margin: 30px 0;">
                  <a href="${acceptUrl}"
                     style="display: inline-block; background: #16a34a; color: #fff; padding: 16px 50px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; margin-right: 12px;">
                    ACCEPT
                  </a>
                  <a href="${declineUrl}"
                     style="display: inline-block; background: #dc2626; color: #fff; padding: 16px 50px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
                    DECLINE
                  </a>
                </div>

                <p style="color: #9ca3af; font-size: 12px; margin-top: 30px;">
                  Please respond ASAP so we can finalize the booking.
                </p>
                ${jobSheetDriveLink ? `<p style="font-size: 11px; color: #94a3b8;"><a href="${jobSheetDriveLink}" style="color: #94a3b8;">Job Sheet</a></p>` : ''}
              </div>
            `,
          });

          console.log(`Sent job notification to ${contractor.email}`);
          notifiedCount++;
        } catch (emailError) {
          console.error(`Error sending email to ${contractor.email}:`, emailError);
        }
      }
    }

    // Update booking status
    await supabase
      .from('bookings')
      .update({
        status: 'contractors_notified',
        contractors_notified_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    return NextResponse.json({
      success: true,
      notifiedCount,
    });
  } catch (error) {
    console.error('Error notifying contractors:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
