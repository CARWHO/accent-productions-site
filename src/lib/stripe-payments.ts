/**
 * Stripe Connect contractor payment processing
 *
 * TODO: Implement actual Stripe Connect payouts
 * - Set up Stripe Connect for contractors
 * - Store contractor Stripe account IDs
 * - Use Stripe Transfers or Payouts API
 */

export interface ContractorPaymentInput {
  contractorId: string;
  contractorName: string;
  contractorEmail: string;
  amount: number;
  description: string;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Process payment to contractor
 *
 * STUB: Currently just logs and returns success.
 * In production, this would:
 * 1. Look up contractor's Stripe Connect account ID
 * 2. Create a Transfer to their account
 * 3. Return the transfer ID
 */
export async function processContractorPayment(
  input: ContractorPaymentInput
): Promise<PaymentResult> {
  console.log('=== CONTRACTOR PAYMENT STUB ===');
  console.log(`Contractor: ${input.contractorName} (${input.contractorEmail})`);
  console.log(`Amount: $${input.amount}`);
  console.log(`Description: ${input.description}`);
  console.log('================================');

  // TODO: Implement actual Stripe Connect payout
  // const stripe = getStripe();
  // if (!stripe) {
  //   return { success: false, error: 'Stripe not configured' };
  // }
  //
  // const transfer = await stripe.transfers.create({
  //   amount: Math.round(input.amount * 100), // cents
  //   currency: 'nzd',
  //   destination: contractorStripeAccountId,
  //   description: input.description,
  // });
  //
  // return { success: true, transactionId: transfer.id };

  // For now, just return success (admin confirms after manual iPayroll payment)
  return {
    success: true,
    transactionId: `STUB-${Date.now()}`,
  };
}
