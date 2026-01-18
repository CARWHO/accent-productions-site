import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

function verifyCronSecret(request: Request): boolean {
  // Allow local dev without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('CRON_SECRET not set - allowing request');
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  try {
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    console.log('Checking for completed events with pending contractor payments...');

    // Find assignments where:
    // - status = 'accepted' (contractor accepted the job)
    // - payment_status = 'pending' (not yet paid)
    // - event_date < today (event has passed)
    const today = new Date().toISOString().split('T')[0];

    const { data: pendingPayments, error: fetchError } = await supabase
      .from('booking_contractor_assignments')
      .select(`
        *,
        contractors (id, name, email),
        bookings (id, event_name, event_date, quote_number, client_name)
      `)
      .eq('status', 'accepted')
      .eq('payment_status', 'pending')
      .lt('bookings.event_date', today);

    if (fetchError) {
      console.error('Error fetching pending payments:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Filter out null bookings (from the join condition)
    const validPayments = pendingPayments?.filter(p => p.bookings !== null) || [];

    if (validPayments.length === 0) {
      console.log('No pending contractor payments found');
      return NextResponse.json({ success: true, pending: 0 });
    }

    console.log(`Found ${validPayments.length} pending contractor payments`);

    // Generate payment tokens for each assignment
    for (const assignment of validPayments) {
      if (!assignment.payment_token) {
        const token = crypto.randomBytes(32).toString('hex');
        await supabase
          .from('booking_contractor_assignments')
          .update({ payment_token: token })
          .eq('id', assignment.id);
        assignment.payment_token = token;
      }
    }

    // Group by booking for cleaner email
    interface BookingGroup {
      booking: { id: string; event_name: string | null; event_date: string; quote_number: string | null };
      contractors: Array<{ name: string; amount: number; token: string }>;
    }

    const byBooking: Record<string, BookingGroup> = {};
    for (const payment of validPayments) {
      const bookingId = payment.bookings.id;
      if (!byBooking[bookingId]) {
        byBooking[bookingId] = {
          booking: payment.bookings,
          contractors: []
        };
      }
      byBooking[bookingId].contractors.push({
        name: payment.contractors.name,
        amount: payment.pay_amount,
        token: payment.payment_token
      });
    }

    // Send email to admin
    if (resend) {
      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-NZ', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      };

      const bookingsHtml = Object.values(byBooking).map(({ booking, contractors }) => {
        const contractorRows = contractors.map(c => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${c.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${c.amount}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
              <a href="${baseUrl}/pay-contractor?token=${c.token}"
                 style="background: #16a34a; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">
                Pay
              </a>
            </td>
          </tr>
        `).join('');

        return `
          <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
            <h3 style="margin: 0 0 8px 0;">${booking.event_name || 'Event'}</h3>
            <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">
              ${formatDate(booking.event_date)} • Quote #${booking.quote_number}
            </p>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #e5e7eb;">
                  <th style="padding: 8px; text-align: left;">Contractor</th>
                  <th style="padding: 8px; text-align: left;">Amount</th>
                  <th style="padding: 8px; text-align: left;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${contractorRows}
              </tbody>
            </table>
          </div>
        `;
      }).join('');

      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [businessEmail],
        subject: `${validPayments.length} Contractor Payment${validPayments.length > 1 ? 's' : ''} Ready`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
            <h1 style="color: #111;">Contractor Payments Due</h1>
            <p>The following events have completed and contractors are awaiting payment:</p>

            ${bookingsHtml}

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              Click "Confirm Paid" after processing each payment.
            </p>
          </div>
        `,
      });

      console.log('Payment reminder email sent to admin');
    }

    // === CHECK CLIENT BALANCES DUE ===
    console.log('Checking for completed events with client balances due...');

    const { data: pendingBalances, error: balanceError } = await supabase
      .from('client_approvals')
      .select(`
        *,
        bookings (id, event_name, event_date, quote_number, client_name, client_email)
      `)
      .not('deposit_amount', 'is', null)
      .eq('balance_status', 'pending')
      .lt('bookings.event_date', today);

    if (balanceError) {
      console.error('Error fetching pending balances:', balanceError);
    }

    // Filter for valid balances (has booking, balance > 0)
    const validBalances = (pendingBalances || []).filter(ca => {
      if (!ca.bookings) return false;
      const total = Number(ca.adjusted_quote_total) || 0;
      const deposit = Number(ca.deposit_amount) || 0;
      return total > deposit;
    });

    if (validBalances.length > 0) {
      console.log(`Found ${validBalances.length} pending client balances`);

      // Generate balance payment tokens
      for (const approval of validBalances) {
        if (!approval.balance_payment_token) {
          const token = crypto.randomBytes(32).toString('hex');
          await supabase
            .from('client_approvals')
            .update({ balance_payment_token: token })
            .eq('id', approval.id);
          approval.balance_payment_token = token;
        }
      }

      // Send email to admin about client balances
      if (resend) {
        const formatDate = (dateStr: string) => {
          return new Date(dateStr).toLocaleDateString('en-NZ', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
        };

        const balanceRows = validBalances.map(ca => {
          const booking = ca.bookings as { id: string; event_name: string | null; event_date: string; quote_number: string | null; client_name: string; client_email: string };
          const total = Number(ca.adjusted_quote_total) || 0;
          const deposit = Number(ca.deposit_amount) || 0;
          const balance = total - deposit;

          return `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                <strong>${booking.event_name || 'Event'}</strong><br>
                <span style="color: #6b7280; font-size: 12px;">${formatDate(booking.event_date)}</span>
              </td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${booking.client_name}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">$${balance.toFixed(0)}</td>
              <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">
                <a href="${baseUrl}/collect-balance?token=${ca.balance_payment_token}"
                   style="background: #1c1917; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">
                  Collect
                </a>
              </td>
            </tr>
          `;
        }).join('');

        await resend.emails.send({
          from: 'Accent Productions <notifications@accent-productions.co.nz>',
          to: [businessEmail],
          subject: `Client Balances Due: ${validBalances.length} event${validBalances.length > 1 ? 's' : ''}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
              <h1 style="color: #111;">Client Balances Due</h1>
              <p>The following events have completed with outstanding client balances:</p>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background: #e5e7eb;">
                    <th style="padding: 8px; text-align: left;">Event</th>
                    <th style="padding: 8px; text-align: left;">Client</th>
                    <th style="padding: 8px; text-align: left;">Balance</th>
                    <th style="padding: 8px; text-align: left;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${balanceRows}
                </tbody>
              </table>

              <p style="color: #6b7280; font-size: 14px;">
                Click "Collect" to send an invoice to the client.
              </p>
            </div>
          `,
        });

        console.log('Client balance reminder email sent to admin');
      }
    } else {
      console.log('No pending client balances found');
    }

    return NextResponse.json({
      success: true,
      contractorPayments: validPayments.length,
      clientBalances: validBalances.length,
      emailSent: !!resend
    });

  } catch (error) {
    console.error('Error in payment check cron:', error);
    return NextResponse.json({
      error: 'Check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
