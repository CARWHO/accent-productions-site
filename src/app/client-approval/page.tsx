'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';
import { SuccessIcon, ErrorIcon, InfoIcon } from '@/components/ui/StatusIcons';

function ClientApprovalContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const eventName = searchParams.get('event');

  if (success) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-6"><SuccessIcon /></div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Quote Approved!</h2>
        <p className="text-gray-700 text-lg font-medium mb-1">
          Thank you for approving the quote for <strong>{eventName || 'your event'}</strong>.
        </p>
        <p className="text-gray-700 text-lg font-medium">
          We&apos;ll be in touch soon with confirmation.
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
    <div className="flex flex-col items-center text-center">
      <div className="mb-6">{error === 'already_approved' ? <InfoIcon /> : <ErrorIcon />}</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">
        {error === 'already_approved' ? 'Already Approved' : 'Error'}
      </h2>
      <p className="text-gray-700 text-lg font-medium">
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
