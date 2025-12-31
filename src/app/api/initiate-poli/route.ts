import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';

// POLi API credentials
const POLI_MERCHANT_CODE = process.env.POLI_MERCHANT_CODE;
const POLI_AUTH_CODE = process.env.POLI_AUTH_CODE;
const POLI_API_URL = process.env.POLI_API_URL || 'https://poliapi.apac.paywithpoli.com/api/v2/Transaction/Initiate';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ success: false, message: 'Missing token' }, { status: 400 });
    }

    if (!POLI_MERCHANT_CODE || !POLI_AUTH_CODE) {
      console.error('POLi credentials not configured');
      return NextResponse.json({ success: false, message: 'Payment not configured' }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ success: false, message: 'Database not configured' }, { status: 500 });
    }

    // Fetch approval and booking
    const { data: approval, error: fetchError } = await supabase
      .from('client_approvals')
      .select('*, bookings(*)')
      .eq('client_approval_token', token)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json({ success: false, message: 'Invalid token' }, { status: 404 });
    }

    if (approval.client_approved_at) {
      return NextResponse.json({ success: false, message: 'Already approved' }, { status: 400 });
    }

    const booking = approval.bookings;
    const depositAmount = approval.deposit_amount || 0;

    if (depositAmount <= 0) {
      return NextResponse.json({ success: false, message: 'No payment required' }, { status: 400 });
    }

    // Create POLi transaction
    const poliPayload = {
      Amount: depositAmount.toFixed(2),
      CurrencyCode: 'NZD',
      MerchantReference: booking.invoice_number || `QUOTE-${booking.quote_number}`,
      MerchantReferenceFormat: 1, // Exact match
      MerchantData: JSON.stringify({ approvalId: approval.id, bookingId: booking.id, token }),
      MerchantHomepageURL: baseUrl,
      SuccessURL: `${baseUrl}/api/poli-callback?status=success&token=${token}`,
      FailureURL: `${baseUrl}/api/poli-callback?status=failure&token=${token}`,
      CancellationURL: `${baseUrl}/api/poli-callback?status=cancelled&token=${token}`,
      NotificationURL: `${baseUrl}/api/poli-webhook`,
    };

    // Base64 encode credentials for Basic Auth
    const credentials = Buffer.from(`${POLI_MERCHANT_CODE}:${POLI_AUTH_CODE}`).toString('base64');

    const poliResponse = await fetch(POLI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify(poliPayload),
    });

    const poliResult = await poliResponse.json();

    if (!poliResponse.ok || !poliResult.NavigateURL) {
      console.error('POLi initiation failed:', poliResult);
      return NextResponse.json({
        success: false,
        message: poliResult.ErrorMessage || 'Failed to initiate payment'
      }, { status: 500 });
    }

    // Update approval with POLi transaction token
    await supabase
      .from('client_approvals')
      .update({
        payment_status: 'processing',
        poli_transaction_id: poliResult.TransactionToken,
      })
      .eq('id', approval.id);

    return NextResponse.json({
      success: true,
      navigateUrl: poliResult.NavigateURL,
      transactionToken: poliResult.TransactionToken,
    });
  } catch (error) {
    console.error('Error initiating POLi payment:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
