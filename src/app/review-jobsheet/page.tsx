'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';
import { SuccessIcon, ErrorIcon, LoadingSpinner } from '@/components/ui/StatusIcons';

interface JobSheetData {
  equipment: { item: string; quantity: number }[];
  notes: string[];
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
  status: string;
  jobsheet_sheet_id: string | null;
  // Group 2 fields
  call_time: string | null;
  pack_out_time: string | null;
  room_available_from: string | null;
  call_out_notes: string | null;
  vehicle_type: string | null;
  vehicle_amount: number | null;
  band_names: string | null;
  // Group 3 fields
  crew_count: number | null;
  details_json: {
    bandNames?: string;
    lineItems?: {
      vehicle?: number;
    };
    [key: string]: unknown;
  } | null;
}

const VEHICLE_OPTIONS = [
  { value: '', label: 'Select vehicle...' },
  { value: 'personal', label: "Contractor's Personal Vehicle" },
  { value: 'company_van', label: 'Company Van (Council Van)' },
  { value: 'hire', label: 'Hire Vehicle' },
  { value: 'admin_vehicle', label: "Admin's Personal Vehicle" },
];

function ReviewJobSheetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [jobSheetData, setJobSheetData] = useState<JobSheetData | null>(null);
  const [techRiderUrl, setTechRiderUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [callTime, setCallTime] = useState('');
  const [packOutTime, setPackOutTime] = useState('');
  const [roomAvailableFrom, setRoomAvailableFrom] = useState('');
  const [callOutNotes, setCallOutNotes] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleAmount, setVehicleAmount] = useState('');
  const [bandNames, setBandNames] = useState('');
  const [crewCount, setCrewCount] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing token');
      setLoading(false);
      return;
    }

    async function fetchJobSheet() {
      try {
        const res = await fetch(`/api/review-jobsheet?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.message || 'Failed to load job sheet');
          return;
        }

        setBooking(data.booking);
        setJobSheetData(data.jobSheetData);
        setTechRiderUrl(data.techRiderUrl);

        // Pre-populate fields from booking
        const b = data.booking;
        setCallTime(b.call_time || '');
        setPackOutTime(b.pack_out_time || '');
        setRoomAvailableFrom(b.room_available_from || '');
        setCallOutNotes(b.call_out_notes || '');
        setVehicleType(b.vehicle_type || '');
        // Vehicle amount: from booking, or default from quote lineItems
        const defaultVehicleAmount = b.details_json?.lineItems?.vehicle;
        setVehicleAmount(b.vehicle_amount?.toString() || defaultVehicleAmount?.toString() || '');
        // Band names from booking or from original inquiry details
        setBandNames(b.band_names || b.details_json?.bandNames || '');
        setCrewCount(b.crew_count?.toString() || '');
      } catch (err) {
        console.error('Error fetching job sheet:', err);
        setError('Failed to load job sheet');
      } finally {
        setLoading(false);
      }
    }

    fetchJobSheet();
  }, [token]);

  const handleSave = async () => {
    if (!token) return;

    setSaving(true);
    try {
      const res = await fetch('/api/review-jobsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          updates: {
            call_time: callTime || null,
            pack_out_time: packOutTime || null,
            room_available_from: roomAvailableFrom || null,
            call_out_notes: callOutNotes || null,
            vehicle_type: vehicleType || null,
            vehicle_amount: vehicleAmount ? parseFloat(vehicleAmount) : null,
            band_names: bandNames || null,
            crew_count: crewCount ? parseInt(crewCount, 10) : null,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    // Save first, then navigate
    await handleSave();
    router.push(`/select-contractors?token=${token}`);
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

  if (!booking) return null;

  return (
    <PageCard stretch>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Review Job Sheet</h1>
            <p className="text-gray-600 font-medium">Quote #{booking.quote_number}</p>
          </div>
          {booking.jobsheet_sheet_id && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${booking.jobsheet_sheet_id}/edit`}
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
            booking.status === 'client_approved' ? 'bg-green-100 text-green-800' :
            booking.status === 'contractors_notified' ? 'bg-blue-100 text-blue-800' :
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

          {/* Tech Rider Link */}
          {techRiderUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <p className="font-semibold text-blue-900">Tech Rider Available</p>
                  <a
                    href={techRiderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline hover:text-blue-800"
                  >
                    View Tech Rider
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Job Details Section */}
          <div className="border-2 border-stone-300 rounded-lg p-4 bg-stone-50">
            <h3 className="font-bold text-gray-900 mb-4">Job Details for Contractors</h3>

            {/* Times Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Call Time (Pack-in)
                </label>
                <input
                  type="time"
                  value={callTime}
                  onChange={(e) => setCallTime(e.target.value)}
                  className={inputStyles}
                />
                <p className="text-xs text-gray-500 mt-1">When contractor arrives</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Room Available From
                </label>
                <input
                  type="time"
                  value={roomAvailableFrom}
                  onChange={(e) => setRoomAvailableFrom(e.target.value)}
                  className={inputStyles}
                />
                <p className="text-xs text-gray-500 mt-1">When venue opens for setup</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Pack-out Time
                </label>
                <input
                  type="time"
                  value={packOutTime}
                  onChange={(e) => setPackOutTime(e.target.value)}
                  className={inputStyles}
                />
                <p className="text-xs text-gray-500 mt-1">When tear-down finishes</p>
              </div>
            </div>

            {/* Vehicle and Crew Count Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Vehicle
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className={inputStyles}
                >
                  {VEHICLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {vehicleType === 'personal' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Vehicle Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={vehicleAmount}
                      onChange={(e) => setVehicleAmount(e.target.value)}
                      placeholder="100"
                      className={`${inputStyles} pl-8`}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Paid to contractor for vehicle</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Crew Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={crewCount}
                  onChange={(e) => setCrewCount(e.target.value)}
                  placeholder="e.g., 3"
                  className={inputStyles}
                />
                <p className="text-xs text-gray-500 mt-1">Total crew on this job</p>
              </div>
            </div>

            {/* Call Out Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Call Out Notes
              </label>
              <textarea
                value={callOutNotes}
                onChange={(e) => setCallOutNotes(e.target.value)}
                placeholder="Special instructions, reminders, parking info, etc."
                rows={3}
                className={`${inputStyles} resize-y`}
              />
            </div>
          </div>

          {/* Notes from Job Sheet */}
          {jobSheetData && jobSheetData.notes && jobSheetData.notes.length > 0 && (
            <div className="border border-gray-200 rounded-md p-4">
              <h3 className="font-bold text-gray-900 mb-3">Notes</h3>
              <ul className="space-y-2">
                {jobSheetData.notes.map((note, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-700">{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={saving}
            className="w-full py-3 rounded-md font-bold text-base transition-colors bg-[#000000] text-white border border-[#000000] hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : 'Select Contractors'}
          </button>
        </div>
      </div>
    </PageCard>
  );
}

export default function ReviewJobSheetPage() {
  return (
    <Suspense fallback={
      <PageCard stretch>
        <LoadingSpinner />
      </PageCard>
    }>
      <ReviewJobSheetContent />
    </Suspense>
  );
}
