import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalendarEvent } from '@/lib/google-calendar';
import { randomUUID } from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/approve-quote?error=missing_token`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.redirect(`${baseUrl}/approve-quote?error=server_error`);
  }

  try {
    // Find booking by approval token
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (fetchError || !booking) {
      return NextResponse.redirect(`${baseUrl}/approve-quote?error=invalid_token`);
    }

    // Check if already approved
    if (booking.status !== 'pending') {
      return NextResponse.redirect(`${baseUrl}/approve-quote?error=already_processed&status=${booking.status}`);
    }

    // Generate contractor token for accept links
    const contractorToken = randomUUID();

    // Create calendar event
    let calendarEventId: string | null = null;
    if (booking.event_date) {
      calendarEventId = await createCalendarEvent({
        summary: `${booking.event_name || 'Event'} - AWAITING CONTRACTOR`,
        description: `Quote: #${booking.quote_number}\nClient: ${booking.client_name}\nEmail: ${booking.client_email}\nPhone: ${booking.client_phone}\n\nStatus: Awaiting contractor assignment`,
        location: booking.location || undefined,
        startDate: booking.event_date,
        startTime: booking.event_time || undefined,
      });
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        contractor_token: contractorToken,
        calendar_event_id: calendarEventId,
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.redirect(`${baseUrl}/approve-quote?error=update_failed`);
    }

    // Get all active contractors
    const { data: contractors, error: contractorsError } = await supabase
      .from('contractors')
      .select('*')
      .eq('active', true);

    if (contractorsError) {
      console.error('Error fetching contractors:', contractorsError);
    }

    // Send emails to all contractors
    if (resend && contractors && contractors.length > 0) {
      const acceptUrl = `${baseUrl}/api/accept-job?token=${contractorToken}`;

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

      // Generate rich details HTML based on booking type
      const generateDetailsHtml = () => {
        const details = booking.details_json as Record<string, unknown> | null;
        if (!details) return '';

        if (details.type === 'backline') {
          const equipment = details.equipment as Array<{ name: string; quantity: number }> | null;
          const equipmentHtml = equipment && equipment.length > 0
            ? `<p><strong>Equipment:</strong></p>
               <ul style="margin: 8px 0; padding-left: 20px;">
                 ${equipment.map(e => `<li>${e.quantity}x ${e.name}</li>`).join('')}
               </ul>`
            : '';

          const period = details.rentalPeriod as { start: string; end: string } | null;
          const periodHtml = period
            ? `<p><strong>Rental Period:</strong> ${formatDate(period.start)} → ${formatDate(period.end)}</p>`
            : '';

          const deliveryHtml = details.deliveryMethod === 'delivery'
            ? `<p><strong>Delivery to:</strong> ${details.deliveryAddress || 'TBC'}</p>`
            : `<p><strong>Collection:</strong> Customer pickup</p>`;

          const otherHtml = details.otherEquipment
            ? `<p><strong>Other requests:</strong> ${details.otherEquipment}</p>`
            : '';

          const notesHtml = details.additionalNotes
            ? `<p><strong>Notes:</strong> ${details.additionalNotes}</p>`
            : '';

          return `${equipmentHtml}${periodHtml}${deliveryHtml}${otherHtml}${notesHtml}`;
        }

        if (details.type === 'fullsystem') {
          const packageLabels: Record<string, string> = {
            small: 'Small (10-50 people)',
            medium: 'Medium (50-200 people)',
            large: 'Large (200-1000 people)',
          };

          const packageHtml = details.package
            ? `<p><strong>Package:</strong> ${packageLabels[details.package as string] || details.package}</p>`
            : '';

          const eventTypeHtml = details.eventType
            ? `<p><strong>Event Type:</strong> ${details.eventType}</p>`
            : '';

          const attendanceHtml = details.attendance
            ? `<p><strong>Attendance:</strong> ${details.attendance}</p>`
            : '';

          const setupHtml = details.setupTime
            ? `<p><strong>Setup/Packout:</strong> ${details.setupTime}</p>`
            : '';

          const contentReqs = details.contentRequirements as string[] | null;
          const contentHtml = contentReqs && contentReqs.length > 0
            ? `<p><strong>Requirements:</strong> ${contentReqs.join(', ')}</p>`
            : '';

          const bandHtml = details.bandNames
            ? `<p><strong>Band(s):</strong> ${details.bandNames}</p>`
            : '';

          const venue = details.venue as Record<string, unknown> | null;
          const venueHtml = venue ? `
            ${venue.indoorOutdoor ? `<p><strong>Setting:</strong> ${venue.indoorOutdoor}</p>` : ''}
            ${venue.hasStage ? `<p><strong>Stage:</strong> Yes${venue.stageDetails ? ` - ${venue.stageDetails}` : ''}</p>` : ''}
            ${venue.powerAccess ? `<p><strong>Power:</strong> ${venue.powerAccess}</p>` : ''}
          ` : '';

          const notesHtml = details.additionalInfo || details.details
            ? `<p><strong>Notes:</strong> ${details.additionalInfo || details.details}</p>`
            : '';

          return `${packageHtml}${eventTypeHtml}${attendanceHtml}${setupHtml}${contentHtml}${bandHtml}${venueHtml}${notesHtml}`;
        }

        return '';
      };

      const detailsHtml = generateDetailsHtml();

      for (const contractor of contractors) {
        try {
          await resend.emails.send({
            from: 'Accent Productions <notifications@accent-productions.co.nz>',
            to: [contractor.email],
            subject: `Job Available: ${booking.event_name || 'Event'} - ${formatDate(booking.event_date)}`,
            html: `
              <div style="text-align: left; margin-bottom: 24px;">
                <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 120px; width: auto;" />
              </div>
              <h1>New Job Available</h1>
              <p>Hi ${contractor.name},</p>
              <p>A new job is available and you're invited to accept it:</p>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin-top: 0;">${booking.event_name || 'Event'}</h2>
                <p><strong>Date:</strong> ${formatDate(booking.event_date)}${formatTime(booking.event_time) ? ` at ${formatTime(booking.event_time)}` : ''}</p>
                <p><strong>Location:</strong> ${booking.location || 'TBC'}</p>
                ${detailsHtml}
              </div>

              <div style="background: #e8f4fd; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
                <p style="margin: 0;"><strong>Client:</strong> ${booking.client_name}</p>
                <p style="margin: 8px 0 0 0;"><strong>Phone:</strong> ${booking.client_phone}</p>
              </div>

              <p style="background: #fff3cd; padding: 12px; border-radius: 4px; border-left: 4px solid #ffc107;">
                <strong>First to accept gets the job!</strong>
              </p>

              <p style="margin: 30px 0;">
                <a href="${acceptUrl}&contractor=${contractor.id}"
                   style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Accept This Job
                </a>
              </p>

              <p style="color: #666; font-size: 14px;">
                If you can't take this job, no action needed - another contractor will be assigned.
              </p>
            `,
          });
          console.log(`Sent job notification to ${contractor.email}`);
        } catch (emailError) {
          console.error(`Error sending email to ${contractor.email}:`, emailError);
        }
      }

      // Update booking to mark contractors notified
      await supabase
        .from('bookings')
        .update({
          status: 'sent_to_contractors',
          contractors_notified_at: new Date().toISOString(),
        })
        .eq('id', booking.id);
    }

    // Redirect to success page with calendar link
    const calendarUrl = calendarEventId
      ? `https://calendar.google.com/calendar/event?eid=${Buffer.from(`${calendarEventId} ${process.env.GOOGLE_CALENDAR_ID || 'primary'}`).toString('base64').replace(/=/g, '')}`
      : '';
    return NextResponse.redirect(`${baseUrl}/approve-quote?success=true&quote=${booking.quote_number}&contractors=${contractors?.length || 0}${calendarUrl ? `&calendar=${encodeURIComponent(calendarUrl)}` : ''}`);
  } catch (error) {
    console.error('Error processing approval:', error);
    return NextResponse.redirect(`${baseUrl}/approve-quote?error=server_error`);
  }
}
