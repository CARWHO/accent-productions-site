import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalendarEvent } from '@/lib/google-calendar';
import { shareFileWithLink } from '@/lib/google-drive';
import { randomUUID } from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const businessEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/client-approval?error=missing_token`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.redirect(`${baseUrl}/client-approval?error=server_error`);
  }

  try {
    // Find client approval by token
    const { data: approval, error: fetchError } = await supabase
      .from('client_approvals')
      .select('*, bookings(*)')
      .eq('client_approval_token', token)
      .single();

    if (fetchError || !approval) {
      return NextResponse.redirect(`${baseUrl}/client-approval?error=invalid_token`);
    }

    // Check if already approved
    if (approval.client_approved_at) {
      return NextResponse.redirect(`${baseUrl}/client-approval?error=already_approved`);
    }

    const booking = approval.bookings;

    // Generate contractor selection token for dad
    const contractorSelectionToken = randomUUID();

    // Create Google Calendar event
    let calendarEventId: string | null = null;
    if (booking.event_date) {
      calendarEventId = await createCalendarEvent({
        summary: `${booking.event_name || 'Event'} - AWAITING CONTRACTORS`,
        description: `Quote: #${booking.quote_number}\nClient: ${booking.client_name}\nEmail: ${booking.client_email}\nPhone: ${booking.client_phone}\n\nStatus: Client approved, awaiting contractor selection`,
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
      return NextResponse.redirect(`${baseUrl}/client-approval?error=update_failed`);
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

      const selectContractorsUrl = `${baseUrl}/select-contractors?token=${contractorSelectionToken}`;

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
          <h1 style="color: #16a34a;">Client Approved!</h1>
          <p>Great news! The client has approved the quote.</p>

          <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h2 style="margin-top: 0; color: #155724;">${booking.event_name || 'Event'}</h2>
            <p><strong>Quote:</strong> #${booking.quote_number}</p>
            <p><strong>Date:</strong> ${formatDate(booking.event_date)}</p>
            <p><strong>Client:</strong> ${booking.client_name}</p>
            ${approval.adjusted_quote_total ? `<p><strong>Amount:</strong> $${approval.adjusted_quote_total}</p>` : ''}
          </div>

          <p>Next step: Select which contractors to assign to this job and set their pay rates.</p>

          <p style="margin: 30px 0;">
            <a href="${selectContractorsUrl}"
               style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Select Contractors
            </a>
          </p>

          <p style="color: #666; font-size: 14px;">
            A calendar event has been created and is awaiting contractor assignment.
          </p>
          ${quoteDriveLink ? `<p style="font-size: 11px; color: #94a3b8;"><a href="${quoteDriveLink}" style="color: #94a3b8;">Quote PDF</a></p>` : ''}
        `,
      });

      console.log(`Notified business of client approval for booking ${booking.id}`);

      await resend.emails.send({
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [booking.client_email],
        subject: `Booking Confirmed - ${booking.event_name || 'Your Event'}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; text-align: left;">
            <div style="margin-bottom: 24px;">
              <img src="${baseUrl}/images/logoblack.png" alt="Accent Productions" style="height: 100px; width: auto;" />
            </div>

            <h1 style="color: #16a34a; margin-bottom: 10px; text-align: left;">Booking Confirmed!</h1>

            <p style="text-align: left;">Hi ${booking.client_name.split(' ')[0]},</p>
            <p style="text-align: left;">Thanks for confirming your booking with us! We're excited to work with you.</p>

            <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: 12px; padding: 24px; margin: 25px 0; text-align: left;">
              <div style="font-size: 14px; color: #166534; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your Event</div>
              <div style="font-size: 24px; font-weight: bold; color: #15803d; margin-bottom: 15px;">${booking.event_name || 'Your Event'}</div>
              <div style="border-top: 1px solid #bbf7d0; padding-top: 15px;">
                <div style="margin-bottom: 5px;"><strong>Date:</strong> ${formatDate(booking.event_date)}</div>
                <div style="margin-bottom: 5px;"><strong>Location:</strong> ${booking.location || 'TBC'}</div>
                <div><strong>Quote:</strong> #${booking.quote_number}</div>
              </div>
            </div>

            <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: left;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>Important:</strong> We won't assign contractors to your event until we receive the deposit payment. Please ensure payment is made to secure your booking.
              </p>
            </div>

            <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #374151;">What happens next?</h3>
              <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
                <li style="margin-bottom: 8px;">Once we receive your deposit, we'll assign our crew to your event</li>
                <li style="margin-bottom: 8px;">You'll receive a job sheet with all the details closer to the date</li>
                <li>Our team will be in touch if we need any more information</li>
              </ul>
            </div>

            <p style="color: #666; font-size: 14px; text-align: left; margin-top: 30px;">
              Questions? Reply to this email or call us on 027 602 3869.
            </p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;" />
            <p style="color: #999; font-size: 12px; text-align: left;">
              Accent Productions | Professional Sound & Lighting
            </p>
            ${quoteDriveLink ? `<p style="font-size: 11px; color: #94a3b8;"><a href="${quoteDriveLink}" style="color: #94a3b8;">Quote PDF</a></p>` : ''}
          </div>
        `,
      });

      console.log(`Sent confirmation email to client: ${booking.client_email}`);
    }

    // Redirect client to success page
    return NextResponse.redirect(`${baseUrl}/client-approval?success=true&event=${encodeURIComponent(booking.event_name || 'Event')}`);
  } catch (error) {
    console.error('Error processing client approval:', error);
    return NextResponse.redirect(`${baseUrl}/client-approval?error=server_error`);
  }
}
