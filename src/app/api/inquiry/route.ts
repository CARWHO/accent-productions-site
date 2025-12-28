import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
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

    // Get tech rider file if present and upload to Supabase Storage
    const techRiderFile = formData.get('techRider') as File | null;
    let techRiderStoragePath: string | null = null;

    if (techRiderFile && techRiderFile.size > 0) {
      const fileExt = techRiderFile.name.split('.').pop() || 'pdf';
      const fileName = `${randomUUID()}.${fileExt}`;
      const filePath = `tech-riders/${fileName}`;

      const buffer = Buffer.from(await techRiderFile.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from('inquiry-files')
        .upload(filePath, buffer, {
          contentType: techRiderFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading tech rider:', uploadError);
      } else {
        techRiderStoragePath = filePath;
        console.log(`Tech rider uploaded to: ${filePath}`);
      }
    }

    // Generate approval token for later use
    const approvalToken = randomUUID();

    // Build form data JSON for Edge Function to process
    const formDataJson = {
      ...body,
      techRiderStoragePath,
      techRiderOriginalName: techRiderFile?.name || null,
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
