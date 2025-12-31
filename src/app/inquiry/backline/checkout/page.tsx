'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart-context';
import PageCard from '@/components/ui/PageCard';

interface CheckoutFormData {
  startDate: string;
  endDate: string;
  deliveryMethod: 'pickup' | 'delivery' | '';
  deliveryAddress: string;
  additionalNotes: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  techRider: File | null;
}

export default function CheckoutPage() {
  const { items, otherEquipment, updateQuantity, removeItem, setOtherEquipment, clearCart, totalItems } = useCart();
  const [step, setStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const [formData, setFormData] = useState<CheckoutFormData>({
    startDate: '',
    endDate: '',
    deliveryMethod: '',
    deliveryAddress: '',
    additionalNotes: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    techRider: null,
  });

  const fillTestData = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    setFormData({
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: dayAfter.toISOString().split('T')[0],
      deliveryMethod: 'delivery',
      deliveryAddress: '123 Daniel Street, Newtown',
      additionalNotes: 'Test booking',
      contactName: 'James Huddon',
      contactEmail: 'relahunter@gmail.com',
      contactPhone: '123467',
      techRider: null,
    });
  };

  // Listen for fill test data event from header
  useEffect(() => {
    const handleFillEvent = () => fillTestData();
    window.addEventListener('fillTestData', handleFillEvent);
    return () => window.removeEventListener('fillTestData', handleFillEvent);
  }, []);

  const updateField = <K extends keyof CheckoutFormData>(field: K, value: CheckoutFormData[K]) => {
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
      const equipment = items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
      }));

      // Use FormData to support file upload
      const formDataToSend = new FormData();
      formDataToSend.append('equipment', JSON.stringify(equipment));
      formDataToSend.append('otherEquipment', otherEquipment);
      formDataToSend.append('startDate', formData.startDate);
      formDataToSend.append('endDate', formData.endDate);
      formDataToSend.append('deliveryMethod', formData.deliveryMethod);
      formDataToSend.append('deliveryAddress', formData.deliveryAddress);
      formDataToSend.append('additionalNotes', formData.additionalNotes);
      formDataToSend.append('contactName', formData.contactName);
      formDataToSend.append('contactEmail', formData.contactEmail);
      formDataToSend.append('contactPhone', formData.contactPhone);

      if (formData.techRider) {
        formDataToSend.append('techRider', formData.techRider);
      }

      const response = await fetch('/api/inquiry/backline', {
        method: 'POST',
        body: formDataToSend,
      });
      if (response.ok) {
        clearCart();
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
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-green-100 rounded-md flex items-center justify-center mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  const totalSteps = 3;
  const hasItems = items.length > 0 || otherEquipment.trim() !== '';

  return (
    <PageCard>
      <div className="h-full flex flex-col">
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

            {/* Step 1: Review Cart */}
            {step === 1 && (
              <div className={`transition-opacity duration-100 flex-grow flex flex-col ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex-grow">
                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Review Your Items</h2>
                  <p className="text-gray-600 mb-4 font-medium">{totalItems} {totalItems === 1 ? 'item' : 'items'} in your quote</p>

                  {items.length === 0 && !otherEquipment.trim() ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 mb-4">Your cart is empty</p>
                      <Link
                        href="/inquiry/backline"
                        className="inline-block px-4 py-2 bg-[#000000] text-white font-medium rounded-md"
                      >
                        Browse Equipment
                      </Link>
                    </div>
                  ) : (
                    <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md">
                          <div className="min-w-0 flex-grow">
                            <p className="font-medium text-gray-900 truncate">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.category}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded text-sm"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded text-sm"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="ml-2 p-1.5 text-gray-400 "
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}

                      <div className="mt-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Other Equipment</label>
                        <textarea
                          value={otherEquipment}
                          onChange={(e) => setOtherEquipment(e.target.value)}
                          rows={4}
                          className={`${inputStyles} resize-none`}
                          placeholder="Any other equipment you need that's not listed..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 mt-auto pt-5">
                  <Link href="/inquiry/backline" className="px-5 py-2.5 text-gray-700 font-bold">Back</Link>
                  <button
                    onClick={() => {
                      if (!hasItems) {
                        setShowValidation(true);
                      } else {
                        goToStep(2);
                      }
                    }}
                    disabled={!hasItems}
                    className="flex-1 bg-[#000000] text-white py-3 rounded-md font-bold text-base transition-colors border border-[#000000] disabled:opacity-50"
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
                                ? 'border-red-500 text-gray-600'
                                : 'border-gray-200 text-gray-600'
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

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Tech Rider (optional)</label>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            updateField('techRider', file);
                          }}
                          className="hidden"
                          id="techRider"
                        />
                        <label
                          htmlFor="techRider"
                          className={`${inputStyles} cursor-pointer flex items-center gap-3 text-gray-500`}
                        >
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          <span className="truncate">
                            {formData.techRider ? formData.techRider.name : 'Upload PDF tech rider / stage plot'}
                          </span>
                        </label>
                        {formData.techRider && (
                          <button
                            type="button"
                            onClick={() => updateField('techRider', null)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 "
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Upload a tech rider or stage plot if available</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-auto pt-5">
                  <button onClick={() => goToStep(1)} className="px-5 py-2.5 text-gray-700 font-bold">Back</button>
                  <button
                    onClick={() => {
                      const needsAddress = formData.deliveryMethod === 'delivery';
                      if (!formData.startDate || !formData.endDate || !formData.deliveryMethod || (needsAddress && !formData.deliveryAddress)) {
                        setShowValidation(true);
                      } else {
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
                  <button onClick={() => goToStep(2)} className="px-5 py-2.5 text-gray-700 font-bold">Back</button>
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
                    ) : 'Get Quote'}
                  </button>
                </div>
              </div>
            )}
      </div>
    </PageCard>
  );
}
