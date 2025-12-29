import { NextResponse } from 'next/server';
import { generateQuotePDF } from '@/lib/pdf-quote';
import { generateSoundQuotePDF } from '@/lib/pdf-sound-quote';
import { QuoteOutput } from '@/lib/gemini-quote';
import { SoundQuoteOutput } from '@/lib/gemini-sound-quote';

// Secret key for Edge Function authentication
const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

// Check if lineItems has structured format (full system) vs array format (backline)
function isStructuredQuote(lineItems: unknown): boolean {
  if (!lineItems || Array.isArray(lineItems)) return false;
  // Structured format has foh, monitors, console, etc.
  return typeof lineItems === 'object' && 'foh' in lineItems;
}

export async function POST(request: Request) {
  try {
    // Verify request is from Edge Function
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quote, clientName, clientEmail, clientPhone, eventDate, options } = body;

    // Validate required fields
    if (!quote || !clientName || !clientEmail || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required fields: quote, clientName, clientEmail, eventDate' },
        { status: 400 }
      );
    }

    let pdfBuffer: Buffer;

    // Use structured format (pdf-sound-quote) for full system quotes
    if (isStructuredQuote(quote.lineItems)) {
      console.log('[generate-pdf] Using structured quote format (SoundQuoteOutput)');
      const soundQuote: SoundQuoteOutput = {
        quoteNumber: quote.quoteNumber,
        title: quote.title || 'Sound System Hire',
        subtitle: quote.description || options?.eventName || '',
        lineItems: quote.lineItems,
        executionNotes: quote.executionNotes || [],
        suggestedGear: quote.suggestedGear || [],
        unavailableGear: quote.unavailableGear || [],
        subtotal: quote.subtotal || 0,
        gst: quote.gst || 0,
        total: quote.total || 0,
      };

      pdfBuffer = await generateSoundQuotePDF(
        soundQuote,
        clientName,
        clientEmail,
        clientPhone || '',
        options?.organization,
        options
      );
    } else {
      // Use legacy format (pdf-quote) for backline quotes
      console.log('[generate-pdf] Using legacy quote format (QuoteOutput)');
      const quoteOutput: QuoteOutput = {
        quoteNumber: quote.quoteNumber,
        title: quote.title || 'Quote',
        description: quote.description || '',
        lineItems: quote.lineItems || [],
        subtotal: quote.subtotal || 0,
        gst: quote.gst || 0,
        total: quote.total || 0,
        rentalDays: quote.rentalDays || 1,
      };

      pdfBuffer = await generateQuotePDF(
        quoteOutput,
        clientName,
        clientEmail,
        clientPhone || '',
        eventDate,
        options
      );
    }

    // Return PDF as binary (convert Buffer to Uint8Array for Response)
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Quote-${quote.quoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
