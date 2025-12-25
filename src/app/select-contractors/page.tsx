'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';

interface Contractor {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  skills: string[];
}

interface Booking {
  id: string;
  quote_number: string;
  event_name: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  client_name: string;
  booking_type: string;
  details_json: Record<string, unknown> | null;
}

interface Assignment {
  contractor_id: string;
  hourly_rate: string;
  estimated_hours: string;
  tasks_description: string;
  equipment_assigned: string[];
}

function SelectContractorsContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing token');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch(`/api/select-contractors?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.message || 'Failed to load data');
          return;
        }

        setBooking(data.booking);
        setContractors(data.contractors);

        // Load existing assignments if any
        if (data.existingAssignments?.length > 0) {
          const existingMap: Record<string, Assignment> = {};
          for (const a of data.existingAssignments) {
            existingMap[a.contractor_id] = {
              contractor_id: a.contractor_id,
              hourly_rate: a.hourly_rate?.toString() || '',
              estimated_hours: a.estimated_hours?.toString() || '',
              tasks_description: a.tasks_description || '',
              equipment_assigned: a.equipment_assigned || [],
            };
          }
          setAssignments(existingMap);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [token]);

  const toggleContractor = (contractorId: string) => {
    setAssignments(prev => {
      if (prev[contractorId]) {
        const { [contractorId]: _, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [contractorId]: {
            contractor_id: contractorId,
            hourly_rate: '50',  // Default $50/hr
            estimated_hours: '',
            tasks_description: '',
            equipment_assigned: [],
          }
        };
      }
    });
  };

  const updateAssignment = (contractorId: string, field: keyof Assignment, value: string | string[]) => {
    setAssignments(prev => ({
      ...prev,
      [contractorId]: {
        ...prev[contractorId],
        [field]: value,
      }
    }));
  };

  const handleSave = async () => {
    if (!booking || Object.keys(assignments).length === 0) return;

    // Validate all assignments have hourly rate and hours
    const assignmentList = Object.values(assignments);
    const invalidAssignments = assignmentList.filter(a =>
      !a.hourly_rate || parseFloat(a.hourly_rate) <= 0 ||
      !a.estimated_hours || parseFloat(a.estimated_hours) <= 0
    );
    if (invalidAssignments.length > 0) {
      alert('Please enter hourly rate and hours for all selected contractors');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/select-contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          bookingId: booking.id,
          assignments: assignmentList.map(a => ({
            contractor_id: a.contractor_id,
            hourly_rate: parseFloat(a.hourly_rate),
            estimated_hours: parseFloat(a.estimated_hours),
            pay_amount: parseFloat(a.hourly_rate) * parseFloat(a.estimated_hours),
            tasks_description: a.tasks_description || null,
            equipment_assigned: a.equipment_assigned.length > 0 ? a.equipment_assigned : null,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      setSaved(true);
    } catch (err) {
      console.error('Error saving:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNotify = async () => {
    if (!booking) return;

    setNotifying(true);
    try {
      const res = await fetch('/api/notify-contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          bookingId: booking.id,
        }),
      });

      if (!res.ok) throw new Error('Failed to notify');
      setNotified(true);
    } catch (err) {
      console.error('Error notifying:', err);
      alert('Failed to send notifications. Please try again.');
    } finally {
      setNotifying(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NZ', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-stone-200 rounded w-3/4" />
        <div className="h-32 bg-stone-200 rounded" />
        <div className="h-48 bg-stone-200 rounded" />
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

  if (notified) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Contractors Notified!</h2>
        <p className="text-gray-600 mb-4">
          {Object.keys(assignments).length} contractor{Object.keys(assignments).length !== 1 ? 's have' : ' has'} been notified.
        </p>
        <p className="text-sm text-gray-500">
          You&apos;ll receive an email when they respond.
        </p>
      </div>
    );
  }

  if (!booking) return null;

  const selectedCount = Object.keys(assignments).length;
  const totalPay = Object.values(assignments).reduce((sum, a) => {
    const rate = parseFloat(a.hourly_rate) || 0;
    const hours = parseFloat(a.estimated_hours) || 0;
    return sum + (rate * hours);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Select Contractors</h1>
        <p className="text-gray-600">Quote #{booking.quote_number}</p>
      </div>

      {/* Job Summary */}
      <div className="bg-stone-50 rounded-lg p-4">
        <h2 className="font-semibold text-lg mb-2">{booking.event_name || 'Event'}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <p><strong>Date:</strong> {formatDate(booking.event_date)}</p>
          <p><strong>Time:</strong> {booking.event_time || 'TBC'}</p>
          <p><strong>Location:</strong> {booking.location || 'TBC'}</p>
          <p><strong>Client:</strong> {booking.client_name}</p>
        </div>
      </div>

      {/* Contractors List */}
      <div>
        <h3 className="font-semibold mb-3">Available Contractors</h3>
        <div className="space-y-3">
          {contractors.map(contractor => {
            const isSelected = !!assignments[contractor.id];
            const assignment = assignments[contractor.id];

            return (
              <div
                key={contractor.id}
                className={`border rounded-lg overflow-hidden transition-colors ${
                  isSelected ? 'border-black bg-stone-50' : 'border-stone-200'
                }`}
              >
                {/* Contractor Header */}
                <button
                  onClick={() => toggleContractor(contractor.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'border-black bg-black' : 'border-stone-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{contractor.name}</p>
                      <p className="text-sm text-gray-500">{contractor.email}</p>
                    </div>
                  </div>
                  {contractor.skills?.length > 0 && (
                    <div className="flex gap-1 flex-wrap justify-end">
                      {contractor.skills.slice(0, 3).map(skill => (
                        <span key={skill} className="px-2 py-0.5 bg-stone-200 text-stone-700 text-xs rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </button>

                {/* Assignment Details (expanded when selected) */}
                {isSelected && assignment && (
                  <div className="border-t border-stone-200 p-4 space-y-4">
                    {/* Pay Rate Row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hourly Rate *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={assignment.hourly_rate}
                            onChange={(e) => updateAssignment(contractor.id, 'hourly_rate', e.target.value)}
                            placeholder="50"
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hours *
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={assignment.estimated_hours}
                          onChange={(e) => updateAssignment(contractor.id, 'estimated_hours', e.target.value)}
                          placeholder="6"
                          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                        />
                      </div>
                    </div>

                    {/* Calculated Total */}
                    {assignment.hourly_rate && assignment.estimated_hours && (
                      <div className="bg-green-50 rounded-md px-3 py-2 text-sm">
                        <span className="text-gray-600">Total: </span>
                        <span className="font-semibold text-green-700">
                          ${(parseFloat(assignment.hourly_rate) * parseFloat(assignment.estimated_hours)).toFixed(2)}
                        </span>
                        <span className="text-gray-500 text-xs ml-1">
                          (${assignment.hourly_rate}/hr × {assignment.estimated_hours} hrs)
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tasks / Notes
                      </label>
                      <textarea
                        value={assignment.tasks_description}
                        onChange={(e) => updateAssignment(contractor.id, 'tasks_description', e.target.value)}
                        placeholder="Describe what this contractor will do..."
                        rows={2}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent resize-none text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      {selectedCount > 0 && (
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">{selectedCount} contractor{selectedCount !== 1 ? 's' : ''} selected</p>
              <p className="text-sm text-gray-600">Total pay: ${totalPay.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 pt-4 border-t border-stone-200">
        {!saved ? (
          <button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="w-full bg-gray-800 text-white py-3 px-4 rounded-md font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Selections'}
          </button>
        ) : (
          <button
            onClick={handleNotify}
            disabled={notifying}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {notifying ? 'Sending...' : `Notify ${selectedCount} Contractor${selectedCount !== 1 ? 's' : ''}`}
          </button>
        )}

        {saved && !notified && (
          <p className="text-center text-sm text-gray-500">
            Selections saved. Click above to send notifications.
          </p>
        )}
      </div>
    </div>
  );
}

export default function SelectContractorsPage() {
  return (
    <PageCard autoHeight>
      <Suspense fallback={<div className="animate-pulse h-96 bg-stone-100 rounded" />}>
        <SelectContractorsContent />
      </Suspense>
    </PageCard>
  );
}
