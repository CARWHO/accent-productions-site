'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';
import { SuccessIcon, ErrorIcon } from '@/components/ui/StatusIcons';

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
        <div className="mb-6"><SuccessIcon /></div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Quote Approved!</h2>
        <p className="text-gray-700 text-lg font-medium">
          Quote #{quoteNumber} has been approved.
        </p>
        <p className="text-gray-700 text-lg font-medium mt-1">
          {contractorCount && parseInt(contractorCount) > 0
            ? `Notified ${contractorCount} contractor${parseInt(contractorCount) > 1 ? 's' : ''} - first to accept gets the job.`
            : 'No contractors configured yet.'}
        </p>
        {calendarUrl && (
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-black text-white rounded-md text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            View Calendar Event
          </a>
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
      <div className="mb-6"><ErrorIcon /></div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">
        {error === 'already_processed' ? 'Already Processed' : 'Error'}
      </h2>
      <p className="text-gray-700 text-lg font-medium">
        {error ? errorMessages[error] || 'An unknown error occurred.' : 'Something went wrong.'}
      </p>
    </div>
  );
}

export default function ApproveQuotePage() {
  return (
    <PageCard centered>
      <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
        <ApproveQuoteContent />
      </Suspense>
    </PageCard>
  );
}
