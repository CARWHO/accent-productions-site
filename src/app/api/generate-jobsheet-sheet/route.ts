import { NextResponse } from 'next/server';
import { createJobSheet } from '@/lib/google-sheets';
import type { FolderType } from '@/lib/google-drive';

const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

export async function POST(request: Request) {
  try {
    // Verify request is from Edge Function
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      quoteNumber,
      eventName,
      eventDate,
      eventTime,
      location,
      clientName,
      clientEmail,
      clientPhone,
      equipment,
      folderType,
    } = body;

    if (!quoteNumber || !clientName) {
      return NextResponse.json(
        { error: 'Missing required fields: quoteNumber, clientName' },
        { status: 400 }
      );
    }

    const type: FolderType = folderType || 'fullsystem';

    const result = await createJobSheet(
      type,
      {
        quoteNumber,
        eventName: eventName || 'Event',
        eventDate: eventDate || 'TBC',
        eventTime: eventTime || 'TBC',
        location: location || 'TBC',
        clientName,
        clientEmail: clientEmail || '',
        clientPhone: clientPhone || '',
      },
      equipment || []
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to create jobsheet - check Google Sheets configuration' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
    });
  } catch (error) {
    console.error('Error generating jobsheet:', error);
    return NextResponse.json(
      { error: 'Failed to generate jobsheet' },
      { status: 500 }
    );
  }
}
