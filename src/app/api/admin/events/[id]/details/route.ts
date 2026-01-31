import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET: Fetch full event details including related data
 * - Booking details
 * - Contractor assignments with payment status
 * - Client approval with payment status
 * - Google Drive file links
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }

  try {
    // Fetch booking with all fields
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        quote_number,
        event_name,
        event_date,
        event_time,
        location,
        client_name,
        client_email,
        client_phone,
        booking_type,
        status,
        created_at,
        client_approved_at,
        contractors_notified_at,
        quote_total,
        crew_count,
        approval_token,
        contractor_selection_token,
        quote_drive_file_id,
        quote_sheet_id,
        jobsheet_sheet_id,
        calendar_event_id,
        call_time,
        pack_out_time,
        site_available_from,
        call_out_notes,
        vehicle_type,
        band_names,
        next_occurrence_date,
        recurrence_reminder_days,
        inquiry_id
      `)
      .eq('id', id)
      .single();

    if (bookingError) {
      console.error('Error fetching booking:', bookingError);
      return NextResponse.json({ error: 'Booking not found', details: bookingError.message }, { status: 404 });
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found', id }, { status: 404 });
    }

    // Fetch contractor assignments
    const { data: assignments, error: assignmentsError } = await supabase
      .from('booking_contractor_assignments')
      .select(`
        id,
        status,
        pay_amount,
        payment_status,
        last_reminder_sent_at,
        jobsheet_drive_file_id,
        contractors (
          id,
          name,
          email,
          phone
        )
      `)
      .eq('booking_id', id)
      .order('created_at', { ascending: true });

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
    }

    // Fetch client approval info
    const { data: approval, error: approvalError } = await supabase
      .from('client_approvals')
      .select(`
        id,
        payment_status,
        deposit_amount,
        balance_status,
        created_at,
        client_approval_token
      `)
      .eq('booking_id', id)
      .single();

    if (approvalError && approvalError.code !== 'PGRST116') {
      console.error('Error fetching approval:', approvalError);
    }

    // Fetch inquiry to get tech rider file ID
    let techRiderUrl: string | null = null;
    if (booking.inquiry_id) {
      const { data: inquiry } = await supabase
        .from('inquiries')
        .select('form_data_json')
        .eq('id', booking.inquiry_id)
        .single();

      // Prefer Google Drive URL, fall back to Supabase storage for legacy inquiries
      if (inquiry?.form_data_json?.techRiderDriveFileId) {
        techRiderUrl = `https://drive.google.com/file/d/${inquiry.form_data_json.techRiderDriveFileId}/view`;
      } else if (inquiry?.form_data_json?.techRiderStoragePath) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        techRiderUrl = `${supabaseUrl}/storage/v1/object/public/inquiry-files/${inquiry.form_data_json.techRiderStoragePath}`;
      }
    }

    // Build Google Drive URLs
    const driveBaseUrl = 'https://drive.google.com/file/d';
    const sheetsBaseUrl = 'https://docs.google.com/spreadsheets/d';
    const documents = {
      quoteSheetPdf: booking.quote_drive_file_id
        ? `${driveBaseUrl}/${booking.quote_drive_file_id}/view`
        : null,
      quoteSpreadsheet: booking.quote_sheet_id
        ? `${sheetsBaseUrl}/${booking.quote_sheet_id}/edit`
        : null,
      jobsheetSpreadsheet: booking.jobsheet_sheet_id
        ? `${sheetsBaseUrl}/${booking.jobsheet_sheet_id}/edit`
        : null,
      techRider: techRiderUrl,
    };

    // Format contractor assignments
    const formattedAssignments = (assignments || []).map(a => {
      const contractor = a.contractors as unknown as {
        id: string;
        name: string;
        email: string;
        phone: string | null;
      } | null;

      return {
        id: a.id,
        contractor: contractor,
        status: a.status,
        payAmount: a.pay_amount,
        paymentStatus: a.payment_status || 'pending',
        reminderSentAt: a.last_reminder_sent_at,
        jobsheetUrl: a.jobsheet_drive_file_id
          ? `${driveBaseUrl}/${a.jobsheet_drive_file_id}/view`
          : null,
        payUrl: `/pay-contractor?token=${a.id}`,
      };
    });

    // Calculate payment summary
    const quoteTotal = booking.quote_total || 0;
    const depositAmount = approval?.deposit_amount || 0;
    const balanceAmount = quoteTotal - depositAmount;

    const paymentSummary = {
      quoteTotal,
      depositAmount,
      balanceAmount,
      depositStatus: approval?.payment_status || 'not_sent',
      balanceStatus: approval?.balance_status || 'not_due',
    };

    // Internal links for admin actions - use IDs directly where possible
    const adminLinks = {
      reviewQuote: `/review-quote?token=${booking.approval_token}`,
      reviewJobsheet: `/review-jobsheet?token=${booking.approval_token}`,
      selectContractors: booking.contractor_selection_token
        ? `/select-contractors?token=${booking.contractor_selection_token}`
        : `/select-contractors?token=${booking.approval_token}`,
      // Use booking_id directly for balance collection
      collectBalance: `/collect-balance?token=${booking.id}`,
      // client_approval_token is used for the client-facing approval page
      clientApprovalPage: approval?.client_approval_token
        ? `/approve?token=${approval.client_approval_token}`
        : null,
    };

    return NextResponse.json({
      booking,
      assignments: formattedAssignments,
      approval,
      documents,
      paymentSummary,
      adminLinks,
    });
  } catch (error) {
    console.error('Error in event details API:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
