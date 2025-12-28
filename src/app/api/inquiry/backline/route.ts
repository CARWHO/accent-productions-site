import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // Parse form fields
    const equipmentRaw = formData.get('equipment') as string;
    const equipment = equipmentRaw ? JSON.parse(equipmentRaw) : [];
    const otherEquipment = formData.get('otherEquipment') as string || '';
    const startDate = formData.get('startDate') as string;
    const endDate = formData.get('endDate') as string;
    const deliveryMethod = formData.get('deliveryMethod') as 'pickup' | 'delivery';
    const deliveryAddress = formData.get('deliveryAddress') as string || '';
    const additionalNotes = formData.get('additionalNotes') as string || '';
    const contactName = formData.get('contactName') as string;
    const contactEmail = formData.get('contactEmail') as string;
    const contactPhone = formData.get('contactPhone') as string;
    const techRiderFile = formData.get('techRider') as File | null;

    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialized');
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 500 }
      );
    }

    // Upload tech rider to storage if present
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

    // Generate approval token
    const approvalToken = randomUUID();

    // Build form data JSON for Edge Function to process
    const formDataJson = {
      type: 'backline',
      equipment,
      otherEquipment,
      startDate,
      endDate,
      deliveryMethod,
      deliveryAddress,
      additionalNotes,
      contactName,
      contactEmail,
      contactPhone,
      techRiderStoragePath,
      techRiderOriginalName: techRiderFile?.name || null,
    };

    // Save inquiry with status='pending_quote' - Edge Function will process it
    const { data: inquiryData, error: inquiryError } = await supabaseAdmin
      .from('inquiries')
      .insert({
        event_type: 'backline_hire',
        event_name: `Backline Hire - ${contactName}`,
        event_date: startDate,
        event_time: null,
        location: deliveryMethod === 'delivery' ? deliveryAddress : 'Pickup',
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        details: additionalNotes || null,
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

    console.log(`Backline inquiry ${inquiryData.id} saved with status pending_quote - Edge Function will process`);

    // Return success immediately - Edge Function handles the rest
    return NextResponse.json({
      success: true,
      message: 'Backline inquiry submitted successfully',
    });
  } catch (error) {
    console.error('Error processing backline inquiry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit inquiry' },
      { status: 500 }
    );
  }
}
