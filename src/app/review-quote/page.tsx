'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';

interface QuoteLineItems {
  foh: number;
  monitors: { count: number; cost: number };
  microphones: { count: number; cost: number };
  console: number;
  cables: number;
  vehicle: number;
  techTime: { hours: number; rate: number; cost: number };
}

interface SuggestedGearItem {
  item: string;
  quantity: number;
  notes?: string;
  matchedInInventory?: boolean;
}

interface SoundQuoteOutput {
  quoteNumber: string;
  title: string;
  subtitle: string;
  lineItems: QuoteLineItems;
  executionNotes: string[];
  suggestedGear: SuggestedGearItem[];
  unavailableGear: string[];
  subtotal: number;
  gst: number;
  total: number;
}

interface Booking {
  id: string;
  quote_number: string;
  event_name: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  booking_type: string;
  quote_json: SoundQuoteOutput | null;
  quote_total: number | null;
  status: string;
  quote_sheet_id: string | null;
}

function ReviewQuoteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [depositPercent, setDepositPercent] = useState<string>('50');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing token');
      setLoading(false);
      return;
    }

    async function fetchBooking() {
      try {
        const res = await fetch(`/api/review-quote?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.message || 'Failed to load booking');
          return;
        }

        setBooking(data.booking);
      } catch (err) {
        console.error('Error fetching booking:', err);
        setError('Failed to load booking');
      } finally {
        setLoading(false);
      }
    }

    fetchBooking();
  }, [token]);

  const handleSendToClient = async () => {
    if (!booking) return;

    setSending(true);
    try {
      const res = await fetch('/api/send-to-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.id,
          notes: notes || null,
          depositPercent: depositPercent ? parseFloat(depositPercent) : 50,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to send');
      }

      setSent(true);
    } catch (err) {
      console.error('Error sending to client:', err);
      alert('Failed to send quote to client. Please try again.');
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

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const inputStyles = "w-full border border-gray-300 rounded-md px-3 py-2.5 text-base focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium";

  if (loading) {
    return (
      <PageCard>
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
      <PageCard centered>
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

  if (sent) {
    return (
      <PageCard centered>
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-[#000000] rounded-md flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Quote Sent!</h2>
          <p className="text-gray-700 text-lg font-medium">
            The quote has been sent to {booking?.client_email}.
          </p>
        </div>
      </PageCard>
    );
  }

  if (!booking) return null;

  const quote = booking.quote_json;

  return (
    <PageCard stretch>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Review Quote</h1>
            <p className="text-gray-600 font-medium">Quote #{booking.quote_number}</p>
          </div>
          {booking.quote_sheet_id && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${booking.quote_sheet_id}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
              </svg>
              Edit in Sheets
            </a>
          )}
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          <span className={`text-xs font-semibold px-2 py-1 rounded ${
            booking.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            booking.status === 'sent_to_client' ? 'bg-blue-100 text-blue-800' :
            booking.status === 'client_approved' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {booking.status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid gap-4 flex-grow overflow-y-auto">
          {/* Event Details */}
          <div className="border border-gray-200 rounded-md p-4">
            <h2 className="font-bold text-lg text-gray-900 mb-3">{booking.event_name || 'Event'}</h2>
            <div className="grid gap-2 text-sm">
              <p className="text-gray-700">
                <span className="font-semibold">Date:</span> {formatDate(booking.event_date)}
                {booking.event_time && ` at ${booking.event_time}`}
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Location:</span> {booking.location || 'TBC'}
              </p>
              <p className="text-gray-700">
                <span className="font-semibold">Type:</span> {booking.booking_type === 'backline' ? 'Backline Hire' : 'Full System'}
              </p>
            </div>
          </div>

          {/* Client Info */}
          <div className="border border-gray-200 rounded-md p-4">
            <h3 className="font-bold text-gray-900 mb-2">Client</h3>
            <p className="text-gray-900 font-medium">{booking.client_name}</p>
            <p className="text-gray-600 text-sm">{booking.client_email}</p>
            <p className="text-gray-600 text-sm">{booking.client_phone}</p>
          </div>

          {/* Quote Line Items */}
          {quote && (
            <div className="border border-gray-200 rounded-md p-4">
              <h3 className="font-bold text-gray-900 mb-3">Quote Line Items</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">FOH System</span>
                  <span className="font-medium">{formatCurrency(quote.lineItems.foh)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Monitors ({quote.lineItems.monitors.count}x)</span>
                  <span className="font-medium">{formatCurrency(quote.lineItems.monitors.cost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Microphones ({quote.lineItems.microphones.count}x)</span>
                  <span className="font-medium">{formatCurrency(quote.lineItems.microphones.cost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Console</span>
                  <span className="font-medium">{formatCurrency(quote.lineItems.console)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Cables & Accessories</span>
                  <span className="font-medium">{formatCurrency(quote.lineItems.cables)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Vehicle</span>
                  <span className="font-medium">{formatCurrency(quote.lineItems.vehicle)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Tech Time ({quote.lineItems.techTime.hours} hrs @ ${quote.lineItems.techTime.rate}/hr)
                  </span>
                  <span className="font-medium">{formatCurrency(quote.lineItems.techTime.cost)}</span>
                </div>

                {/* Totals */}
                <div className="border-t pt-3 mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (15%)</span>
                    <span className="font-medium">{formatCurrency(quote.gst)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(quote.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Execution Notes */}
          {quote && quote.executionNotes.length > 0 && (
            <div className="border border-gray-200 rounded-md p-4">
              <h3 className="font-bold text-gray-900 mb-3">Execution Notes</h3>
              <ul className="space-y-2">
                {quote.executionNotes.map((note, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-700">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Gear */}
          {quote && quote.suggestedGear.length > 0 && (
            <div className="border border-gray-200 rounded-md p-4">
              <h3 className="font-bold text-gray-900 mb-3">Suggested Gear</h3>
              <div className="space-y-2">
                {quote.suggestedGear.map((gear, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{gear.quantity}×</span>
                    <span className={`text-sm ${gear.matchedInInventory === false ? 'text-red-600' : 'text-gray-700'}`}>
                      {gear.item}
                      {gear.matchedInInventory === false && ' ⚠'}
                    </span>
                    {gear.notes && (
                      <span className="text-xs text-gray-500 italic">({gear.notes})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deposit Percent */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Deposit Required
            </label>
            <div className="relative">
              <input
                type="number"
                value={depositPercent}
                onChange={(e) => setDepositPercent(e.target.value)}
                placeholder="50"
                min="0"
                max="100"
                step="10"
                className={`${inputStyles} pr-8`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Percentage of total to request upfront (default 50%)</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes for Client (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes or special conditions..."
              rows={3}
              className={`${inputStyles} resize-y`}
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-3 pt-6 mt-auto">
          <button
            onClick={handleSendToClient}
            disabled={sending}
            className="w-full bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000] disabled:opacity-50"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </span>
            ) : 'Send to Client for Approval'}
          </button>
        </div>
      </div>
    </PageCard>
  );
}

export default function ReviewQuotePage() {
  return (
    <Suspense fallback={
      <PageCard>
        <div className="animate-pulse h-96 bg-stone-100 rounded" />
      </PageCard>
    }>
      <ReviewQuoteContent />
    </Suspense>
  );
}
