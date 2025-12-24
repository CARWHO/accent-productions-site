'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AcceptJobContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const eventName = searchParams.get('event');
  const status = searchParams.get('status');

  if (success) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">You&apos;re Booked!</h1>
        <p className="text-gray-600 mb-6">
          You&apos;ve been assigned to <strong>{eventName || 'this event'}</strong>.
        </p>
        <p className="text-sm text-gray-500">Check your email for confirmation and details.</p>
      </div>
    );
  }

  if (status === 'already_yours') {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Already Yours!</h1>
        <p className="text-gray-600">You&apos;ve already accepted this job.</p>
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
      <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {error === 'already_taken' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          )}
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        {error === 'already_taken' ? 'Job Taken' : 'Error'}
      </h1>
      <p className="text-gray-600">
        {error ? errorMessages[error] || 'An unknown error occurred.' : 'Something went wrong.'}
      </p>
      {error === 'already_taken' && (
        <p className="text-sm text-gray-500 mt-4">
          Don&apos;t worry - we&apos;ll notify you of future opportunities!
        </p>
      )}
    </div>
  );
}

export default function AcceptJobPage() {
  return (
    <main className="bg-stone-50 min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-lg border border-stone-200 p-8 max-w-md w-full">
        <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
          <AcceptJobContent />
        </Suspense>
      </div>
    </main>
  );
}
