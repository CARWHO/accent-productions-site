import Stripe from 'stripe';

// Lazy initialization - only create client when needed and keys exist
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!_stripe && process.env.STRIPE_SECRET_KEY) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia',
    });
  }
  return _stripe;
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string
): Stripe.Event | null {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe not configured');
  }
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}
