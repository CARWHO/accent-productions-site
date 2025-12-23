'use client';

import { useState } from 'react';

type RoleType = 'sound_engineer' | 'audio_technician' | 'dj' | 'other';
type EventType = 'wedding' | 'corporate' | 'festival' | 'party' | 'other';

interface ContractorFormData {
  roleType: RoleType | '';
  otherRole: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  location: string;
  eventType: EventType | '';
  specialRequirements: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

const roleTypes: { value: RoleType; label: string; description: string }[] = [
  { value: 'sound_engineer', label: 'Sound Engineer', description: 'Professional mixing and audio management' },
  { value: 'audio_technician', label: 'Audio Technician', description: 'Equipment setup and operation' },
  { value: 'dj', label: 'DJ', description: 'Music selection and entertainment' },
  { value: 'other', label: 'Other', description: 'Specify your requirements' },
];

const eventTypes: { value: EventType; label: string }[] = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate Event' },
  { value: 'festival', label: 'Festival' },
  { value: 'party', label: 'Private Party' },
  { value: 'other', label: 'Other' },
];

export default function ContractorInquiryPage() {
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState<ContractorFormData>({
    roleType: '',
    otherRole: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    location: '',
    eventType: '',
    specialRequirements: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

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

  if (submitted) {
    return (
      <main className="bg-stone-50 min-h-screen pt-5 lg:pt-5 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-md border border-stone-200 p-6 lg:p-8 min-h-[400px] lg:min-h-[775px]">
            <div className={`flex flex-col items-center justify-center min-h-[610px] transition-opacity duration-100 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
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

  const inputStyles = "w-full border border-gray-300 rounded-md px-3 py-2.5 text-base focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium";
  const totalSteps = 3;

  return (
    <main className="bg-stone-50 min-h-screen pt-5 lg:pt-5 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-md border border-stone-200 p-6 lg:p-8 min-h-[400px] lg:min-h-[775px]">
          <div className="w-full min-h-0 lg:min-h-[720px] flex flex-col">
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

            {/* Step 1: Role Selection */}
            {step === 1 && (
              <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex-grow">
                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Role Selection</h2>
                  <p className="text-gray-600 mb-4 font-medium">What type of professional do you need?</p>

                  <div className="grid gap-3">
                    {roleTypes.map((role) => (
                      <label
                        key={role.value}
                        className="cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="roleType"
                          value={role.value}
                          checked={formData.roleType === role.value}
                          onChange={(e) => updateField('roleType', e.target.value as RoleType)}
                          className="sr-only"
                        />
                        <div className={`border-2 rounded-md p-4 transition-all ${
                          formData.roleType === role.value
                            ? 'border-[#000000] bg-[#000000]/5'
                            : showValidation && !formData.roleType
                            ? 'border-red-500'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                          <span className="font-bold text-gray-900 block">{role.label}</span>
                          <span className="text-sm text-gray-600">{role.description}</span>
                        </div>
                      </label>
                    ))}

                    {formData.roleType === 'other' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Please specify *</label>
                        <input
                          type="text"
                          value={formData.otherRole}
                          onChange={(e) => updateField('otherRole', e.target.value)}
                          className={`${inputStyles} ${showValidation && formData.roleType === 'other' && !formData.otherRole ? 'border-red-500' : ''}`}
                          placeholder="Describe the role you need..."
                        />
                        {showValidation && formData.roleType === 'other' && !formData.otherRole && (
                          <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 mt-auto pt-5">
                  <a href="/inquiry" className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</a>
                  <button
                    onClick={() => {
                      const needsOtherRole = formData.roleType === 'other';
                      if (!formData.roleType || (needsOtherRole && !formData.otherRole)) {
                        setShowValidation(true);
                      } else {
                        goToStep(2);
                      }
                    }}
                    className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base hover:bg-[#152d47] transition-colors border border-[#000000]"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Availability & Requirements */}
            {step === 2 && (
              <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex-grow">
                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Availability & Requirements</h2>

                  <div className="grid gap-3 lg:gap-4">
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

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Event Type *</label>
                      <select
                        value={formData.eventType}
                        onChange={(e) => updateField('eventType', e.target.value as EventType)}
                        className={`${inputStyles} ${showValidation && !formData.eventType ? 'border-red-500' : ''}`}
                      >
                        <option value="">Select event type...</option>
                        {eventTypes.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                      {showValidation && !formData.eventType && (
                        <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Special Requirements</label>
                      <textarea
                        value={formData.specialRequirements}
                        onChange={(e) => updateField('specialRequirements', e.target.value)}
                        rows={3}
                        className={`${inputStyles} resize-none`}
                        placeholder="Any specific skills, equipment familiarity, or other requirements..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto pt-5">
                  <button onClick={() => goToStep(1)} className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
                  <button
                    onClick={() => {
                      if (!formData.eventDate || !formData.startTime || !formData.endTime || !formData.location || !formData.eventType) {
                        setShowValidation(true);
                      } else {
                        goToStep(3);
                      }
                    }}
                    className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base hover:bg-[#152d47] transition-colors border border-[#000000]"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Contact Information */}
            {step === 3 && (
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
                  <button onClick={() => goToStep(2)} className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
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
                    className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base hover:bg-[#152d47] transition-colors border border-[#000000] disabled:opacity-50"
                  >
                    {isSubmitting ? 'Sending...' : 'Get Quote'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
