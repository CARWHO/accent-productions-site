import { NextResponse } from 'next/server';
import { exportSheetAsPdf } from '@/lib/google-sheets';

const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

export async function POST(request: Request) {
  try {
    // Verify request is from Edge Function or internal call
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { spreadsheetId, sheetGid, filename } = body;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing required field: spreadsheetId' },
        { status: 400 }
      );
    }

    // Export the sheet as PDF
    const pdfBuffer = await exportSheetAsPdf(spreadsheetId, sheetGid);

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: 'Failed to export sheet as PDF' },
        { status: 500 }
      );
    }

    // Return PDF as binary
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename || 'export'}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error exporting sheet as PDF:', error);
    return NextResponse.json(
      { error: 'Failed to export sheet as PDF' },
      { status: 500 }
    );
  }
}

// Also support GET for direct browser access (with query params)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get('id');
    const sheetGid = searchParams.get('gid');
    const filename = searchParams.get('filename');

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Missing required param: id' },
        { status: 400 }
      );
    }

    const pdfBuffer = await exportSheetAsPdf(
      spreadsheetId,
      sheetGid ? parseInt(sheetGid, 10) : undefined
    );

    if (!pdfBuffer) {
      return NextResponse.json(
        { error: 'Failed to export sheet as PDF' },
        { status: 500 }
      );
    }

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename || 'export'}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error exporting sheet as PDF:', error);
    return NextResponse.json(
      { error: 'Failed to export sheet as PDF' },
      { status: 500 }
    );
  }
}
