import { NextResponse } from 'next/server';
import { readJobSheetData } from '@/lib/google-sheets';

const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

export async function POST(request: Request) {
  try {
    // Verify request is from Edge Function or internal call
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { spreadsheetId } = body;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing required field: spreadsheetId' },
        { status: 400 }
      );
    }

    const data = await readJobSheetData(spreadsheetId);

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to read jobsheet data' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading jobsheet:', error);
    return NextResponse.json(
      { error: 'Failed to read jobsheet' },
      { status: 500 }
    );
  }
}
