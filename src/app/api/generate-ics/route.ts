import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { buildICSFromBooking } from '@/lib/ics-generator';

/**
 * GET: Generate and download an ICS calendar file for a booking
 * Query params:
 *   - token: contractor_selection_token or contractor_token
 *   - booking_id: alternative to token for direct lookup
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const bookingId = searchParams.get('booking_id');

  if (!token && !bookingId) {
    return NextResponse.json({ error: 'Missing token or booking_id' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    let booking;

    if (bookingId) {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      booking = data;
    } else if (token) {
      // Try contractor_selection_token first, then contractor_token
      let result = await supabase
        .from('bookings')
        .select('*')
        .eq('contractor_selection_token', token)
        .single();

      if (result.error || !result.data) {
        result = await supabase
          .from('bookings')
          .select('*')
          .eq('contractor_token', token)
          .single();
      }

      if (result.error || !result.data) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      booking = result.data;
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Generate the ICS content
    const icsContent = buildICSFromBooking({
      event_name: booking.event_name,
      event_date: booking.event_date,
      event_time: booking.event_time,
      location: booking.location,
      client_name: booking.client_name,
      client_phone: booking.client_phone,
      call_time: booking.call_time,
      pack_out_time: booking.pack_out_time,
      call_out_notes: booking.call_out_notes,
      band_names: booking.band_names,
      quote_number: booking.quote_number,
    });

    // Generate filename
    const eventName = (booking.event_name || 'Event').replace(/[^a-zA-Z0-9]/g, '-');
    const filename = `${eventName}-${booking.quote_number || 'event'}.ics`;

    // Return as downloadable ICS file
    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating ICS:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
