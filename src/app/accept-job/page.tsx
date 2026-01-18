'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';
import { SuccessIcon, ErrorIcon, InfoIcon } from '@/components/ui/StatusIcons';

function AcceptJobContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const eventName = searchParams.get('event');
  const status = searchParams.get('status');

  if (success) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-6"><SuccessIcon /></div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">You&apos;re Booked!</h2>
        <p className="text-gray-700 text-lg font-medium">
          You&apos;ve been assigned to <strong>{eventName || 'this event'}</strong>.
        </p>
        <p className="text-gray-700 text-lg font-medium mt-1">
          Check your email for confirmation and details.
        </p>
      </div>
    );
  }

  if (status === 'already_yours') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="mb-6"><InfoIcon /></div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Already Yours!</h2>
        <p className="text-gray-700 text-lg font-medium">
          You&apos;ve already accepted this job.
        </p>
      </div>
    );
  }

  const errorMessages: Record<string, string> = {
    missing_params: 'Invalid link - missing parameters.',
    invalid_token: 'This link is invalid or has expired.',
    already_taken: 'Sorry, this job has already been taken by another contractor.',
    invalid_contractor: 'Invalid contractor link.',
    server_error: 'Something went wrong. Please try again later.',
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6">{error === 'already_taken' ? <InfoIcon /> : <ErrorIcon />}</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">
        {error === 'already_taken' ? 'Job Taken' : 'Error'}
      </h2>
      <p className="text-gray-700 text-lg font-medium">
        {error ? errorMessages[error] || 'An unknown error occurred.' : 'Something went wrong.'}
      </p>
      {error === 'already_taken' && (
        <p className="text-gray-700 text-lg font-medium mt-1">
          Don&apos;t worry - we&apos;ll notify you of future opportunities!
        </p>
      )}
    </div>
  );
}

export default function AcceptJobPage() {
  return (
    <PageCard centered>
      <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
        <AcceptJobContent />
      </Suspense>
    </PageCard>
  );
}
