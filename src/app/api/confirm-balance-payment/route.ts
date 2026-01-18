import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const reference = searchParams.get('reference');

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/result?type=error&error=missing_token`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.redirect(`${baseUrl}/result?type=error&error=server_error`);
  }

  try {
    // Find approval by balance payment token
    const { data: approval, error: fetchError } = await supabase
      .from('client_approvals')
      .select(`
        *,
        bookings (id, event_name, event_date, quote_number, client_name, client_email)
      `)
      .eq('balance_payment_token', token)
      .single();

    if (fetchError || !approval) {
      return NextResponse.redirect(`${baseUrl}/result?type=error&error=invalid_token`);
    }

    if (approval.balance_status === 'paid') {
      return NextResponse.redirect(`${baseUrl}/result?type=already_done&message=${encodeURIComponent('This balance has already been paid.')}`);
    }

    const booking = approval.bookings as unknown as {
      id: string;
      event_name: string | null;
      event_date: string;
      quote_number: string | null;
      client_name: string;
      client_email: string;
    };

    const total = Number(approval.adjusted_quote_total) || 0;
    const deposit = Number(approval.deposit_amount) || 0;
    const balance = total - deposit;

    // Update approval status
    const { error: updateError } = await supabase
      .from('client_approvals')
      .update({
        balance_status: 'paid',
        balance_paid_at: new Date().toISOString(),
        balance_reference: reference || null,
      })
      .eq('id', approval.id);

    if (updateError) {
      console.error('Error updating balance status:', updateError);
      return NextResponse.redirect(`${baseUrl}/result?type=error&error=update_failed`);
    }

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-NZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    // Send confirmation email to client
    if (resend) {
      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [booking.client_email],
        replyTo: businessEmail,
        subject: `Payment Received - Thank You!`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
            <div style="margin-bottom: 20px;">
              <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
            </div>

            <div style="background: #f5f5f4; border: 2px solid #78716c; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
              <div style="font-size: 18px; color: #1c1917; font-weight: bold; margin-bottom: 10px;">PAYMENT CONFIRMED</div>
              <div style="font-size: 32px; font-weight: bold; color: #1c1917;">$${balance.toFixed(0)}</div>
            </div>

            <p>Hi ${booking.client_name.split(' ')[0]},</p>
            <p>Thank you for your payment! We've received the balance for your event.</p>

            <div style="background: #f5f5f4; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0;">${booking.event_name || 'Event'}</h3>
              <p style="margin: 0; color: #57534e;">${formatDate(booking.event_date)}</p>
            </div>

            ${reference ? `
            <div style="background: #f5f5f4; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #78716c;">Payment Reference</p>
              <p style="margin: 0; font-weight: bold; font-family: monospace;">${reference}</p>
            </div>
            ` : ''}

            <p style="color: #57534e;">
              Your account is now fully paid. Thank you for choosing Accent Productions!
            </p>

            <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 30px 0;" />

            <p style="color: #78716c; font-size: 12px;">
              Accent Productions<br />
              ${businessEmail}
            </p>
          </div>
        `,
      });

      // Notify admin
      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [businessEmail],
        subject: `Balance Paid: $${balance.toFixed(0)} - ${booking.client_name}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
            <h1 style="color: #111;">Balance Payment Received</h1>

            <div style="background: #f5f5f4; border: 2px solid #78716c; border-radius: 12px; padding: 24px; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; color: #1c1917;">$${balance.toFixed(0)}</div>
            </div>

            <table style="width: 100%; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; color: #78716c;">Client</td>
                <td style="padding: 8px 0; font-weight: bold;">${booking.client_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #78716c;">Event</td>
                <td style="padding: 8px 0;">${booking.event_name || 'Event'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #78716c;">Date</td>
                <td style="padding: 8px 0;">${formatDate(booking.event_date)}</td>
              </tr>
              ${reference ? `
              <tr>
                <td style="padding: 8px 0; color: #78716c;">Reference</td>
                <td style="padding: 8px 0; font-family: monospace;">${reference}</td>
              </tr>
              ` : ''}
            </table>

            <p style="color: #57534e; font-size: 14px;">
              Please verify this payment has been received in your bank account.
            </p>
          </div>
        `,
      });
    }

    return NextResponse.redirect(
      `${baseUrl}/result?type=balance_paid&amount=${balance.toFixed(0)}`
    );

  } catch (error) {
    console.error('Error confirming balance payment:', error);
    return NextResponse.redirect(`${baseUrl}/result?type=error&error=server_error`);
  }
}
