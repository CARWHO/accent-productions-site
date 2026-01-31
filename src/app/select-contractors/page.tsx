'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PageCard from '@/components/ui/PageCard';
import { SuccessIcon, ErrorIcon } from '@/components/ui/StatusIcons';
import { formatDate } from '@/lib/format-utils';

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
  vehicle_type: string | null;
  vehicle_amount: number | null;
  vehicle_contractor_id: string | null;
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
  const router = useRouter();
  const token = searchParams.get('token');

  const [booking, setBooking] = useState<Booking | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Vehicle contractor (who gets the vehicle payment when using personal vehicle)
  const [vehicleContractorId, setVehicleContractorId] = useState<string | null>(null);

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

        // Load existing vehicle contractor assignment
        if (data.booking.vehicle_contractor_id) {
          setVehicleContractorId(data.booking.vehicle_contractor_id);
        }

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

  const handleNotify = async () => {
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

    setNotifying(true);
    try {
      // First save the assignments
      const saveRes = await fetch('/api/select-contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          bookingId: booking.id,
          vehicleContractorId: booking.vehicle_type === 'personal' ? vehicleContractorId : null,
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

      if (!saveRes.ok) throw new Error('Failed to save');

      // Then notify contractors
      const notifyRes = await fetch('/api/notify-contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          bookingId: booking.id,
        }),
      });

      if (!notifyRes.ok) throw new Error('Failed to notify');
      setNotified(true);
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to send notifications. Please try again.');
    } finally {
      setNotifying(false);
    }
  };

  // Get all unique skills from contractors
  const allSkills = Array.from(
    new Set(contractors.flatMap(c => c.skills || []))
  ).sort();

  // Filter contractors based on search and selected skills
  const filteredContractors = contractors.filter(contractor => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      contractor.name.toLowerCase().includes(searchLower) ||
      contractor.email.toLowerCase().includes(searchLower) ||
      contractor.skills?.some(s => s.toLowerCase().includes(searchLower));

    // Skill filter
    const matchesSkills = selectedSkills.length === 0 ||
      selectedSkills.some(skill => contractor.skills?.includes(skill));

    return matchesSearch && matchesSkills;
  });

  const toggleSkillFilter = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  if (loading) {
    return (
      <PageCard>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-3/4" />
          <div className="h-32 bg-stone-200 rounded" />
          <div className="h-48 bg-stone-200 rounded" />
        </div>
      </PageCard>
    );
  }

  if (error) {
    return (
      <PageCard centered>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6"><ErrorIcon /></div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-700 text-lg font-medium">{error}</p>
        </div>
      </PageCard>
    );
  }

  if (notified) {
    return (
      <PageCard centered>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6"><SuccessIcon /></div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Contractors Notified!</h2>
          <p className="text-gray-700 text-lg font-medium">
            {Object.keys(assignments).length} contractor{Object.keys(assignments).length !== 1 ? 's have' : ' has'} been notified.
          </p>
          <p className="text-gray-700 text-lg font-medium mt-1">
            You&apos;ll receive an email when they respond.
          </p>
        </div>
      </PageCard>
    );
  }

  if (!booking) return null;

  const selectedCount = Object.keys(assignments).length;
  const basePay = Object.values(assignments).reduce((sum, a) => {
    const rate = parseFloat(a.hourly_rate) || 0;
    const hours = parseFloat(a.estimated_hours) || 0;
    return sum + (rate * hours);
  }, 0);
  // Add vehicle amount if personal vehicle is selected and a contractor is assigned
  const vehiclePayAmount = (booking?.vehicle_type === 'personal' && vehicleContractorId && booking?.vehicle_amount)
    ? booking.vehicle_amount
    : 0;
  const totalPay = basePay + vehiclePayAmount;

  return (
    <PageCard stretch>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-stone-200 pb-4">
          <div className="flex items-start justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Select Contractors</h1>
            <button
              onClick={() => router.push(`/review-jobsheet?token=${token}`)}
              className="text-gray-700 font-bold text-sm"
            >
              Back
            </button>
          </div>
          <p className="text-gray-600">Quote #{booking.quote_number}</p>
        </div>

      {/* Job Summary */}
      <div className="bg-stone-50 rounded-lg p-4">
        <h2 className="font-semibold text-lg mb-2">{booking.event_name || 'Event'}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <p><strong>Date:</strong> {formatDate(booking.event_date, 'short')}</p>
          <p><strong>Time:</strong> {booking.event_time || 'TBC'}</p>
          <p><strong>Location:</strong> {booking.location || 'TBC'}</p>
          <p><strong>Client:</strong> {booking.client_name}</p>
        </div>
      </div>

      {/* Vehicle Assignment (only when using contractor's personal vehicle) */}
      {booking.vehicle_type === 'personal' && booking.vehicle_amount && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <h3 className="font-semibold text-blue-900">Vehicle Payment</h3>
          </div>
          <p className="text-sm text-blue-800 mb-3">
            <strong>${booking.vehicle_amount}</strong> vehicle allowance - select which contractor will use their personal vehicle:
          </p>
          <select
            value={vehicleContractorId || ''}
            onChange={(e) => setVehicleContractorId(e.target.value || null)}
            className="w-full border border-blue-300 rounded-md px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select contractor for vehicle...</option>
            {Object.keys(assignments).map(contractorId => {
              const contractor = contractors.find(c => c.id === contractorId);
              return contractor ? (
                <option key={contractorId} value={contractorId}>
                  {contractor.name}
                </option>
              ) : null;
            })}
          </select>
          {selectedCount > 0 && !vehicleContractorId && (
            <p className="text-xs text-blue-600 mt-2">
              Vehicle payment will be added to the selected contractor&apos;s pay
            </p>
          )}
        </div>
      )}

      {/* Search and Filter */}
      <div className="space-y-3">
        {/* Search Input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contractors by name, email, or skill..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Skill Filters */}
        {allSkills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allSkills.map(skill => (
              <button
                key={skill}
                onClick={() => toggleSkillFilter(skill)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedSkills.includes(skill)
                    ? 'bg-black text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {skill}
              </button>
            ))}
            {selectedSkills.length > 0 && (
              <button
                onClick={() => setSelectedSkills([])}
                className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contractors List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Available Contractors</h3>
          <span className="text-sm text-gray-500">
            {filteredContractors.length} of {contractors.length}
          </span>
        </div>
        <div className="space-y-3">
          {filteredContractors.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No contractors match your search
            </div>
          ) : filteredContractors.map(contractor => {
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
                        Extra Notes
                      </label>
                      <textarea
                        value={assignment.tasks_description}
                        onChange={(e) => updateAssignment(contractor.id, 'tasks_description', e.target.value)}
                        placeholder="Describe what this contractor will do..."
                        rows={4}
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
        <div className="bg-stone-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">{selectedCount} contractor{selectedCount !== 1 ? 's' : ''} selected</p>
              <p className="text-sm text-gray-600">
                Contractor pay: ${basePay.toFixed(2)}
                {vehiclePayAmount > 0 && (
                  <span className="text-blue-600"> + ${vehiclePayAmount} vehicle</span>
                )}
              </p>
              <p className="text-sm font-semibold text-gray-900">Total: ${totalPay.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="pt-4 border-t border-stone-200">
        <button
          onClick={handleNotify}
          disabled={notifying || selectedCount === 0}
          className="w-full bg-black text-white py-3 px-4 rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {notifying ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending...
            </span>
          ) : `Notify ${selectedCount} Contractor${selectedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
      </div>
    </PageCard>
  );
}

export default function SelectContractorsPage() {
  return (
    <Suspense fallback={
      <PageCard>
        <div className="animate-pulse h-96 bg-stone-100 rounded" />
      </PageCard>
    }>
      <SelectContractorsContent />
    </Suspense>
  );
}
