import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateSoundQuote, SoundQuoteInput } from '@/lib/gemini-sound-quote';
import { generateSoundQuotePDF } from '@/lib/pdf-sound-quote';
import { uploadQuoteToDrive } from '@/lib/google-drive';
import { randomUUID } from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const baseEmail = process.env.BUSINESS_EMAIL || 'hello@accent-productions.co.nz';
const businessEmail = baseEmail.replace('@', '+fullevent@');
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Save to Supabase
    const supabaseAdmin = getSupabaseAdmin();
    let inquiryId: string | null = null;

    if (supabaseAdmin) {
      const { data: inquiryData, error } = await supabaseAdmin
        .from('inquiries')
        .insert({
          event_type: body.eventType,
          organization: body.organization,
          event_name: body.eventName,
          event_date: body.eventDate,
          event_time: body.eventTime,
          setup_time: body.setupTime,
          attendance: body.attendance,
          location: body.location,
          venue_contact: body.venueContact,
          content: body.content,
          indoor_outdoor: body.indoorOutdoor,
          power_access: body.powerAccess,
          stage_provider: body.stageProvider,
          details: body.details,
          contact_name: body.contactName,
          contact_email: body.contactEmail,
          contact_phone: body.contactPhone,
          status: 'new'
        })
        .select('id')
        .single();

      if (error) {
        console.error('Supabase error:', error);
      } else {
        inquiryId = inquiryData?.id || null;
      }
    } else {
      console.warn('Supabase admin client not initialized');
    }

    // 2. Generate quote and PDF (only for small, medium, large packages)
    let pdfBuffer: Buffer | null = null;
    let quoteNumber = '';
    let driveFileId: string | null = null;

    // Check if this is a sound system inquiry with a valid package
    const validPackages = ['small', 'medium', 'large'];
    if (body.package && validPackages.includes(body.package)) {
      try {
        const quoteInput: SoundQuoteInput = {
          package: body.package,
          eventType: body.eventType,
          eventName: body.eventName,
          organization: body.organization,
          eventDate: body.eventDate,
          eventTime: body.eventTime,
          setupTime: body.setupTime,
          attendance: body.attendance,
          playbackFromDevice: body.playbackFromDevice,
          hasLiveMusic: body.hasLiveMusic,
          needsMic: body.needsMic,
          hasDJ: body.hasDJ,
          hasBand: body.hasBand,
          bandCount: body.bandCount,
          bandNames: body.bandNames,
          bandSetup: body.bandSetup,
          needsDJTable: body.needsDJTable,
          needsCDJs: body.needsCDJs,
          cdjType: body.cdjType,
          hasSpeeches: body.hasSpeeches,
          needsWirelessMic: body.needsWirelessMic,
          needsLectern: body.needsLectern,
          needsAmbientMusic: body.needsAmbientMusic,
          additionalInfo: body.additionalInfo,
          location: body.location,
          venueContact: body.venueContact,
          indoorOutdoor: body.indoorOutdoor,
          wetWeatherPlan: body.wetWeatherPlan,
          needsGenerator: body.needsGenerator,
          powerAccess: body.powerAccess,
          hasStage: body.hasStage,
          stageDetails: body.stageDetails,
          contactName: body.contactName,
          contactEmail: body.contactEmail,
          contactPhone: body.contactPhone,
          details: body.details
        };

        const quote = await generateSoundQuote(quoteInput);
        quoteNumber = quote.quoteNumber;

        // Generate PDF
        pdfBuffer = await generateSoundQuotePDF(
          quote,
          body.contactName,
          body.contactEmail,
          body.contactPhone,
          body.organization
        );

        console.log(`Sound quote ${quoteNumber} generated successfully`);

        // Upload to Google Drive
        if (pdfBuffer) {
          driveFileId = await uploadQuoteToDrive(pdfBuffer, `Quote-${quoteNumber}.pdf`, 'fullsystem');
        }
      } catch (quoteError) {
        console.error('Error generating sound quote:', quoteError);
        // Continue without quote - email will still be sent
      }
    }

    // 2b. Create booking record for contractor scheduling
    let approvalToken: string | null = null;
    if (supabaseAdmin && quoteNumber) {
      approvalToken = randomUUID();

      // Build content requirements list
      const contentRequirements: string[] = [];
      if (body.playbackFromDevice) contentRequirements.push('Playback from device');
      if (body.hasLiveMusic) contentRequirements.push('Live music');
      if (body.needsMic) contentRequirements.push('Microphone required');
      if (body.hasDJ) contentRequirements.push('DJ');
      if (body.hasBand) contentRequirements.push(`Live band(s)${body.bandCount ? ` (${body.bandCount})` : ''}`);
      if (body.hasSpeeches) contentRequirements.push('Speeches/presentations');
      if (body.needsWirelessMic) contentRequirements.push('Wireless mic');
      if (body.needsLectern) contentRequirements.push('Lectern');

      // Build rich details for contractor emails
      const detailsJson = {
        type: 'fullsystem',
        package: body.package || null,
        eventType: body.eventType || null,
        organization: body.organization || null,
        attendance: body.attendance || null,
        setupTime: body.setupTime || null,
        contentRequirements,
        bandNames: body.bandNames || null,
        bandSetup: body.bandSetup || null,
        venue: {
          location: body.location || null,
          venueContact: body.venueContact || null,
          indoorOutdoor: body.indoorOutdoor || null,
          powerAccess: body.powerAccess || null,
          hasStage: body.hasStage || false,
          stageDetails: body.stageDetails || null,
        },
        additionalInfo: body.additionalInfo || null,
        details: body.details || null,
      };

      const { error: bookingError } = await supabaseAdmin
        .from('bookings')
        .insert({
          inquiry_id: inquiryId,
          quote_number: quoteNumber,
          booking_type: 'fullsystem',
          status: 'pending',
          event_date: body.eventDate || null,
          event_time: body.eventTime || null,
          location: body.location || null,
          event_name: body.eventName || null,
          job_description: body.details || null,
          client_name: body.contactName,
          client_email: body.contactEmail,
          client_phone: body.contactPhone,
          approval_token: approvalToken,
          details_json: detailsJson,
          quote_drive_file_id: driveFileId,
        });

      if (bookingError) {
        console.error('Error creating booking:', bookingError);
        approvalToken = null; // Don't show button if booking failed
      }
    }

    // 3. Send email notification with PDF attachment if available
    if (resend) {
      // Build content summary for small events
      const contentSummary: string[] = [];
      if (body.playbackFromDevice) contentSummary.push('Playback from device');
      if (body.hasLiveMusic) contentSummary.push('Live music');
      if (body.needsMic) contentSummary.push('Microphone required');
      if (body.hasDJ) contentSummary.push('DJ');
      if (body.hasBand) contentSummary.push('Live band(s)');
      if (body.hasSpeeches) contentSummary.push('Speeches/presentations');

      const packageLabels: Record<string, string> = {
        small: 'Small Event (10-50 people)',
        medium: 'Medium Event (50-200 people)',
        large: 'Large Event (200-1000 people)',
        extra_large: 'Extra-Large Event (1000+ people)'
      };

      const emailOptions: {
        from: string;
        to: string[];
        subject: string;
        html: string;
        attachments?: { filename: string; content: Buffer }[];
      } = {
        from: 'Accent Productions <notifications@accent-productions.co.nz>',
        to: [businessEmail],
        subject: `Sound System Inquiry from ${body.contactName}${quoteNumber ? ` - Quote ${quoteNumber}` : ''}`,
        html: `
          <h1>New Sound System Hire Inquiry</h1>
          ${quoteNumber ? `<p><strong>Quote Number:</strong> ${quoteNumber}</p>` : ''}
          <hr />

          <h2>Package Selected</h2>
          <p><strong>Package:</strong> ${body.package ? packageLabels[body.package] || body.package : 'Not selected'}</p>

          <hr />

          <h2>Event Details</h2>
          <p><strong>Event Type:</strong> ${body.eventType || 'N/A'}</p>
          <p><strong>Event Name:</strong> ${body.eventName || 'N/A'}</p>
          <p><strong>Organization:</strong> ${body.organization || 'N/A'}</p>
          <p><strong>Date:</strong> ${body.eventDate || 'N/A'}</p>
          <p><strong>Time:</strong> ${body.eventTime || 'N/A'}</p>
          <p><strong>Setup/Packout:</strong> ${body.setupTime || 'N/A'}</p>
          <p><strong>Attendance:</strong> ${body.attendance || 'N/A'}</p>

          <hr />

          <h2>Content Requirements</h2>
          <p>${contentSummary.length > 0 ? contentSummary.join(', ') : 'No specific content requirements'}</p>
          ${body.additionalInfo ? `<p><strong>Additional Info:</strong> ${body.additionalInfo}</p>` : ''}

          <hr />

          <h2>Venue Details</h2>
          <p><strong>Location:</strong> ${body.location || 'N/A'}</p>
          <p><strong>Venue Contact:</strong> ${body.venueContact || 'N/A'}</p>
          <p><strong>Indoor/Outdoor:</strong> ${body.indoorOutdoor || 'N/A'}</p>
          ${body.indoorOutdoor === 'Outdoor' ? `
            <p><strong>Power Access:</strong> ${body.powerAccess || 'N/A'}</p>
            <p><strong>Wet Weather Plan:</strong> ${body.wetWeatherPlan || 'N/A'}</p>
            <p><strong>Generator Needed:</strong> ${body.needsGenerator ? 'Yes' : 'No'}</p>
          ` : ''}
          <p><strong>Stage Available:</strong> ${body.hasStage ? 'Yes' : 'No'}</p>
          ${body.stageDetails ? `<p><strong>Stage Details:</strong> ${body.stageDetails}</p>` : ''}

          <hr />

          <h2>Contact Information</h2>
          <p><strong>Name:</strong> ${body.contactName}</p>
          <p><strong>Email:</strong> ${body.contactEmail}</p>
          <p><strong>Phone:</strong> ${body.contactPhone}</p>
          ${body.details ? `<p><strong>Additional Details:</strong> ${body.details}</p>` : ''}

          ${pdfBuffer ? '<p><em>Quote PDF attached</em></p>' : '<p><em>Quote PDF not generated (extra-large package or generation failed)</em></p>'}

          ${approvalToken ? `
          <hr />
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7; text-align: center;">
            <p style="margin: 0 0 15px 0; font-size: 14px; color: #0369a1;">
              Review the quote and send to client for approval:
            </p>
            <a href="${baseUrl}/review-quote?token=${approvalToken}"
               style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
              Review Quote
            </a>
          </div>
          ` : ''}
        `,
      };

      // Add PDF attachment if generated successfully
      if (pdfBuffer) {
        emailOptions.attachments = [
          {
            filename: `Quote-${quoteNumber}.pdf`,
            content: pdfBuffer
          }
        ];
      }

      await resend.emails.send(emailOptions);
    } else {
      console.warn('Resend API key missing, skipping email notification');
    }

    console.log('Sound system inquiry processed successfully');

    return NextResponse.json({
      success: true,
      message: 'Inquiry submitted successfully',
      quoteNumber: quoteNumber || undefined
    });
  } catch (error) {
    console.error('Error processing inquiry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit inquiry' },
      { status: 500 }
    );
  }
}
