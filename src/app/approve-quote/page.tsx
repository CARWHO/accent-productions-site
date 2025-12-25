'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ApproveQuoteContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const quoteNumber = searchParams.get('quote');
  const contractorCount = searchParams.get('contractors');
  const status = searchParams.get('status');
  const calendarUrl = searchParams.get('calendar');

  if (success) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Quote Approved!</h1>
        <p className="text-gray-600 mb-2">Quote #{quoteNumber} has been approved.</p>
        <p className="text-gray-600 mb-6">
          {contractorCount && parseInt(contractorCount) > 0
            ? `Notified ${contractorCount} contractor${parseInt(contractorCount) > 1 ? 's' : ''} - first to accept gets the job.`
            : 'No contractors configured yet.'}
        </p>
        {calendarUrl ? (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            View Calendar Event
          </a>
        ) : (
          <p className="text-sm text-gray-500">A calendar event has been created.</p>
        )}
      </div>
    );
  }

  const errorMessages: Record<string, string> = {
    missing_token: 'Invalid link - no approval token provided.',
    invalid_token: 'This approval link is invalid or has expired.',
    already_processed: `This quote has already been ${status || 'processed'}.`,
    update_failed: 'Failed to update the booking. Please try again.',
    server_error: 'Something went wrong. Please try again later.',
  };

  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        {error === 'already_processed' ? 'Already Processed' : 'Error'}
      </h1>
      <p className="text-gray-600">
        {error ? errorMessages[error] || 'An unknown error occurred.' : 'Something went wrong.'}
      </p>
    </div>
  );
}

export default function ApproveQuotePage() {
  return (
    <main className="bg-stone-50 min-h-screen flex items-center justify-center px-4 pb-32">
      <div className="bg-white rounded-lg border border-stone-200 p-8 max-w-md w-full aspect-square flex items-center justify-center">
        <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
          <ApproveQuoteContent />
        </Suspense>
      </div>
    </main>
  );
}
