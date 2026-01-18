'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import PageCard from '@/components/ui/PageCard';
import { SuccessIcon } from '@/components/ui/StatusIcons';
import type { TechRiderRequirements } from '@/lib/parse-tech-rider';

type PackageType = 'small' | 'medium' | 'large' | 'extra_large';
type EventType = 'wedding' | 'corporate' | 'festival' | 'private_party' | 'other';

interface PackageFormData {
  // Package selection
  package: PackageType;

  // Event basics
  eventType?: EventType;
  eventName?: string;
  organization?: string;
  eventDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  attendance?: number;

  // Small event specifics
  playbackFromDevice?: boolean;
  hasLiveMusic?: boolean;
  needsMic?: boolean;
  hasDJ?: boolean;

  // Content details
  hasBand?: boolean;
  bandCount?: number;
  bandNames?: string;
  bandSetup?: string;
  needsDJTable?: boolean;
  needsCDJs?: boolean;
  cdjType?: string;
  hasSpeeches?: boolean;
  needsWirelessMic?: boolean;
  needsLectern?: boolean;
  needsAmbientMusic?: boolean;
  additionalInfo?: string;

  // Venue details
  location?: string;
  venueContact?: string;
  indoorOutdoor?: string;
  wetWeatherPlan?: string;
  needsGenerator?: boolean;
  powerAccess?: string;

  // Stage
  hasStage?: boolean;
  stageDetails?: string;

  // Timing (for contractors)
  roomAvailableFrom?: string;
  callTime?: string;
  packOutTime?: string;

  // Contact
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  details?: string;
}

const packages: { value: PackageType; label: string; size: string; price: string; image: string; description: string }[] = [
  {
    value: 'small',
    label: 'Small Event',
    size: '10-50 People',
    price: 'From $500',
    image: '/images/smallpackage.png',
    description: 'Perfect for intimate gatherings, small parties, and presentations'
  },
  {
    value: 'medium',
    label: 'Medium Event',
    size: '50-200 People',
    price: 'From $1,200',
    image: '/images/mediumpackage.png',
    description: 'Ideal for weddings, corporate events, and medium-sized celebrations'
  },
  {
    value: 'large',
    label: 'Large Event',
    size: '200-1000 People',
    price: 'From $3,000',
    image: '/images/largepackage.png',
    description: 'For festivals, large conferences, and major events'
  },
  {
    value: 'extra_large',
    label: 'Extra-Large Event',
    size: '1000+ People',
    price: 'Contact Us',
    image: '/images/extralargepackage.png',
    description: 'Major festivals and events requiring custom solutions'
  },
];

const eventTypes: { value: EventType; label: string }[] = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate Event' },
  { value: 'festival', label: 'Festival' },
  { value: 'private_party', label: 'Private Party' },
  { value: 'other', label: 'Other' },
];

// Generate common time suggestions (30-minute intervals from 6am to 2am)
const timeSuggestions: string[] = [];
for (let hour = 6; hour <= 26; hour++) {
  const displayHour = hour >= 24 ? hour - 24 : hour;
  const ampm = (hour >= 12 && hour < 24) ? 'PM' : 'AM';
  const hour12 = displayHour === 0 ? 12 : (displayHour > 12 ? displayHour - 12 : displayHour);
  timeSuggestions.push(`${hour12}:00 ${ampm}`);
  timeSuggestions.push(`${hour12}:30 ${ampm}`);
}

// Time Input Component - Hybrid combobox (type + select)
function TimeInput({
  value,
  onChange,
  placeholder,
  hasError,
  inputStyles,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  hasError?: boolean;
  inputStyles: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Sync internal state with external value
  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Filter suggestions based on input
  const filteredSuggestions = inputValue
    ? timeSuggestions.filter(t =>
        t.toLowerCase().replace(/\s/g, '').includes(inputValue.toLowerCase().replace(/\s/g, ''))
      )
    : timeSuggestions;

  // Handle click outside to close dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    // Pass through immediately for custom times
    onChange(val);
  };

  const handleSelect = (time: string) => {
    setInputValue(time);
    onChange(time);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && filteredSuggestions.length > 0) {
      e.preventDefault();
      handleSelect(filteredSuggestions[0]);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`${inputStyles} ${hasError ? 'border-red-500' : ''}`}
      />
      {isOpen && filteredSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[100] w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredSuggestions.map((time) => (
            <div
              key={time}
              onClick={() => handleSelect(time)}
              className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm font-medium"
            >
              {time}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InquiryForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState<Partial<PackageFormData>>({});
  const [techRiderFile, setTechRiderFile] = useState<File | null>(null);

  // Tech rider parsing state
  const [hasTechRider, setHasTechRider] = useState<boolean>(true);
  const [isParsing, setIsParsing] = useState(false);
  const [autofilledFields, setAutofilledFields] = useState<Set<string>>(new Set());
  const [parsedTechRider, setParsedTechRider] = useState<TechRiderRequirements | null>(null);

  // Background parsing state - start parsing when file is uploaded, not when Continue is clicked
  const [parsingPromise, setParsingPromise] = useState<Promise<TechRiderRequirements | null> | null>(null);
  const [backgroundParsedResult, setBackgroundParsedResult] = useState<TechRiderRequirements | null>(null);

  // Start parsing in background immediately when file is uploaded
  const startBackgroundParsing = (file: File) => {
    // Clear any previous result
    setBackgroundParsedResult(null);

    const formDataObj = new FormData();
    formDataObj.append('file', file);

    const promise = fetch('/api/parse-tech-rider', {
      method: 'POST',
      body: formDataObj,
    })
      .then(res => res.json())
      .then((data: TechRiderRequirements | null) => {
        setBackgroundParsedResult(data);
        return data;
      })
      .catch(err => {
        console.error('Background tech rider parsing failed:', err);
        return null;
      });

    setParsingPromise(promise);
  };

  // When tech rider is uploaded, automatically mark hasBand as true and start background parsing
  const handleTechRiderUpload = (file: File | null) => {
    setTechRiderFile(file);
    // Clear previous parsing state
    setBackgroundParsedResult(null);
    setParsingPromise(null);

    if (file) {
      updateField('hasBand', true);
      // Start parsing immediately in background
      startBackgroundParsing(file);
    }
  };

  // Apply parsed tech rider data to form fields
  const applyTechRiderToForm = (parsed: TechRiderRequirements) => {
    const updates: Partial<PackageFormData> = {};
    const filled = new Set<string>();

    // Event/artist info
    if (parsed.artistName) {
      updates.bandNames = parsed.artistName;
      filled.add('bandNames');
    }
    if (parsed.eventName) {
      updates.eventName = parsed.eventName;
      filled.add('eventName');
    }
    if (parsed.eventType) {
      updates.eventType = parsed.eventType;
      filled.add('eventType');
    }
    if (parsed.organization) {
      updates.organization = parsed.organization;
      filled.add('organization');
    }

    // Content flags
    if (parsed.hasBand) {
      updates.hasBand = true;
      updates.hasLiveMusic = true;
      filled.add('hasBand');
      filled.add('hasLiveMusic');
    }
    if (parsed.hasDJ) {
      updates.hasDJ = true;
      filled.add('hasDJ');
    }

    // Additional notes from specific gear requests
    if (parsed.specificGear?.length > 0 || parsed.additionalNotes) {
      const notes = [
        parsed.specificGear?.length ? `Gear requests: ${parsed.specificGear.join(', ')}` : '',
        parsed.additionalNotes || ''
      ].filter(Boolean).join('\n\n');
      if (notes) {
        updates.additionalInfo = notes;
        filled.add('additionalInfo');
      }
    }

    setFormData(prev => ({ ...prev, ...updates }));
    setAutofilledFields(filled);
  };

  // Handle continue from tech rider step - no loading here, just proceed
  const handleTechRiderContinue = () => {
    // Go to next step (Venue for medium/large, Contact for small)
    if (formData.package === 'small') {
      goToStep(3); // Contact Info
    } else {
      goToStep(3); // Venue & Logistics
    }
  };

  // Check and apply tech rider parsing when entering Event Basics
  const handleEventBasicsEntry = async () => {
    // If we have a tech rider file and haven't applied it yet
    if (techRiderFile && !parsedTechRider) {
      setIsParsing(true);
      try {
        let result = backgroundParsedResult;

        // If background parsing is still in progress, wait for it
        if (!result && parsingPromise) {
          result = await parsingPromise;
        }

        // If no background parsing was started, parse now as fallback
        if (!result && !parsingPromise) {
          const formDataObj = new FormData();
          formDataObj.append('file', techRiderFile);

          const response = await fetch('/api/parse-tech-rider', {
            method: 'POST',
            body: formDataObj,
          });

          if (response.ok) {
            result = await response.json();
          }
        }

        if (result) {
          applyTechRiderToForm(result);
          setParsedTechRider(result);
        }
      } catch (error) {
        console.error('Tech rider parsing failed:', error);
      } finally {
        setIsParsing(false);
        setParsingPromise(null);
        setBackgroundParsedResult(null);
      }
    }
  };

  // Badge component for auto-filled fields
  const AutofillBadge = ({ field }: { field: string }) => {
    if (!autofilledFields.has(field)) return null;
    return (
      <span className="ml-2 text-xs bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
        </svg>
        From tech rider
      </span>
    );
  };

  const fillTestData = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    setFormData({
      package: 'medium',
      eventType: 'wedding',
      eventName: 'Test Wedding Reception',
      organization: 'Test Corp',
      eventDate: tomorrow.toISOString().split('T')[0],
      eventStartTime: '6:00 PM',
      eventEndTime: '11:00 PM',
      attendance: 150,
      hasBand: true,
      hasDJ: true,
      hasSpeeches: true,
      additionalInfo: 'Test event notes',
      location: '123 Test Venue, Wellington',
      venueContact: 'Venue Manager 021 555 1234',
      indoorOutdoor: 'Indoor',
      hasStage: true,
      stageDetails: '4m x 3m stage',
      contactName: 'James Huddon',
      contactEmail: 'relahunter@gmail.com',
      contactPhone: '123467',
      details: 'Test booking - please ignore',
    });
    setStep(3); // Go to step 3 (Event Basics) after filling
  };

  // Listen for fill test data event from header
  useEffect(() => {
    const handleFillEvent = () => fillTestData();
    window.addEventListener('fillTestData', handleFillEvent);
    return () => window.removeEventListener('fillTestData', handleFillEvent);
  }, []);

  const updateField = (field: keyof PackageFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation when user updates a field
    if (showValidation) {
      setShowValidation(false);
    }
  };

  const goToStep = (newStep: number) => {
    setShowValidation(false);
    setStep(newStep);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      const formDataObj = new FormData();

      // Append all form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          formDataObj.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
        }
      });

      // Append tech rider if present
      if (techRiderFile) {
        formDataObj.append('techRider', techRiderFile);
      }

      const response = await fetch('/api/inquiry', {
        method: 'POST',
        body: formDataObj,
      });
      if (response.ok) {
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <PageCard centered>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6"><SuccessIcon /></div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Thank you</h2>
          <p className="text-gray-700 text-lg font-medium">We&apos;ll be in touch within 24 hours.</p>
        </div>
      </PageCard>
    );
  }

  const inputStyles = "w-full border border-gray-300 rounded-md px-3 py-2.5 text-base focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium";
  // Total steps shown in progress bar (excluding tech rider step which has no indicator):
  // extra_large = no progress bar shown
  // small = 2 (Contact + Event Details)
  // medium/large = 4 (Venue + Contact + Event Details + Content)
  const totalSteps = formData.package === 'small' ? 2 : 4;

  return (
    <PageCard>
      {/* Parsing Loading Overlay */}
      {isParsing && (
        <div className="fixed inset-0 bg-white/95 flex flex-col items-center justify-center z-50">
          <div className="animate-spin w-12 h-12 border-4 border-black border-t-transparent rounded-full mb-4" />
          <p className="text-lg font-medium">Loading your Tech Rider...</p>
          <p className="text-sm text-gray-500 mt-2">This can take 10-20 seconds</p>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        {/* Error Summary */}
        {showValidation && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <p className="text-sm text-red-800 font-semibold">Please fill in all required fields</p>
        </div>
      )}

      {/* Progress - show from step 3 onwards (not on tech rider step) */}
      {step > 2 && formData.package !== 'extra_large' && (
        <div className="flex gap-2 mb-4">
          {[...Array(totalSteps)].map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 transition-colors duration-200 ${i + 1 <= (step - 2) ? 'bg-[#000000]' : 'bg-gray-200'}`}
            />
          ))}
        </div>
      )}

      {/* Step 1: Package Selection */}
      {step === 1 && (
        <div className="flex-grow flex flex-col">
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Select Your Package</h2>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
            {packages.map((pkg) => (
              <div
                key={pkg.value}
                onClick={() => {
                  updateField('package', pkg.value);
                  goToStep(2);
                }}
                className="cursor-pointer border-2 border-gray-200 rounded-md overflow-hidden flex flex-col min-h-0"
              >
                <div className="flex-1 relative min-h-[120px]">
                  <Image src={pkg.image} alt={pkg.label} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 to-transparent" />
                  <div className="absolute top-0 left-0 right-0 p-3">
                    <div className="flex justify-between items-start text-white">
                      <h3 className="text-lg font-bold leading-tight">{pkg.label}</h3>
                      <span className="text-base font-bold leading-tight">{pkg.price}</span>
                    </div>
                    <p className="text-xs text-white/90 leading-tight mt-1">{pkg.size}</p>
                  </div>
                </div>
                <div className="px-3 py-2 bg-white flex-shrink-0">
                  <p className="text-xs text-gray-600 font-medium leading-tight m-0">{pkg.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-4 flex-shrink-0">
            <a href="/inquiry" className="px-5 py-3 text-gray-700 font-bold border border-transparent">Back</a>
          </div>
        </div>
      )}

      {/* Step 2: Tech Rider (for small/medium/large - NOT extra_large) */}
      {step === 2 && formData.package !== 'extra_large' && (
        <div className="flex-grow flex flex-col">
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Do you have a tech rider?</h2>
          <div className="flex-1">
            <p className="text-gray-600 mb-6 font-medium">
            A tech rider contains technical requirements from your band or performers. If you have one, we can automatically extract the requirements.
          </p>

          {/* Yes/No Toggle */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setHasTechRider(true)}
              className={`py-3 text-center rounded-md border-2 transition-all font-bold ${
                hasTechRider
                  ? 'border-[#000000] bg-[#000000]/5 text-[#000000]'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              Yes, I have one
            </button>
            <button
              type="button"
              onClick={() => {
                setHasTechRider(false);
                setTechRiderFile(null);
              }}
              className={`py-3 text-center rounded-md border-2 transition-all font-bold ${
                !hasTechRider
                  ? 'border-[#000000] bg-[#000000]/5 text-[#000000]'
                  : 'border-gray-200 text-gray-600'
              }`}
            >
              No, I don&apos;t
            </button>
          </div>

          {/* File Upload (only if Yes) */}
          {hasTechRider && (
            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 bg-gray-50">
              <div className="text-center">
                <div className="w-12 h-12 bg-black rounded-md flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">Upload your tech rider</p>
                <p className="text-xs text-gray-500 mb-4">PDF, DOC, or DOCX (max 10MB)</p>
                <div className="flex justify-center">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => handleTechRiderUpload(e.target.files?.[0] || null)}
                    className="text-transparent file:mr-3 file:py-2 file:px-3.5 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white cursor-pointer w-[100px]"
                  />
                </div>
              </div>
              {techRiderFile && (
                <div className="flex items-center justify-between mt-4 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {techRiderFile.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTechRiderUpload(null)}
                    className="text-gray-500"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {!hasTechRider && (
            <div className="bg-stone-50 border border-stone-200 rounded-md p-4">
              <p className="text-sm text-gray-600">
                No problem! We&apos;ll ask you about your audio requirements in the next steps.
              </p>
            </div>
          )}
          </div>

          <div className="flex gap-4 pt-4 flex-shrink-0">
            <button onClick={() => goToStep(1)} className="px-5 py-3 text-gray-700 font-bold border border-transparent">Back</button>
            <button
              onClick={handleTechRiderContinue}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Extra-Large Contact */}
      {step === 2 && formData.package === 'extra_large' && (
        <div className={`flex-grow flex flex-col`}>
          <div className="flex-grow">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Contact Information</h2>
            <p className="text-gray-600 mb-4 font-medium">
              For events with 1000+ people, we'll need to discuss your requirements in detail. Please provide your contact information and we'll be in touch within 24 hours.
            </p>
            <div className="grid gap-3 lg:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name *</label>
              <input
                type="text"
                value={formData.contactName || ''}
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
                  value={formData.contactEmail || ''}
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
                  value={formData.contactPhone || ''}
                  onChange={(e) => updateField('contactPhone', e.target.value)}
                  className={`${inputStyles} ${showValidation && !formData.contactPhone ? 'border-red-500' : ''}`}
                  placeholder="+64 21 123 4567"
                />
                {showValidation && !formData.contactPhone && (
                  <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Details</label>
              <textarea
                value={formData.details || ''}
                onChange={(e) => updateField('details', e.target.value)}
                rows={3}
                className={`${inputStyles} resize-none`}
                placeholder="Tell us about your event..."
              />
            </div>
          </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(1)} disabled={isSubmitting} className="px-5 py-3 text-gray-700 font-bold border border-transparent disabled:opacity-50">Back</button>
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
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Venue & Logistics (medium/large) */}
      {step === 3 && (formData.package === 'medium' || formData.package === 'large') && (
        <div className={`flex-grow flex flex-col`}>
          <div className="flex-grow">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Venue & Logistics</h2>
            <div className="grid gap-3 lg:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Venue Location</label>
              <input
                type="text"
                placeholder="Full venue address"
                value={formData.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                className={inputStyles}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Venue Contact (Optional)</label>
              <input
                type="text"
                placeholder="Venue manager name or phone"
                value={formData.venueContact || ''}
                onChange={(e) => updateField('venueContact', e.target.value)}
                className={inputStyles}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Environment *</label>
              <div className="grid grid-cols-2 gap-3">
                {['Indoor', 'Outdoor'].map((opt) => (
                  <label key={opt} className="cursor-pointer">
                    <input
                      type="radio"
                      name="indoorOutdoor"
                      value={opt}
                      checked={formData.indoorOutdoor === opt}
                      onChange={(e) => updateField('indoorOutdoor', e.target.value)}
                      className="sr-only"
                    />
                    <div className={`py-2.5 text-center rounded-md border-2 transition-all font-bold ${
                      formData.indoorOutdoor === opt
                        ? 'border-[#000000] bg-[#000000]/5 text-[#000000]'
                        : showValidation && !formData.indoorOutdoor
                        ? 'border-red-500 text-gray-600'
                        : 'border-gray-200 text-gray-600'
                    }`}>
                      {opt}
                    </div>
                  </label>
                ))}
              </div>
              {showValidation && !formData.indoorOutdoor && (
                <p className="text-xs text-red-600 mt-1 font-medium">Please select an environment</p>
              )}
            </div>

            {formData.indoorOutdoor === 'Outdoor' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Power Access *</label>
                  <input
                    type="text"
                    placeholder="e.g., 2 standard outlets, 3-phase power available"
                    value={formData.powerAccess || ''}
                    onChange={(e) => updateField('powerAccess', e.target.value)}
                    className={`${inputStyles} ${showValidation && !formData.powerAccess ? 'border-red-500' : ''}`}
                  />
                  {showValidation && !formData.powerAccess && (
                    <p className="text-xs text-red-600 mt-1 font-medium">This field is required for outdoor events</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Wet Weather Plan</label>
                  <textarea
                    value={formData.wetWeatherPlan || ''}
                    onChange={(e) => updateField('wetWeatherPlan', e.target.value)}
                    rows={4}
                    className={`${inputStyles} resize-none`}
                    placeholder="What's your backup plan if it rains?"
                  />
                </div>
                <div className="border border-gray-200 rounded-md p-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.needsGenerator || false}
                      onChange={(e) => updateField('needsGenerator', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                    />
                    <span className="font-semibold text-gray-900">Generator required</span>
                  </label>
                </div>
              </>
            )}

            <div className="border border-gray-200 rounded-md p-3">
              <label className="flex items-start gap-3 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={formData.hasStage || false}
                  onChange={(e) => updateField('hasStage', e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                />
                <div>
                  <span className="font-semibold text-gray-900 block">Stage Available</span>
                  <span className="text-sm text-gray-600">Is there a stage at the venue?</span>
                </div>
              </label>

              {formData.hasStage && (
                <div className="mt-2">
                  <textarea
                    placeholder="Stage dimensions, height, access details..."
                    value={formData.stageDetails || ''}
                    onChange={(e) => updateField('stageDetails', e.target.value)}
                    rows={4}
                    className={`${inputStyles} resize-none`}
                  />
                </div>
              )}
            </div>

            {/* Timing Section */}
            <div className="border-t border-gray-200 pt-4 mt-2">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Setup Timing (Optional)</h3>
              <p className="text-sm text-gray-600 mb-4">
                Help us plan crew schedules. You can fill these in now or we&apos;ll confirm later.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Room Available From</label>
                  <TimeInput
                    value={formData.roomAvailableFrom || ''}
                    onChange={(val) => updateField('roomAvailableFrom', val)}
                    placeholder="e.g., 2:00 PM"
                    inputStyles={inputStyles}
                  />
                  <p className="text-xs text-gray-500 mt-1">When venue opens</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Crew Call Time</label>
                  <TimeInput
                    value={formData.callTime || ''}
                    onChange={(val) => updateField('callTime', val)}
                    placeholder="e.g., 3:00 PM"
                    inputStyles={inputStyles}
                  />
                  <p className="text-xs text-gray-500 mt-1">When crew arrives</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Pack-out By</label>
                  <TimeInput
                    value={formData.packOutTime || ''}
                    onChange={(val) => updateField('packOutTime', val)}
                    placeholder="e.g., 12:00 AM"
                    inputStyles={inputStyles}
                  />
                  <p className="text-xs text-gray-500 mt-1">When tear-down finishes</p>
                </div>
              </div>
            </div>
          </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(2)} className="px-5 py-3 text-gray-700 font-bold border border-transparent">Back</button>
            <button
              onClick={() => {
                const isOutdoor = formData.indoorOutdoor === 'Outdoor';
                if (!formData.indoorOutdoor || (isOutdoor && !formData.powerAccess)) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(4);
                }
              }}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Contact Info (small packages only) */}
      {step === 3 && formData.package === 'small' && (
        <div className={`flex-grow flex flex-col`}>
          <div className="flex-grow">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid gap-3 lg:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name *</label>
              <input
                type="text"
                value={formData.contactName || ''}
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
                  value={formData.contactEmail || ''}
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
                  value={formData.contactPhone || ''}
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
            <button onClick={() => goToStep(2)} className="px-5 py-3 text-gray-700 font-bold border border-transparent">Back</button>
            <button
              onClick={() => {
                if (!formData.contactName || !formData.contactEmail || !formData.contactPhone) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(4);
                  handleEventBasicsEntry(); // Check tech rider parsing
                }
              }}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Contact Info (medium/large) */}
      {step === 4 && (formData.package === 'medium' || formData.package === 'large') && (
        <div className={`flex-grow flex flex-col`}>
          <div className="flex-grow">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid gap-3 lg:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name *</label>
              <input
                type="text"
                value={formData.contactName || ''}
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
                  value={formData.contactEmail || ''}
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
                  value={formData.contactPhone || ''}
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
            <button onClick={() => goToStep(3)} className="px-5 py-3 text-gray-700 font-bold border border-transparent">Back</button>
            <button
              onClick={() => {
                if (!formData.contactName || !formData.contactEmail || !formData.contactPhone) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(5);
                  handleEventBasicsEntry(); // Check tech rider parsing
                }
              }}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Event Basics + Details (small packages - FINAL STEP) */}
      {step === 4 && formData.package === 'small' && (
        <div className={`flex-grow flex flex-col`}>
          <div className="flex-grow">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Event Details</h2>
            <div className="grid gap-3 lg:gap-4">

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Type of Event *</label>
              <select
                value={formData.eventType || ''}
                onChange={(e) => updateField('eventType', e.target.value)}
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Name *</label>
              <input
                type="text"
                value={formData.eventName || ''}
                onChange={(e) => updateField('eventName', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.eventName ? 'border-red-500' : ''}`}
                placeholder="e.g., Annual Awards Night"
              />
              {showValidation && !formData.eventName && (
                <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Date *</label>
              <input
                type="date"
                value={formData.eventDate || ''}
                onChange={(e) => updateField('eventDate', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.eventDate ? 'border-red-500' : ''}`}
              />
              {showValidation && !formData.eventDate && (
                <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Start Time</label>
                <TimeInput
                  value={formData.eventStartTime || ''}
                  onChange={(val) => updateField('eventStartTime', val)}
                  placeholder="e.g., 6:00 PM"
                  inputStyles={inputStyles}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event End Time</label>
                <TimeInput
                  value={formData.eventEndTime || ''}
                  onChange={(val) => updateField('eventEndTime', val)}
                  placeholder="e.g., 11:00 PM"
                  inputStyles={inputStyles}
                />
              </div>
            </div>

            {/* Content options */}
            <div className="border border-gray-200 rounded-md p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.playbackFromDevice || false}
                  onChange={(e) => updateField('playbackFromDevice', e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                />
                <div>
                  <span className="font-semibold text-gray-900 block">Playback from Device</span>
                  <span className="text-sm text-gray-600">Playing music from iPhone/Laptop/iPod through speakers</span>
                </div>
              </label>
            </div>

            <div className="border border-gray-200 rounded-md p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasLiveMusic || false}
                  onChange={(e) => updateField('hasLiveMusic', e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                />
                <div>
                  <span className="font-semibold text-gray-900 block">Live Music</span>
                  <span className="text-sm text-gray-600">Will there be any live music at your event?</span>
                </div>
              </label>
            </div>

            <div className="border border-gray-200 rounded-md p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.needsMic || false}
                  onChange={(e) => updateField('needsMic', e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                />
                <div>
                  <span className="font-semibold text-gray-900 block">Microphone Required</span>
                  <span className="text-sm text-gray-600">Do you need a microphone for speeches or announcements?</span>
                </div>
              </label>
            </div>

            <div className="border border-gray-200 rounded-md p-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.hasDJ || false}
                  onChange={(e) => updateField('hasDJ', e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                />
                <div>
                  <span className="font-semibold text-gray-900 block">DJ Present</span>
                  <span className="text-sm text-gray-600">Will you have a DJ at your event?</span>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Information</label>
              <textarea
                value={formData.additionalInfo || ''}
                onChange={(e) => updateField('additionalInfo', e.target.value)}
                rows={3}
                className={`${inputStyles} resize-none`}
                placeholder="Any other details we should know..."
              />
            </div>
          </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(3)} disabled={isSubmitting} className="px-5 py-3 text-gray-700 font-bold border border-transparent disabled:opacity-50">Back</button>
            <button
              onClick={() => {
                if (!formData.eventType || !formData.eventName || !formData.eventDate) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  handleSubmit();
                }
              }}
              disabled={isSubmitting}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000] disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : 'Get Quote'}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Event Details (medium/large) */}
      {step === 5 && (formData.package === 'medium' || formData.package === 'large') && (
        <div className={`flex-grow flex flex-col`}>
          <div className="flex-grow overflow-y-auto">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Event Details</h2>
            <div className="grid gap-3 lg:gap-4">

            {/* Event Type */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Type of Event *
                <AutofillBadge field="eventType" />
              </label>
              <select
                value={formData.eventType || ''}
                onChange={(e) => updateField('eventType', e.target.value)}
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

            {/* Event Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Event Name *
                <AutofillBadge field="eventName" />
              </label>
              <input
                type="text"
                value={formData.eventName || ''}
                onChange={(e) => updateField('eventName', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.eventName ? 'border-red-500' : ''}`}
                placeholder="e.g., Annual Awards Night"
              />
              {showValidation && !formData.eventName && (
                <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
              )}
            </div>

            {/* Organization */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Organization (Optional)
                <AutofillBadge field="organization" />
              </label>
              <input
                type="text"
                value={formData.organization || ''}
                onChange={(e) => updateField('organization', e.target.value)}
                className={inputStyles}
                placeholder="e.g., Company name"
              />
            </div>

            {/* Event Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Date *</label>
              <input
                type="date"
                value={formData.eventDate || ''}
                onChange={(e) => updateField('eventDate', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.eventDate ? 'border-red-500' : ''}`}
              />
              {showValidation && !formData.eventDate && (
                <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
              )}
            </div>

            {/* Event Times */}
            <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Start Time</label>
                <TimeInput
                  value={formData.eventStartTime || ''}
                  onChange={(val) => updateField('eventStartTime', val)}
                  placeholder="e.g., 6:00 PM"
                  inputStyles={inputStyles}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event End Time</label>
                <TimeInput
                  value={formData.eventEndTime || ''}
                  onChange={(val) => updateField('eventEndTime', val)}
                  placeholder="e.g., 11:00 PM"
                  inputStyles={inputStyles}
                />
              </div>
            </div>
          </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(4)} className="px-5 py-3 text-gray-700 font-bold border border-transparent">Back</button>
            <button
              onClick={() => {
                if (!formData.eventType || !formData.eventName || !formData.eventDate) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(6);
                }
              }}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Content & Setup (medium/large - FINAL STEP) */}
      {step === 6 && (formData.package === 'medium' || formData.package === 'large') && (
        <div className={`flex-grow flex flex-col`}>
          <div className="flex-grow overflow-y-auto">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Content & Setup</h2>
            <div className="grid gap-3 lg:gap-4">

              {/* Band Section - hide if tech rider (we'll get it from there) */}
              {!techRiderFile && (
                <div className="border border-gray-200 rounded-md p-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasBand || false}
                      onChange={(e) => updateField('hasBand', e.target.checked)}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                    />
                    <div>
                      <span className="font-semibold text-gray-900 inline-flex items-center">
                        Live Band(s)
                        <AutofillBadge field="hasBand" />
                      </span>
                      <span className="text-sm text-gray-600 block">Will there be live band(s) performing?</span>
                    </div>
                  </label>
                </div>
              )}

              {/* DJ Section */}
              <div className="border border-gray-200 rounded-md p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasDJ || false}
                    onChange={(e) => updateField('hasDJ', e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 inline-flex items-center">
                      DJ Setup
                      <AutofillBadge field="hasDJ" />
                    </span>
                    <span className="text-sm text-gray-600 block">Will you have a DJ at your event?</span>
                  </div>
                </label>
              </div>

              {/* Speeches Section */}
              <div className="border border-gray-200 rounded-md p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasSpeeches || false}
                    onChange={(e) => updateField('hasSpeeches', e.target.checked)}
                    className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 block">Speeches/Presentations</span>
                    <span className="text-sm text-gray-600">Will there be speeches or presentations?</span>
                  </div>
                </label>
              </div>

              {/* Additional Information */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional Information
                  <AutofillBadge field="additionalInfo" />
                </label>
                <textarea
                  value={formData.additionalInfo || ''}
                  onChange={(e) => updateField('additionalInfo', e.target.value)}
                  rows={10}
                  className={`${inputStyles} resize-none`}
                  placeholder={techRiderFile ? "Multiple bands, special requirements, etc..." : "Band names, number of performers, any other details..."}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(5)} disabled={isSubmitting} className="px-5 py-3 text-gray-700 font-bold border border-transparent disabled:opacity-50">Back</button>
            <button
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000] disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : 'Get Quote'}
            </button>
          </div>
        </div>
      )}
      </div>
    </PageCard>
  );
}

export default function SoundgearInquiryPage() {
  return (
    <Suspense fallback={
      <PageCard>
        <div className="animate-pulse h-96 bg-stone-100 rounded-md" />
      </PageCard>
    }>
      <InquiryForm />
    </Suspense>
  );
}
