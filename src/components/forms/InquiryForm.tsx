'use client';

import { useState } from 'react';
import type { InquiryFormData, EventType } from '@/types';

const eventTypes: { value: EventType; label: string }[] = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate Event' },
  { value: 'festival', label: 'Festival' },
  { value: 'private_party', label: 'Private Party' },
  { value: 'other', label: 'Other' },
];

export function InquiryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data: InquiryFormData = {
      eventType: formData.get('eventType') as EventType,
      attendance: Number(formData.get('attendance')),
      eventDate: formData.get('eventDate') as string,
      location: formData.get('location') as string,
      duration: formData.get('duration') as string,
      details: formData.get('details') as string,
      contactName: formData.get('contactName') as string,
      contactEmail: formData.get('contactEmail') as string,
      contactPhone: formData.get('contactPhone') as string,
    };

    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold text-green-600 mb-4">Thank you!</h2>
        <p>We&apos;ve received your inquiry and will get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      {/* Event Details */}
      <div>
        <label htmlFor="eventType" className="block text-sm font-medium mb-1">
          Event Type
        </label>
        <select
          id="eventType"
          name="eventType"
          required
          className="w-full border rounded-md px-3 py-2"
        >
          <option value="">Select event type...</option>
          {eventTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="attendance" className="block text-sm font-medium mb-1">
          Estimated Attendance
        </label>
        <input
          type="number"
          id="attendance"
          name="attendance"
          required
          min="1"
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="eventDate" className="block text-sm font-medium mb-1">
          Event Date
        </label>
        <input
          type="date"
          id="eventDate"
          name="eventDate"
          required
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">
          Event Location / Venue
        </label>
        <input
          type="text"
          id="location"
          name="location"
          required
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="duration" className="block text-sm font-medium mb-1">
          Event Duration
        </label>
        <input
          type="text"
          id="duration"
          name="duration"
          placeholder="e.g., 4 hours, full day"
          required
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="details" className="block text-sm font-medium mb-1">
          Additional Details
        </label>
        <textarea
          id="details"
          name="details"
          rows={4}
          className="w-full border rounded-md px-3 py-2"
          placeholder="Tell us more about your event..."
        />
      </div>

      {/* Contact Info */}
      <hr className="my-6" />
      <h3 className="text-lg font-semibold">Your Contact Information</h3>

      <div>
        <label htmlFor="contactName" className="block text-sm font-medium mb-1">
          Full Name
        </label>
        <input
          type="text"
          id="contactName"
          name="contactName"
          required
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          type="email"
          id="contactEmail"
          name="contactEmail"
          required
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="contactPhone" className="block text-sm font-medium mb-1">
          Phone Number
        </label>
        <input
          type="tel"
          id="contactPhone"
          name="contactPhone"
          required
          className="w-full border rounded-md px-3 py-2"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-black text-white py-3 rounded-md hover:bg-gray-800 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
      </button>
    </form>
  );
}
