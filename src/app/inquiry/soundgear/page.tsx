'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import PageCard from '@/components/ui/PageCard';

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
  eventTime?: string;
  setupTime?: string;
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

function InquiryForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState<Partial<PackageFormData>>({});
  const [techRiderFile, setTechRiderFile] = useState<File | null>(null);

  // When tech rider is uploaded, automatically mark hasBand as true
  const handleTechRiderUpload = (file: File | null) => {
    setTechRiderFile(file);
    if (file) {
      updateField('hasBand', true);
    }
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
      eventTime: '6pm - 11pm',
      setupTime: '2pm setup / 12am packout',
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
    setStep(2); // Go to step 2 after filling
  };

  const updateField = (field: keyof PackageFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation when user updates a field
    if (showValidation) {
      setShowValidation(false);
    }
  };

  const goToStep = (newStep: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setIsVisible(false);
    // Clear validation when changing steps
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

  const inputStyles = "w-full border border-gray-300 rounded-md px-3 py-2.5 text-base focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium";
  const totalSteps = formData.package === 'extra_large' ? 1 : 4;

  // Stretch on step 2 for medium/large (has tech rider upload)
  const shouldStretch = step === 2 && (formData.package === 'medium' || formData.package === 'large');

  return (
    <PageCard stretch={shouldStretch}>
      <div className="h-full flex flex-col">
        {/* Error Summary */}
        {showValidation && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <p className="text-sm text-red-800 font-semibold">Please fill in all required fields</p>
        </div>
      )}

      {/* Progress - only show after package selection */}
      {step > 1 && (
        <div className="flex gap-2 mb-4">
          {[...Array(totalSteps)].map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 transition-colors duration-200 ${i + 1 <= (step - 1) ? 'bg-[#000000]' : 'bg-gray-200'}`}
            />
          ))}
        </div>
      )}

      {/* Dev Fill Button */}
      {process.env.NODE_ENV === 'development' && step === 1 && (
        <button
          type="button"
          onClick={fillTestData}
          className="mb-4 px-3 py-1 text-xs bg-yellow-100 text-yellow-800 rounded border border-yellow-300 hover:bg-yellow-200"
        >
          Fill Test Data (Medium Package)
        </button>
      )}

      {/* Step 1: Package Selection */}
      {step === 1 && (
        <div className={`transition-opacity duration-100 flex-grow flex flex-col min-h-0 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Select Your Package</h2>
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
            {packages.map((pkg) => (
              <div
                key={pkg.value}
                onClick={() => {
                  updateField('package', pkg.value);
                  goToStep(2);
                }}
                className="cursor-pointer border-2 border-gray-200 rounded-md overflow-hidden transition-all hover:border-gray-300 flex flex-col min-h-0"
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

          <div className="flex gap-4 pt-5 flex-shrink-0">
            <a href="/inquiry" className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</a>
          </div>
        </div>
      )}

      {/* Step 2: Extra-Large Contact (or Event Basics for others) */}
      {step === 2 && formData.package === 'extra_large' && (
        <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
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
              {isSubmitting ? 'Sending...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Event Basics (for small/medium/large) */}
      {step === 2 && formData.package !== 'extra_large' && (
        <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-grow">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Event Basics</h2>
            <div className="grid gap-3 lg:gap-4">

            {/* Tech Rider Upload - shown first for medium/large packages */}
            {(formData.package === 'medium' || formData.package === 'large') && (
              <div className="border-2 border-dashed border-gray-300 rounded-md p-4 bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 bg-black rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-grow">
                    <label className="block text-sm font-bold text-gray-900 mb-1">Have a Tech Rider?</label>
                    <p className="text-sm text-gray-600 mb-3">
                      Upload it and we&apos;ll extract the requirements automatically. This speeds up your quote!
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleTechRiderUpload(e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer"
                    />
                    {techRiderFile && (
                      <div className="flex items-center justify-between mt-2 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                        <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {techRiderFile.name}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleTechRiderUpload(null)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Organization (Optional)</label>
              <input
                type="text"
                value={formData.organization || ''}
                onChange={(e) => updateField('organization', e.target.value)}
                className={inputStyles}
                placeholder="Company or Group Name"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
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
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Event Time *</label>
                <input
                  type="text"
                  placeholder="e.g., 6pm - 11pm"
                  value={formData.eventTime || ''}
                  onChange={(e) => updateField('eventTime', e.target.value)}
                  className={`${inputStyles} ${showValidation && !formData.eventTime ? 'border-red-500' : ''}`}
                />
                {showValidation && !formData.eventTime && (
                  <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Setup / Packout Time *</label>
              <input
                type="text"
                placeholder="e.g., 2pm setup / 12am packout"
                value={formData.setupTime || ''}
                onChange={(e) => updateField('setupTime', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.setupTime ? 'border-red-500' : ''}`}
              />
              {showValidation && !formData.setupTime && (
                <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
              )}
            </div>
          </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(1)} className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
            <button
              onClick={() => {
                if (!formData.eventType || !formData.eventName || !formData.eventDate || !formData.eventTime || !formData.setupTime) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(3);
                }
              }}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Small Event Specifics */}
      {step === 3 && formData.package === 'small' && (
        <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-grow">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Event Details</h2>
            <div className="grid gap-3">
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
                rows={2}
                className={`${inputStyles} resize-none`}
                placeholder="Any other details we should know..."
              />
            </div>
          </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(2)} className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
            <button
              onClick={() => goToStep(4)}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Medium/Large Event Configuration */}
      {step === 3 && (formData.package === 'medium' || formData.package === 'large') && (
        <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-grow">
            {/* Show simplified version if tech rider uploaded */}
            {techRiderFile ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-md flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Tech Rider Uploaded</h2>
                    <p className="text-sm text-gray-600">{techRiderFile.name}</p>
                  </div>
                </div>
                <p className="text-gray-600 mb-4">
                  We&apos;ll extract band requirements from your tech rider. Just a few more questions:
                </p>
                <div className="grid gap-3">
                  {/* DJ Section - still relevant even with tech rider */}
                  <div className="border border-gray-200 rounded-md p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasDJ || false}
                        onChange={(e) => updateField('hasDJ', e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                      />
                      <div>
                        <span className="font-semibold text-gray-900 block">DJ Setup</span>
                        <span className="text-sm text-gray-600">Will there also be a DJ at your event?</span>
                      </div>
                    </label>
                  </div>

                  {/* Speeches Section - still relevant even with tech rider */}
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Anything else we should know?</label>
                    <textarea
                      value={formData.additionalInfo || ''}
                      onChange={(e) => updateField('additionalInfo', e.target.value)}
                      rows={2}
                      className={`${inputStyles} resize-none`}
                      placeholder="Multiple bands, special requirements, etc..."
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Content & Setup</h2>
                <div className="grid gap-3">
                  {/* Band Section */}
                  <div className="border border-gray-200 rounded-md p-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasBand || false}
                        onChange={(e) => updateField('hasBand', e.target.checked)}
                        className="mt-1 h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                      />
                      <div>
                        <span className="font-semibold text-gray-900 block">Live Band(s)</span>
                        <span className="text-sm text-gray-600">Will there be live band(s) performing?</span>
                      </div>
                    </label>
                  </div>

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
                        <span className="font-semibold text-gray-900 block">DJ Setup</span>
                        <span className="text-sm text-gray-600">Will you have a DJ at your event?</span>
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Information</label>
                    <textarea
                      value={formData.additionalInfo || ''}
                      onChange={(e) => updateField('additionalInfo', e.target.value)}
                      rows={2}
                      className={`${inputStyles} resize-none`}
                      placeholder="Band names, number of performers, any other details..."
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(2)} className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
            <button
              onClick={() => goToStep(4)}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Venue & Logistics (only for medium/large) */}
      {step === 4 && (formData.package === 'medium' || formData.package === 'large') && (
        <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex-grow">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Venue & Logistics</h2>
            <div className="grid gap-3 lg:gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Venue Location *</label>
              <input
                type="text"
                placeholder="Full venue address"
                value={formData.location || ''}
                onChange={(e) => updateField('location', e.target.value)}
                className={`${inputStyles} ${showValidation && !formData.location ? 'border-red-500' : ''}`}
              />
              {showValidation && !formData.location && (
                <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
              )}
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
                        ? 'border-red-500 text-gray-600 hover:border-red-600'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
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
                    rows={2}
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
                    rows={2}
                    className={`${inputStyles} resize-none`}
                  />
                </div>
              )}
            </div>
          </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button onClick={() => goToStep(3)} className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
            <button
              onClick={() => {
                const isOutdoor = formData.indoorOutdoor === 'Outdoor';
                if (!formData.location || !formData.indoorOutdoor || (isOutdoor && !formData.powerAccess)) {
                  setShowValidation(true);
                } else {
                  setShowValidation(false);
                  goToStep(5);
                }
              }}
              className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Contact Information (Small) or Step 4 (Medium/Large) */}
      {((step === 4 && formData.package === 'small') || (step === 5 && (formData.package === 'medium' || formData.package === 'large'))) && (
        <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Details</label>
              <textarea
                value={formData.details || ''}
                onChange={(e) => updateField('details', e.target.value)}
                rows={2}
                className={`${inputStyles} resize-none`}
                placeholder="Any other information you'd like to share..."
              />
            </div>
          </div>
          </div>

          <div className="flex gap-4 mt-auto pt-5">
            <button
              onClick={() => goToStep(formData.package === 'small' ? 3 : 4)}
              className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors"
            >
              Back
            </button>
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
