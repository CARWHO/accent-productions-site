import { NextResponse } from 'next/server';
import { generateJobSheetPDF, JobSheetInput } from '@/lib/pdf-job-sheet';
import { uploadJobSheetToDrive, shareFileWithLink, FolderType } from '@/lib/google-drive';

const EDGE_FUNCTION_SECRET = process.env.EDGE_FUNCTION_SECRET || 'default-secret-change-me';

export async function POST(request: Request) {
  try {
    // Verify request is from edge function
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${EDGE_FUNCTION_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobSheetInput, filename, folderType } = body as {
      jobSheetInput: JobSheetInput;
      filename: string;
      folderType: FolderType;
    };

    if (!jobSheetInput || !filename || !folderType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate PDF
    const pdfBuffer = await generateJobSheetPDF(jobSheetInput);
    if (!pdfBuffer) {
      return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }

    // Upload to Drive
    const fileId = await uploadJobSheetToDrive(pdfBuffer, filename, folderType);
    if (!fileId) {
      return NextResponse.json({ error: 'Failed to upload to Drive' }, { status: 500 });
    }

    // Get shareable link
    const driveLink = await shareFileWithLink(fileId);

    return NextResponse.json({
      success: true,
      fileId,
      driveLink,
    });
  } catch (error) {
    console.error('Error generating/uploading jobsheet:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
