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
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Thank you</h2>
        <p className="text-gray-600">
          We&apos;ve received your inquiry and will get back to you within 24 hours.
        </p>
      </div>
    );
  }

  const inputStyles = "w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent";
  const labelStyles = "block text-sm font-medium text-gray-700 mb-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Event Details */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Details</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="eventType" className={labelStyles}>
              Event Type *
            </label>
            <select id="eventType" name="eventType" required className={inputStyles}>
              <option value="">Select...</option>
              {eventTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="attendance" className={labelStyles}>
              Estimated Attendance *
            </label>
            <input
              type="number"
              id="attendance"
              name="attendance"
              required
              min="1"
              placeholder="e.g., 100"
              className={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="eventDate" className={labelStyles}>
              Event Date *
            </label>
            <input
              type="date"
              id="eventDate"
              name="eventDate"
              required
              className={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="duration" className={labelStyles}>
              Duration *
            </label>
            <input
              type="text"
              id="duration"
              name="duration"
              placeholder="e.g., 4 hours"
              required
              className={inputStyles}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="location" className={labelStyles}>
              Location / Venue *
            </label>
            <input
              type="text"
              id="location"
              name="location"
              required
              placeholder="e.g., Auckland Town Hall"
              className={inputStyles}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="details" className={labelStyles}>
              Additional Details
            </label>
            <textarea
              id="details"
              name="details"
              rows={4}
              className={`${inputStyles} resize-none`}
              placeholder="Any specific requirements or questions..."
            />
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Contact Info</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="contactName" className={labelStyles}>
              Full Name *
            </label>
            <input
              type="text"
              id="contactName"
              name="contactName"
              required
              className={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="contactEmail" className={labelStyles}>
              Email *
            </label>
            <input
              type="email"
              id="contactEmail"
              name="contactEmail"
              required
              className={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="contactPhone" className={labelStyles}>
              Phone *
            </label>
            <input
              type="tel"
              id="contactPhone"
              name="contactPhone"
              required
              className={inputStyles}
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-amber-500 text-white py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
        </button>
        <p className="text-center text-sm text-gray-500 mt-4">
          We&apos;ll respond within 24 hours.
        </p>
      </div>
    </form>
  );
}
