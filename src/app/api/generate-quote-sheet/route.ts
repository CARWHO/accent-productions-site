import { NextResponse } from 'next/server';
import { createQuoteSheet, type QuoteData, type LineItem } from '@/lib/google-sheets';
import type { FolderType } from '@/lib/google-drive';

const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

interface StructuredLineItems {
  foh: number;
  monitors: { count: number; cost: number };
  microphones: { count: number; cost: number };
  console: number;
  cables: number;
  vehicle: number;
  techTime: { hours: number; rate: number; cost: number };
}

function isStructuredQuote(lineItems: unknown): lineItems is StructuredLineItems {
  if (!lineItems || Array.isArray(lineItems)) return false;
  return typeof lineItems === 'object' && 'foh' in lineItems;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function POST(request: Request) {
  try {
    // Verify request is from Edge Function
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quote, clientName, clientEmail, clientPhone, eventDate, options, folderType } = body;

    if (!quote || !clientName || !clientEmail || !eventDate) {
      return NextResponse.json(
        { error: 'Missing required fields: quote, clientName, clientEmail, eventDate' },
        { status: 400 }
      );
    }

    // Build quote data for sheet
    const quoteData: QuoteData = {
      quoteNumber: quote.quoteNumber,
      issuedDate: formatDate(new Date().toISOString()),
      clientName,
      clientEmail,
      clientPhone: clientPhone || '',
      eventName: quote.title || options?.eventName || 'Event',
      eventDate: formatDate(eventDate),
      eventLocation: options?.location || 'TBC',
    };

    // Convert line items to sheet format
    let lineItems: LineItem[] = [];

    if (isStructuredQuote(quote.lineItems)) {
      // Full system quote - structured format
      const items = quote.lineItems;
      lineItems = [
        { description: 'FOH System', cost: items.foh },
        { description: `Monitors (${items.monitors.count}x)`, cost: items.monitors.cost },
        { description: `Microphones (${items.microphones.count}x)`, cost: items.microphones.cost },
        { description: 'Console', cost: items.console },
        { description: 'Cables & Accessories', cost: items.cables },
        { description: 'Vehicle', cost: items.vehicle },
        { description: `Tech Time (${items.techTime.hours} hrs @ $${items.techTime.rate}/hr)`, cost: items.techTime.cost },
      ].filter(item => item.cost > 0);
    } else if (Array.isArray(quote.lineItems)) {
      // Backline quote - array format
      lineItems = quote.lineItems.map((item: { item?: string; description?: string; cost?: number; price?: number }) => ({
        description: item.item || item.description || '',
        cost: item.cost || item.price || 0,
      }));
    }

    // Determine folder type
    const type: FolderType = folderType || 'fullsystem';

    // Create the sheet
    const result = await createQuoteSheet(type, quoteData, lineItems);

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create quote sheet - check Google Sheets configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
    });
  } catch (error) {
    console.error('Error generating quote sheet:', error);
    return NextResponse.json(
      { error: 'Failed to generate quote sheet' },
      { status: 500 }
    );
  }
}
