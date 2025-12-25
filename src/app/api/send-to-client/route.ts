import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, adjustedAmount, notes } = body;

    if (!bookingId) {
      return NextResponse.json({ success: false, message: 'Missing booking ID' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 500 });
    }

    // Fetch booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ success: false, message: 'Booking not found' }, { status: 404 });
    }

    // Generate client approval token
    const clientApprovalToken = randomUUID();

    // Create or update client_approvals record
    const { error: approvalError } = await supabase
      .from('client_approvals')
      .upsert({
        booking_id: bookingId,
        adjusted_quote_total: adjustedAmount || null,
        quote_notes: notes || null,
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

    // Update booking status
    await supabase
      .from('bookings')
      .update({ status: 'sent_to_client' })
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

      const approveUrl = `${baseUrl}/api/client-approve?token=${clientApprovalToken}`;

      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [booking.client_email],
        subject: `Quote from Accent Productions - ${booking.event_name || 'Your Event'}`,
        html: `
          <div style="text-align: left; margin-bottom: 24px;">
            <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 120px; width: auto;" />
          </div>

          <h1>Your Quote is Ready</h1>
          <p>Hi ${booking.client_name},</p>
          <p>Thank you for your inquiry! Here are your event details:</p>

          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0;">${booking.event_name || 'Your Event'}</h2>
            <p><strong>Date:</strong> ${formatDate(booking.event_date)}</p>
            <p><strong>Location:</strong> ${booking.location || 'TBC'}</p>
            ${adjustedAmount ? `<p style="font-size: 18px;"><strong>Quote Total:</strong> $${adjustedAmount.toFixed(2)}</p>` : ''}
          </div>

          ${notes ? `
          <div style="background: #e8f4fd; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
            <p style="margin: 0;"><strong>Note from Accent Productions:</strong></p>
            <p style="margin: 8px 0 0 0;">${notes}</p>
          </div>
          ` : ''}

          <p>Please review and approve this quote to confirm your booking:</p>

          <p style="margin: 30px 0;">
            <a href="${approveUrl}"
               style="display: inline-block; background: #16a34a; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              ✓ Approve Quote
            </a>
          </p>

          <p style="color: #666; font-size: 14px;">
            If you have any questions, please reply to this email or call us.
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
          <p style="color: #999; font-size: 12px;">
            Accent Productions | Professional Sound & Lighting
          </p>
        `,
      });

      console.log(`Sent quote to client: ${booking.client_email}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Quote sent to client',
      clientApprovalId: clientApprovalToken
    });
  } catch (error) {
    console.error('Error sending to client:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
