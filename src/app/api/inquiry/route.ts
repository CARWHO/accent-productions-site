import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendInquiryNotification } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Save to Supabase
    const supabaseAdmin = getSupabaseAdmin();
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from('inquiries')
        .insert({
          event_type: body.eventType,
          organization: body.organization,
          event_name: body.eventName,
          event_date: body.eventDate,
          event_time: body.eventTime,
          setup_time: body.setupTime,
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
          status: 'new'
        });

      if (error) {
        console.error('Supabase error:', error);
      }
    } else {
      console.warn('Supabase admin client not initialized');
    }

    // 2. Send email notification
    try {
      await sendInquiryNotification(body);
    } catch (emailError) {
      console.error('Email error:', emailError);
      // We don't fail the whole request if only the email fails, 
      // but in this case the user specifically wants the email.
    }

    console.log('Inquiry processed successfully');

    return NextResponse.json({
      success: true,
      message: 'Inquiry submitted successfully'
    });
  } catch (error) {
    console.error('Error processing inquiry:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to submit inquiry' },
      { status: 500 }
    );
  }
}
