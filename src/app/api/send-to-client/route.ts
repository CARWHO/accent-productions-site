import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, adjustedAmount, notes, depositPercent } = body;

    if (!bookingId) {
      return NextResponse.json({ success: false, message: 'Missing booking ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 500 });
    }

    // Fetch booking with related inquiry (for original quote data)
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*, inquiries(quote_data)')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
    }

    // Generate invoice number (INV-YYYY-XXXX format)
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${booking.quote_number?.split('-')[1] || randomUUID().slice(0, 4).toUpperCase()}`;

    // Generate client approval token
    const clientApprovalToken = randomUUID();

    // Calculate totals - adjustedAmount overrides the stored quote_total
    const finalAmount = adjustedAmount || booking.quote_total || 0;

    // Calculate deposit amount from percentage (default 50%)
    const depositPercentValue = depositPercent ?? 50;
    const depositAmount = (finalAmount * depositPercentValue) / 100;

    // Create or update client_approvals record
    const { error: approvalError } = await supabase
      .from('client_approvals')
      .upsert({
        booking_id: bookingId,
        adjusted_quote_total: finalAmount,
        quote_notes: notes || null,
        deposit_amount: depositAmount || null,
        client_approval_token: clientApprovalToken,
        sent_to_client_at: new Date().toISOString(),
        client_email: booking.client_email,
      }, {
        onConflict: 'booking_id'
      });

    if (approvalError) {
      console.error('Error creating client approval:', approvalError);
      return NextResponse.json({ success: false, message: 'Failed to create approval record' }, { status: 500 });
    }

    // Update booking with invoice number
    await supabase
      .from('bookings')
      .update({
        status: 'sent_to_client',
        invoice_number: invoiceNumber,
      })
      .eq('id', bookingId);

    // Send email to client
    if (resend) {
      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-NZ', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      // Generate invoice PDF via edge function
      let invoiceDriveLink: string | null = null;
      if (booking.quote_sheet_id) {
        try {
          const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-pdfs`;
          const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              booking_id: bookingId,
              pdfType: 'invoice',
            }),
          });

          if (response.ok) {
            const result = await response.json();
            invoiceDriveLink = result.driveLink;
            console.log(`Invoice PDF generated via edge function: ${invoiceDriveLink}`);
          } else {
            console.error('Edge function failed:', await response.text());
          }
        } catch (pdfError) {
          console.error('Error calling generate-pdfs edge function:', pdfError);
        }
      } else {
        console.error('No quote_sheet_id - cannot generate invoice PDF');
      }

      // Client approval URL
      const approveUrl = `${baseUrl}/api/client-approve?token=${clientApprovalToken}`;

      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [booking.client_email],
        subject: `Invoice from Accent Productions - ${booking.event_name || 'Your Event'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; text-align: left;">
            <div style="margin-bottom: 24px;">
              <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 100px; width: auto;" />
            </div>

            <h1 style="color: #16a34a; margin-bottom: 10px; text-align: left;">Invoice Ready</h1>
            <p style="color: #666; margin-top: 0; text-align: left;">Invoice #${invoiceNumber}</p>

            <p style="text-align: left;">Hi ${booking.client_name.split(' ')[0]},</p>
            <p style="text-align: left;">Thanks for booking with us! Please review and approve your invoice to confirm the booking.</p>

            <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 25px 0; text-align: left;">
              <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Amount Due</div>
              <div style="font-size: 36px; font-weight: bold; color: #15803d; margin-bottom: 15px;">$${finalAmount.toFixed(2)}</div>
              <div style="border-top: 1px solid #bbf7d0; padding-top: 15px;">
                <div style="margin-bottom: 5px;"><strong>Event:</strong> ${booking.event_name || 'Your Event'}</div>
                <div style="margin-bottom: 5px;"><strong>Date:</strong> ${formatDate(booking.event_date)}</div>
                <div><strong>Location:</strong> ${booking.location || 'TBC'}</div>
              </div>
            </div>

            ${depositAmount > 0 ? `
            <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: left;">
              <div style="font-size: 14px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Deposit Required (${depositPercentValue}%)</div>
              <div style="font-size: 28px; font-weight: bold; color: #b45309;">$${depositAmount.toFixed(2)}</div>
              <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">
                Please pay the deposit to the bank account on the invoice, then click <strong>Approve Quote</strong> below to confirm your booking.
              </p>
            </div>
            ` : ''}

            ${notes ? `
            <div style="background: #e8f4fd; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; text-align: left;">
              <p style="margin: 0;"><strong>Note:</strong></p>
              <p style="margin: 8px 0 0 0;">${notes}</p>
            </div>
            ` : ''}

            <p style="text-align: left; margin-top: 25px;">${depositAmount > 0 ? 'Once you\'ve paid the deposit, click below to confirm your booking:' : 'Click below to confirm your booking:'}</p>

            <div style="margin: 25px 0; text-align: left;">
              <a href="${approveUrl}"
                 style="display: inline-block; background: #16a34a; color: #fff; padding: 18px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px;">
                Approve Quote
              </a>
            </div>

            <p style="color: #666; font-size: 14px; text-align: left; margin-top: 30px;">
              Questions? Reply to this email or call us on 027 602 3869.
            </p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
            <p style="color: #999; font-size: 12px; text-align: left;">
              Accent Productions | Professional Sound & Lighting
            </p>
          </div>
        `,
      });

      console.log(`Sent invoice to client: ${booking.client_email}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice sent to client',
      invoiceNumber,
      clientApprovalId: clientApprovalToken
    });
  } catch (error) {
    console.error('Error sending to client:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
