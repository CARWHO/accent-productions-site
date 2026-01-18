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
    const { data: approval, error } = await supabase
      .from('client_approvals')
      .select(`
        id,
        adjusted_quote_total,
        deposit_amount,
        balance_status,
        bookings (id, event_name, event_date, quote_number, client_name, client_email, client_phone)
      `)
      .eq('balance_payment_token', token)
      .single();

    if (error || !approval) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    const booking = approval.bookings as unknown as {
      id: string;
      event_name: string | null;
      event_date: string;
      quote_number: string | null;
      client_name: string;
      client_email: string;
      client_phone: string | null;
    };

    const total = Number(approval.adjusted_quote_total) || 0;
    const deposit = Number(approval.deposit_amount) || 0;
    const balance = total - deposit;

    return NextResponse.json({
      id: approval.id,
      total,
      deposit,
      balance,
      balanceStatus: approval.balance_status,
      client: {
        name: booking.client_name,
        email: booking.client_email,
        phone: booking.client_phone,
      },
      event: {
        name: booking.event_name,
        date: booking.event_date,
        quoteNumber: booking.quote_number,
      },
    });
  } catch (err) {
    console.error('Error fetching balance details:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
