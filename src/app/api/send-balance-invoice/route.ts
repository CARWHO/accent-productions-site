import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    // Get approval by balance payment token
    const { data: approval, error: fetchError } = await supabase
      .from('client_approvals')
      .select(`
        id,
        adjusted_quote_total,
        deposit_amount,
        balance_status,
        balance_payment_token,
        bookings (id, event_name, event_date, quote_number, client_name, client_email, client_phone)
      `)
      .eq('balance_payment_token', token)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 });
    }

    if (approval.balance_status === 'paid') {
      return NextResponse.json({ error: 'Balance already paid' }, { status: 400 });
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

    // Generate a client payment token if not exists
    let clientPaymentToken = approval.balance_payment_token;
    if (!clientPaymentToken) {
      clientPaymentToken = crypto.randomBytes(32).toString('hex');
      await supabase
        .from('client_approvals')
        .update({ balance_payment_token: clientPaymentToken })
        .eq('id', approval.id);
    }

    // Update status to invoiced
    await supabase
      .from('client_approvals')
      .update({ balance_status: 'invoiced' })
      .eq('id', approval.id);

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-NZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    // Send invoice email to client
    if (resend) {
      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [booking.client_email],
        replyTo: businessEmail,
        subject: `Balance Due: $${balance.toFixed(0)} - ${booking.event_name || 'Your Event'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
            <div style="margin-bottom: 20px;">
              <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
            </div>

            <p>Hi ${booking.client_name.split(' ')[0]},</p>
            <p>Thank you for choosing Accent Productions for your event! We hope everything went well.</p>

            <div style="background: #f5f5f4; border: 2px solid #78716c; border-radius: 12px; padding: 24px; margin: 20px 0;">
              <div style="font-size: 14px; color: #57534e; margin-bottom: 8px;">BALANCE DUE</div>
              <div style="font-size: 36px; font-weight: bold; color: #1c1917;">$${balance.toFixed(0)}</div>
            </div>

            <div style="background: #f5f5f4; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0; color: #1c1917;">${booking.event_name || 'Event'}</h3>
              <p style="margin: 0; color: #57534e;">${formatDate(booking.event_date)}</p>
              ${booking.quote_number ? `<p style="margin: 4px 0 0 0; color: #78716c; font-size: 14px;">Quote #${booking.quote_number}</p>` : ''}
            </div>

            <table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">Total Quote</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4; text-align: right; font-weight: bold;">$${total.toFixed(0)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">Deposit Paid</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4; text-align: right;">-$${deposit.toFixed(0)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Balance Due</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px;">$${balance.toFixed(0)}</td>
              </tr>
            </table>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/pay-balance?token=${clientPaymentToken}"
                 style="display: inline-block; background: #1c1917; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Pay Balance
              </a>
            </div>

            <p style="color: #78716c; font-size: 14px; text-align: center;">
              Payment is due within 7 days. Please contact us if you have any questions.
            </p>

            <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 30px 0;" />

            <p style="color: #78716c; font-size: 12px;">
              Accent Productions<br />
              ${businessEmail}
            </p>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error sending balance invoice:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
