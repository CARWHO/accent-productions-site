'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';
import { LoadingSpinner, SuccessIcon, ErrorIcon, InfoIcon } from '@/components/ui/StatusIcons';

interface ApprovalData {
  bookingId: string;
  clientName: string;
  eventName: string;
  eventDate: string;
  location: string;
  quoteTotal: number;
  depositAmount: number | null;
  depositPercent: number | null;
  invoiceNumber: string;
  notes: string | null;
  alreadyApproved: boolean;
  paymentStatus: string;
  readyForApproval: boolean;
}

function ApproveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [purchaseOrder, setPurchaseOrder] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing approval token');
      setLoading(false);
      return;
    }

    async function fetchApprovalData() {
      try {
        const res = await fetch(`/api/get-approval?token=${token}`);
        const result = await res.json();

        if (!res.ok) {
          setError(result.message || 'Failed to load approval');
          return;
        }

        // Only auto-approve if deposit is explicitly set to 0 (not null)
        if (result.readyForApproval && result.depositAmount === 0 && !result.alreadyApproved) {
          await handleAutoApprove();
          return;
        }

        setData(result);
      } catch (err) {
        console.error('Error fetching approval:', err);
        setError('Failed to load approval data');
      } finally {
        setLoading(false);
      }
    }

    fetchApprovalData();
  }, [token]);

  const handleAutoApprove = async () => {
    try {
      const res = await fetch('/api/client-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, skipPayment: true, purchaseOrder: purchaseOrder || null }),
      });

      if (res.ok) {
        router.push('/result?type=quote_approved&event=' + encodeURIComponent(data?.eventName || ''));
      } else {
        setError('Failed to approve booking');
      }
    } catch (err) {
      setError('Failed to approve booking');
    }
  };

  const handleBankTransferConfirm = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/client-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, paymentMethod: 'bank_transfer', purchaseOrder: purchaseOrder || null }),
      });

      if (res.ok) {
        router.push('/result?type=quote_approved&event=' + encodeURIComponent(data?.eventName || ''));
      } else {
        setError('Failed to confirm payment');
        setProcessing(false);
      }
    } catch (err) {
      setError('Failed to confirm payment');
      setProcessing(false);
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
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-700 text-lg font-medium">{error}</p>
        </div>
      </PageCard>
    );
  }

  if (data?.alreadyApproved) {
    return (
      <PageCard stretch centered>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6"><SuccessIcon /></div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Already Approved</h2>
          <p className="text-gray-700 text-lg font-medium">This booking has already been approved.</p>
        </div>
      </PageCard>
    );
  }

  // Quote not ready for approval yet (admin hasn't reviewed/sent it)
  if (data && !data.readyForApproval) {
    return (
      <PageCard stretch centered>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6"><InfoIcon /></div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Quote Pending</h2>
          <p className="text-gray-700 text-lg font-medium">Your quote is still being prepared.</p>
          <p className="text-gray-500 mt-2">You&apos;ll receive an email when it&apos;s ready for approval.</p>
        </div>
      </PageCard>
    );
  }

  if (!data) return null;

  return (
    <PageCard stretch>
      <div className="flex flex-col">
        <div className="text-center mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Approve & Pay</h1>
          <p className="text-gray-600 font-medium">{data.invoiceNumber}</p>
        </div>

        {/* Event Summary */}
        <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 mb-6">
          <h2 className="font-bold text-lg text-gray-900 mb-2">{data.eventName}</h2>
          <p className="text-gray-700 text-sm">{formatDate(data.eventDate)}</p>
          <p className="text-gray-600 text-sm">{data.location}</p>
        </div>

        {/* Amount Due */}
        <div className="bg-stone-100 border-2 border-stone-400 rounded-lg p-5 mb-6">
          <div className="text-sm text-stone-600 uppercase tracking-wide font-semibold mb-1">
            Deposit Due ({data.depositPercent ?? 50}%)
          </div>
          <div className="text-4xl font-bold text-stone-800">
            {formatCurrency(data.depositAmount ?? 0)}
          </div>
          <div className="text-sm text-stone-600 mt-2">
            Total: {formatCurrency(data.quoteTotal)}
          </div>
        </div>

        {data.notes && (
          <div className="bg-stone-50 border-l-4 border-stone-400 p-4 mb-6">
            <p className="text-sm text-stone-800"><strong>Note:</strong> {data.notes}</p>
          </div>
        )}

        {/* Purchase Order (optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Purchase Order No. <span className="text-stone-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={purchaseOrder}
            onChange={(e) => setPurchaseOrder(e.target.value)}
            placeholder="e.g. PO-12345"
            className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-500 focus:border-transparent"
          />
          <p className="text-xs text-stone-500 mt-1">
            If your organisation requires a PO number on the invoice, enter it here.
          </p>
        </div>

        {/* Bank Transfer Details */}
        <div className="space-y-4">
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-5">
            <h3 className="font-bold text-stone-800 mb-3">Bank Transfer Details</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Account Name:</strong> Accent Entertainment</p>
              <p><strong>Bank:</strong> ANZ</p>
              <p><strong>Account Number:</strong> 01-0505-0123456-00</p>
              <p><strong>Reference:</strong> {data.invoiceNumber}</p>
              <p><strong>Amount:</strong> {formatCurrency(data.depositAmount ?? 0)}</p>
            </div>
            <p className="text-stone-600 text-xs mt-4">
              Please use the invoice number as your payment reference so we can match your payment.
            </p>
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
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Questions? Contact us at hello@accent-productions.co.nz
        </p>
      </div>
    </PageCard>
  );
}

export default function ApprovePage() {
  return (
    <Suspense fallback={
      <PageCard stretch>
        <LoadingSpinner />
      </PageCard>
    }>
      <ApproveContent />
    </Suspense>
  );
}
