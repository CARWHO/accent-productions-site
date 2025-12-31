'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';

function PaymentConfirmedContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const status = searchParams.get('status');
  const contractor = searchParams.get('contractor');
  const amount = searchParams.get('amount');

  if (success) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-green-100 rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Payment Confirmed</h2>
        <p className="text-gray-700 text-lg font-medium">
          <strong>${amount}</strong> payment to <strong>{contractor}</strong> has been recorded.
        </p>
        <p className="text-gray-500 text-sm mt-4">
          They&apos;ve been notified via email.
        </p>
      </div>
    );
  }

  if (status === 'already_paid') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Already Paid</h2>
        <p className="text-gray-700 text-lg font-medium">
          Payment to <strong>{contractor}</strong> was already confirmed.
        </p>
      </div>
    );
  }

  const errorMessages: Record<string, string> = {
    missing_token: 'Invalid link - missing payment token.',
    invalid_token: 'This payment link is invalid or has expired.',
    payment_failed: 'Payment processing failed. Please try again.',
    update_failed: 'Failed to update payment status.',
    server_error: 'Something went wrong. Please try again later.',
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-red-100 rounded-md flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">Error</h2>
      <p className="text-gray-700 text-lg font-medium">
        {error ? errorMessages[error] || 'An unknown error occurred.' : 'Something went wrong.'}
      </p>
    </div>
  );
}

export default function PaymentConfirmedPage() {
  return (
    <PageCard centered>
      <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
        <PaymentConfirmedContent />
      </Suspense>
    </PageCard>
  );
}
