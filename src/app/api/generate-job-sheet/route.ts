import { NextResponse } from 'next/server';
import { generateJobSheetPDF, JobSheetInput } from '@/lib/pdf-job-sheet';

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

    // Validate required fields
    if (!body.eventName || !body.eventDate || !body.quoteNumber || !body.clientName) {
      return NextResponse.json(
        { error: 'Missing required fields: eventName, eventDate, quoteNumber, clientName' },
        { status: 400 }
      );
    }

    // Build JobSheetInput from request body
    const jobSheetInput: JobSheetInput = {
      // Event info
      eventName: body.eventName,
      eventDate: body.eventDate,
      eventTime: body.eventTime || null,
      eventEndTime: body.eventEndTime || null,
      location: body.location || 'TBC',
      quoteNumber: body.quoteNumber,

      // Contractor assignment (may be empty for initial job sheets)
      contractorName: body.contractorName || 'TBC',
      hourlyRate: body.hourlyRate || null,
      estimatedHours: body.estimatedHours || null,
      payAmount: body.payAmount || 0,
      tasksDescription: body.tasksDescription || null,

      // AI-generated execution notes
      executionNotes: body.executionNotes || [],

      // Equipment (confirmed equipment after assignment)
      equipment: body.equipment || [],

      // AI-suggested gear (for initial job sheet)
      suggestedGear: body.suggestedGear || [],

      // Items that don't match available inventory
      unavailableGear: body.unavailableGear || [],

      // Event details
      eventType: body.eventType || null,
      attendance: body.attendance || null,
      setupTime: body.setupTime || null,
      indoorOutdoor: body.indoorOutdoor || null,
      contentRequirements: body.contentRequirements || [],
      additionalNotes: body.additionalNotes || null,

      // Venue details
      venueContact: body.venueContact || null,
      hasStage: body.hasStage || false,
      stageDetails: body.stageDetails || null,
      powerAccess: body.powerAccess || null,
      wetWeatherPlan: body.wetWeatherPlan || null,
      needsGenerator: body.needsGenerator || false,

      // Client
      clientName: body.clientName,
      clientPhone: body.clientPhone || '',
      clientEmail: body.clientEmail || '',
    };

    // Generate PDF
    const pdfBuffer = await generateJobSheetPDF(jobSheetInput);

    // Return PDF as binary (convert Buffer to Uint8Array for Response)
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="JobSheet-${body.quoteNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating Job Sheet PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate Job Sheet PDF' },
      { status: 500 }
    );
  }
}
