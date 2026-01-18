'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';
import { LoadingSpinner, SuccessIcon, ErrorIcon, InfoIcon } from '@/components/ui/StatusIcons';

type ResultType =
  | 'quote_approved'
  | 'payment_confirmed'
  | 'balance_paid'
  | 'contractor_booked'
  | 'contractor_declined'
  | 'invoice_sent'
  | 'already_done'
  | 'error';

interface ResultConfig {
  icon: 'success' | 'error' | 'info';
  title: string;
  message: string;
  submessage?: string;
  showLogo?: boolean;
}

function getResultConfig(type: ResultType, params: URLSearchParams): ResultConfig {
  const name = params.get('name') || '';
  const amount = params.get('amount') || '';
  const event = params.get('event') || 'your event';
  const email = params.get('email') || '';
  const error = params.get('error') || '';

  const configs: Record<ResultType, ResultConfig> = {
    quote_approved: {
      icon: 'success',
      title: 'Quote Approved!',
      message: `Thank you for approving the quote for ${event}.`,
      submessage: "We'll be in touch soon with confirmation.",
    },
    payment_confirmed: {
      icon: 'success',
      title: 'Payment Confirmed',
      message: amount ? `$${amount} payment to ${name} has been recorded.` : 'Payment has been recorded.',
      submessage: name ? "They've been notified via email." : undefined,
    },
    balance_paid: {
      icon: 'success',
      title: 'Thank You!',
      message: amount ? `Your payment of $${amount} has been recorded.` : 'Your payment has been recorded.',
      submessage: "You'll receive a confirmation email shortly.",
      showLogo: true,
    },
    contractor_booked: {
      icon: 'success',
      title: "You're Booked!",
      message: `You've been confirmed for ${event}.`,
      submessage: amount ? `Your pay: $${amount}` : 'Check your email for details.',
    },
    contractor_declined: {
      icon: 'info',
      title: 'Response Recorded',
      message: "Thanks for letting us know.",
      submessage: "We'll notify you of future opportunities!",
    },
    invoice_sent: {
      icon: 'success',
      title: 'Invoice Sent',
      message: email ? `Balance invoice has been sent to ${email}.` : 'Invoice has been sent.',
    },
    already_done: {
      icon: 'info',
      title: 'Already Done',
      message: params.get('message') || 'This action has already been completed.',
    },
    error: {
      icon: 'error',
      title: 'Error',
      message: getErrorMessage(error),
    },
  };

  return configs[type] || configs.error;
}

function getErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    missing_token: 'Invalid link - missing token.',
    invalid_token: 'This link is invalid or has expired.',
    already_approved: 'This quote has already been approved.',
    already_paid: 'This payment has already been confirmed.',
    already_responded: 'You have already responded to this.',
    update_failed: 'Failed to process. Please try again.',
    server_error: 'Something went wrong. Please try again later.',
    payment_cancelled: 'Payment was cancelled.',
    payment_failed: 'Payment failed. Please try again.',
  };
  return errorMessages[error] || error || 'An unknown error occurred.';
}

function ResultContent() {
  const searchParams = useSearchParams();
  const type = (searchParams.get('type') || 'error') as ResultType;
  const config = getResultConfig(type, searchParams);

  const IconComponent = {
    success: SuccessIcon,
    error: ErrorIcon,
    info: InfoIcon,
  }[config.icon];

  return (
    <div className="flex flex-col items-center text-center">
      {config.showLogo && (
        <div className="mb-6">
          <img src="/images/logoblack.png" alt="Accent Productions" className="h-16 mx-auto" />
        </div>
      )}
      <div className="mb-6"><IconComponent /></div>
      <h2 className="text-3xl font-bold text-gray-900 mb-2">{config.title}</h2>
      <p className="text-gray-700 text-lg font-medium">{config.message}</p>
      {config.submessage && (
        <p className="text-gray-500 text-sm mt-4">{config.submessage}</p>
      )}
    </div>
  );
}

export default function ResultPage() {
  return (
    <PageCard centered>
      <Suspense fallback={<LoadingSpinner />}>
        <ResultContent />
      </Suspense>
    </PageCard>
  );
}
