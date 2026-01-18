import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { uploadTechRiderToSharedFolder } from '@/lib/google-drive';
import { parseTechRider, TechRiderRequirements } from '@/lib/parse-tech-rider';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    // Parse FormData
    const formData = await request.formData();

    // Helper to get string fields
    const getField = (name: string): string => formData.get(name)?.toString() || '';
    const getBoolField = (name: string): boolean => getField(name) === 'true';
    const getNumField = (name: string): number | undefined => {
      const val = getField(name);
      return val ? parseInt(val, 10) : undefined;
    };

    // Extract all form fields
    const body = {
      package: getField('package'),
      eventType: getField('eventType'),
      eventName: getField('eventName'),
      organization: getField('organization'),
      eventDate: getField('eventDate'),
      eventStartTime: getField('eventStartTime'),
      eventEndTime: getField('eventEndTime'),
      attendance: getNumField('attendance'),
      playbackFromDevice: getBoolField('playbackFromDevice'),
      hasLiveMusic: getBoolField('hasLiveMusic'),
      needsMic: getBoolField('needsMic'),
      hasDJ: getBoolField('hasDJ'),
      hasBand: getBoolField('hasBand'),
      bandCount: getNumField('bandCount'),
      bandNames: getField('bandNames'),
      bandSetup: getField('bandSetup'),
      needsDJTable: getBoolField('needsDJTable'),
      needsCDJs: getBoolField('needsCDJs'),
      cdjType: getField('cdjType'),
      hasSpeeches: getBoolField('hasSpeeches'),
      needsWirelessMic: getBoolField('needsWirelessMic'),
      needsLectern: getBoolField('needsLectern'),
      needsAmbientMusic: getBoolField('needsAmbientMusic'),
      additionalInfo: getField('additionalInfo'),
      location: getField('location'),
      venueContact: getField('venueContact'),
      indoorOutdoor: getField('indoorOutdoor'),
      wetWeatherPlan: getField('wetWeatherPlan'),
      needsGenerator: getBoolField('needsGenerator'),
      powerAccess: getField('powerAccess'),
      hasStage: getBoolField('hasStage'),
      stageDetails: getField('stageDetails'),
      // Timing fields for contractors
      roomAvailableFrom: getField('roomAvailableFrom'),
      callTime: getField('callTime'),
      packOutTime: getField('packOutTime'),
      contactName: getField('contactName'),
      contactEmail: getField('contactEmail'),
      contactPhone: getField('contactPhone'),
      details: getField('details'),
      content: getField('content'),
      stageProvider: getField('stageProvider'),
    };

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialized');
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 500 }
      );
    }

    // Get tech rider file if present, upload to Google Drive, and parse it
    const techRiderFile = formData.get('techRider') as File | null;
    let techRiderDriveFileId: string | null = null;
    let techRiderRequirements: TechRiderRequirements | null = null;

    if (techRiderFile && techRiderFile.size > 0) {
      const buffer = Buffer.from(await techRiderFile.arrayBuffer());

      // Upload to Google Drive shared tech riders folder
      techRiderDriveFileId = await uploadTechRiderToSharedFolder(
        buffer,
        techRiderFile.name,
        techRiderFile.type
      );

      if (techRiderDriveFileId) {
        console.log(`Tech rider uploaded to Google Drive: ${techRiderDriveFileId}`);
      } else {
        console.error('Failed to upload tech rider to Google Drive');
      }

      // Parse tech rider to extract requirements (for AI quote generation)
      try {
        console.log(`Parsing tech rider: ${techRiderFile.name}`);
        techRiderRequirements = await parseTechRider(buffer, techRiderFile.name);
        if (techRiderRequirements) {
          console.log('Tech rider parsed successfully:', {
            specificGear: techRiderRequirements.specificGear,
            hasBackline: techRiderRequirements.hasBackline,
            inputChannels: techRiderRequirements.inputChannels,
          });
        }
      } catch (parseError) {
        console.error('Error parsing tech rider (non-fatal):', parseError);
        // Continue without parsed data - quote will just use form fields
      }
    }

    // Generate approval token for later use
    const approvalToken = randomUUID();

    // Build form data JSON for Edge Function to process
    const formDataJson = {
      ...body,
      techRiderDriveFileId,
      techRiderOriginalName: techRiderFile?.name || null,
      // Include parsed tech rider requirements for AI quote generation
      techRiderRequirements: techRiderRequirements || null,
    };

    // Save inquiry with status='pending_quote' - Edge Function will process it
    const { data: inquiryData, error: inquiryError } = await supabaseAdmin
      .from('inquiries')
      .insert({
        event_type: body.eventType,
        organization: body.organization,
        event_name: body.eventName,
        event_date: body.eventDate,
        event_time: body.eventStartTime && body.eventEndTime
          ? `${body.eventStartTime} - ${body.eventEndTime}`
          : null,
        attendance: body.attendance,
        location: body.location,
        venue_contact: body.venueContact,
        content: body.content,
        indoor_outdoor: body.indoorOutdoor,
        power_access: body.powerAccess,
        stage_provider: body.stageProvider,
        details: body.details,
        contact_name: body.contactName,
        contact_email: body.contactEmail,
        contact_phone: body.contactPhone,
        status: 'pending_quote',
        form_data_json: formDataJson,
        approval_token: approvalToken,
      })
      .select('id')
      .single();

    if (inquiryError) {
      console.error('Supabase error:', inquiryError);
      return NextResponse.json(
        { success: false, message: 'Failed to save inquiry' },
        { status: 500 }
      );
    }

    console.log(`Inquiry ${inquiryData.id} saved with status pending_quote - Edge Function will process`);

    // Return success immediately - Edge Function handles the rest
    return NextResponse.json({
      success: true,
      message: 'Inquiry submitted successfully',
    });
  } catch (error) {
    console.error('Error processing inquiry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit inquiry' },
      { status: 500 }
    );
  }
}
