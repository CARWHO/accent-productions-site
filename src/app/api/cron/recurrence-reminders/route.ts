import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const adminEmail = process.env.ADMIN_EMAIL || 'hello@accent-productions.co.nz';
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

function verifyCronSecret(request: Request): boolean {
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not set - allowing request');
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Cron job to send admin reminders about recurring events
 * Checks for bookings where next_occurrence_date is within recurrence_reminder_days
 */
export async function GET(request: Request) {
  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    console.log('Checking for recurring event reminders...');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Find bookings with next_occurrence_date set and not yet reminded
    // We check if today + reminder_days >= next_occurrence_date
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        quote_number,
        event_name,
        event_date,
        location,
        client_name,
        client_email,
        booking_type,
        next_occurrence_date,
        recurrence_reminder_days,
        recurrence_reminder_sent_at
      `)
      .not('next_occurrence_date', 'is', null);

    if (fetchError) {
      console.error('Error fetching recurring bookings:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Filter bookings that need reminders
    const bookingsToRemind = (bookings || []).filter(booking => {
      if (!booking.next_occurrence_date) return false;

      // Check if already reminded
      if (booking.recurrence_reminder_sent_at) {
        const sentAt = new Date(booking.recurrence_reminder_sent_at);
        const nextOccurrence = new Date(booking.next_occurrence_date);
        // Don't remind again if we already sent for this occurrence
        if (sentAt >= new Date(nextOccurrence.getTime() - 365 * 24 * 60 * 60 * 1000)) {
          return false;
        }
      }

      const reminderDays = booking.recurrence_reminder_days || 30;
      const nextOccurrence = new Date(booking.next_occurrence_date);
      const reminderDate = new Date(nextOccurrence);
      reminderDate.setDate(reminderDate.getDate() - reminderDays);

      // Send reminder if we're at or past the reminder date
      return today >= reminderDate && today < nextOccurrence;
    });

    if (bookingsToRemind.length === 0) {
      console.log('No recurring event reminders needed');
      return NextResponse.json({ success: true, reminders: 0 });
    }

    console.log(`Found ${bookingsToRemind.length} recurring events needing reminders`);

    let remindersSent = 0;

    if (resend) {
      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-NZ', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      };

      for (const booking of bookingsToRemind) {
        const nextDate = new Date(booking.next_occurrence_date);
        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        await resend.emails.send({
          from: 'Accent Productions <notifications@accent-productions.co.nz>',
          to: [adminEmail],
          subject: `Recurring Event Reminder: ${booking.event_name || booking.client_name} - ${daysUntil} days`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; text-align: left;">
              <div style="margin-bottom: 20px;">
                <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
              </div>

              <h2 style="color: #1f2937; margin-bottom: 20px;">Recurring Event Reminder</h2>

              <p style="color: #374151;">A recurring event is coming up and may need attention:</p>

              <div style="background: #f0f9ff; border: 2px solid #0284c7; border-radius: 12px; padding: 24px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #0369a1;">${booking.event_name || 'Event'}</h3>
                <div style="font-size: 15px;">
                  <p style="margin: 8px 0;"><strong>Client:</strong> ${booking.client_name} (${booking.client_email})</p>
                  <p style="margin: 8px 0;"><strong>Original Event:</strong> ${formatDate(booking.event_date)}</p>
                  <p style="margin: 8px 0;"><strong>Expected Next Occurrence:</strong> ${formatDate(booking.next_occurrence_date)}</p>
                  <p style="margin: 8px 0;"><strong>Days Until:</strong> ${daysUntil} days</p>
                  ${booking.location ? `<p style="margin: 8px 0;"><strong>Location:</strong> ${booking.location}</p>` : ''}
                </div>
              </div>

              <p style="color: #374151;">
                <strong>Actions to take:</strong>
              </p>
              <ol style="color: #374151; padding-left: 20px;">
                <li>Contact the client to confirm they want to book again</li>
                <li>If yes, duplicate the event from the admin panel</li>
                <li>Update the quote if pricing has changed</li>
                <li>Send the new quote to the client</li>
              </ol>

              <div style="margin-top: 24px;">
                <a href="${baseUrl}/admin/events"
                   style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  View in Admin Panel
                </a>
              </div>

              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
              <p style="color: #999; font-size: 12px;">
                Quote #${booking.quote_number} | ${booking.booking_type || 'Event'}
              </p>
            </div>
          `,
        });

        // Update the reminder sent timestamp
        await supabase
          .from('bookings')
          .update({ recurrence_reminder_sent_at: new Date().toISOString() })
          .eq('id', booking.id);

        remindersSent++;
        console.log(`Sent recurring reminder for ${booking.quote_number}`);
      }
    }

    return NextResponse.json({
      success: true,
      reminders: remindersSent,
      checked: bookings?.length || 0,
    });

  } catch (error) {
    console.error('Error in recurrence reminders cron:', error);
    return NextResponse.json({
      error: 'Check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
