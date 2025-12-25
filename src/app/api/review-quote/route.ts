import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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
    // Find booking by approval token (the original token from inquiry)
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (error || !booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Check if already sent to client or beyond
    if (['sent_to_client', 'client_approved', 'selecting_contractors', 'contractors_notified', 'fully_assigned'].includes(booking.status)) {
      return NextResponse.json({
        message: 'This quote has already been processed',
        status: booking.status
      }, { status: 400 });
    }

    return NextResponse.json({ booking });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
