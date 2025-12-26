'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';

function ContractorResponseContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const action = searchParams.get('action');
  const eventName = searchParams.get('event');
  const pay = searchParams.get('pay');
  const status = searchParams.get('status');

  if (success && action === 'accepted') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-[#000000] rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">You&apos;re Booked!</h2>
        <p className="text-gray-700 text-lg font-medium">
          You&apos;ve been confirmed for <strong>{eventName || 'this event'}</strong>.
        </p>
        {pay && (
          <p className="text-gray-700 text-lg font-medium mt-1">
            Your pay: <strong>${Number(pay).toFixed(2)}</strong>
          </p>
        )}
      </div>
    );
  }

  if (success && action === 'declined') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-gray-400 rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Response Recorded</h2>
        <p className="text-gray-700 text-lg font-medium">
          Thanks for letting us know. We&apos;ll notify you of future opportunities!
        </p>
      </div>
    );
  }

  const errorMessages: Record<string, string> = {
    invalid_params: 'Invalid link - missing parameters.',
    invalid_token: 'This link is invalid or has expired.',
    already_responded: status === 'accepted'
      ? 'You have already accepted this job.'
      : status === 'declined'
        ? 'You have already declined this job.'
        : 'You have already responded to this job.',
    update_failed: 'Failed to record your response. Please try again.',
    server_error: 'Something went wrong. Please try again later.',
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-amber-100 rounded-md flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {error === 'already_responded' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          )}
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">
        {error === 'already_responded' ? 'Already Responded' : 'Error'}
      </h2>
      <p className="text-gray-700 text-lg font-medium">
        {error ? errorMessages[error] || 'An unknown error occurred.' : 'Something went wrong.'}
      </p>
    </div>
  );
}

export default function ContractorResponsePage() {
  return (
    <PageCard centered>
      <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
        <ContractorResponseContent />
      </Suspense>
    </PageCard>
  );
}
