'use client';

import Link from 'next/link';
import PageCard from '@/components/ui/PageCard';
import { InfoIcon } from '@/components/ui/StatusIcons';

export default function LightingInquiryPage() {
  return (
    <PageCard centered>
      <div className="flex flex-col items-center text-center">
        <div className="mb-6"><InfoIcon /></div>
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
