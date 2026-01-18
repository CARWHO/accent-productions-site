import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalendarEvent } from '@/lib/google-calendar';
import { shareFileWithLink } from '@/lib/google-drive';
import { randomUUID } from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

// GET: Redirect to approval page (from email link)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/approve?error=missing_token`);
  }

  // Redirect to approval page where client chooses payment method
  return NextResponse.redirect(`${baseUrl}/approve?token=${token}`);
}

// POST: Process approval with payment method
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, skipPayment, paymentMethod } = body;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Missing token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 500 });
    }

    // Find client approval by token
    const { data: approval, error: fetchError } = await supabase
      .from('client_approvals')
      .select('*, bookings(*)')
      .eq('client_approval_token', token)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 404 });
    }

    // Check if already approved
    if (approval.client_approved_at) {
      return NextResponse.json({ success: false, message: 'Already approved' }, { status: 400 });
    }

    const booking = approval.bookings;

    // Determine payment status
    let paymentStatus = 'pending';
    let paidAt = null;

    if (skipPayment) {
      paymentStatus = 'skipped';
    } else if (paymentMethod === 'bank_transfer') {
      paymentStatus = 'awaiting_bank_transfer';
    } else if (paymentMethod === 'poli') {
      paymentStatus = 'paid';
      paidAt = new Date().toISOString();
    }

    // Generate contractor selection token for dad
    const contractorSelectionToken = randomUUID();

    // Create Google Calendar event
    let calendarEventId: string | null = null;
    if (booking.event_date) {
      const calendarTitle = paymentStatus === 'awaiting_bank_transfer'
        ? `${booking.event_name || 'Event'} - AWAITING PAYMENT`
        : `${booking.event_name || 'Event'} - AWAITING CONTRACTORS`;

      calendarEventId = await createCalendarEvent({
        summary: calendarTitle,
        description: `Quote: #${booking.quote_number}\nClient: ${booking.client_name}\nEmail: ${booking.client_email}\nPhone: ${booking.client_phone}\n\nPayment: ${paymentStatus}\nStatus: Client approved, awaiting contractor selection`,
        location: booking.location || undefined,
        startDate: booking.event_date,
        startTime: booking.event_time || undefined,
      });
    }

    // Update client approval
    const { error: updateApprovalError } = await supabase
      .from('client_approvals')
      .update({
        client_approved_at: new Date().toISOString(),
        payment_status: paymentStatus,
        payment_method: skipPayment ? 'none' : paymentMethod || null,
        paid_at: paidAt,
      })
      .eq('id', approval.id);

    if (updateApprovalError) {
      console.error('Error updating approval:', updateApprovalError);
    }

    // Update booking
    const { error: updateBookingError } = await supabase
      .from('bookings')
      .update({
        status: 'client_approved',
        client_approved_at: new Date().toISOString(),
        contractor_selection_token: contractorSelectionToken,
        calendar_event_id: calendarEventId,
      })
      .eq('id', booking.id);

    if (updateBookingError) {
      console.error('Error updating booking:', updateBookingError);
      return NextResponse.json({ success: false, message: 'Update failed' }, { status: 500 });
    }

    // Notify dad with link to select contractors
    if (resend) {
      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-NZ', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      const reviewJobSheetUrl = `${baseUrl}/review-jobsheet?token=${contractorSelectionToken}`;

      // Get quote Drive link for both emails
      let quoteDriveLink: string | null = null;
      if (booking.quote_drive_file_id) {
        quoteDriveLink = await shareFileWithLink(booking.quote_drive_file_id);
      }

      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [businessEmail],
        subject: `Client Approved: ${booking.event_name || 'Event'} - Quote #${booking.quote_number}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
            <div style="margin-bottom: 24px;">
              <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
            </div>

            <h1 style="color: #16a34a; margin: 0 0 20px 0;">Client Approved!</h1>
            <p style="margin: 0 0 20px 0;">Great news! The client has approved the quote.</p>

            <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 20px 0;">
              <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Quote #${booking.quote_number}</div>
              <div style="font-size: 24px; font-weight: bold; color: #15803d; margin-bottom: 15px;">${booking.event_name || 'Event'}</div>
              <div style="border-top: 1px solid #bbf7d0; padding-top: 15px;">
                <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${formatDate(booking.event_date)}</p>
                <p style="margin: 0 0 8px 0;"><strong>Client:</strong> ${booking.client_name}</p>
                ${approval.adjusted_quote_total ? `<p style="margin: 0;"><strong>Amount:</strong> $${approval.adjusted_quote_total}</p>` : ''}
              </div>
            </div>

            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Next step:</strong> Review the job sheet, add call times and notes, then select contractors.</p>
            </div>

            <div style="margin: 30px 0;">
              <a href="${reviewJobSheetUrl}"
                 style="display: inline-block; background: #16a34a; color: #fff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Review Job Sheet
              </a>
            </div>

            <p style="color: #666; font-size: 14px;">
              A calendar event has been created and is awaiting contractor assignment.
            </p>
            ${quoteDriveLink ? `<p style="font-size: 12px; color: #94a3b8;"><a href="${quoteDriveLink}" style="color: #2563eb;">View Quote PDF</a></p>` : ''}

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
            <p style="color: #999; font-size: 12px;">Accent Productions | Professional Sound & Lighting</p>
          </div>
        `,
      });

      console.log(`Notified business of client approval for booking ${booking.id}`);

      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [booking.client_email],
        subject: `Booking Confirmed - ${booking.event_name || 'Your Event'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px;">
            <div style="margin-bottom: 24px;">
              <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 80px; width: auto;" />
            </div>

            <h1 style="color: #16a34a; margin: 0 0 20px 0;">Booking Confirmed!</h1>

            <p>Hi ${booking.client_name.split(' ')[0]},</p>
            <p>Thanks for confirming your booking with us! We're excited to work with you.</p>

            <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 20px 0;">
              <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your Event</div>
              <div style="font-size: 24px; font-weight: bold; color: #15803d; margin-bottom: 15px;">${booking.event_name || 'Your Event'}</div>
              <div style="border-top: 1px solid #bbf7d0; padding-top: 15px;">
                <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${formatDate(booking.event_date)}</p>
                <p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${booking.location || 'TBC'}</p>
                <p style="margin: 0;"><strong>Quote:</strong> #${booking.quote_number}</p>
              </div>
            </div>

            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Important:</strong> We won't assign contractors to your event until we receive the deposit payment. Please ensure payment is made to secure your booking.
              </p>
            </div>

            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0; font-weight: bold; color: #374151;">What happens next?</p>
              <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;">Once we receive your deposit, we'll assign our crew to your event</li>
                <li style="margin-bottom: 8px;">You'll receive a job sheet with all the details closer to the date</li>
                <li>Our team will be in touch if we need any more information</li>
              </ul>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Questions? Reply to this email or call us on 027 602 3869.
            </p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
            <p style="color: #999; font-size: 12px;">
              Accent Productions | Professional Sound & Lighting
            </p>
            ${quoteDriveLink ? `<p style="font-size: 12px;"><a href="${quoteDriveLink}" style="color: #2563eb;">View Quote PDF</a></p>` : ''}
          </div>
        `,
      });

      console.log(`Sent confirmation email to client: ${booking.client_email}`);
    }

    // Return success response (frontend handles navigation)
    return NextResponse.json({ success: true, paymentStatus });
  } catch (error) {
    console.error('Error processing client approval:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
