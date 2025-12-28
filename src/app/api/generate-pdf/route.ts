import { NextResponse } from 'next/server';
import { generateQuotePDF } from '@/lib/pdf-quote';
import { QuoteOutput } from '@/lib/gemini-quote';

// Secret key for Edge Function authentication
const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

export async function POST(request: Request) {
  try {
    // Verify request is from Edge Function
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quote, clientName, clientEmail, clientPhone, eventDate, type, options } = body;

    // Validate required fields
    if (!quote || !clientName || !clientEmail || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required fields: quote, clientName, clientEmail, eventDate' },
        { status: 400 }
      );
    }

    // Convert quote to expected format
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

    // Generate PDF
    const pdfBuffer = await generateQuotePDF(
      quoteOutput,
      clientName,
      clientEmail,
      clientPhone || '',
      eventDate,
      options
    );

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
