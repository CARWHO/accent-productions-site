import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { copyFile } from '@/lib/google-drive';
import { v4 as uuidv4 } from 'uuid';

function generateQuoteNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${year}-${random}`;
}

/**
 * POST: Duplicate an existing booking
 * - Copies the Google Sheet to a new sheet
 * - Creates a new booking with status=pending
 * - Returns redirect URL to /review-quote page
 */
export async function POST(request: Request) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    const { bookingId } = await request.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    // Get the existing booking
    const { data: original, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Generate new identifiers
    const newId = uuidv4();
    const newQuoteNumber = generateQuoteNumber();
    const newApprovalToken = uuidv4();

    // Copy the Google Sheet if exists
    let newSheetId: string | null = null;
    if (original.quote_sheet_id) {
      const newName = `Quote ${newQuoteNumber} - ${original.event_name || original.client_name}`;
      newSheetId = await copyFile(original.quote_sheet_id, newName);
      if (!newSheetId) {
        console.warn('Failed to copy Google Sheet, proceeding without it');
      }
    }

    // Create new booking with reset status
    const newBooking = {
      id: newId,
      inquiry_id: original.inquiry_id, // Keep reference to original inquiry
      quote_number: newQuoteNumber,
      booking_type: original.booking_type,
      status: 'pending',
      client_name: original.client_name,
      client_email: original.client_email,
      client_phone: original.client_phone,
      event_name: original.event_name,
      event_date: original.event_date,
      event_time: original.event_time,
      location: original.location,
      details_json: original.details_json,
      quote_total: original.quote_total,
      quote_sheet_id: newSheetId,
      approval_token: newApprovalToken,
      crew_count: original.crew_count,
      // Don't copy: quote_drive_file_id, tech_rider_file_id, calendar_event_id
      // Don't copy: client_approved_at, contractors_notified_at, etc.
      // Don't copy: payment fields
      // Set recurrence fields to defaults
      next_occurrence_date: null,
      recurrence_reminder_days: 30,
      recurrence_reminder_sent_at: null,
    };

    const { error: insertError } = await supabase
      .from('bookings')
      .insert(newBooking);

    if (insertError) {
      console.error('Error creating duplicate booking:', insertError);
      return NextResponse.json({ error: 'Failed to create duplicate' }, { status: 500 });
    }

    console.log(`Duplicated booking ${original.quote_number} -> ${newQuoteNumber}`);

    return NextResponse.json({
      success: true,
      newBookingId: newId,
      newQuoteNumber,
      redirectUrl: `/review-quote?token=${newApprovalToken}`,
    });
  } catch (error) {
    console.error('Error in duplicate event API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
