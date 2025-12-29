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

interface DetailsJson {
  eventType?: string;
  attendance?: string;
  setupTime?: string;
  venue?: {
    indoorOutdoor?: string;
    powerAccess?: string;
  };
  contentRequirements?: string[];
  additionalInfo?: string;
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
  details_json: DetailsJson | null;
  quote_total: number | null;
  status: string;
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

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedQuote, setEditedQuote] = useState<SoundQuoteOutput | null>(null);
  const [editedDetails, setEditedDetails] = useState<DetailsJson | null>(null);

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
        setEditedQuote(data.booking.quote_json);
        setEditedDetails(data.booking.details_json || {});
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

  const handleSaveChanges = async () => {
    if (!token || !editedQuote) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/review-quote?token=${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteData: editedQuote,
          detailsData: editedDetails,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save');
      }

      setBooking(data.booking);
      setEditedQuote(data.booking.quote_json);
      setEditedDetails(data.booking.details_json || {});
      setEditMode(false);
    } catch (err) {
      console.error('Error saving changes:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedQuote(booking?.quote_json || null);
    setEditedDetails(booking?.details_json || {});
    setEditMode(false);
  };

  // Recalculate totals when line items change
  const recalculateTotals = (lineItems: QuoteLineItems) => {
    const subtotal =
      lineItems.foh +
      lineItems.monitors.cost +
      lineItems.microphones.cost +
      lineItems.console +
      lineItems.cables +
      lineItems.vehicle +
      lineItems.techTime.cost;
    const gst = Math.round(subtotal * 0.15 * 100) / 100;
    const total = subtotal + gst;
    return { subtotal, gst, total };
  };

  const updateLineItem = (field: keyof QuoteLineItems, value: number | { count?: number; cost?: number; hours?: number; rate?: number }) => {
    if (!editedQuote) return;

    const newLineItems = { ...editedQuote.lineItems };

    if (field === 'monitors') {
      newLineItems.monitors = { ...newLineItems.monitors, ...(value as { count?: number; cost?: number }) };
    } else if (field === 'microphones') {
      newLineItems.microphones = { ...newLineItems.microphones, ...(value as { count?: number; cost?: number }) };
    } else if (field === 'techTime') {
      const techUpdate = value as { hours?: number; rate?: number };
      const hours = techUpdate.hours ?? newLineItems.techTime.hours;
      const rate = techUpdate.rate ?? newLineItems.techTime.rate;
      newLineItems.techTime = { hours, rate, cost: hours * rate };
    } else if (field === 'foh') {
      newLineItems.foh = value as number;
    } else if (field === 'console') {
      newLineItems.console = value as number;
    } else if (field === 'cables') {
      newLineItems.cables = value as number;
    } else if (field === 'vehicle') {
      newLineItems.vehicle = value as number;
    }

    const totals = recalculateTotals(newLineItems);
    setEditedQuote({
      ...editedQuote,
      lineItems: newLineItems,
      ...totals,
    });
  };

  const updateExecutionNote = (index: number, value: string) => {
    if (!editedQuote) return;
    const newNotes = [...editedQuote.executionNotes];
    newNotes[index] = value;
    setEditedQuote({ ...editedQuote, executionNotes: newNotes });
  };

  const addExecutionNote = () => {
    if (!editedQuote) return;
    setEditedQuote({
      ...editedQuote,
      executionNotes: [...editedQuote.executionNotes, ''],
    });
  };

  const removeExecutionNote = (index: number) => {
    if (!editedQuote) return;
    const newNotes = editedQuote.executionNotes.filter((_, i) => i !== index);
    setEditedQuote({ ...editedQuote, executionNotes: newNotes });
  };

  const updateGearItem = (index: number, field: keyof SuggestedGearItem, value: string | number) => {
    if (!editedQuote) return;
    const newGear = [...editedQuote.suggestedGear];
    newGear[index] = { ...newGear[index], [field]: value };
    setEditedQuote({ ...editedQuote, suggestedGear: newGear });
  };

  const addGearItem = () => {
    if (!editedQuote) return;
    setEditedQuote({
      ...editedQuote,
      suggestedGear: [...editedQuote.suggestedGear, { item: '', quantity: 1 }],
    });
  };

  const removeGearItem = (index: number) => {
    if (!editedQuote) return;
    const newGear = editedQuote.suggestedGear.filter((_, i) => i !== index);
    setEditedQuote({ ...editedQuote, suggestedGear: newGear });
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
  const numberInputStyles = "border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium w-24";

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
    <PageCard stretch>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Review Quote</h1>
            <p className="text-gray-600 font-medium">Quote #{booking.quote_number}</p>
          </div>
          <div className="flex items-center gap-2">
            {editMode && (
              <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-1 rounded">
                Editing
              </span>
            )}
            <button
              onClick={() => editMode ? handleCancelEdit() : setEditMode(true)}
              className="text-sm font-bold text-gray-700 hover:text-black"
            >
              {editMode ? 'Cancel' : 'Edit'}
            </button>
          </div>
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

        <div className="grid gap-4 flex-grow">
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

          {/* Quote Line Items - Editable */}
          {editedQuote && (
            <div className="border border-gray-200 rounded-md p-4">
              <h3 className="font-bold text-gray-900 mb-3">Quote Line Items</h3>
              <div className="space-y-3">
                {/* FOH */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">FOH System</span>
                  {editMode ? (
                    <input
                      type="number"
                      value={editedQuote.lineItems.foh}
                      onChange={(e) => updateLineItem('foh', parseFloat(e.target.value) || 0)}
                      className={numberInputStyles}
                    />
                  ) : (
                    <span className="font-medium">{formatCurrency(editedQuote.lineItems.foh)}</span>
                  )}
                </div>

                {/* Monitors */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Monitors {editMode ? '' : `(${editedQuote.lineItems.monitors.count}x)`}
                  </span>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editedQuote.lineItems.monitors.count}
                        onChange={(e) => updateLineItem('monitors', { count: parseInt(e.target.value) || 0 })}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-16"
                        placeholder="Qty"
                      />
                      <span className="text-gray-500">x</span>
                      <input
                        type="number"
                        value={editedQuote.lineItems.monitors.cost}
                        onChange={(e) => updateLineItem('monitors', { cost: parseFloat(e.target.value) || 0 })}
                        className={numberInputStyles}
                      />
                    </div>
                  ) : (
                    <span className="font-medium">{formatCurrency(editedQuote.lineItems.monitors.cost)}</span>
                  )}
                </div>

                {/* Microphones */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Microphones {editMode ? '' : `(${editedQuote.lineItems.microphones.count}x)`}
                  </span>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editedQuote.lineItems.microphones.count}
                        onChange={(e) => updateLineItem('microphones', { count: parseInt(e.target.value) || 0 })}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-16"
                        placeholder="Qty"
                      />
                      <span className="text-gray-500">x</span>
                      <input
                        type="number"
                        value={editedQuote.lineItems.microphones.cost}
                        onChange={(e) => updateLineItem('microphones', { cost: parseFloat(e.target.value) || 0 })}
                        className={numberInputStyles}
                      />
                    </div>
                  ) : (
                    <span className="font-medium">{formatCurrency(editedQuote.lineItems.microphones.cost)}</span>
                  )}
                </div>

                {/* Console */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Console</span>
                  {editMode ? (
                    <input
                      type="number"
                      value={editedQuote.lineItems.console}
                      onChange={(e) => updateLineItem('console', parseFloat(e.target.value) || 0)}
                      className={numberInputStyles}
                    />
                  ) : (
                    <span className="font-medium">{formatCurrency(editedQuote.lineItems.console)}</span>
                  )}
                </div>

                {/* Cables */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Cables & Accessories</span>
                  {editMode ? (
                    <input
                      type="number"
                      value={editedQuote.lineItems.cables}
                      onChange={(e) => updateLineItem('cables', parseFloat(e.target.value) || 0)}
                      className={numberInputStyles}
                    />
                  ) : (
                    <span className="font-medium">{formatCurrency(editedQuote.lineItems.cables)}</span>
                  )}
                </div>

                {/* Vehicle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Vehicle</span>
                  {editMode ? (
                    <input
                      type="number"
                      value={editedQuote.lineItems.vehicle}
                      onChange={(e) => updateLineItem('vehicle', parseFloat(e.target.value) || 0)}
                      className={numberInputStyles}
                    />
                  ) : (
                    <span className="font-medium">{formatCurrency(editedQuote.lineItems.vehicle)}</span>
                  )}
                </div>

                {/* Tech Time */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    Tech Time {editMode ? '' : `(${editedQuote.lineItems.techTime.hours} hrs @ $${editedQuote.lineItems.techTime.rate}/hr)`}
                  </span>
                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={editedQuote.lineItems.techTime.hours}
                        onChange={(e) => updateLineItem('techTime', { hours: parseFloat(e.target.value) || 0 })}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-16"
                        placeholder="Hrs"
                      />
                      <span className="text-gray-500">@ $</span>
                      <input
                        type="number"
                        value={editedQuote.lineItems.techTime.rate}
                        onChange={(e) => updateLineItem('techTime', { rate: parseFloat(e.target.value) || 0 })}
                        className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-16"
                      />
                      <span className="text-gray-500">/hr</span>
                    </div>
                  ) : (
                    <span className="font-medium">{formatCurrency(editedQuote.lineItems.techTime.cost)}</span>
                  )}
                </div>

                {/* Totals */}
                <div className="border-t pt-3 mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">{formatCurrency(editedQuote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">GST (15%)</span>
                    <span className="font-medium">{formatCurrency(editedQuote.gst)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(editedQuote.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Execution Notes - Editable */}
          {editedQuote && editedQuote.executionNotes.length > 0 && (
            <div className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Execution Notes</h3>
                {editMode && (
                  <button
                    onClick={addExecutionNote}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    + Add Note
                  </button>
                )}
              </div>
              <ul className="space-y-2">
                {editedQuote.executionNotes.map((note, index) => (
                  <li key={index} className="flex items-start gap-2">
                    {editMode ? (
                      <>
                        <input
                          type="text"
                          value={note}
                          onChange={(e) => updateExecutionNote(index, e.target.value)}
                          className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                        />
                        <button
                          onClick={() => removeExecutionNote(index)}
                          className="text-red-500 hover:text-red-700 text-sm px-2"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-700">{note}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Gear - Editable */}
          {editedQuote && editedQuote.suggestedGear.length > 0 && (
            <div className="border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Suggested Gear</h3>
                {editMode && (
                  <button
                    onClick={addGearItem}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    + Add Item
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {editedQuote.suggestedGear.map((gear, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {editMode ? (
                      <>
                        <input
                          type="number"
                          value={gear.quantity}
                          onChange={(e) => updateGearItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-14 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          min="1"
                        />
                        <span className="text-gray-500 text-sm">×</span>
                        <input
                          type="text"
                          value={gear.item}
                          onChange={(e) => updateGearItem(index, 'item', e.target.value)}
                          className="flex-1 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          placeholder="Item name"
                        />
                        <input
                          type="text"
                          value={gear.notes || ''}
                          onChange={(e) => updateGearItem(index, 'notes', e.target.value)}
                          className="w-24 border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          placeholder="Notes"
                        />
                        <button
                          onClick={() => removeGearItem(index)}
                          className="text-red-500 hover:text-red-700 text-sm px-2"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{gear.quantity}×</span>
                        <span className={`text-sm ${gear.matchedInInventory === false ? 'text-red-600' : 'text-gray-700'}`}>
                          {gear.item}
                          {gear.matchedInInventory === false && ' ⚠'}
                        </span>
                        {gear.notes && (
                          <span className="text-xs text-gray-500 italic">({gear.notes})</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Job Sheet Details - Editable */}
          {editMode && editedDetails && (
            <div className="border border-amber-200 bg-amber-50 rounded-md p-4">
              <h3 className="font-bold text-gray-900 mb-3">Job Sheet Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Event Type</label>
                  <input
                    type="text"
                    value={editedDetails.eventType || ''}
                    onChange={(e) => setEditedDetails({ ...editedDetails, eventType: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Attendance</label>
                  <input
                    type="text"
                    value={editedDetails.attendance || ''}
                    onChange={(e) => setEditedDetails({ ...editedDetails, attendance: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Setup Time</label>
                  <input
                    type="text"
                    value={editedDetails.setupTime || ''}
                    onChange={(e) => setEditedDetails({ ...editedDetails, setupTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Indoor/Outdoor</label>
                  <input
                    type="text"
                    value={editedDetails.venue?.indoorOutdoor || ''}
                    onChange={(e) => setEditedDetails({
                      ...editedDetails,
                      venue: { ...editedDetails.venue, indoorOutdoor: e.target.value }
                    })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Info</label>
                  <textarea
                    value={editedDetails.additionalInfo || ''}
                    onChange={(e) => setEditedDetails({ ...editedDetails, additionalInfo: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm resize-y"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Non-edit mode: Deposit & Notes */}
          {!editMode && (
            <>
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
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-6 mt-auto">
          {editMode ? (
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className="w-full bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000] disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : 'Save Changes'}
            </button>
          ) : (
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
          )}
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
