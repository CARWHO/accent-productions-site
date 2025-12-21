'use client';

import { useState, useEffect } from 'react';
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

export function InquiryForm() {
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
      <div className={`flex flex-col items-center justify-center h-full transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-20 h-20 bg-[#F47B20] rounded-full flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">Thank you</h2>
        <p className="text-gray-600 text-lg">We&apos;ll be in touch within 24 hours.</p>
      </div>
    );
  }

  const inputStyles = "w-full border border-gray-300 rounded-lg px-4 py-3 text-base lg:py-2 2xl:py-3 focus:outline-none focus:border-[#F47B20] transition-colors";

  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      <div className="flex gap-2 mb-4 flex-shrink-0">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${s <= step ? 'bg-[#F47B20]' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* Step 1: Event Type */}
      {step === 1 && (
        <div className={`transition-opacity duration-100 flex flex-col h-full ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-4 flex-shrink-0">What type of event?</h2>
          <div className="grid grid-cols-3 gap-2 md:gap-3 flex-1 min-h-0">
            {eventTypes.map((type, index) => (
              <button
                key={type.value}
                type="button"
                onClick={() => {
                  updateField('eventType', type.value);
                  goToStep(2);
                }}
                className={`group relative border-2 rounded-lg overflow-hidden transition-all block ${index === 3 ? 'col-start-2' : ''
                  } ${formData.eventType === type.value
                    ? 'border-[#F47B20] shadow-md ring-1 ring-[#F47B20]'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                style={{ padding: 0, margin: 0 }}
              >
                <div className="aspect-[3/2] relative w-full">
                  <Image
                    src={type.image}
                    alt={type.label}
                    fill
                    className="object-cover"
                  />
                  {/* Hover overlay only */}
                  <div className="absolute inset-0 transition-colors bg-black/0 group-hover:bg-black/5" />
                </div>
                <div className="px-2 pt-2 md:px-3 md:pt-3 bg-white" style={{ paddingBottom: '0.5rem' }}>
                  <span className={`font-medium text-sm md:text-base block ${formData.eventType === type.value
                    ? 'text-[#F47B20]'
                    : 'text-gray-900'
                    }`}>
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
          <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4 lg:mb-3">Event Basics</h2>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3 lg:gap-y-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What is the name of the event? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.eventName || ''}
                onChange={(e) => updateField('eventName', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.eventName ? 'border-red-500' : ''}`}
                placeholder="e.g., Annual Awards Night"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What organization is this for? <span className="text-gray-400 font-normal ml-1">(Optional)</span>
              </label>
              <input
                type="text"
                value={formData.organization || ''}
                onChange={(e) => updateField('organization', e.target.value)}
                className={inputStyles}
                placeholder="Company or Group Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What date is the event? <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.eventDate || ''}
                onChange={(e) => updateField('eventDate', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.eventDate ? 'border-red-500' : ''}`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approx. audience details? <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="e.g., 100"
                value={formData.attendance || ''}
                onChange={(e) => updateField('attendance', Number(e.target.value))}
                className={`${inputStyles} ${showValidation && !formData.attendance ? 'border-red-500' : ''}`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What is the event time? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 6pm - 11pm"
                value={formData.eventTime || ''}
                onChange={(e) => updateField('eventTime', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.eventTime ? 'border-red-500' : ''}`}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Setup / Packout times? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 2pm in / 12am out"
                value={formData.setupTime || ''}
                onChange={(e) => updateField('setupTime', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.setupTime ? 'border-red-500' : ''}`}
                required
              />
            </div>
          </div>

          {showValidation && (
            <p className="text-red-500 text-sm mt-4">Please fill in all required fields to continue.</p>
          )}

          <div className="flex gap-3 mt-6 lg:mt-4">
            <button
              type="button"
              onClick={() => goToStep(1)}
              className="px-8 py-3 text-gray-600 hover:text-gray-900 text-lg"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  !formData.eventName ||
                  !formData.eventDate ||
                  !formData.attendance ||
                  !formData.eventTime ||
                  !formData.setupTime
                ) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(3);
                }
              }}
              className="flex-1 bg-[#F47B20] text-white py-3 rounded-lg font-semibold text-lg hover:bg-[#D96B10] transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Logistics & Content */}
      {step === 3 && (
        <div className={`transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4 lg:mb-3">Logistics & Content</h2>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3 lg:gap-y-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Where is the venue located? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Venue name and full address"
                value={formData.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.location ? 'border-red-500' : ''}`}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Do you have a venue contact? <span className="text-gray-400 font-normal ml-1">(Type N/A if unknown)</span>
              </label>
              <input
                type="text"
                placeholder="Manager name, email, or phone"
                value={formData.venueContact || ''}
                onChange={(e) => updateField('venueContact', e.target.value)}
                className={inputStyles}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Is this event indoor or outdoor? <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="indoorOutdoor"
                    value="Indoor"
                    checked={formData.indoorOutdoor === 'Indoor'}
                    onChange={(e) => updateField('indoorOutdoor', e.target.value)}
                    className="w-4 h-4 text-[#F47B20] focus:ring-[#F47B20]"
                  />
                  <span>Indoor</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="indoorOutdoor"
                    value="Outdoor"
                    checked={formData.indoorOutdoor === 'Outdoor'}
                    onChange={(e) => updateField('indoorOutdoor', e.target.value)}
                    className="w-4 h-4 text-[#F47B20] focus:ring-[#F47B20]"
                  />
                  <span>Outdoor</span>
                </label>
              </div>
              {showValidation && !formData.indoorOutdoor && (
                <p className="text-red-500 text-xs mt-1">Please select an option</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                How is power accessed? <span className="text-red-500">*</span> <span className="text-gray-400 font-normal text-xs">(Type N/A if unknown)</span>
              </label>
              <input
                type="text"
                placeholder="e.g., 2x 10A outlets"
                value={formData.powerAccess || ''}
                onChange={(e) => updateField('powerAccess', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.powerAccess ? 'border-red-500' : ''}`}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Who is providing the stage? <span className="text-gray-400 font-normal ml-1">(Optional / Type N/A)</span>
              </label>
              <input
                type="text"
                placeholder="Company name or 'Self'"
                value={formData.stageProvider || ''}
                onChange={(e) => updateField('stageProvider', e.target.value)}
                className={inputStyles}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                What are the content details? <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => updateField('content', e.target.value)}
                rows={2}
                className={`${inputStyles} resize-none ${showValidation && !formData.content ? 'border-red-500' : ''}`}
                placeholder="Band, DJ, speeches, etc..."
                required
              />
            </div>
          </div>

          {showValidation && (
            <p className="text-red-500 text-sm mt-4">Please fill in all required fields to continue.</p>
          )}

          <div className="flex gap-3 mt-6 lg:mt-4">
            <button
              type="button"
              onClick={() => goToStep(2)}
              className="px-8 py-3 text-gray-600 hover:text-gray-900 text-lg"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (
                  !formData.location ||
                  !formData.indoorOutdoor ||
                  !formData.powerAccess ||
                  !formData.content
                ) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(4);
                }
              }}
              className="flex-1 bg-[#F47B20] text-white py-3 rounded-lg font-semibold text-lg hover:bg-[#D96B10] transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Contact Info */}
      {step === 4 && (
        <div className={`transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-4 lg:mb-3">Contact info</h2>
          <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3 lg:gap-y-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={formData.contactName || ''}
                onChange={(e) => updateField('contactName', e.target.value)}
                className={inputStyles}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.contactEmail || ''}
                onChange={(e) => updateField('contactEmail', e.target.value)}
                className={inputStyles}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.contactPhone || ''}
                onChange={(e) => updateField('contactPhone', e.target.value)}
                className={inputStyles}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Any other details?</label>
              <textarea
                value={formData.details || ''}
                onChange={(e) => updateField('details', e.target.value)}
                rows={2}
                className={`${inputStyles} resize-none`}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6 lg:mt-4">
            <button
              type="button"
              onClick={() => goToStep(3)}
              className="px-8 py-3 text-gray-600 hover:text-gray-900 text-lg"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.contactName || !formData.contactEmail || !formData.contactPhone}
              className="flex-1 bg-[#F47B20] text-white py-3 rounded-lg font-semibold text-lg hover:bg-[#D96B10] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Sending...' : 'Get Quote'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
