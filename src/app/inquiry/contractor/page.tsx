'use client';

import { useState } from 'react';
import PageCard from '@/components/ui/PageCard';

interface ContractorFormData {
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  eventDescription: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

export default function ContractorInquiryPage() {
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState<ContractorFormData>({
    eventDate: '',
    startTime: '',
    endTime: '',
    location: '',
    eventDescription: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  const fillTestData = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    setFormData({
      eventDate: tomorrow.toISOString().split('T')[0],
      startTime: '6:00 PM',
      endTime: '11:00 PM',
      location: '123 Test Venue, Wellington',
      eventDescription: 'Test wedding with live band and DJ. Approximately 150 guests. Need full sound setup and operator for the evening.',
      contactName: 'James Huddon',
      contactEmail: 'relahunter@gmail.com',
      contactPhone: '123467',
    });
  };

  const updateField = <K extends keyof ContractorFormData>(field: K, value: ContractorFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (showValidation) {
      setShowValidation(false);
    }
  };

  const goToStep = (newStep: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setIsVisible(false);
    setShowValidation(false);

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
      const response = await fetch('/api/inquiry/contractor', {
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

  const inputStyles = "w-full border border-gray-300 rounded-md px-3 py-2.5 text-base focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium";
  const totalSteps = 2;

  if (submitted) {
    return (
      <PageCard centered>
        <div className={`flex flex-col items-center text-center transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="w-20 h-20 bg-[#000000] rounded-md flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Thank you</h2>
          <p className="text-gray-700 text-lg font-medium">We&apos;ll be in touch within 24 hours.</p>
        </div>
      </PageCard>
    );
  }

  return (
    <PageCard>
      <div className="flex flex-col">
          {/* Error Summary */}
          {showValidation && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800 font-semibold">Please fill in all required fields</p>
            </div>
          )}

          {/* Progress */}
          <div className="flex gap-2 mb-4">
            {[...Array(totalSteps)].map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 transition-colors duration-200 ${i + 1 <= step ? 'bg-[#000000]' : 'bg-gray-200'}`}
              />
            ))}
          </div>

          {/* Dev Fill Button */}
          {process.env.NODE_ENV === 'development' && (
            <button
              type="button"
              onClick={fillTestData}
              className="mb-4 px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded border border-yellow-300 hover:bg-yellow-200"
            >
              Fill Test Data
            </button>
          )}

          {/* Step 1: Event Details */}
          {step === 1 && (
            <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex-grow flex flex-col">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Sound Technician Request</h2>
                <p className="text-gray-600 mb-4 font-medium">Tell us about your event and we&apos;ll provide a professional sound tech.</p>

                <div className="flex-grow flex flex-col gap-3 lg:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Event Date *</label>
                    <input
                      type="date"
                      value={formData.eventDate}
                      onChange={(e) => updateField('eventDate', e.target.value)}
                      className={`${inputStyles} ${showValidation && !formData.eventDate ? 'border-red-500' : ''}`}
                    />
                    {showValidation && !formData.eventDate && (
                      <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Start Time *</label>
                      <input
                        type="text"
                        value={formData.startTime}
                        onChange={(e) => updateField('startTime', e.target.value)}
                        className={`${inputStyles} ${showValidation && !formData.startTime ? 'border-red-500' : ''}`}
                        placeholder="e.g., 6:00 PM"
                      />
                      {showValidation && !formData.startTime && (
                        <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">End Time *</label>
                      <input
                        type="text"
                        value={formData.endTime}
                        onChange={(e) => updateField('endTime', e.target.value)}
                        className={`${inputStyles} ${showValidation && !formData.endTime ? 'border-red-500' : ''}`}
                        placeholder="e.g., 11:00 PM"
                      />
                      {showValidation && !formData.endTime && (
                        <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Location *</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      className={`${inputStyles} ${showValidation && !formData.location ? 'border-red-500' : ''}`}
                      placeholder="Venue address or area"
                    />
                    {showValidation && !formData.location && (
                      <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                    )}
                  </div>

                  <div className="flex-grow flex flex-col min-120px">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Describe Your Event *</label>
                    <p className="text-sm text-gray-500 mb-2">Help us understand your event so we can match you with the right sound technician.</p>
                    <textarea
                      value={formData.eventDescription}
                      onChange={(e) => updateField('eventDescription', e.target.value)}
                      className={`${inputStyles} resize-y min-h-[222px] ${showValidation && !formData.eventDescription ? 'border-red-500' : ''}`}
                      placeholder="Tell us about your event - what type of event is it? (e.g., wedding, corporate function, live band, DJ night, conference). How many guests are expected? What kind of audio setup do you need? Any specific requirements or challenges we should know about?"
                    />
                    {showValidation && !formData.eventDescription && (
                      <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-auto pt-5">
                <a href="/inquiry" className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</a>
                <button
                  onClick={() => {
                    if (!formData.eventDate || !formData.startTime || !formData.endTime || !formData.location || !formData.eventDescription) {
                      setShowValidation(true);
                    } else {
                      goToStep(2);
                    }
                  }}
                  className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {step === 2 && (
            <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex-grow">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Contact Information</h2>

                <div className="grid gap-3 lg:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name *</label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => updateField('contactName', e.target.value)}
                      className={`${inputStyles} ${showValidation && !formData.contactName ? 'border-red-500' : ''}`}
                      placeholder="John Smith"
                    />
                    {showValidation && !formData.contactName && (
                      <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) => updateField('contactEmail', e.target.value)}
                        className={`${inputStyles} ${showValidation && !formData.contactEmail ? 'border-red-500' : ''}`}
                        placeholder="john@example.com"
                      />
                      {showValidation && !formData.contactEmail && (
                        <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Phone *</label>
                      <input
                        type="tel"
                        value={formData.contactPhone}
                        onChange={(e) => updateField('contactPhone', e.target.value)}
                        className={`${inputStyles} ${showValidation && !formData.contactPhone ? 'border-red-500' : ''}`}
                        placeholder="+64 21 123 4567"
                      />
                      {showValidation && !formData.contactPhone && (
                        <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-auto pt-5">
                <button onClick={() => goToStep(1)} className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
                <button
                  onClick={() => {
                    if (!formData.contactName || !formData.contactEmail || !formData.contactPhone) {
                      setShowValidation(true);
                    } else {
                      setShowValidation(false);
                      handleSubmit();
                    }
                  }}
                  disabled={isSubmitting}
                  className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000] disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Get Quote'}
                </button>
              </div>
            </div>
          )}
      </div>
    </PageCard>
  );
}
