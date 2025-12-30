'use client';

import Link from 'next/link';
import PageCard from '@/components/ui/PageCard';

export default function LightingInquiryPage() {
  return (
    <PageCard centered>
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-yellow-100 rounded-md flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Coming Soon</h1>
        <p className="text-gray-600 text-lg font-medium mb-6">
          Lighting & staging hire is coming soon.
        </p>
        <p className="text-gray-500 mb-8">
          Contact us directly for lighting and staging inquiries.
        </p>
        <div className="flex gap-4">
          <Link
            href="/inquiry"
            className="px-6 py-3 text-gray-700 font-bold border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Back
          </Link>
          <Link
            href="/contact"
            className="px-6 py-3 bg-black text-white font-bold rounded-md hover:bg-gray-800"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </PageCard>
  );
}
