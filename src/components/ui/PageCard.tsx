'use client';

import { ReactNode } from 'react';

interface PageCardProps {
  children: ReactNode;
  /** Center content vertically (useful for success/confirmation pages) */
  centered?: boolean;
  /** Allow height to stretch based on content (for pages with dynamic content like expandable sections) */
  stretch?: boolean;
  /** Use minimum height only - stretch if content exceeds min, otherwise stay at minimum */
  autoHeight?: boolean;
}

/**
 * Universal page card component for all quote-related pages.
 * Scales to viewport height (80-85dvh) with min/max bounds. Use stretch for min-height that can grow with content.
 * Use autoHeight to only stretch when content exceeds minimum (600px).
 */
export default function PageCard({ children, centered = false, stretch = false, autoHeight = false }: PageCardProps) {
  const heightClass = stretch
    ? 'min-h-[max(80dvh,600px)] lg:min-h-[max(85dvh,600px)] flex flex-col'
    : autoHeight
      ? 'min-h-[600px] flex flex-col'
      : 'h-[80dvh] lg:h-[85dvh] min-h-[600px] max-h-[1300px]';

  return (
    <main className="bg-stone-50 pt-5 lg:pt-5 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className={`bg-white rounded-md border border-stone-200 ${heightClass}`}>
          <div
            className={`${stretch || autoHeight ? 'flex-1' : 'h-full'} p-6 lg:p-8 flex flex-col ${centered ? 'items-center justify-center' : ''}`}
          >
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
