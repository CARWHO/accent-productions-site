import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET: Fetch upcoming contractor reminders for the next 30 days
 * Returns assignments with their reminder dates and last sent timestamps
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const todayStr = today.toISOString().split('T')[0];
    const futureStr = thirtyDaysFromNow.toISOString().split('T')[0];

    // Fetch assignments for upcoming events (next 30 days)
    const { data: assignments, error: fetchError } = await supabase
      .from('booking_contractor_assignments')
      .select(`
        id,
        status,
        reminder_date,
        last_reminder_sent_at,
        contractors (id, name, email),
        bookings (
          id,
          event_name,
          event_date,
          event_time,
          location,
          quote_number,
          client_name
        )
      `)
      .eq('status', 'accepted')
      .gte('bookings.event_date', todayStr)
      .lte('bookings.event_date', futureStr)
      .order('bookings(event_date)', { ascending: true });

    if (fetchError) {
      console.error('Error fetching upcoming reminders:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Filter out null bookings and calculate reminder status
    const validAssignments = (assignments || [])
      .filter(a => a.bookings !== null && a.contractors !== null)
      .map(a => {
        const booking = a.bookings as unknown as {
          id: string;
          event_name: string | null;
          event_date: string;
          event_time: string | null;
          location: string | null;
          quote_number: string | null;
          client_name: string;
        };

        // Calculate default reminder date (14 days before event)
        const eventDate = new Date(booking.event_date);
        const defaultReminderDate = new Date(eventDate);
        defaultReminderDate.setDate(defaultReminderDate.getDate() - 14);

        const reminderDate = a.reminder_date
          ? new Date(a.reminder_date)
          : defaultReminderDate;

        const daysUntilEvent = Math.ceil(
          (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        const daysUntilReminder = Math.ceil(
          (reminderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if reminder should be sent today
        const reminderDue = today >= reminderDate && !a.last_reminder_sent_at;

        // Check if reminder was recently sent
        const reminderSent = a.last_reminder_sent_at !== null;

        return {
          id: a.id,
          contractor: a.contractors,
          booking: {
            ...booking,
            daysUntil: daysUntilEvent,
          },
          reminderDate: reminderDate.toISOString().split('T')[0],
          daysUntilReminder,
          reminderDue,
          reminderSent,
          lastReminderSentAt: a.last_reminder_sent_at,
        };
      })
      .sort((a, b) => {
        // Sort by reminder urgency: due first, then by days until reminder
        if (a.reminderDue && !b.reminderDue) return -1;
        if (!a.reminderDue && b.reminderDue) return 1;
        return a.daysUntilReminder - b.daysUntilReminder;
      });

    return NextResponse.json({
      reminders: validAssignments,
      total: validAssignments.length,
    });
  } catch (error) {
    console.error('Error in upcoming reminders API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
