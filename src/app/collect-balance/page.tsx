'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import PageCard from '@/components/ui/PageCard';
import { LoadingSpinner, SuccessIcon, ErrorIcon } from '@/components/ui/StatusIcons';

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

function CollectBalanceContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [details, setDetails] = useState<BalanceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing token');
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
        setError('Failed to load balance details');
        setLoading(false);
      });
  }, [token]);

  const handleSendInvoice = async () => {
    if (!token) return;
    setSending(true);

    try {
      const res = await fetch('/api/send-balance-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSent(true);
      }
    } catch {
      setError('Failed to send invoice');
    } finally {
      setSending(false);
    }
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

  if (details.balanceStatus === 'paid') {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full">
        <div className="mb-6"><SuccessIcon /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Already Paid</h2>
        <p className="text-gray-600">
          Balance from <strong>{details.client.name}</strong> has already been collected.
        </p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-full">
        <div className="mb-6"><SuccessIcon /></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Invoice Sent</h2>
        <p className="text-gray-600">
          Balance invoice has been sent to <strong>{details.client.email}</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Collect Balance</h1>

        {/* Event Info */}
        <div className="bg-stone-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-500 mb-1">Event</p>
          <p className="font-semibold text-gray-900">{details.event.name || 'Event'}</p>
          <p className="text-sm text-gray-600">{formatDate(details.event.date)}</p>
          {details.event.quoteNumber && (
            <p className="text-sm text-gray-500 mt-1">Quote #{details.event.quoteNumber}</p>
          )}
        </div>

        {/* Client Info */}
        <div className="border border-stone-200 rounded-lg p-6 mb-6">
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">Client</p>
            <p className="text-xl font-bold text-gray-900">{details.client.name}</p>
            <p className="text-sm text-gray-500">{details.client.email}</p>
            {details.client.phone && (
              <p className="text-sm text-gray-500">{details.client.phone}</p>
            )}
          </div>

          <div className="border-t border-stone-200 pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-lg font-semibold text-gray-900">${details.total.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Deposit Paid</p>
                <p className="text-lg font-semibold text-gray-900">${details.deposit.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Balance Due</p>
                <p className="text-2xl font-bold text-gray-900">${details.balance.toFixed(0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-auto pt-4">
        <button
          onClick={handleSendInvoice}
          disabled={sending}
          className="w-full bg-black hover:bg-stone-800 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-lg text-lg transition-colors"
        >
          {sending ? 'Sending...' : 'Send Invoice to Client'}
        </button>
        <p className="text-center text-sm text-gray-500 mt-3">
          This will email {details.client.name.split(' ')[0]} with a payment link for ${details.balance.toFixed(0)}.
        </p>
      </div>
    </div>
  );
}

export default function CollectBalancePage() {
  return (
    <PageCard>
      <Suspense fallback={<div className="animate-pulse h-40 bg-stone-100 rounded" />}>
        <CollectBalanceContent />
      </Suspense>
    </PageCard>
  );
}
