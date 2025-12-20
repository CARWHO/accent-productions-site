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
        <div className="w-20 h-20 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h2>
        <p className="text-lg text-gray-600 mb-2">
          We&apos;ve received your inquiry and will get back to you within 24 hours.
        </p>
        <p className="text-gray-500">
          Check your email for a confirmation message.
        </p>
      </div>
    );
  }

  const inputStyles = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all";
  const labelStyles = "block text-sm font-semibold text-gray-700 mb-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Event Details Section */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <span className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">1</span>
          Event Details
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="eventType" className={labelStyles}>
              Event Type *
            </label>
            <select
              id="eventType"
              name="eventType"
              required
              className={inputStyles}
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
              Event Duration *
            </label>
            <input
              type="text"
              id="duration"
              name="duration"
              placeholder="e.g., 4 hours, full day"
              required
              className={inputStyles}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="location" className={labelStyles}>
              Event Location / Venue *
            </label>
            <input
              type="text"
              id="location"
              name="location"
              required
              placeholder="e.g., Auckland Town Hall, Auckland"
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
              placeholder="Tell us more about your event, any specific requirements, or questions you have..."
            />
          </div>
        </div>
      </div>

      {/* Contact Info Section */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <span className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center text-white text-sm font-bold">2</span>
          Your Contact Information
        </h3>

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
              placeholder="John Smith"
              className={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="contactEmail" className={labelStyles}>
              Email Address *
            </label>
            <input
              type="email"
              id="contactEmail"
              name="contactEmail"
              required
              placeholder="john@example.com"
              className={inputStyles}
            />
          </div>

          <div>
            <label htmlFor="contactPhone" className={labelStyles}>
              Phone Number *
            </label>
            <input
              type="tel"
              id="contactPhone"
              name="contactPhone"
              required
              placeholder="+64 21 123 4567"
              className={inputStyles}
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white py-4 rounded-xl font-semibold text-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </span>
          ) : (
            'Submit Inquiry'
          )}
        </button>
        <p className="text-center text-sm text-gray-500 mt-4">
          We&apos;ll respond within 24 hours. Your information is kept confidential.
        </p>
      </div>
    </form>
  );
}
