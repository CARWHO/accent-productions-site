'use client';

import { ReactNode } from 'react';

interface PageCardProps {
  children: ReactNode;
  /** Center content vertically (useful for success/confirmation pages) */
  centered?: boolean;
  /** Allow height to stretch based on content (for pages with dynamic content like expandable sections) */
  stretch?: boolean;
}

/**
 * Universal page card component for all quote-related pages.
 * Fixed height of 780px by default. Use stretch for min-height that can grow with content.
 */
export default function PageCard({ children, centered = false, stretch = false }: PageCardProps) {
  return (
    <main className="bg-stone-50 pt-5 lg:pt-5 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className={`bg-white rounded-md border border-stone-200 ${stretch ? 'min-h-[600px] lg:min-h-[780px] flex flex-col' : 'h-[600px] lg:h-[780px]'}`}>
          <div
            className={`${stretch ? 'flex-1' : 'h-full'} p-6 lg:p-8 flex flex-col ${centered ? 'items-center justify-center' : ''}`}
          >
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
