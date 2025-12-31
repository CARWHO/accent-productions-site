import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { readQuoteSheetData } from '@/lib/google-sheets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ message: 'Database not configured' }, { status: 500 });
  }

  try {
    // Find booking by approval token
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (error || !booking) {
      return NextResponse.json({ message: 'Booking not found' }, { status: 404 });
    }

    // Fetch existing client_approvals record if any
    const { data: approval } = await supabase
      .from('client_approvals')
      .select('*')
      .eq('booking_id', booking.id)
      .single();

    // Read actual total from Google Sheet (source of truth)
    let sheetTotal: number | null = null;
    if (booking.quote_sheet_id) {
      try {
        const sheetData = await readQuoteSheetData(booking.quote_sheet_id);
        if (sheetData && sheetData.total > 0) {
          sheetTotal = sheetData.total;
        }
      } catch (sheetError) {
        console.error('Error reading quote sheet:', sheetError);
      }
    }

    // Build response with approval data if exists
    const response: Record<string, unknown> = {
      booking,
      sheetTotal, // The actual total from the Google Sheet
    };

    if (approval) {
      response.clientApproval = {
        sentToClient: true,
        sentAt: approval.sent_to_client_at,
        lastAdjustedTotal: approval.adjusted_quote_total,
        lastNotes: approval.quote_notes,
        lastDepositAmount: approval.deposit_amount,
        resendCount: approval.resend_count || 0,
        paymentStatus: approval.payment_status,
        clientApprovedAt: approval.client_approved_at,
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
