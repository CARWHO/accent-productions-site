'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';

function SuccessContent() {
  const searchParams = useSearchParams();
  const method = searchParams.get('method');

  const getMessage = () => {
    switch (method) {
      case 'poli':
        return {
          title: 'Payment Received!',
          subtitle: 'Your booking is now confirmed.',
          detail: 'We\'ve received your deposit payment. You\'ll receive a confirmation email shortly.'
        };
      case 'bank':
        return {
          title: 'Booking Confirmed!',
          subtitle: 'Thank you for your payment.',
          detail: 'We\'ll confirm receipt of your bank transfer shortly. You\'ll receive a confirmation email once verified.'
        };
      case 'none':
        return {
          title: 'Booking Approved!',
          subtitle: 'You\'re all set.',
          detail: 'Your booking has been confirmed. We\'ll be in touch with more details soon.'
        };
      default:
        return {
          title: 'Success!',
          subtitle: 'Your booking has been processed.',
          detail: 'You\'ll receive a confirmation email shortly.'
        };
    }
  };

  const message = getMessage();

  return (
    <PageCard centered>
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-green-100 rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{message.title}</h1>
        <p className="text-gray-700 text-lg font-medium mb-4">{message.subtitle}</p>
        <p className="text-gray-500 max-w-md">{message.detail}</p>
      </div>
    </PageCard>
  );
}

export default function ApproveSuccessPage() {
  return (
    <Suspense fallback={
      <PageCard>
        <div className="animate-pulse h-48 bg-stone-100 rounded" />
      </PageCard>
    }>
      <SuccessContent />
    </Suspense>
  );
}
