import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

/**
 * POST: Force send a reminder email to a contractor
 * Body: { assignmentId: string }
 */
export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const { assignmentId } = await request.json();

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
    }

    // Fetch the assignment with contractor and booking details
    const { data: assignment, error: fetchError } = await supabase
      .from('booking_contractor_assignments')
      .select(`
        id,
        status,
        contractors (id, name, email),
        bookings (
          id,
          event_name,
          event_date,
          event_time,
          location,
          quote_number,
          client_name,
          call_time,
          pack_out_time,
          call_out_notes,
          band_names
        )
      `)
      .eq('id', assignmentId)
      .single();

    if (fetchError || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const contractor = assignment.contractors as unknown as { id: string; name: string; email: string } | null;
    const booking = assignment.bookings as unknown as {
      id: string;
      event_name: string | null;
      event_date: string;
      event_time: string | null;
      location: string | null;
      quote_number: string | null;
      client_name: string;
      call_time: string | null;
      pack_out_time: string | null;
      call_out_notes: string | null;
      band_names: string | null;
    } | null;

    if (!contractor || !booking) {
      return NextResponse.json({ error: 'Invalid assignment data' }, { status: 400 });
    }

    if (!resend) {
      return NextResponse.json({ error: 'Email not configured' }, { status: 500 });
    }

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-NZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    const formatTime = (timeStr: string | null): string | null => {
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

    // Calculate days until event
    const eventDate = new Date(booking.event_date);
    const today = new Date();
    const daysUntil = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Build time display
    let timeInfo = '';
    if (booking.call_time) {
      timeInfo = `<strong style="color: #dc2626;">Call Time: ${formatTime(booking.call_time)}</strong>`;
    }
    if (booking.event_time) {
      timeInfo += timeInfo ? ` | Show: ${formatTime(booking.event_time)}` : `Show: ${formatTime(booking.event_time)}`;
    }
    if (booking.pack_out_time) {
      timeInfo += timeInfo ? ` | Pack-out: ${formatTime(booking.pack_out_time)}` : `Pack-out: ${formatTime(booking.pack_out_time)}`;
    }

    const bandNamesHtml = booking.band_names
      ? `<p><strong>Performing:</strong> ${booking.band_names}</p>`
      : '';

    const callOutNotesHtml = booking.call_out_notes
      ? `<div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 15px; margin: 15px 0;">
          <strong>Notes:</strong> ${booking.call_out_notes}
        </div>`
      : '';

    await resend.emails.send({
      from: 'Accent Productions <notifications@accent-productions.co.nz>',
      to: [contractor.email],
      subject: `Reminder: ${booking.event_name || 'Event'} - ${daysUntil} days away`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; text-align: left;">
          <div style="margin-bottom: 20px;">
            <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
          </div>

          <p style="color: #374151;">Hi ${contractor.name.split(' ')[0]},</p>

          <p style="color: #374151;">Just a reminder about your upcoming job:</p>

          <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 20px 0;">
            <h2 style="margin: 0 0 15px 0; color: #15803d;">${booking.event_name || 'Event'}</h2>
            <div style="font-size: 15px;">
              <p style="margin: 8px 0;"><strong>Date:</strong> ${formatDate(booking.event_date)} (${daysUntil} days away)</p>
              ${timeInfo ? `<p style="margin: 8px 0;">${timeInfo}</p>` : ''}
              <p style="margin: 8px 0;"><strong>Location:</strong> ${booking.location || 'TBC'}</p>
            </div>
          </div>

          ${bandNamesHtml}
          ${callOutNotesHtml}

          <div style="background: #f8fafc; border-radius: 8px; padding: 12px 15px; margin: 20px 0; font-size: 14px;">
            <strong>Client:</strong> ${booking.client_name}
          </div>

          <p style="color: #374151; margin-top: 20px;">
            If you have any questions or need to discuss anything about this job, please get in touch.
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
          <p style="color: #999; font-size: 12px;">
            Accent Productions | Professional Sound & Lighting
          </p>
        </div>
      `,
    });

    // Update the last reminder sent timestamp
    await supabase
      .from('booking_contractor_assignments')
      .update({ last_reminder_sent_at: new Date().toISOString() })
      .eq('id', assignmentId);

    console.log(`Sent manual reminder to ${contractor.name} for ${booking.event_name}`);

    return NextResponse.json({
      success: true,
      message: `Reminder sent to ${contractor.name}`,
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
