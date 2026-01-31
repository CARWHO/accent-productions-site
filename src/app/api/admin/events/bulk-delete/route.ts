import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { deleteFile } from '@/lib/google-drive';
import { deleteCalendarEvent } from '@/lib/google-calendar';

/**
 * POST: Bulk delete multiple events/bookings and all associated data
 * Body: { ids: string[] }
 */
export async function POST(request: Request) {
  try {
    const { ids } = await request.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Array of booking IDs is required' }, { status: 400 });
    }

    // Limit to 100 at a time to prevent timeouts
    if (ids.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 bookings can be deleted at once' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get all bookings with file IDs
    const { data: bookings, error: fetchError } = await supabase
      .from('bookings')
      .select(`
        id,
        quote_number,
        quote_drive_file_id,
        calendar_event_id
      `)
      .in('id', ids);

    if (fetchError) {
      console.error('Error fetching bookings for bulk delete:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ error: 'No bookings found with the provided IDs' }, { status: 404 });
    }

    // Get all contractor assignments with their jobsheet file IDs
    const { data: assignments } = await supabase
      .from('booking_contractor_assignments')
      .select('id, booking_id, jobsheet_drive_file_id')
      .in('booking_id', ids);

    // Collect all file deletion promises
    const deletePromises: Promise<boolean>[] = [];

    for (const booking of bookings) {
      if (booking.quote_drive_file_id) {
        deletePromises.push(deleteFile(booking.quote_drive_file_id));
      }
      if (booking.calendar_event_id) {
        deletePromises.push(deleteCalendarEvent(booking.calendar_event_id));
      }
    }

    if (assignments) {
      for (const assignment of assignments) {
        if (assignment.jobsheet_drive_file_id) {
          deletePromises.push(deleteFile(assignment.jobsheet_drive_file_id));
        }
      }
    }

    // Wait for all external deletions (but don't fail if some fail)
    await Promise.allSettled(deletePromises);

    // Delete all bookings (cascade will handle assignments and client_approvals)
    const { error: deleteError } = await supabase
      .from('bookings')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('Error bulk deleting bookings:', deleteError);
      return NextResponse.json({ error: 'Failed to delete bookings' }, { status: 500 });
    }

    const deletedQuoteNumbers = bookings.map(b => b.quote_number).join(', ');
    console.log(`Bulk deleted ${bookings.length} bookings: ${deletedQuoteNumbers}`);

    return NextResponse.json({
      success: true,
      deleted: bookings.length,
      message: `Deleted ${bookings.length} booking(s)`,
    });
  } catch (error) {
    console.error('Error in bulk delete API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
