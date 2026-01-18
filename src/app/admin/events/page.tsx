'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
  approval_token: string;
  next_occurrence_date: string | null;
  recurrence_reminder_days: number | null;
}

interface Client {
  client_name: string;
  client_email: string;
}

interface Reminder {
  id: string;
  contractor: { id: string; name: string; email: string };
  booking: {
    id: string;
    event_name: string | null;
    event_date: string;
    event_time: string | null;
    location: string | null;
    quote_number: string | null;
    client_name: string;
    daysUntil: number;
  };
  reminderDate: string;
  daysUntilReminder: number;
  reminderDue: boolean;
  reminderSent: boolean;
  lastReminderSentAt: string | null;
}

interface Payment {
  id: string;
  type: 'contractor' | 'balance';
  contractor?: { id: string; name: string; email: string };
  client?: { name: string; email: string };
  booking: {
    id: string;
    event_name: string | null;
    event_date: string;
    quote_number: string | null;
    client_name?: string;
  };
  amount: number | null;
  paymentStatus: string;
  payUrl?: string;
  collectUrl?: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  quote_sent: 'bg-blue-100 text-blue-800',
  client_approved: 'bg-green-100 text-green-800',
  contractors_notified: 'bg-purple-100 text-purple-800',
  assigned: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  quote_sent: 'Quote Sent',
  client_approved: 'Approved',
  contractors_notified: 'Notified',
  assigned: 'Assigned',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const ITEMS_PER_PAGE = 50;

export default function AdminEventsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'events' | 'reminders' | 'payments'>('events');

  // Events state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [sortField, setSortField] = useState('event_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk delete modal
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Duplicate state
  const [duplicating, setDuplicating] = useState<string | null>(null);

  // Reminders state
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  // Payments state
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    fetchEvents();
    // Clear selections when filters/page change
    setSelectedIds(new Set());
  }, [search, statusFilter, clientFilter, showPast, sortField, sortOrder, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, clientFilter, showPast]);

  useEffect(() => {
    if (activeTab === 'reminders') {
      fetchReminders();
    } else if (activeTab === 'payments') {
      fetchPayments();
    }
  }, [activeTab]);

  async function fetchEvents() {
    setLoading(true);
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (clientFilter) params.set('client', clientFilter);
    if (showPast) params.set('past', 'true');
    params.set('sort', sortField);
    params.set('order', sortOrder);
    params.set('limit', String(ITEMS_PER_PAGE));
    params.set('offset', String((currentPage - 1) * ITEMS_PER_PAGE));

    try {
      const res = await fetch(`/api/admin/events?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setBookings(data.bookings || []);
        setTotal(data.total || 0);
        setClients(data.clients || []);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReminders() {
    setLoadingReminders(true);
    try {
      const res = await fetch('/api/admin/reminders/upcoming');
      const data = await res.json();
      if (res.ok) {
        setReminders(data.reminders || []);
      }
    } catch (err) {
      console.error('Error fetching reminders:', err);
    } finally {
      setLoadingReminders(false);
    }
  }

  async function fetchPayments() {
    setLoadingPayments(true);
    try {
      const res = await fetch('/api/admin/payments/pending');
      const data = await res.json();
      if (res.ok) {
        setPayments(data.payments || []);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleRowClick = (booking: Booking, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, a, input')) {
      return;
    }
    router.push(`/admin/events/${booking.id}`);
  };

  const handleDuplicate = async (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Create a new event based on "${booking.event_name || booking.quote_number}"?\n\nThis will copy the quote sheet and create a new pending booking.`)) {
      return;
    }

    setDuplicating(booking.id);
    try {
      const res = await fetch('/api/admin/events/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      const data = await res.json();

      if (res.ok && data.redirectUrl) {
        router.push(data.redirectUrl);
      } else {
        alert(data.error || 'Failed to duplicate event');
      }
    } catch (err) {
      console.error('Error duplicating:', err);
      alert('Failed to duplicate event');
    } finally {
      setDuplicating(null);
    }
  };

  const openDeleteModal = (booking: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookingToDelete(booking);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!bookingToDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/events/${bookingToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDeleteModalOpen(false);
        setBookingToDelete(null);
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete event');
      }
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  const handleSendReminder = async (assignmentId: string) => {
    setSendingReminder(assignmentId);
    try {
      const res = await fetch('/api/admin/reminders/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId }),
      });

      if (res.ok) {
        fetchReminders();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send reminder');
      }
    } catch (err) {
      console.error('Error sending reminder:', err);
      alert('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  // Pagination helpers
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, total);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map(b => b.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setBulkDeleting(true);
    try {
      const res = await fetch('/api/admin/events/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      if (res.ok) {
        setBulkDeleteModalOpen(false);
        setSelectedIds(new Set());
        fetchEvents();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete events');
      }
    } catch (err) {
      console.error('Error bulk deleting:', err);
      alert('Failed to delete events');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">Manage events, reminders, and payments</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'events'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Events
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'reminders'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Contractor Reminders
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'payments'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Pending Payments
          </button>
        </div>

        {/* Events Tab */}
        {activeTab === 'events' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search events, clients, quotes..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <select
                  value={clientFilter}
                  onChange={e => setClientFilter(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                >
                  <option value="">All Clients</option>
                  {clients.map(client => (
                    <option key={client.client_email} value={client.client_name}>
                      {client.client_name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPast}
                      onChange={e => setShowPast(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                    />
                    <span className="text-sm">Show Past</span>
                  </label>
                  <button
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('');
                      setClientFilter('');
                      setShowPast(false);
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4 h-10">
              <div className="text-sm text-gray-500">
                {total > 0 ? (
                  <>Showing {startItem}-{endItem} of {total} events</>
                ) : (
                  <>No events found</>
                )}
              </div>
              <button
                onClick={() => setBulkDeleteModalOpen(true)}
                className={`flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-opacity ${
                  selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Selected ({selectedIds.size || 0})
              </button>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : bookings.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No events found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={bookings.length > 0 && selectedIds.size === bookings.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                          />
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort('event_date')}
                        >
                          Date {sortField === 'event_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Event
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort('client_name')}
                        >
                          Client {sortField === 'client_name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                          onClick={() => toggleSort('status')}
                        >
                          Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Quote
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {bookings.map(booking => (
                        <tr
                          key={booking.id}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedIds.has(booking.id) ? 'bg-blue-50' : ''}`}
                          onClick={e => handleRowClick(booking, e)}
                        >
                          <td className="px-3 py-4 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(booking.id)}
                              onChange={() => toggleSelectOne(booking.id)}
                              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatDate(booking.event_date)}
                            </div>
                            {booking.event_time && (
                              <div className="text-xs text-gray-500">{booking.event_time}</div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-gray-900">
                              {booking.event_name || 'Untitled Event'}
                            </div>
                            {booking.location && (
                              <div className="text-xs text-gray-500">{booking.location}</div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">{booking.client_name}</div>
                            <div className="text-xs text-gray-500">{booking.client_email}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                STATUS_COLORS[booking.status] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {STATUS_LABELS[booking.status] || booking.status}
                            </span>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">#{booking.quote_number}</div>
                            {booking.quote_total && (
                              <div className="text-xs text-gray-500">
                                ${booking.quote_total.toLocaleString()}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={e => handleDuplicate(booking, e)}
                                disabled={duplicating === booking.id}
                                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-50"
                                title="Duplicate Event"
                              >
                                {duplicating === booking.id ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={e => openDeleteModal(booking, e)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete Event"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Contractor Reminders</h2>
              <p className="text-sm text-gray-500 mt-1">Events in the next 30 days with assigned contractors</p>
            </div>
            {loadingReminders ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : reminders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No upcoming reminders</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {reminders.map(reminder => (
                  <div key={reminder.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-gray-900">{reminder.contractor.name}</h3>
                          {reminder.reminderDue && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                              Due Today
                            </span>
                          )}
                          {reminder.reminderSent && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              Sent
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {reminder.booking.event_name || 'Event'} - {formatDate(reminder.booking.event_date)}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {reminder.booking.daysUntil} days until event | Reminder date: {formatDate(reminder.reminderDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSendReminder(reminder.id)}
                          disabled={sendingReminder === reminder.id}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                          {sendingReminder === reminder.id ? 'Sending...' : 'Send Now'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Pending Payments</h2>
              <p className="text-sm text-gray-500 mt-1">Contractor payments and client balances</p>
            </div>
            {loadingPayments ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No pending payments</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {payments.map(payment => (
                  <div key={`${payment.type}-${payment.id}`} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              payment.type === 'contractor'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {payment.type === 'contractor' ? 'Contractor' : 'Balance'}
                          </span>
                          <h3 className="font-medium text-gray-900">
                            {payment.type === 'contractor'
                              ? payment.contractor?.name
                              : payment.client?.name}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {payment.booking.event_name || `Quote #${payment.booking.quote_number}`}
                          {' - '}
                          {formatDate(payment.booking.event_date)}
                        </p>
                        {payment.amount && (
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            ${payment.amount.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={payment.payUrl || payment.collectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                        >
                          {payment.type === 'contractor' ? 'Pay' : 'Collect'}
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && bookingToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Event</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to permanently delete{' '}
              <strong>{bookingToDelete.event_name || `Quote #${bookingToDelete.quote_number}`}</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will delete all associated files, contractor assignments, and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setBookingToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete {selectedIds.size} Events</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to permanently delete <strong>{selectedIds.size} event{selectedIds.size > 1 ? 's' : ''}</strong>?
            </p>
            <p className="text-sm text-red-600 mb-6">
              This will delete all associated files, contractor assignments, and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setBulkDeleteModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Event${selectedIds.size > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
