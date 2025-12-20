import { InquiryForm } from '@/components/forms/InquiryForm';

export default function InquiryPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white mb-4">Request a Quote</h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Tell us about your event and we&apos;ll send you a custom quote.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-16 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <InquiryForm />
        </div>
      </section>
    </main>
  );
}
