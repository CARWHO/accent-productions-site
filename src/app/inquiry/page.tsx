import { Suspense } from 'react';
import { InquiryForm } from '@/components/forms/InquiryForm';

export default function InquiryPage() {
  return (
    <main className="bg-stone-50 h-[calc(100vh-5rem)] p-4 md:p-6 lg:p-8">
      <div className="h-full max-w-4xl mx-auto flex flex-col">
        <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-6 md:p-8 lg:p-10 h-full flex flex-col overflow-hidden">
          <div className="flex-shrink-0">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Request a Quote</h1>
            <p className="text-gray-500 text-lg mb-6 md:mb-8">We&apos;ll get back to you within 24 hours.</p>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <Suspense fallback={<div className="animate-pulse h-96 bg-stone-100 rounded-lg" />}>
              <InquiryForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
