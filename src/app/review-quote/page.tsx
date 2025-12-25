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

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-stone-200 rounded w-3/4" />
        <div className="h-4 bg-stone-200 rounded w-1/2" />
        <div className="h-32 bg-stone-200 rounded" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Quote Sent!</h2>
        <p className="text-gray-600 mb-4">
          The quote has been sent to {booking?.client_email}.
        </p>
        <p className="text-sm text-gray-500">
          You&apos;ll receive an email when the client approves.
        </p>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Review Quote</h1>
        <p className="text-gray-600">Quote #{booking.quote_number}</p>
      </div>

      {/* Event Details */}
      <div className="bg-stone-50 rounded-lg p-4 space-y-2">
        <h2 className="font-semibold text-lg">{booking.event_name || 'Event'}</h2>
        <p className="text-gray-600">
          <strong>Date:</strong> {formatDate(booking.event_date)}
          {booking.event_time && ` at ${booking.event_time}`}
        </p>
        <p className="text-gray-600">
          <strong>Location:</strong> {booking.location || 'TBC'}
        </p>
        <p className="text-gray-600">
          <strong>Type:</strong> {booking.booking_type === 'backline' ? 'Backline Hire' : 'Full System'}
        </p>
      </div>

      {/* Client Info */}
      <div className="bg-blue-50 rounded-lg p-4 space-y-1">
        <h3 className="font-semibold">Client</h3>
        <p className="text-gray-700">{booking.client_name}</p>
        <p className="text-gray-600 text-sm">{booking.client_email}</p>
        <p className="text-gray-600 text-sm">{booking.client_phone}</p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes for Client (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any notes or special conditions..."
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent resize-none"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4">
        <button
          onClick={handleSendToClient}
          disabled={sending}
          className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending...' : 'Send to Client for Approval'}
        </button>
        <a
          href={`/select-contractors?token=${token}`}
          className="w-full bg-gray-800 text-white py-3 px-4 rounded-md font-semibold hover:bg-gray-900 transition-colors text-center"
        >
          Skip → Select Contractors Directly
        </a>
      </div>
    </div>
  );
}

export default function ReviewQuotePage() {
  return (
    <PageCard autoHeight>
      <Suspense fallback={<div className="animate-pulse h-96 bg-stone-100 rounded" />}>
        <ReviewQuoteContent />
      </Suspense>
    </PageCard>
  );
}
