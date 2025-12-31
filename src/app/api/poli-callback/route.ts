import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';
const POLI_MERCHANT_CODE = process.env.POLI_MERCHANT_CODE;
const POLI_AUTH_CODE = process.env.POLI_AUTH_CODE;
const POLI_QUERY_URL = process.env.POLI_QUERY_URL || 'https://poliapi.apac.paywithpoli.com/api/v2/Transaction/GetTransaction';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const token = searchParams.get('token');
  const transactionToken = searchParams.get('Token'); // POLi adds this

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/approve/success?method=error`);
  }

  // If cancelled or failed, redirect to failure page
  if (status === 'cancelled' || status === 'failure') {
    return NextResponse.redirect(`${baseUrl}/approve?token=${token}&error=payment_${status}`);
  }

  const supabase = getSupabaseAdmin();
  if (!supabase || !POLI_MERCHANT_CODE || !POLI_AUTH_CODE) {
    return NextResponse.redirect(`${baseUrl}/approve?token=${token}&error=config`);
  }

  try {
    // Get approval to find the POLi transaction token
    const { data: approval, error: fetchError } = await supabase
      .from('client_approvals')
      .select('*, bookings(*)')
      .eq('client_approval_token', token)
      .single();

    if (fetchError || !approval) {
      return NextResponse.redirect(`${baseUrl}/approve?token=${token}&error=invalid`);
    }

    // Already approved? Skip to success
    if (approval.client_approved_at && approval.payment_status === 'paid') {
      return NextResponse.redirect(`${baseUrl}/approve/success?method=poli`);
    }

    const poliToken = transactionToken || approval.poli_transaction_id;
    if (!poliToken) {
      return NextResponse.redirect(`${baseUrl}/approve?token=${token}&error=no_transaction`);
    }

    // Query POLi for transaction status
    const credentials = Buffer.from(`${POLI_MERCHANT_CODE}:${POLI_AUTH_CODE}`).toString('base64');

    const queryResponse = await fetch(`${POLI_QUERY_URL}?token=${poliToken}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    });

    const queryResult = await queryResponse.json();

    // Check if payment was successful
    // POLi TransactionStatusCode: Completed = payment successful
    if (queryResult.TransactionStatusCode === 'Completed') {
      // Process the approval with POLi payment method
      const approveResponse = await fetch(`${baseUrl}/api/client-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          paymentMethod: 'poli',
        }),
      });

      if (approveResponse.ok) {
        // Update with POLi reference
        await supabase
          .from('client_approvals')
          .update({
            payment_reference: queryResult.TransactionRefNo || poliToken,
          })
          .eq('id', approval.id);

        return NextResponse.redirect(`${baseUrl}/approve/success?method=poli`);
      }
    }

    // Payment not completed
    console.log('POLi payment not completed:', queryResult.TransactionStatusCode);
    return NextResponse.redirect(`${baseUrl}/approve?token=${token}&error=payment_incomplete`);

  } catch (error) {
    console.error('Error processing POLi callback:', error);
    return NextResponse.redirect(`${baseUrl}/approve?token=${token}&error=server`);
  }
}
