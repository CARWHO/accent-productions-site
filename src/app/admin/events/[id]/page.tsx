'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';
import { formatDate, formatCurrencyWhole } from '@/lib/format-utils';
import { STATUS_COLORS, STATUS_LABELS, ASSIGNMENT_STATUS_COLORS, PAYMENT_STATUS_COLORS } from '@/lib/status-config';

interface Contractor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface Assignment {
  id: string;
  contractor: Contractor | null;
  status: string;
  payAmount: number | null;
  paymentStatus: string;
  reminderSentAt: string | null;
  jobsheetUrl: string | null;
  payUrl: string;
}

interface Booking {
  id: string;
  quote_number: string;
  event_name: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  booking_type: string;
  status: string;
  created_at: string;
  client_approved_at: string | null;
  contractors_notified_at: string | null;
  quote_total: number | null;
  crew_count: number | null;
  call_time: string | null;
  pack_out_time: string | null;
  vehicle_type: string | null;
  band_names: string | null;
  purchase_order: string | null;
}

interface Documents {
  quoteSheetPdf: string | null;
  quoteSpreadsheet: string | null;
  jobsheetSpreadsheet: string | null;
  techRider: string | null;
}

interface PaymentSummary {
  quoteTotal: number;
  depositAmount: number;
  balanceAmount: number;
  depositStatus: string;
  balanceStatus: string;
}

interface AdminLinks {
  reviewQuote: string;
  reviewJobsheet: string;
  selectContractors: string;
  collectBalance: string | null;
  clientApprovalPage: string | null;
}

interface EventData {
  booking: Booking;
  assignments: Assignment[];
  documents: Documents;
  paymentSummary: PaymentSummary;
  adminLinks: AdminLinks;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEventDetails() {
      try {
        const res = await fetch(`/api/admin/events/${id}/details`);
        const result = await res.json();

        if (!res.ok) {
          setError(result.error || 'Failed to load event');
          return;
        }

        setData(result);
      } catch (err) {
        console.error('Error fetching event details:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    }

    fetchEventDetails();
  }, [id]);

  if (loading) {
    return (
      <PageCard stretch>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </PageCard>
    );
  }

  if (error || !data) {
    return (
      <PageCard centered>
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Event not found'}</p>
          <button
            onClick={() => router.push('/admin/events')}
            className="text-blue-600 hover:underline"
          >
            Back to Events
          </button>
        </div>
      </PageCard>
    );
  }

  const { booking, assignments, documents, paymentSummary, adminLinks } = data;

  return (
    <PageCard stretch>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {booking.event_name || 'Untitled Event'}
          </h1>
          <p className="text-gray-500">Quote #{booking.quote_number}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              STATUS_COLORS[booking.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {STATUS_LABELS[booking.status] || booking.status}
          </span>
          <button
            onClick={() => router.push('/admin/events')}
            className="text-gray-700 font-bold text-sm"
          >
            Back
          </button>
        </div>
      </div>

      {/* Event & Client Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b border-gray-200">
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
            Event Details
          </h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Date</dt>
              <dd className="font-medium text-gray-900">{formatDate(booking.event_date)}</dd>
            </div>
            {booking.event_time && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Time</dt>
                <dd className="font-medium text-gray-900">{booking.event_time}</dd>
              </div>
            )}
            {booking.location && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Location</dt>
                <dd className="font-medium text-gray-900">{booking.location}</dd>
              </div>
            )}
            {booking.call_time && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Call Time</dt>
                <dd className="font-medium text-gray-900">{booking.call_time}</dd>
              </div>
            )}
            {booking.crew_count && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Crew</dt>
                <dd className="font-medium text-gray-900">{booking.crew_count}</dd>
              </div>
            )}
          </dl>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
            Client
          </h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900">{booking.client_name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd>
                <a href={`mailto:${booking.client_email}`} className="text-blue-600 hover:underline">
                  {booking.client_email}
                </a>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd>
                <a href={`tel:${booking.client_phone}`} className="text-blue-600 hover:underline">
                  {booking.client_phone}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Documents
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Documents
        </h3>
        <div className="flex flex-wrap gap-3">
          {documents.quoteSpreadsheet ? (
            <a
              href={documents.quoteSpreadsheet}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              Quote Sheet
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-400 rounded-md text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              Quote Sheet
            </span>
          )}

          {documents.quoteSheetPdf && (
            <a
              href={documents.quoteSheetPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              Quote PDF
            </a>
          )}

          {documents.jobsheetSpreadsheet ? (
            <a
              href={documents.jobsheetSpreadsheet}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-md hover:bg-green-100 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" clipRule="evenodd" />
              </svg>
              Job Sheet
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-400 rounded-md text-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" clipRule="evenodd" />
              </svg>
              Job Sheet
            </span>
          )}

          {documents.techRider && (
            <a
              href={documents.techRider}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              Tech Rider
            </a>
          )}
        </div>
      </div> */}

      {/* Payment Summary */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Payment
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Total</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrencyWhole(paymentSummary.quoteTotal)}</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Deposit</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrencyWhole(paymentSummary.depositAmount)}</p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                PAYMENT_STATUS_COLORS[paymentSummary.depositStatus] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {paymentSummary.depositStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Balance</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrencyWhole(paymentSummary.balanceAmount)}</p>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                PAYMENT_STATUS_COLORS[paymentSummary.balanceStatus] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {paymentSummary.balanceStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      {/* Contractors */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Contractors ({assignments.length})
        </h3>
        {assignments.length === 0 ? (
          <p className="text-gray-400 text-sm">No contractors assigned yet</p>
        ) : (
          <div className="space-y-2">
            {assignments.map(assignment => (
              <a
                key={assignment.id}
                href={assignment.payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      {assignment.contractor?.name?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {assignment.contractor?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {assignment.contractor?.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {assignment.payAmount && (
                    <span className="text-sm font-medium text-gray-700">
                      {formatCurrencyWhole(assignment.payAmount)}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      ASSIGNMENT_STATUS_COLORS[assignment.status] || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {assignment.status}
                  </span>
                  {assignment.status === 'accepted' && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        PAYMENT_STATUS_COLORS[assignment.paymentStatus] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {assignment.paymentStatus}
                    </span>
                  )}
                  {assignment.jobsheetUrl && (
                    <span
                      className="p-1 text-gray-400"
                      title="Has Job Sheet"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </span>
                  )}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Client */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Client
        </h3>
        <a
          href={`/collect-balance?token=${booking.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer block"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-blue-600">
                {booking.client_name?.charAt(0) || '?'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {booking.client_name}
              </p>
              <p className="text-xs text-gray-500">
                {booking.client_email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {paymentSummary.quoteTotal > 0 && (
              <span className="text-sm font-medium text-gray-700">
                {formatCurrencyWhole(paymentSummary.quoteTotal)}
              </span>
            )}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                PAYMENT_STATUS_COLORS[paymentSummary.depositStatus] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {paymentSummary.depositStatus.replace(/_/g, ' ')}
            </span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
          Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <a
            href={adminLinks.reviewQuote}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Review Quote
          </a>
          <a
            href={adminLinks.reviewJobsheet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Review Job Sheet
          </a>
          {documents.techRider ? (
            <a
              href={documents.techRider}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              View Tech Rider
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-100 rounded-md cursor-not-allowed" title="No tech rider uploaded">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              View Tech Rider
            </span>
          )}
          <a
            href={adminLinks.selectContractors}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Select Contractors
          </a>
          {adminLinks.collectBalance ? (
            <a
              href={adminLinks.collectBalance}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Collect Balance
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-100 rounded-md cursor-not-allowed" title="Available after deposit is paid">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Collect Balance
            </span>
          )}
        </div>
      </div>
    </PageCard>
  );
}
