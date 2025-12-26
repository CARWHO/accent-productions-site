'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';

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
  details_json: Record<string, unknown> | null;
}

function ReviewQuoteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
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

  return (
    <PageCard>
      <div className="flex flex-col">
      <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Review Quote</h1>
      <p className="text-gray-600 mb-6 font-medium">Quote #{booking.quote_number}</p>

      <div className="grid gap-4">
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

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-6">
        <button
          onClick={handleSendToClient}
          disabled={sending}
          className="w-full bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000] disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send to Client for Approval'}
        </button>
        <a
          href={`/select-contractors?token=${token}`}
          className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-md font-bold text-base transition-colors hover:border-gray-400 text-center"
        >
          Skip → Select Contractors Directly
        </a>
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
