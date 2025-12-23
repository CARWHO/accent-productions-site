'use client';

import { useState } from 'react';

interface EquipmentItem {
  id: string;
  label: string;
  selected: boolean;
  quantity: number;
}

interface backlineFormData {
  equipment: EquipmentItem[];
  otherEquipment: string;
  startDate: string;
  endDate: string;
  deliveryMethod: 'pickup' | 'delivery' | '';
  deliveryAddress: string;
  additionalNotes: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

const initialEquipment: EquipmentItem[] = [
  { id: 'speakers', label: 'Speakers', selected: false, quantity: 1 },
  { id: 'subwoofers', label: 'Subwoofers', selected: false, quantity: 1 },
  { id: 'mixers', label: 'Mixers', selected: false, quantity: 1 },
  { id: 'mics_wired', label: 'Microphones - Wired', selected: false, quantity: 1 },
  { id: 'mics_wireless', label: 'Microphones - Wireless', selected: false, quantity: 1 },
  { id: 'dj_equipment', label: 'DJ Equipment', selected: false, quantity: 1 },
  { id: 'monitors', label: 'Stage Monitors', selected: false, quantity: 1 },
  { id: 'cables', label: 'Cables & Accessories', selected: false, quantity: 1 },
];

export default function backlineInquiryPage() {
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState<backlineFormData>({
    equipment: initialEquipment,
    otherEquipment: '',
    startDate: '',
    endDate: '',
    deliveryMethod: '',
    deliveryAddress: '',
    additionalNotes: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  const updateField = <K extends keyof backlineFormData>(field: K, value: backlineFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (showValidation) {
      setShowValidation(false);
    }
  };

  const toggleEquipment = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      ),
    }));
    if (showValidation) {
      setShowValidation(false);
    }
  };

  const updateQuantity = (id: string, quantity: number) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item
      ),
    }));
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
      const selectedEquipment = formData.equipment
        .filter((item) => item.selected)
        .map((item) => ({ name: item.label, quantity: item.quantity }));

      const response = await fetch('/api/inquiry/backline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          equipment: selectedEquipment,
        }),
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
  const hasSelectedEquipment = formData.equipment.some((item) => item.selected) || formData.otherEquipment.trim() !== '';

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

            {/* Step 1: Equipment Selection */}
            {step === 1 && (
              <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex-grow">
                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Equipment Selection</h2>
                  <p className="text-gray-600 mb-4 font-medium">Select the equipment you need and specify quantities.</p>

                  <div className="grid gap-3">
                    {formData.equipment.map((item) => (
                      <div
                        key={item.id}
                        className={`border rounded-md p-3 transition-all ${
                          item.selected ? 'border-[#000000] bg-[#000000]/5' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer flex-grow">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleEquipment(item.id)}
                              className="h-5 w-5 rounded border-gray-300 text-[#000000] focus:ring-[#000000]"
                            />
                            <span className="font-semibold text-gray-900">{item.label}</span>
                          </label>
                          {item.selected && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-semibold">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Other Equipment</label>
                      <textarea
                        value={formData.otherEquipment}
                        onChange={(e) => updateField('otherEquipment', e.target.value)}
                        rows={2}
                        className={`${inputStyles} resize-none`}
                        placeholder="Any other equipment you need..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto pt-5">
                  <a href="/inquiry" className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</a>
                  <button
                    onClick={() => {
                      if (!hasSelectedEquipment) {
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

            {/* Step 2: Dates & Logistics */}
            {step === 2 && (
              <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex-grow">
                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Dates & Logistics</h2>

                  <div className="grid gap-3 lg:gap-4">
                    <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date *</label>
                        <input
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => updateField('startDate', e.target.value)}
                          className={`${inputStyles} ${showValidation && !formData.startDate ? 'border-red-500' : ''}`}
                        />
                        {showValidation && !formData.startDate && (
                          <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">End Date *</label>
                        <input
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => updateField('endDate', e.target.value)}
                          className={`${inputStyles} ${showValidation && !formData.endDate ? 'border-red-500' : ''}`}
                        />
                        {showValidation && !formData.endDate && (
                          <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Pickup or Delivery *</label>
                      <div className="grid grid-cols-2 gap-3">
                        {(['pickup', 'delivery'] as const).map((opt) => (
                          <label key={opt} className="cursor-pointer">
                            <input
                              type="radio"
                              name="deliveryMethod"
                              value={opt}
                              checked={formData.deliveryMethod === opt}
                              onChange={(e) => updateField('deliveryMethod', e.target.value as 'pickup' | 'delivery')}
                              className="sr-only"
                            />
                            <div className={`py-2.5 text-center rounded-md border-2 transition-all font-bold ${
                              formData.deliveryMethod === opt
                                ? 'border-[#000000] bg-[#000000]/5 text-[#000000]'
                                : showValidation && !formData.deliveryMethod
                                ? 'border-red-500 text-gray-600 hover:border-red-600'
                                : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}>
                              {opt === 'pickup' ? 'Pickup' : 'Delivery'}
                            </div>
                          </label>
                        ))}
                      </div>
                      {showValidation && !formData.deliveryMethod && (
                        <p className="text-xs text-red-600 mt-1 font-medium">Please select an option</p>
                      )}
                    </div>

                    {formData.deliveryMethod === 'delivery' && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Address *</label>
                        <input
                          type="text"
                          value={formData.deliveryAddress}
                          onChange={(e) => updateField('deliveryAddress', e.target.value)}
                          className={`${inputStyles} ${showValidation && formData.deliveryMethod === 'delivery' && !formData.deliveryAddress ? 'border-red-500' : ''}`}
                          placeholder="Full delivery address"
                        />
                        {showValidation && formData.deliveryMethod === 'delivery' && !formData.deliveryAddress && (
                          <p className="text-xs text-red-600 mt-1 font-medium">This field is required</p>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes</label>
                      <textarea
                        value={formData.additionalNotes}
                        onChange={(e) => updateField('additionalNotes', e.target.value)}
                        rows={3}
                        className={`${inputStyles} resize-none`}
                        placeholder="Any special requirements or notes..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto pt-5">
                  <button onClick={() => goToStep(1)} className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</button>
                  <button
                    onClick={() => {
                      const needsAddress = formData.deliveryMethod === 'delivery';
                      if (!formData.startDate || !formData.endDate || !formData.deliveryMethod || (needsAddress && !formData.deliveryAddress)) {
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
