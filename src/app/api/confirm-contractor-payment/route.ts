import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { processContractorPayment } from '@/lib/stripe-payments';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

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
    // Find assignment by payment token
    const { data: assignment, error: fetchError } = await supabase
      .from('booking_contractor_assignments')
      .select(`
        *,
        contractors (id, name, email),
        bookings (id, event_name, event_date, quote_number)
      `)
      .eq('payment_token', token)
      .single();

    if (fetchError || !assignment) {
      return NextResponse.redirect(`${baseUrl}/result?type=error&error=invalid_token`);
    }

    if (assignment.payment_status === 'paid') {
      return NextResponse.redirect(`${baseUrl}/result?type=already_done&message=${encodeURIComponent('Payment to ' + assignment.contractors.name + ' was already confirmed.')}`);
    }

    // Process payment via Stripe (stub for now)
    const paymentResult = await processContractorPayment({
      contractorId: assignment.contractors.id,
      contractorName: assignment.contractors.name,
      contractorEmail: assignment.contractors.email,
      amount: Number(assignment.pay_amount),
      description: `Payment for ${assignment.bookings.event_name || 'Event'} - Quote #${assignment.bookings.quote_number}`,
    });

    if (!paymentResult.success) {
      console.error('Payment failed:', paymentResult.error);
      return NextResponse.redirect(`${baseUrl}/result?type=error&error=payment_failed`);
    }

    // Update assignment status
    const { error: updateError } = await supabase
      .from('booking_contractor_assignments')
      .update({
        payment_status: 'paid',
        payment_confirmed_at: new Date().toISOString(),
        payment_reference: reference || null,
      })
      .eq('id', assignment.id);

    if (updateError) {
      console.error('Error updating payment status:', updateError);
      return NextResponse.redirect(`${baseUrl}/result?type=error&error=update_failed`);
    }

    // Notify contractor
    if (resend) {
      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-NZ', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [assignment.contractors.email],
        subject: `Payment Confirmed: $${assignment.pay_amount}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
            <div style="margin-bottom: 20px;">
              <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
            </div>

            <div style="background: #f5f5f4; border: 2px solid #78716c; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
              <div style="font-size: 18px; color: #1c1917; font-weight: bold; margin-bottom: 10px;">PAYMENT SENT</div>
              <div style="font-size: 32px; font-weight: bold; color: #1c1917;">$${assignment.pay_amount}</div>
            </div>

            <p>Hi ${assignment.contractors.name.split(' ')[0]},</p>
            <p>Your payment for the following job has been processed:</p>

            <div style="background: #f5f5f4; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin: 0 0 8px 0;">${assignment.bookings.event_name || 'Event'}</h3>
              <p style="margin: 0; color: #57534e;">${formatDate(assignment.bookings.event_date)}</p>
            </div>

            ${reference ? `
            <div style="background: #f5f5f4; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #78716c;">Payment Reference</p>
              <p style="margin: 0; font-weight: bold; font-family: monospace;">${reference}</p>
            </div>
            ` : ''}

            <p style="color: #57534e; font-size: 14px;">
              Payment should arrive in your account within 1-2 business days.
            </p>

            <p>Thanks for your great work!</p>
          </div>
        `,
      });
    }

    return NextResponse.redirect(
      `${baseUrl}/result?type=payment_confirmed&name=${encodeURIComponent(assignment.contractors.name)}&amount=${assignment.pay_amount}`
    );

  } catch (error) {
    console.error('Error confirming payment:', error);
    return NextResponse.redirect(`${baseUrl}/result?type=error&error=server_error`);
  }
}
