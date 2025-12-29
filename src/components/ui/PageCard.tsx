'use client';

import { ReactNode } from 'react';

interface PageCardProps {
  children: ReactNode;
  /** Center content vertically (useful for success/confirmation pages) */
  centered?: boolean;
  /** Allow height to stretch based on content (no fixed height limit) */
  stretch?: boolean;
}

/**
 * Universal page card component for all quote-related pages.
 */
export default function PageCard({ children, centered = false, stretch = false }: PageCardProps) {
  return (
    <main className={`bg-stone-50 pt-5 lg:pt-5 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8 min-h-screen`}>
      <div className={`max-w-3xl mx-auto ${stretch ? 'w-full' : ''}`}>
        <div className={`bg-white rounded-md border border-stone-200 ${stretch ? '' : 'h-[780px] lg:h-[780px]'} overflow-hidden`}>
          <div
            className={`
              ${stretch ? 'p-6 lg:p-8' : 'h-full overflow-y-auto p-6 lg:p-8'}
              ${centered ? 'flex flex-col items-center justify-center' : ''}
            `}
          >
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
