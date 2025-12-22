'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import type { InquiryFormData, EventType } from '@/types';

const eventTypes: { value: EventType; label: string; image: string }[] = [
  { value: 'wedding', label: 'Wedding', image: '/images/image1.jpg' },
  { value: 'corporate', label: 'Corporate', image: '/images/image2.jpg' },
  { value: 'festival', label: 'Festival', image: '/images/image3.jpg' },
  { value: 'private_party', label: 'Private Party', image: '/images/image6.jpg' },
  { value: 'other', label: 'Other', image: '/images/image8.webp' },
];

function InquiryForm() {
  const searchParams = useSearchParams();
  const preselectedType = searchParams.get('type') as EventType | null;

  const [step, setStep] = useState(preselectedType ? 2 : 1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState<Partial<InquiryFormData>>({
    eventType: preselectedType || undefined,
  });

  const updateField = (field: keyof InquiryFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const goToStep = (newStep: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setIsVisible(false);

    setTimeout(() => {
      setStep(newStep);
      window.scrollTo({ top: 0, behavior: 'instant' });
      setTimeout(() => {
        setIsVisible(true);
        setIsTransitioning(false);
      }, 50);
    }, 100);
  };

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (response.ok) {
        setIsVisible(false);
        setTimeout(() => {
          setSubmitted(true);
          window.scrollTo({ top: 0, behavior: 'instant' });
          setIsVisible(true);
        }, 100);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={`flex flex-col items-center justify-center py-20 transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-20 h-20 bg-[#000000] rounded-md flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Thank you</h2>
        <p className="text-gray-700 text-lg font-medium">We&apos;ll be in touch within 24 hours.</p>
      </div>
    );
  }

  const inputStyles = "w-full border border-gray-300 rounded-md px-4 py-3 text-base focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium";

  return (
    <div className="w-full">
      {/* Progress */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 transition-colors duration-200 ${s <= step ? 'bg-[#000000]' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* Step 1: Event Type */}
      {step === 1 && (
        <div className={`transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-5">What type of event?</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 lg:gap-4">
            {eventTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => {
                  updateField('eventType', type.value);
                  goToStep(2);
                }}
                className={`group relative border-2 rounded-md overflow-hidden transition-all text-left ${formData.eventType === type.value
                  ? 'border-[#000000] ring-2 ring-[#000000]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
              >
                <div className="aspect-[3/2] lg:aspect-[4/3] relative w-full">
                  <Image src={type.image} alt={type.label} fill className="object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
                </div>
                <div className="p-3 lg:p-4">
                  <span className={`font-bold block ${formData.eventType === type.value ? 'text-[#000000]' : 'text-gray-900'}`}>
                    {type.label}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Event Basics */}
      {step === 2 && (
        <div className={`transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">Event Basics</h2>
          <div className="grid gap-4 lg:gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Name *</label>
              <input
                type="text"
                value={formData.eventName || ''}
                onChange={(e) => updateField('eventName', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.eventName ? 'border-red-500' : ''}`}
                placeholder="e.g., Annual Awards Night"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Organization (Optional)</label>
              <input
                type="text"
                value={formData.organization || ''}
                onChange={(e) => updateField('organization', e.target.value)}
                className={inputStyles}
                placeholder="Company or Group Name"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Date *</label>
                <input
                  type="date"
                  value={formData.eventDate || ''}
                  onChange={(e) => updateField('eventDate', e.target.value)}
                  className={`${inputStyles} ${showValidation && !formData.eventDate ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Approx. Attendance *</label>
                <input
                  type="number"
                  placeholder="e.g., 100"
                  value={formData.attendance || ''}
                  onChange={(e) => updateField('attendance', Number(e.target.value))}
                  className={`${inputStyles} ${showValidation && !formData.attendance ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Time *</label>
                <input
                  type="text"
                  placeholder="e.g., 6pm - 11pm"
                  value={formData.eventTime || ''}
                  onChange={(e) => updateField('eventTime', e.target.value)}
                  className={`${inputStyles} ${showValidation && !formData.eventTime ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Setup / Packout *</label>
                <input
                  type="text"
                  placeholder="e.g., 2pm in / 12am out"
                  value={formData.setupTime || ''}
                  onChange={(e) => updateField('setupTime', e.target.value)}
                  className={`${inputStyles} ${showValidation && !formData.setupTime ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6 lg:mt-7">
            <button onClick={() => goToStep(1)} className="px-6 py-3 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
            <button
              onClick={() => {
                if (!formData.eventName || !formData.eventDate || !formData.attendance || !formData.eventTime || !formData.setupTime) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(3);
                }
              }}
              className="flex-1 bg-[#000000] text-white py-4 rounded-md font-bold text-lg hover:bg-[#152d47] transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Logistics */}
      {step === 3 && (
        <div className={`transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">Logistics & Content</h2>
          <div className="grid gap-4 lg:gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Venue Location *</label>
              <input
                type="text"
                placeholder="Full address"
                value={formData.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.location ? 'border-red-500' : ''}`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Venue Contact (Optional)</label>
              <input
                type="text"
                placeholder="Manager name or phone"
                value={formData.venueContact || ''}
                onChange={(e) => updateField('venueContact', e.target.value)}
                className={inputStyles}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Environment *</label>
                <div className="flex gap-4 p-1">
                  {['Indoor', 'Outdoor'].map((opt) => (
                    <label key={opt} className="flex-1 cursor-pointer">
                      <input
                        type="radio"
                        name="indoorOutdoor"
                        value={opt}
                        checked={formData.indoorOutdoor === opt}
                        onChange={(e) => updateField('indoorOutdoor', e.target.value)}
                        className="sr-only"
                      />
                      <div className={`py-3 text-center rounded-md border-2 transition-all font-bold ${formData.indoorOutdoor === opt ? 'border-[#000000] bg-[#000000]/5 text-[#000000]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        {opt}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Power Access *</label>
                <input
                  type="text"
                  placeholder="e.g., 2 standard outlets"
                  value={formData.powerAccess || ''}
                  onChange={(e) => updateField('powerAccess', e.target.value)}
                  className={`${inputStyles} ${showValidation && !formData.powerAccess ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Content Details *</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => updateField('content', e.target.value)}
                rows={3}
                className={`${inputStyles} resize-none ${showValidation && !formData.content ? 'border-red-500' : ''}`}
                placeholder="Band, DJ, speeches, etc..."
              />
            </div>
          </div>

          <div className="flex gap-4 mt-6 lg:mt-7">
            <button onClick={() => goToStep(2)} className="px-6 py-3 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
            <button
              onClick={() => {
                if (!formData.location || !formData.indoorOutdoor || !formData.powerAccess || !formData.content) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(4);
                }
              }}
              className="flex-1 bg-[#000000] text-white py-4 rounded-md font-bold text-lg hover:bg-[#152d47] transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Contact */}
      {step === 4 && (
        <div className={`transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">Contact Info</h2>
          <div className="grid gap-4 lg:gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name</label>
              <input
                type="text"
                value={formData.contactName || ''}
                onChange={(e) => updateField('contactName', e.target.value)}
                className={inputStyles}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4 lg:gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={formData.contactEmail || ''}
                  onChange={(e) => updateField('contactEmail', e.target.value)}
                  className={inputStyles}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.contactPhone || ''}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                  className={inputStyles}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Any other details?</label>
              <textarea
                value={formData.details || ''}
                onChange={(e) => updateField('details', e.target.value)}
                rows={3}
                className={`${inputStyles} resize-none`}
              />
            </div>
          </div>

          <div className="flex gap-4 mt-6 lg:mt-7">
            <button onClick={() => goToStep(3)} className="px-6 py-3 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.contactName || !formData.contactEmail || !formData.contactPhone}
              className="flex-1 bg-[#000000] text-white py-4 rounded-md font-bold text-lg hover:bg-[#152d47] transition-colors border border-[#000000] disabled:opacity-50"
            >
              {isSubmitting ? 'Sending...' : 'Get Quote'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InquiryPage() {
  return (
    <main className="bg-stone-50 min-h-screen pt-6 lg:pt-28 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-5 lg:mb-6 text-center">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Request a Quote</h1>
          <p className="text-gray-700 text-base lg:text-lg font-medium">Tell us about your event and we'll be in touch within 24 hours.</p>
        </div>

        <div className="bg-white rounded-md border border-stone-200 p-6 lg:p-8">
          <Suspense fallback={<div className="animate-pulse h-96 bg-stone-100 rounded-md" />}>
            <InquiryForm />
          </Suspense>
        </div>


      </div>
    </main>
  );
}
