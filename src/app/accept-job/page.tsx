'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';

function AcceptJobContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const eventName = searchParams.get('event');
  const status = searchParams.get('status');

  if (success) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-green-100 rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
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
        <div className="w-20 h-20 bg-amber-100 rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
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
      <div className="w-20 h-20 bg-amber-100 rounded-md flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {error === 'already_taken' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          )}
        </svg>
      </div>
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
