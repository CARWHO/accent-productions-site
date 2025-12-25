'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';

function ClientApprovalContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const eventName = searchParams.get('event');

  if (success) {
    return (
      <div className="flex flex-col items-center text-center py-8">
        <div className="w-20 h-20 bg-[#000000] rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Quote Approved!</h1>
        <p className="text-gray-600 mb-2">
          Thank you for approving the quote for <strong>{eventName || 'your event'}</strong>.
        </p>
        <p className="text-gray-600 mb-6">
          We&apos;re now arranging your team and will be in touch soon with confirmation.
        </p>
        <p className="text-sm text-gray-500">
          If you have any questions, please don&apos;t hesitate to contact us.
        </p>
      </div>
    );
  }

  const errorMessages: Record<string, string> = {
    missing_token: 'Invalid link - no approval token provided.',
    invalid_token: 'This approval link is invalid or has expired.',
    already_approved: 'This quote has already been approved.',
    update_failed: 'Failed to process approval. Please try again.',
    server_error: 'Something went wrong. Please try again later.',
  };

  return (
    <div className="flex flex-col items-center text-center py-8">
      <div className="w-20 h-20 bg-red-100 rounded-md flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {error === 'already_approved' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          )}
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        {error === 'already_approved' ? 'Already Approved' : 'Error'}
      </h1>
      <p className="text-gray-600">
        {error ? errorMessages[error] || 'An unknown error occurred.' : 'Something went wrong.'}
      </p>
    </div>
  );
}

export default function ClientApprovalPage() {
  return (
    <PageCard centered>
      <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
        <ClientApprovalContent />
      </Suspense>
    </PageCard>
  );
}
