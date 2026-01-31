import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Query by assignment ID
    const { data: assignment, error } = await supabase
      .from('booking_contractor_assignments')
      .select(`
        id,
        pay_amount,
        payment_status,
        contractors (id, name, email, bank_account),
        bookings (id, event_name, event_date, quote_number)
      `)
      .eq('id', token)
      .single();

    if (error || !assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const contractor = assignment.contractors as unknown as { id: string; name: string; email: string; bank_account: string | null };
    const booking = assignment.bookings as unknown as { id: string; event_name: string | null; event_date: string; quote_number: string | null };

    return NextResponse.json({
      id: assignment.id,
      amount: assignment.pay_amount,
      paymentStatus: assignment.payment_status,
      contractor: {
        name: contractor.name,
        email: contractor.email,
        bankAccount: contractor.bank_account,
      },
      event: {
        name: booking.event_name,
        date: booking.event_date,
        quoteNumber: booking.quote_number,
      },
    });
  } catch (err) {
    console.error('Error fetching payment details:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
