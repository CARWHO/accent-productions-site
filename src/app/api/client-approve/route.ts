import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalendarEvent } from '@/lib/google-calendar';
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
        `,
      });

      console.log(`Notified business of client approval for booking ${booking.id}`);
    }

    // Redirect client to success page
    return NextResponse.redirect(`${baseUrl}/client-approval?success=true&event=${encodeURIComponent(booking.event_name || 'Event')}`);
  } catch (error) {
    console.error('Error processing client approval:', error);
    return NextResponse.redirect(`${baseUrl}/client-approval?error=server_error`);
  }
}
