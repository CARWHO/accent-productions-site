'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import PageCard from '@/components/ui/PageCard';
import { LoadingSpinner, SuccessIcon, ErrorIcon } from '@/components/ui/StatusIcons';

interface PaymentDetails {
  id: string;
  amount: number;
  paymentStatus: string;
  contractor: {
    name: string;
    email: string;
    bankAccount: string | null;
  };
  event: {
    name: string | null;
    date: string;
    quoteNumber: string | null;
  };
}

function PayContractorContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing payment token');
      setLoading(false);
      return;
    }

    fetch(`/api/get-payment-details?token=${token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setDetails(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load payment details');
        setLoading(false);
      });
  }, [token]);

  const handleConfirmPaid = async () => {
    if (!token) return;
    setConfirming(true);

    // Redirect to the confirm endpoint with reference
    const params = new URLSearchParams({ token });
    if (reference.trim()) {
      params.set('reference', reference.trim());
    }
    window.location.href = `/api/confirm-contractor-payment?${params.toString()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full">
        <div className="mb-6"><ErrorIcon /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (!details) return null;

  if (details.paymentStatus === 'paid') {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full">
        <div className="mb-6"><SuccessIcon /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Paid</h2>
        <p className="text-gray-600">
          Payment to <strong>{details.contractor.name}</strong> has already been confirmed.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Pay Contractor</h1>

        {/* Event Info */}
        <div className="bg-stone-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500 mb-1">Event</p>
          <p className="font-semibold text-gray-900">{details.event.name || 'Event'}</p>
          <p className="text-sm text-gray-600">{formatDate(details.event.date)}</p>
          {details.event.quoteNumber && (
            <p className="text-sm text-gray-500 mt-1">Quote #{details.event.quoteNumber}</p>
          )}
        </div>

        {/* Payment Details */}
        <div className="border border-stone-200 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Pay to</p>
              <p className="text-xl font-bold text-gray-900">{details.contractor.name}</p>
              <p className="text-sm text-gray-500">{details.contractor.email}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Amount</p>
              <p className="text-3xl font-bold text-gray-900">${details.amount}</p>
            </div>
          </div>

          <div className="border-t border-stone-200 pt-4">
            <p className="text-sm text-gray-500 mb-2">Bank Account</p>
            {details.contractor.bankAccount ? (
              <p className="text-xl font-mono font-semibold text-gray-900 bg-stone-100 p-3 rounded">
                {details.contractor.bankAccount}
              </p>
            ) : (
              <p className="text-gray-500 italic">No bank account on file</p>
            )}
          </div>
        </div>

        {/* Reference Input */}
        <div className="mb-6">
          <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
            Payment Reference
          </label>
          <input
            type="text"
            id="reference"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. Bank transfer reference"
            className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500"
          />
          <p className="text-sm text-gray-500 mt-1">Optional - will be included in the payment email</p>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-auto pt-4">
        <button
          onClick={handleConfirmPaid}
          disabled={confirming}
          className="w-full bg-black hover:bg-stone-800 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg text-lg transition-colors"
        >
          {confirming ? 'Processing...' : "I've Paid This"}
        </button>
        <p className="text-center text-sm text-gray-500 mt-3">
          This will notify {details.contractor.name.split(' ')[0]} that payment has been sent.
        </p>
      </div>
    </div>
  );
}

export default function PayContractorPage() {
  return (
    <PageCard>
      <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
        <PayContractorContent />
      </Suspense>
    </PageCard>
  );
}
