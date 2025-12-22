'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (showValidation) {
      setShowValidation(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      setShowValidation(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: formData.name,
          contactEmail: formData.email,
          contactPhone: formData.phone,
          eventName: formData.subject,
          details: formData.message,
        }),
      });
      if (response.ok) {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputStyles = "w-full border border-gray-300 rounded-md px-3 py-2.5 text-base focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium";

  if (submitted) {
    return (
      <main className="bg-stone-50 min-h-screen pt-24 lg:pt-24 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-md border border-stone-200 p-6 lg:p-8">
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 bg-[#000000] rounded-md flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Thank you</h2>
              <p className="text-gray-700 text-lg font-medium">We&apos;ll be in touch within 24 hours.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-stone-50 min-h-screen pt-8 lg:pt-8 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-3 lg:mb-4">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Contact Us</h1>
          <p className="text-gray-700 text-base font-medium">
            Have a question? Get in touch and we&apos;ll respond within 24 hours.
          </p>
        </div>

        <div className="bg-white rounded-md border border-stone-200 p-5 lg:p-6">
          {showValidation && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800 font-semibold">Please fill in all required fields</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-3 lg:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className={`${inputStyles} ${showValidation && !formData.name ? 'border-red-500' : ''}`}
                  placeholder="John Smith"
                />
                {showValidation && !formData.name && (
                  <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className={`${inputStyles} ${showValidation && !formData.email ? 'border-red-500' : ''}`}
                    placeholder="john@example.com"
                  />
                  {showValidation && !formData.email && (
                    <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className={inputStyles}
                    placeholder="+64 21 123 4567"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Subject (Optional)</label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => updateField('subject', e.target.value)}
                  className={inputStyles}
                  placeholder="What's this about?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => updateField('message', e.target.value)}
                  rows={3}
                  className={`${inputStyles} resize-none ${showValidation && !formData.message ? 'border-red-500' : ''}`}
                  placeholder="Tell us how we can help..."
                />
                {showValidation && !formData.message && (
                  <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                )}
              </div>
            </div>

            <div className="mt-5">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#000000] text-white py-3 rounded-md font-bold text-base hover:bg-[#152d47] transition-colors border border-[#000000] disabled:opacity-50"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-3">Other Ways to Reach Us</h3>
            <div className="space-y-2 text-sm text-gray-700 font-medium">
              <p>
                <span className="font-bold">Phone:</span> +64 21 123 4567
              </p>
              <p>
                <span className="font-bold">Email:</span> hello@accentproductions.co.nz
              </p>
              <p>
                <span className="font-bold">Location:</span> Wellington, New Zealand
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
