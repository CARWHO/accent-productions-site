import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { readJobSheetData } from '@/lib/google-sheets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ message: 'Database not configured' }, { status: 500 });
  }

  try {
    // Find booking by contractor_selection_token (this is the token sent after client approval)
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('contractor_selection_token', token)
      .single();

    if (error || !booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Verify booking is client-approved
    if (booking.status !== 'client_approved' && booking.status !== 'contractors_notified') {
      return NextResponse.json({ message: 'Booking not ready for job sheet review' }, { status: 400 });
    }

    // Read job sheet data if available
    let jobSheetData = null;
    if (booking.jobsheet_sheet_id) {
      try {
        jobSheetData = await readJobSheetData(booking.jobsheet_sheet_id);
      } catch (sheetError) {
        console.error('Error reading job sheet:', sheetError);
      }
    }

    // Get tech rider info if available
    let techRiderUrl = null;
    if (booking.tech_rider_file_id) {
      techRiderUrl = `https://drive.google.com/file/d/${booking.tech_rider_file_id}/view`;
    }

    return NextResponse.json({
      booking: {
        id: booking.id,
        quote_number: booking.quote_number,
        event_name: booking.event_name,
        event_date: booking.event_date,
        event_time: booking.event_time,
        location: booking.location,
        client_name: booking.client_name,
        client_email: booking.client_email,
        client_phone: booking.client_phone,
        booking_type: booking.booking_type,
        status: booking.status,
        jobsheet_sheet_id: booking.jobsheet_sheet_id,
        // New fields for Group 2
        call_time: booking.call_time,
        pack_out_time: booking.pack_out_time,
        site_available_from: booking.site_available_from,
        call_out_notes: booking.call_out_notes,
        vehicle_type: booking.vehicle_type,
        vehicle_amount: booking.vehicle_amount,
        band_names: booking.band_names,
        // Group 3 fields
        crew_count: booking.crew_count,
        // Details from inquiry
        details_json: booking.details_json,
      },
      jobSheetData,
      techRiderUrl,
      contractorSelectionToken: token,
    });
  } catch (error) {
    console.error('Error fetching job sheet data:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// POST: Update job sheet fields
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, updates } = body;

    if (!token) {
      return NextResponse.json({ message: 'Missing token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ message: 'Database not configured' }, { status: 500 });
    }

    // Find booking by token
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id')
      .eq('contractor_selection_token', token)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Allowed fields to update
    const allowedFields = [
      'call_time',
      'pack_out_time',
      'site_available_from',
      'call_out_notes',
      'vehicle_type',
      'vehicle_amount',
      'band_names',
      'crew_count',
    ];

    // Filter updates to only allowed fields
    const safeUpdates: Record<string, string | number | null> = {};
    for (const field of allowedFields) {
      if (field in updates) {
        safeUpdates[field] = updates[field] ?? null;
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 });
    }

    // Validate crew count if provided
    if ('crew_count' in safeUpdates && safeUpdates.crew_count !== null) {
      const crewCount = Number(safeUpdates.crew_count);
      if (isNaN(crewCount) || crewCount < 1 || crewCount > 50) {
        return NextResponse.json({ message: 'Crew count must be between 1 and 50' }, { status: 400 });
      }
      safeUpdates.crew_count = crewCount;
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update(safeUpdates)
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.json({ message: 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating job sheet fields:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
