import { NextResponse } from 'next/server';
import { createQuoteSheet, type QuoteData, type LineItem } from '@/lib/google-sheets';
import type { FolderType } from '@/lib/google-drive';

const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Generate a quote Google Sheet from quote data
 *
 * NEW FORMAT (2024):
 * - LineItems use gear names from Master Equipment Sheet
 * - Pricing is auto-calculated via VLOOKUP formulas
 * - Required: gearName, quantity, days
 *
 * Expected body format:
 * {
 *   quote: {
 *     quoteNumber: string,
 *     title?: string,
 *     lineItems: Array<{
 *       gearName: string,      // Must match Master Sheet equipment names
 *       quantity: number,
 *       days?: number          // Defaults to 1
 *     }>
 *   },
 *   clientName: string,
 *   clientEmail: string,
 *   clientPhone?: string,
 *   eventDate: string,
 *   options?: { eventName?: string, location?: string },
 *   folderType?: 'fullsystem' | 'backline' | 'soundtech'
 * }
 */
export async function POST(request: Request) {
  try {
    // Verify request is from Edge Function
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quote, clientName, clientEmail, clientPhone, eventDate, options, folderType, rentalDays } = body;

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

    // Convert line items to new format (gearName, quantity, days)
    // Pricing is auto-calculated by sheet formulas from Master Equipment Sheet
    const defaultDays = rentalDays || 1;
    let lineItems: LineItem[] = [];

    if (Array.isArray(quote.lineItems)) {
      lineItems = quote.lineItems
        .filter((item: Record<string, unknown>) => item.gearName || item.item || item.description)
        .map((item: Record<string, unknown>) => ({
          gearName: String(item.gearName || item.item || item.description || ''),
          quantity: Number(item.quantity || item.qty || 1),
          days: Number(item.days || defaultDays),
        }));
    }

    // Determine folder type
    const type: FolderType = folderType || 'backline';

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
