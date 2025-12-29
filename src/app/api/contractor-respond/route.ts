import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { updateCalendarEvent } from '@/lib/google-calendar';
import { shareFileWithLink, uploadJobSheetToDrive, FolderType } from '@/lib/google-drive';
import { generateJobSheetPDF, JobSheetInput } from '@/lib/pdf-job-sheet';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

function getJobSheetFolderType(bookingType: string | null): FolderType {
  if (bookingType === 'backline') return 'backline';
  if (bookingType === 'soundgear' || bookingType === 'full_system') return 'fullsystem';
  return 'soundtech'; // default for contractor bookings
}

// Build Google Calendar "Add to Calendar" link
function buildAddToCalendarUrl(params: {
  title: string;
  date: string;
  time?: string | null;
  location?: string | null;
  description?: string;
  durationHours?: number;
}): string {
  const { title, date, time, location, description, durationHours = 4 } = params;

  // Parse date and time
  const eventDate = new Date(date);
  let startHour = 9; // Default 9am
  let startMinute = 0;

  if (time) {
    // Parse time like "6pm", "6:30pm", "18:00"
    const timeMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      startHour = parseInt(timeMatch[1], 10);
      startMinute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      if (timeMatch[3]?.toLowerCase() === 'pm' && startHour !== 12) startHour += 12;
      if (timeMatch[3]?.toLowerCase() === 'am' && startHour === 12) startHour = 0;
    }
  }

  eventDate.setHours(startHour, startMinute, 0, 0);
  const endDate = new Date(eventDate.getTime() + durationHours * 60 * 60 * 1000);

  // Format dates as YYYYMMDDTHHMMSSZ (UTC)
  const formatGoogleDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const dates = `${formatGoogleDate(eventDate)}/${formatGoogleDate(endDate)}`;

  const queryParams = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: dates,
    ...(location && { location }),
    ...(description && { details: description }),
  });

  return `https://calendar.google.com/calendar/render?${queryParams.toString()}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  if (!token || !action || !['accept', 'decline'].includes(action)) {
    return NextResponse.redirect(`${baseUrl}/contractor-response?error=invalid_params`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.redirect(`${baseUrl}/contractor-response?error=server_error`);
  }

  try {
    // Find assignment by token
    const { data: assignment, error: fetchError } = await supabase
      .from('booking_contractor_assignments')
      .select('*, contractors(*), bookings(*)')
      .eq('assignment_token', token)
      .single();

    if (fetchError || !assignment) {
      return NextResponse.redirect(`${baseUrl}/contractor-response?error=invalid_token`);
    }

    // Check if already responded
    if (assignment.status === 'accepted' || assignment.status === 'declined') {
      return NextResponse.redirect(`${baseUrl}/contractor-response?error=already_responded&status=${assignment.status}`);
    }

    const contractor = assignment.contractors;
    const booking = assignment.bookings;

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    // Update assignment status
    const { error: updateError } = await supabase
      .from('booking_contractor_assignments')
      .update({
        status: newStatus,
        responded_at: new Date().toISOString(),
      })
      .eq('id', assignment.id);

    if (updateError) {
      console.error('Error updating assignment:', updateError);
      return NextResponse.redirect(`${baseUrl}/contractor-response?error=update_failed`);
    }

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-NZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    if (action === 'accept') {
      // Share quote PDF if available
      let quoteLink: string | null = null;
      if (booking.quote_drive_file_id) {
        quoteLink = await shareFileWithLink(booking.quote_drive_file_id);
      }

      // Check if all contractors have accepted
      const { data: allAssignments } = await supabase
        .from('booking_contractor_assignments')
        .select('status')
        .eq('booking_id', booking.id);

      const allAccepted = allAssignments?.every(a => a.status === 'accepted');

      if (allAccepted) {
        // Update booking status
        await supabase
          .from('bookings')
          .update({ status: 'fully_assigned' })
          .eq('id', booking.id);

        // Update calendar with all contractor names
        if (booking.calendar_event_id) {
          const { data: acceptedAssignments } = await supabase
            .from('booking_contractor_assignments')
            .select('*, contractors(*)')
            .eq('booking_id', booking.id)
            .eq('status', 'accepted');

          const contractorNames = acceptedAssignments?.map(a => a.contractors?.name).filter(Boolean).join(', ');

          await updateCalendarEvent(booking.calendar_event_id, {
            summary: `${booking.event_name || 'Event'} - ${contractorNames}`,
            description: `Quote: #${booking.quote_number}\nClient: ${booking.client_name}\nEmail: ${booking.client_email}\nPhone: ${booking.client_phone}\n\nContractors: ${contractorNames}`,
          });
        }

        // Notify dad that all contractors confirmed
        if (resend) {
          const { data: acceptedAssignments } = await supabase
            .from('booking_contractor_assignments')
            .select('*, contractors(*)')
            .eq('booking_id', booking.id)
            .eq('status', 'accepted');

          const contractorList = acceptedAssignments?.map(a =>
            `<li><strong>${a.contractors?.name}</strong> - $${a.pay_amount} - ${a.tasks_description || 'General'}</li>`
          ).join('');

          await resend.emails.send({
            from: 'Accent Productions <notifications@accent-productions.co.nz>',
            to: [businessEmail],
            subject: `All Contractors Confirmed: ${booking.event_name || 'Event'}`,
            html: `
              <h1 style="color: #16a34a;">All Contractors Confirmed!</h1>
              <p>Great news! All contractors have accepted for:</p>

              <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h2 style="margin-top: 0;">${booking.event_name || 'Event'}</h2>
                <p><strong>Date:</strong> ${formatDate(booking.event_date)}</p>
                <p><strong>Quote:</strong> #${booking.quote_number}</p>
              </div>

              <h3>Confirmed Contractors:</h3>
              <ul>${contractorList}</ul>

              <p style="color: #666; font-size: 14px;">
                The calendar event has been updated with contractor details.
              </p>
            `,
          });
        }
      }

      // Send confirmation to contractor with calendar link
      if (resend) {
        // Build pay breakdown
        const hourlyRate = Number(assignment.hourly_rate) || 0;
        const hours = Number(assignment.estimated_hours) || 0;
        const totalPay = Number(assignment.pay_amount) || (hourlyRate * hours);
        const payBreakdown = hourlyRate && hours
          ? `$${hourlyRate}/hr × ${hours} hrs = $${totalPay.toFixed(0)}`
          : `$${totalPay.toFixed(0)}`;

        // Generate Job Sheet PDF for confirmation email
        const details = booking.details_json as Record<string, unknown> | null;
        let equipmentWithNotes: Array<{ name: string; quantity: number; notes?: string | null }> = [];

        // Fetch equipment notes from hire_items
        if (details?.equipment && Array.isArray(details.equipment)) {
          const equipmentNames = (details.equipment as Array<{ name: string }>).map(e => e.name);
          const { data: hireItems } = await supabase
            .from('hire_items')
            .select('name, notes')
            .in('name', equipmentNames);

          equipmentWithNotes = (details.equipment as Array<{ name: string; quantity: number }>).map(item => ({
            name: item.name,
            quantity: item.quantity,
            notes: hireItems?.find(h => h.name === item.name)?.notes || null,
          }));
        }

        // Build content requirements
        const contentRequirements: string[] = [];
        if (details?.contentRequirements && Array.isArray(details.contentRequirements)) {
          contentRequirements.push(...(details.contentRequirements as string[]));
        }
        const venue = details?.venue as Record<string, unknown> | undefined;

        const jobSheetInput: JobSheetInput = {
          eventName: booking.event_name || 'Event',
          eventDate: booking.event_date,
          eventTime: booking.event_time,
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
          indoorOutdoor: (venue?.indoorOutdoor as string) || null,
          contentRequirements,
          additionalNotes: (details?.additionalNotes as string) || (details?.additionalInfo as string) || null,
          clientName: booking.client_name,
          clientPhone: booking.client_phone || '',
          clientEmail: booking.client_email,
        };

        let jobSheetDriveLink: string | null = null;
        const jobSheetFilename = `JobSheet-CONFIRMED-${booking.quote_number || 'Job'}-${contractor.name.split(' ')[0]}.pdf`;
        try {
          const jobSheetBuffer = await generateJobSheetPDF(jobSheetInput);
          // Upload confirmed job sheet to Google Drive and get shareable link
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

        // Build calendar link
        const calendarUrl = buildAddToCalendarUrl({
          title: `WORK: ${booking.event_name || 'Event'} - Accent Productions`,
          date: booking.event_date,
          time: booking.event_time,
          location: booking.location,
          description: `${assignment.tasks_description || 'General support'}\n\nPay: ${payBreakdown}\n\nClient: ${booking.client_name}\nPhone: ${booking.client_phone}`,
          durationHours: hours || 4,
        });

        await resend.emails.send({
          from: 'Accent Productions <notifications@accent-productions.co.nz>',
          to: [contractor.email],
          subject: `Confirmed: You're booked for ${formatDate(booking.event_date)}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; text-align: left;">
              <div style="margin-bottom: 20px;">
                <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
              </div>

              <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin-bottom: 20px; text-align: left;">
                <div style="font-size: 18px; color: #166534; font-weight: bold; margin-bottom: 10px;">YOU'RE BOOKED!</div>
                <div style="font-size: 24px; font-weight: bold; color: #15803d;">${payBreakdown}</div>
              </div>

              <p>Hi ${contractor.name.split(' ')[0]},</p>
              <p>Thanks for accepting! Here are your job details:</p>

              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin-top: 0; font-size: 18px;">${booking.event_name || 'Event'}</h2>
                <p><strong>Date:</strong> ${formatDate(booking.event_date)}${booking.event_time ? ` at ${booking.event_time}` : ''}</p>
                <p><strong>Location:</strong> ${booking.location || 'TBC'}</p>
                ${assignment.tasks_description ? `<p><strong>Your Tasks:</strong> ${assignment.tasks_description}</p>` : ''}
              </div>

              <!-- Add to Calendar Button -->
              <div style="margin: 25px 0;">
                <a href="${calendarUrl}"
                   target="_blank"
                   style="display: inline-block; background: #4285f4; color: #fff; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Add to Google Calendar
                </a>
              </div>

              <div style="background: #f8fafc; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px;">Client Contact</h3>
                <p style="margin: 0;"><strong>${booking.client_name}</strong></p>
                <p style="margin: 5px 0 0 0; color: #4b5563;">${booking.client_phone}</p>
              </div>

              <p style="color: #6b7280; font-size: 14px;">Barrie will be in touch with more details. Thanks!</p>
              ${jobSheetDriveLink ? `<p style="font-size: 11px; color: #94a3b8;"><a href="${jobSheetDriveLink}" style="color: #94a3b8;">Job Sheet</a></p>` : ''}
            </div>
          `,
        });
      }

      return NextResponse.redirect(`${baseUrl}/contractor-response?success=true&action=accepted&event=${encodeURIComponent(booking.event_name || 'Event')}&pay=${assignment.pay_amount}`);
    } else {
      // Declined - notify dad
      if (resend) {
        await resend.emails.send({
          from: 'Accent Productions <notifications@accent-productions.co.nz>',
          to: [businessEmail],
          subject: `Contractor Declined: ${contractor.name} for ${booking.event_name || 'Event'}`,
          html: `
            <h1 style="color: #dc2626;">Contractor Declined</h1>
            <p><strong>${contractor.name}</strong> has declined the job:</p>

            <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h2 style="margin-top: 0;">${booking.event_name || 'Event'}</h2>
              <p><strong>Date:</strong> ${formatDate(booking.event_date)}</p>
              <p><strong>Pay offered:</strong> $${assignment.pay_amount}</p>
            </div>

            <p>You may need to find a replacement contractor.</p>

            <p style="margin: 20px 0;">
              <a href="${baseUrl}/select-contractors?token=${booking.contractor_selection_token || booking.approval_token}"
                 style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Select New Contractor
              </a>
            </p>
          `,
        });
      }

      return NextResponse.redirect(`${baseUrl}/contractor-response?success=true&action=declined`);
    }
  } catch (error) {
    console.error('Error processing contractor response:', error);
    return NextResponse.redirect(`${baseUrl}/contractor-response?error=server_error`);
  }
}
