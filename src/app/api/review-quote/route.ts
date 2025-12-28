import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateSoundQuotePDF } from '@/lib/pdf-sound-quote';
import { generateJobSheetPDF, JobSheetInput } from '@/lib/pdf-job-sheet';
import { SoundQuoteOutput, QuoteLineItems, SuggestedGearItem } from '@/lib/gemini-sound-quote';
import { updateFileInDrive } from '@/lib/google-drive';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ message: 'Database not configured' }, { status: 500 });
  }

  try {
    // Find booking by approval token (the original token from inquiry)
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (error || !booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Return booking with full quote_json and details_json (editable at any stage)
    return NextResponse.json({ booking });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// PATCH - Update quote and job sheet data
export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ message: 'Database not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { quoteData, detailsData } = body as {
      quoteData?: Partial<SoundQuoteOutput>;
      detailsData?: Record<string, unknown>;
    };

    // Fetch existing booking
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Merge with existing data
    const existingQuote = (booking.quote_json || {}) as SoundQuoteOutput;
    const existingDetails = (booking.details_json || {}) as Record<string, unknown>;

    const updatedQuote: SoundQuoteOutput = {
      ...existingQuote,
      ...quoteData,
      // Recalculate totals if lineItems changed
      ...(quoteData?.lineItems ? recalculateTotals(quoteData.lineItems as QuoteLineItems) : {}),
    };

    const updatedDetails = {
      ...existingDetails,
      ...detailsData,
    };

    // Update database
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        quote_json: updatedQuote,
        details_json: updatedDetails,
        quote_total: updatedQuote.total,
      })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return NextResponse.json({ message: 'Failed to save changes' }, { status: 500 });
    }

    // Regenerate PDFs and update Google Drive
    let quotePdfUpdated = false;
    let jobSheetPdfUpdated = false;

    try {
      // Regenerate quote PDF
      if (booking.booking_type === 'soundgear') {
        const quotePdfBuffer = await generateSoundQuotePDF(
          updatedQuote,
          booking.client_name,
          booking.client_email,
          booking.client_phone || '',
          booking.organization || undefined
        );

        // Update in Google Drive if file ID exists
        if (booking.quote_drive_file_id) {
          quotePdfUpdated = await updateFileInDrive(
            booking.quote_drive_file_id,
            quotePdfBuffer,
            `Quote-${booking.quote_number}.pdf`
          );
        }
      }

      // Regenerate job sheet PDF
      const jobSheetInput: JobSheetInput = {
        eventName: booking.event_name || 'Event',
        eventDate: booking.event_date,
        eventTime: booking.event_time,
        location: booking.location || 'TBC',
        quoteNumber: booking.quote_number || '',
        contractorName: '',
        hourlyRate: null,
        estimatedHours: null,
        payAmount: 0,
        tasksDescription: null,
        executionNotes: updatedQuote.executionNotes || [],
        equipment: [],
        suggestedGear: updatedQuote.suggestedGear || [],
        unavailableGear: updatedQuote.unavailableGear || [],
        eventType: (updatedDetails.eventType as string) || null,
        attendance: (updatedDetails.attendance as string) || null,
        setupTime: (updatedDetails.setupTime as string) || null,
        indoorOutdoor: (updatedDetails.venue as { indoorOutdoor?: string })?.indoorOutdoor || null,
        contentRequirements: (updatedDetails.contentRequirements as string[]) || [],
        additionalNotes: (updatedDetails.additionalInfo as string) || null,
        clientName: booking.client_name,
        clientPhone: booking.client_phone || '',
        clientEmail: booking.client_email,
      };

      const jobSheetPdfBuffer = await generateJobSheetPDF(jobSheetInput);

      if (booking.job_sheet_drive_file_id) {
        jobSheetPdfUpdated = await updateFileInDrive(
          booking.job_sheet_drive_file_id,
          jobSheetPdfBuffer,
          `JobSheet-${booking.quote_number}.pdf`
        );
      }
    } catch (pdfError) {
      console.error('Error regenerating PDFs:', pdfError);
      // Continue - data is saved, PDFs can be regenerated later
    }

    return NextResponse.json({
      success: true,
      booking: {
        ...booking,
        quote_json: updatedQuote,
        details_json: updatedDetails,
        quote_total: updatedQuote.total,
      },
      pdfStatus: {
        quotePdfUpdated,
        jobSheetPdfUpdated,
      },
    });
  } catch (error) {
    console.error('Error updating quote:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

// Recalculate totals from line items
function recalculateTotals(lineItems: QuoteLineItems): { subtotal: number; gst: number; total: number } {
  const subtotal =
    lineItems.foh +
    lineItems.monitors.cost +
    lineItems.microphones.cost +
    lineItems.console +
    lineItems.cables +
    lineItems.vehicle +
    lineItems.techTime.cost;
  const gst = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + gst;
  return { subtotal, gst, total };
}
