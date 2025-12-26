'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PageCard from '@/components/ui/PageCard';

function PaymentContent() {
  const searchParams = useSearchParams();
  const invoice = searchParams.get('invoice');
  const amount = searchParams.get('amount');

  return (
    <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Payment Coming Soon</h2>
        <p className="text-gray-700 text-lg font-medium">
          Online payments will be available shortly.
        </p>
        {invoice && amount && (
          <div className="mt-6 bg-stone-100 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-600">Invoice: <strong>{invoice}</strong></p>
            <p className="text-sm text-gray-600">Amount: <strong>${amount}</strong></p>
          </div>
        )}
        <p className="text-gray-500 text-base mt-6">
          For now, please use bank transfer.<br />
          Details are on your invoice.
        </p>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <PageCard centered>
      <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
        <PaymentContent />
      </Suspense>
    </PageCard>
  );
}
