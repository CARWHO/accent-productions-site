import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deleteFile } from '@/lib/google-drive';
import { deleteCalendarEvent } from '@/lib/google-calendar';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE: Hard delete an event/booking and all associated data
 * - Deletes Google Drive files (quote, tech rider, contractor jobsheets)
 * - Deletes Google Calendar event
 * - Cascades to booking_contractor_assignments and client_approvals
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Get the booking with file IDs
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        quote_number,
        quote_drive_file_id,
        tech_rider_file_id,
        calendar_event_id
      `)
      .eq('id', id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Get contractor assignments with their jobsheet file IDs
    const { data: assignments } = await supabase
      .from('booking_contractor_assignments')
      .select('id, jobsheet_drive_file_id')
      .eq('booking_id', id);

    // Delete Google Drive files (non-blocking - continue even if some fail)
    const deletePromises: Promise<boolean>[] = [];

    if (booking.quote_drive_file_id) {
      deletePromises.push(deleteFile(booking.quote_drive_file_id));
    }

    if (booking.tech_rider_file_id) {
      deletePromises.push(deleteFile(booking.tech_rider_file_id));
    }

    if (assignments) {
      for (const assignment of assignments) {
        if (assignment.jobsheet_drive_file_id) {
          deletePromises.push(deleteFile(assignment.jobsheet_drive_file_id));
        }
      }
    }

    // Delete calendar event
    if (booking.calendar_event_id) {
      deletePromises.push(deleteCalendarEvent(booking.calendar_event_id));
    }

    // Wait for all external deletions (but don't fail the request if they fail)
    await Promise.allSettled(deletePromises);

    // Delete the booking (cascade will handle assignments and client_approvals)
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting booking:', deleteError);
      return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 });
    }

    console.log(`Deleted booking ${booking.quote_number} (ID: ${id})`);

    return NextResponse.json({
      success: true,
      message: `Deleted booking ${booking.quote_number}`,
    });
  } catch (error) {
    console.error('Error in delete event API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * PATCH: Update booking fields (recurrence settings, etc.)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = [
      'next_occurrence_date',
      'recurrence_reminder_days',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating booking:', error);
      return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
    }

    return NextResponse.json({ success: true, booking });
  } catch (error) {
    console.error('Error in patch event API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
