import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://accent-productions.co.nz';
const POLI_MERCHANT_CODE = process.env.POLI_MERCHANT_CODE;
const POLI_AUTH_CODE = process.env.POLI_AUTH_CODE;
const POLI_QUERY_URL = process.env.POLI_QUERY_URL || 'https://poliapi.apac.paywithpoli.com/api/v2/Transaction/GetTransaction';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { Token: transactionToken } = body;

    if (!transactionToken) {
      console.log('POLi webhook: No transaction token');
      return NextResponse.json({ received: true });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase || !POLI_MERCHANT_CODE || !POLI_AUTH_CODE) {
      console.error('POLi webhook: Missing config');
      return NextResponse.json({ received: true });
    }

    // Find approval by POLi transaction token
    const { data: approval, error: fetchError } = await supabase
      .from('client_approvals')
      .select('*, bookings(*)')
      .eq('poli_transaction_id', transactionToken)
      .single();

    if (fetchError || !approval) {
      console.log('POLi webhook: Approval not found for token:', transactionToken);
      return NextResponse.json({ received: true });
    }

    // Already processed?
    if (approval.payment_status === 'paid') {
      console.log('POLi webhook: Already paid');
      return NextResponse.json({ received: true });
    }

    // Query POLi for transaction status
    const credentials = Buffer.from(`${POLI_MERCHANT_CODE}:${POLI_AUTH_CODE}`).toString('base64');

    const queryResponse = await fetch(`${POLI_QUERY_URL}?token=${transactionToken}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    });

    const queryResult = await queryResponse.json();

    if (queryResult.TransactionStatusCode === 'Completed') {
      // Process the approval
      const clientToken = approval.client_approval_token;

      const approveResponse = await fetch(`${baseUrl}/api/client-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: clientToken,
          paymentMethod: 'poli',
        }),
      });

      if (approveResponse.ok) {
        // Update with POLi reference
        await supabase
          .from('client_approvals')
          .update({
            payment_reference: queryResult.TransactionRefNo || transactionToken,
          })
          .eq('id', approval.id);

        console.log(`POLi webhook: Payment completed for approval ${approval.id}`);
      }
    } else {
      console.log('POLi webhook: Transaction status:', queryResult.TransactionStatusCode);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing POLi webhook:', error);
    return NextResponse.json({ received: true });
  }
}
