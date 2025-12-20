import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    // TODO: Verify Stripe webhook signature
    // TODO: Handle payment_intent.succeeded event
    // TODO: Create Xero invoice
    // TODO: Add event to Google Calendar

    console.log('Stripe webhook received');

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}
