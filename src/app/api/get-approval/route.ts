import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ success: false, message: 'Missing token' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 500 });
    }

    // Fetch client approval with booking
    const { data: approval, error } = await supabase
      .from('client_approvals')
      .select('*, bookings(*)')
      .eq('client_approval_token', token)
      .single();

    if (error || !approval) {
      return NextResponse.json({ success: false, message: 'Invalid or expired token' }, { status: 404 });
    }

    const booking = approval.bookings;

    // Check if already approved
    const alreadyApproved = booking.status === 'client_approved' ||
                           booking.status === 'contractor_selection' ||
                           booking.status === 'confirmed' ||
                           approval.client_approved_at !== null;

    // deposit_amount being null means admin hasn't set it yet - don't allow approval
    const depositAmount = approval.deposit_amount;
    const quoteTotal = approval.adjusted_quote_total || booking.quote_total || 0;

    return NextResponse.json({
      bookingId: booking.id,
      clientName: booking.client_name,
      eventName: booking.event_name,
      eventDate: booking.event_date,
      location: booking.location,
      quoteTotal,
      depositAmount: depositAmount ?? null, // Keep null if not set
      depositPercent: depositAmount != null && quoteTotal > 0
        ? Math.round((depositAmount / quoteTotal) * 100)
        : null,
      invoiceNumber: booking.invoice_number,
      notes: approval.quote_notes,
      alreadyApproved,
      paymentStatus: approval.payment_status || 'pending',
      readyForApproval: depositAmount != null, // Flag to indicate if quote is ready
    });
  } catch (error) {
    console.error('Error fetching approval:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
