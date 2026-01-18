import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * GET: Fetch pending payments - both contractor payments and client balances
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Fetch unpaid contractor assignments (completed jobs, not paid)
    const { data: contractorPayments, error: contractorError } = await supabase
      .from('booking_contractor_assignments')
      .select(`
        id,
        status,
        payment_status,
        pay_amount,
        contractors (id, name, email),
        bookings (
          id,
          event_name,
          event_date,
          quote_number,
          client_name
        )
      `)
      .eq('status', 'accepted')
      .or('payment_status.is.null,payment_status.eq.pending')
      .order('bookings(event_date)', { ascending: true });

    if (contractorError) {
      console.error('Error fetching contractor payments:', contractorError);
    }

    // Filter to only past events
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const unpaidContractors = (contractorPayments || [])
      .filter(a => {
        const booking = a.bookings as unknown as { event_date: string } | null;
        return booking && booking.event_date < todayStr;
      })
      .map(a => {
        const contractor = a.contractors as unknown as { id: string; name: string; email: string } | null;
        const booking = a.bookings as unknown as {
          id: string;
          event_name: string | null;
          event_date: string;
          quote_number: string | null;
          client_name: string;
        } | null;

        return {
          id: a.id,
          type: 'contractor' as const,
          contractor: contractor,
          booking: booking,
          amount: a.pay_amount,
          paymentStatus: a.payment_status || 'pending',
          payUrl: `/pay-contractor?token=${a.id}`,
        };
      });

    // Fetch pending client balance payments
    const { data: clientBalances, error: clientError } = await supabase
      .from('client_approvals')
      .select(`
        id,
        payment_status,
        balance_status,
        bookings (
          id,
          event_name,
          event_date,
          quote_number,
          client_name,
          client_email,
          quote_total
        )
      `)
      .eq('payment_status', 'deposit_paid')
      .or('balance_status.is.null,balance_status.eq.pending');

    if (clientError) {
      console.error('Error fetching client balances:', clientError);
    }

    const pendingBalances = (clientBalances || [])
      .filter(c => c.bookings !== null)
      .map(c => {
        const booking = c.bookings as unknown as {
          id: string;
          event_name: string | null;
          event_date: string;
          quote_number: string | null;
          client_name: string;
          client_email: string;
          quote_total: number | null;
        };

        // Estimate balance as quote_total - deposit (50% typically)
        const estimatedBalance = booking.quote_total
          ? Math.round(booking.quote_total * 0.5)
          : null;

        return {
          id: c.id,
          type: 'balance' as const,
          client: {
            name: booking.client_name,
            email: booking.client_email,
          },
          booking: {
            id: booking.id,
            event_name: booking.event_name,
            event_date: booking.event_date,
            quote_number: booking.quote_number,
          },
          amount: estimatedBalance,
          paymentStatus: c.balance_status || 'pending',
          collectUrl: `/collect-balance?token=${booking.id}`,
        };
      });

    // Combine and sort by event date
    const allPayments = [
      ...unpaidContractors.map(p => ({
        ...p,
        sortDate: (p.booking as { event_date: string } | null)?.event_date || '',
      })),
      ...pendingBalances.map(p => ({
        ...p,
        sortDate: p.booking?.event_date || '',
      })),
    ].sort((a, b) => a.sortDate.localeCompare(b.sortDate));

    return NextResponse.json({
      payments: allPayments,
      contractorCount: unpaidContractors.length,
      balanceCount: pendingBalances.length,
      total: allPayments.length,
    });
  } catch (error) {
    console.error('Error in pending payments API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
