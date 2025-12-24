import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createCalendarEvent } from '@/lib/google-calendar';
import { randomUUID } from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/approve-quote?error=missing_token`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.redirect(`${baseUrl}/approve-quote?error=server_error`);
  }

  try {
    // Find booking by approval token
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (fetchError || !booking) {
      return NextResponse.redirect(`${baseUrl}/approve-quote?error=invalid_token`);
    }

    // Check if already approved
    if (booking.status !== 'pending') {
      return NextResponse.redirect(`${baseUrl}/approve-quote?error=already_processed&status=${booking.status}`);
    }

    // Generate contractor token for accept links
    const contractorToken = randomUUID();

    // Create calendar event
    let calendarEventId: string | null = null;
    if (booking.event_date) {
      calendarEventId = await createCalendarEvent({
        summary: `${booking.event_name || 'Event'} - AWAITING CONTRACTOR`,
        description: `Quote: #${booking.quote_number}\nClient: ${booking.client_name}\nEmail: ${booking.client_email}\nPhone: ${booking.client_phone}\n\nStatus: Awaiting contractor assignment`,
        location: booking.location || undefined,
        startDate: booking.event_date,
        startTime: booking.event_time || undefined,
      });
    }

    // Update booking status
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        contractor_token: contractorToken,
        calendar_event_id: calendarEventId,
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.redirect(`${baseUrl}/approve-quote?error=update_failed`);
    }

    // Get all active contractors
    const { data: contractors, error: contractorsError } = await supabase
      .from('contractors')
      .select('*')
      .eq('active', true);

    if (contractorsError) {
      console.error('Error fetching contractors:', contractorsError);
    }

    // Send emails to all contractors
    if (resend && contractors && contractors.length > 0) {
      const acceptUrl = `${baseUrl}/api/accept-job?token=${contractorToken}`;

      const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-NZ', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      };

      for (const contractor of contractors) {
        try {
          await resend.emails.send({
            from: 'Accent Productions <notifications@accent-productions.co.nz>',
            to: [contractor.email],
            subject: `Job Available: ${booking.event_name || 'Event'} - ${formatDate(booking.event_date)}`,
            html: `
              <h1>New Job Available</h1>
              <p>Hi ${contractor.name},</p>
              <p>A new job is available and you're invited to accept it:</p>

              <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin-top: 0;">${booking.event_name || 'Event'}</h2>
                <p><strong>Date:</strong> ${formatDate(booking.event_date)}</p>
                <p><strong>Time:</strong> ${booking.event_time || 'TBC'}</p>
                <p><strong>Location:</strong> ${booking.location || 'TBC'}</p>
                ${booking.job_description ? `<p><strong>Details:</strong> ${booking.job_description}</p>` : ''}
              </div>

              <p style="background: #fff3cd; padding: 12px; border-radius: 4px; border-left: 4px solid #ffc107;">
                <strong>First to accept gets the job!</strong>
              </p>

              <p style="margin: 30px 0;">
                <a href="${acceptUrl}&contractor=${contractor.id}"
                   style="display: inline-block; background: #000; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                  Accept This Job
                </a>
              </p>

              <p style="color: #666; font-size: 14px;">
                If you can't take this job, no action needed - another contractor will be assigned.
              </p>
            `,
          });
          console.log(`Sent job notification to ${contractor.email}`);
        } catch (emailError) {
          console.error(`Error sending email to ${contractor.email}:`, emailError);
        }
      }

      // Update booking to mark contractors notified
      await supabase
        .from('bookings')
        .update({
          status: 'sent_to_contractors',
          contractors_notified_at: new Date().toISOString(),
        })
        .eq('id', booking.id);
    }

    // Redirect to success page with calendar link
    const calendarUrl = calendarEventId
      ? `https://calendar.google.com/calendar/event?eid=${Buffer.from(`${calendarEventId} ${process.env.GOOGLE_CALENDAR_ID || 'primary'}`).toString('base64').replace(/=/g, '')}`
      : '';
    return NextResponse.redirect(`${baseUrl}/approve-quote?success=true&quote=${booking.quote_number}&contractors=${contractors?.length || 0}${calendarUrl ? `&calendar=${encodeURIComponent(calendarUrl)}` : ''}`);
  } catch (error) {
    console.error('Error processing approval:', error);
    return NextResponse.redirect(`${baseUrl}/approve-quote?error=server_error`);
  }
}
