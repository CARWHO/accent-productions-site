import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { updateCalendarEvent } from '@/lib/google-calendar';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const contractorId = searchParams.get('contractor');

  if (!token || !contractorId) {
    return NextResponse.redirect(`${baseUrl}/accept-job?error=missing_params`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.redirect(`${baseUrl}/accept-job?error=server_error`);
  }

  try {
    // Find booking by contractor token
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('contractor_token', token)
      .single();

    if (fetchError || !booking) {
      return NextResponse.redirect(`${baseUrl}/accept-job?error=invalid_token`);
    }

    // Check if already assigned
    if (booking.status === 'assigned' || booking.assigned_contractor_id) {
      // Check if this contractor was the one assigned
      if (booking.assigned_contractor_id === contractorId) {
        return NextResponse.redirect(`${baseUrl}/accept-job?status=already_yours`);
      }
      return NextResponse.redirect(`${baseUrl}/accept-job?error=already_taken`);
    }

    // Get contractor details
    const { data: contractor, error: contractorError } = await supabase
      .from('contractors')
      .select('*')
      .eq('id', contractorId)
      .single();

    if (contractorError || !contractor) {
      return NextResponse.redirect(`${baseUrl}/accept-job?error=invalid_contractor`);
    }

    // Assign contractor (first-click-wins with atomic update)
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'assigned',
        assigned_contractor_id: contractorId,
        assigned_at: new Date().toISOString(),
      })
      .eq('id', booking.id)
      .eq('status', 'sent_to_contractors') // Only update if not already assigned
      .select()
      .single();

    if (updateError || !updated) {
      // Race condition - someone else got it first
      return NextResponse.redirect(`${baseUrl}/accept-job?error=already_taken`);
    }

    // Update calendar event with contractor name
    if (booking.calendar_event_id) {
      await updateCalendarEvent(booking.calendar_event_id, {
        summary: `${booking.event_name || 'Event'} - ${contractor.name}`,
        description: `Quote: #${booking.quote_number}\nClient: ${booking.client_name}\nEmail: ${booking.client_email}\nPhone: ${booking.client_phone}\n\nContractor: ${contractor.name}\nPhone: ${contractor.phone || 'N/A'}\nEmail: ${contractor.email}`,
      });
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
      // Handle various time formats
      const cleanTime = timeStr.trim().toLowerCase();
      // If already formatted nicely (e.g., "6pm", "6:00 PM"), return as-is but capitalized
      if (/^\d{1,2}(:\d{2})?\s*(am|pm)$/i.test(cleanTime)) {
        return timeStr.trim();
      }
      // If 24-hour format like "18:00", convert to 12-hour
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

    // Build "Add to Google Calendar" URL for contractor
    const buildAddToCalendarUrl = () => {
      if (!booking.event_date) return null;

      const eventTitle = encodeURIComponent(`${booking.event_name || 'Event'} - Accent Productions`);
      const location = encodeURIComponent(booking.location || '');
      const details = encodeURIComponent(
        `Client: ${booking.client_name}\nPhone: ${booking.client_phone}\n\nBooked via Accent Productions`
      );

      // Parse date and time
      const startDate = new Date(booking.event_date);
      if (booking.event_time) {
        const timeMatch = booking.event_time.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
        if (timeMatch) {
          let hours = parseInt(timeMatch[1], 10);
          const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
          const meridiem = timeMatch[3]?.toLowerCase();
          if (meridiem === 'pm' && hours < 12) hours += 12;
          if (meridiem === 'am' && hours === 12) hours = 0;
          startDate.setHours(hours, mins, 0, 0);
        }
      } else {
        startDate.setHours(9, 0, 0, 0); // Default to 9am
      }

      // End time: 4 hours later
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 4);

      // Format as YYYYMMDDTHHMMSS (local time)
      const formatDateTime = (d: Date) => {
        return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      };

      const dates = `${formatDateTime(startDate)}/${formatDateTime(endDate)}`;

      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${dates}&details=${details}&location=${location}`;
    };

    const addToCalendarUrl = buildAddToCalendarUrl();

    // Notify business owner
    if (resend) {
      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [businessEmail],
        subject: `Contractor Assigned: ${contractor.name} for ${booking.event_name || 'Event'}`,
        html: `
          <h1>Contractor Assigned</h1>
          <p>Great news! A contractor has accepted the job:</p>

          <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h2 style="margin-top: 0; color: #155724;">Contractor: ${contractor.name}</h2>
            <p><strong>Email:</strong> ${contractor.email}</p>
            <p><strong>Phone:</strong> ${contractor.phone || 'N/A'}</p>
          </div>

          <h3>Job Details</h3>
          <p><strong>Event:</strong> ${booking.event_name || 'Event'}</p>
          <p><strong>Quote:</strong> #${booking.quote_number}</p>
          <p><strong>Date:</strong> ${formatDate(booking.event_date)}${formatTime(booking.event_time) ? ` at ${formatTime(booking.event_time)}` : ''}</p>
          <p><strong>Location:</strong> ${booking.location || 'TBC'}</p>

          <h3>Client</h3>
          <p><strong>Name:</strong> ${booking.client_name}</p>
          <p><strong>Email:</strong> ${booking.client_email}</p>
          <p><strong>Phone:</strong> ${booking.client_phone}</p>

          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            The calendar event has been updated with the contractor's details.
          </p>
        `,
      });

      // Notify other contractors that job is taken
      const { data: otherContractors } = await supabase
        .from('contractors')
        .select('*')
        .eq('active', true)
        .neq('id', contractorId);

      if (otherContractors && otherContractors.length > 0) {
        for (const other of otherContractors) {
          try {
            await resend.emails.send({
              from: 'Accent Productions <notifications@accent-productions.co.nz>',
              to: [other.email],
              subject: `Job Filled: ${booking.event_name || 'Event'} - ${formatDate(booking.event_date)}`,
              html: `
                <div style="text-align: center; margin-bottom: 24px;">
                  <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 60px; width: auto;" />
                </div>
                <p>Hi ${other.name},</p>
                <p>The following job has been filled by another contractor:</p>
                <p><strong>${booking.event_name || 'Event'}</strong> on ${formatDate(booking.event_date)}</p>
                <p style="color: #666;">Thanks for your interest - we'll notify you of future opportunities!</p>
              `,
            });
          } catch (e) {
            console.error(`Error notifying ${other.email}:`, e);
          }
        }
      }

      // Send confirmation to assigned contractor
      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [contractor.email],
        subject: `Confirmed: You're booked for ${booking.event_name || 'Event'}`,
        html: `
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 60px; width: auto;" />
          </div>
          <h1>You're Booked!</h1>
          <p>Hi ${contractor.name},</p>
          <p>You've successfully accepted this job:</p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">${booking.event_name || 'Event'}</h2>
            <p><strong>Date:</strong> ${formatDate(booking.event_date)}${formatTime(booking.event_time) ? ` at ${formatTime(booking.event_time)}` : ''}</p>
            <p><strong>Location:</strong> ${booking.location || 'TBC'}</p>
          </div>

          ${addToCalendarUrl ? `
          <p style="margin: 20px 0;">
            <a href="${addToCalendarUrl}"
               style="display: inline-block; background: #4285f4; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              + Add to My Google Calendar
            </a>
          </p>
          ` : ''}

          <h3>Client Contact</h3>
          <p><strong>Name:</strong> ${booking.client_name}</p>
          <p><strong>Phone:</strong> ${booking.client_phone}</p>

          <p>Barrie will be in touch with more details. Thanks!</p>
        `,
      });
    }

    // Redirect to success page
    return NextResponse.redirect(`${baseUrl}/accept-job?success=true&event=${encodeURIComponent(booking.event_name || 'Event')}`);
  } catch (error) {
    console.error('Error processing job acceptance:', error);
    return NextResponse.redirect(`${baseUrl}/accept-job?error=server_error`);
  }
}
