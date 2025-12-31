'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';

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
  const [paymentWarning, setPaymentWarning] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);

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
        'no_transaction': 'Transaction not found. Please try again.',
        'invalid': 'Invalid approval link.',
      };
      setPaymentWarning(errorMessages[errorParam] || 'An error occurred. Please try again.');
    }

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
        body: JSON.stringify({ token, skipPayment: true }),
      });

      if (res.ok) {
        router.push('/approve/success?method=none');
      } else {
        setError('Failed to approve booking');
      }
    } catch (err) {
      setError('Failed to approve booking');
    }
  };

  const handlePayWithPoli = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/initiate-poli', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const result = await res.json();

      if (res.ok && result.navigateUrl) {
        window.location.href = result.navigateUrl;
      } else {
        setError(result.message || 'Failed to initiate payment');
        setProcessing(false);
      }
    } catch (err) {
      setError('Failed to initiate payment');
      setProcessing(false);
    }
  };

  const handleBankTransferConfirm = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/client-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, paymentMethod: 'bank_transfer' }),
      });

      if (res.ok) {
        router.push('/approve/success?method=bank');
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
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </PageCard>
    );
  }

  if (error) {
    return (
      <PageCard stretch centered>
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-100 rounded-md flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
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
          <div className="w-20 h-20 bg-green-100 rounded-md flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
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
          <div className="w-20 h-20 bg-amber-100 rounded-md flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
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
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Approve & Pay</h1>
        <p className="text-gray-600 font-medium mb-6">{data.invoiceNumber}</p>

        {/* Event Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h2 className="font-bold text-lg text-gray-900 mb-2">{data.eventName}</h2>
          <p className="text-gray-700 text-sm">{formatDate(data.eventDate)}</p>
          <p className="text-gray-600 text-sm">{data.location}</p>
        </div>

        {/* Amount Due */}
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-5 mb-6">
          <div className="text-sm text-green-700 uppercase tracking-wide font-semibold mb-1">
            Deposit Due ({data.depositPercent ?? 50}%)
          </div>
          <div className="text-4xl font-bold text-green-700">
            {formatCurrency(data.depositAmount ?? 0)}
          </div>
          <div className="text-sm text-green-600 mt-2">
            Total: {formatCurrency(data.quoteTotal)}
          </div>
        </div>

        {data.notes && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-sm text-blue-900"><strong>Note:</strong> {data.notes}</p>
          </div>
        )}

        {paymentWarning && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{paymentWarning}</p>
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
              className="w-full bg-white text-gray-700 py-4 rounded-lg font-bold text-lg border-2 border-gray-300 hover:border-gray-400 transition-colors"
            >
              Pay by Bank Transfer
            </button>
          </div>
        ) : (
          /* Bank Transfer Details */
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
              <h3 className="font-bold text-amber-900 mb-3">Bank Transfer Details</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Account Name:</strong> Accent Entertainment</p>
                <p><strong>Bank:</strong> ANZ</p>
                <p><strong>Account Number:</strong> 01-0505-0123456-00</p>
                <p><strong>Reference:</strong> {data.invoiceNumber}</p>
                <p><strong>Amount:</strong> {formatCurrency(data.depositAmount ?? 0)}</p>
              </div>
              <p className="text-amber-800 text-xs mt-4">
                Please use the invoice number as your payment reference so we can match your payment.
              </p>
            </div>

            <button
              onClick={handleBankTransferConfirm}
              disabled={processing}
              className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg transition-colors hover:bg-green-700 disabled:opacity-50"
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

export default function ApprovePage() {
  return (
    <Suspense fallback={
      <PageCard stretch>
        <div className="animate-pulse h-96 bg-stone-100 rounded" />
      </PageCard>
    }>
      <ApproveContent />
    </Suspense>
  );
}
