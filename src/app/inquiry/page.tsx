import { InquiryForm } from '@/components/forms/InquiryForm';

export default function InquiryPage() {
  return (
    <main className="min-h-screen py-16 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-4">Request a Quote</h1>
        <p className="text-lg text-gray-600 mb-8">
          Tell us about your event and we&apos;ll get back to you with a custom quote.
        </p>
        <div className="bg-white p-8 rounded-lg shadow-sm">
          <InquiryForm />
        </div>
      </div>
    </main>
  );
}
