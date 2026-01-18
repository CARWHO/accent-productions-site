'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import PageCard from '@/components/ui/PageCard';
import { LoadingSpinner, SuccessIcon, ErrorIcon, InfoIcon } from '@/components/ui/StatusIcons';

interface BalanceDetails {
  id: string;
  total: number;
  deposit: number;
  balance: number;
  balanceStatus: string;
  client: {
    name: string;
    email: string;
    phone: string | null;
  };
  event: {
    name: string | null;
    date: string;
    quoteNumber: string | null;
  };
}

function PayBalanceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [details, setDetails] = useState<BalanceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentWarning, setPaymentWarning] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [reference, setReference] = useState('');

  useEffect(() => {
    // Check for payment errors from POLi callback
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        'payment_cancelled': 'Payment was cancelled. Please try again.',
        'payment_failure': 'Payment failed. Please try again or use bank transfer.',
        'payment_incomplete': 'Payment was not completed. Please try again.',
        'config': 'Payment system not configured. Please use bank transfer.',
        'server': 'Server error occurred. Please try again.',
      };
      setPaymentWarning(errorMessages[errorParam] || 'An error occurred. Please try again.');
    }

    if (!token) {
      setError('Missing payment token');
      setLoading(false);
      return;
    }

    fetch(`/api/get-balance-details?token=${token}`)
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
  }, [token, searchParams]);

  const handlePayWithPoli = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const res = await fetch('/api/initiate-poli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, type: 'balance' }),
      });

      const result = await res.json();

      if (res.ok && result.navigateUrl) {
        window.location.href = result.navigateUrl;
      } else {
        setError(result.message || 'Failed to initiate payment');
        setProcessing(false);
      }
    } catch {
      setError('Failed to initiate payment');
      setProcessing(false);
    }
  };

  const handleBankTransferConfirm = async () => {
    if (!token) return;
    setProcessing(true);

    const params = new URLSearchParams({ token });
    if (reference.trim()) {
      params.set('reference', reference.trim());
    }
    window.location.href = `/api/confirm-balance-payment?${params.toString()}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loading) {
    return (
      <PageCard stretch>
        <LoadingSpinner />
      </PageCard>
    );
  }

  if (error) {
    return (
      <PageCard stretch centered>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6"><ErrorIcon /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </PageCard>
    );
  }

  if (!details) return null;

  if (details.balanceStatus === 'paid') {
    return (
      <PageCard stretch centered>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6">
            <img src="/images/logoblack.png" alt="Accent Productions" className="h-16 mx-auto" />
          </div>
          <div className="mb-6"><SuccessIcon /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Paid</h2>
          <p className="text-gray-600">Thank you! Your balance has already been paid.</p>
        </div>
      </PageCard>
    );
  }

  return (
    <PageCard stretch>
      <div className="flex flex-col">
        <div className="text-center mb-6">
          <img src="/images/logoblack.png" alt="Accent Productions" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Pay Balance</h1>
          {details.event.quoteNumber && (
            <p className="text-gray-600 font-medium">Quote #{details.event.quoteNumber}</p>
          )}
        </div>

        {/* Event Summary */}
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 mb-6">
          <h2 className="font-bold text-lg text-gray-900 mb-2">{details.event.name || 'Event'}</h2>
          <p className="text-gray-700 text-sm">{formatDate(details.event.date)}</p>
        </div>

        {/* Amount Due */}
        <div className="bg-stone-100 border-2 border-stone-400 rounded-lg p-5 mb-6">
          <div className="text-sm text-stone-600 uppercase tracking-wide font-semibold mb-1">
            Balance Due
          </div>
          <div className="text-4xl font-bold text-stone-800">
            {formatCurrency(details.balance)}
          </div>
          <div className="text-sm text-stone-600 mt-2 space-y-1">
            <p>Total: {formatCurrency(details.total)}</p>
            <p>Deposit Paid: -{formatCurrency(details.deposit)}</p>
          </div>
        </div>

        {paymentWarning && (
          <div className="bg-stone-100 border border-stone-300 rounded-lg p-4 mb-6">
            <p className="text-sm text-stone-700">{paymentWarning}</p>
          </div>
        )}

        {!showBankDetails ? (
          /* Payment Choice */
          <div className="space-y-3">
            <button
              onClick={handlePayWithPoli}
              disabled={processing}
              className="w-full bg-[#00457C] text-white py-4 rounded-lg font-bold text-lg transition-colors hover:bg-[#003366] disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                  </svg>
                  Pay with POLi
                </>
              )}
            </button>

            <button
              onClick={() => setShowBankDetails(true)}
              className="w-full bg-white text-gray-700 py-4 rounded-lg font-bold text-lg border-2 border-stone-300 hover:border-stone-400 transition-colors"
            >
              Pay by Bank Transfer
            </button>
          </div>
        ) : (
          /* Bank Transfer Details */
          <div className="space-y-4">
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-5">
              <h3 className="font-bold text-stone-800 mb-3">Bank Transfer Details</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Account Name:</strong> Accent Entertainment</p>
                <p><strong>Bank:</strong> ANZ</p>
                <p><strong>Account Number:</strong> 01-0505-0123456-00</p>
                <p><strong>Reference:</strong> {details.event.quoteNumber || 'Your Name'}</p>
                <p><strong>Amount:</strong> {formatCurrency(details.balance)}</p>
              </div>
              <p className="text-stone-600 text-xs mt-4">
                Please use the quote number as your payment reference so we can match your payment.
              </p>
            </div>

            <div>
              <label htmlFor="reference" className="block text-sm font-medium text-gray-700 mb-2">
                Your Payment Reference
              </label>
              <input
                type="text"
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Bank transfer reference"
                className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-500 focus:border-stone-500"
              />
              <p className="text-sm text-gray-500 mt-1">Enter the reference used for your bank transfer</p>
            </div>

            <button
              onClick={handleBankTransferConfirm}
              disabled={processing}
              className="w-full bg-stone-800 text-white py-4 rounded-lg font-bold text-lg transition-colors hover:bg-stone-900 disabled:opacity-50"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                "I've Made the Payment"
              )}
            </button>

            <button
              onClick={() => setShowBankDetails(false)}
              className="w-full text-gray-500 py-2 font-medium"
            >
              Back to payment options
            </button>
          </div>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">
          Questions? Contact us at hello@accent-productions.co.nz
        </p>
      </div>
    </PageCard>
  );
}

export default function PayBalancePage() {
  return (
    <Suspense fallback={
      <PageCard stretch>
        <LoadingSpinner />
      </PageCard>
    }>
      <PayBalanceContent />
    </Suspense>
  );
}
