'use client';

import { ReactNode } from 'react';

interface PageCardProps {
  children: ReactNode;
  /** Optional max-width class. Defaults to max-w-3xl (768px) */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  /** Center content vertically (useful for success/response pages) */
  centered?: boolean;
  /** Remove min-height constraint - card will stretch to fit content */
  autoHeight?: boolean;
  /** Full height form mode - matches inquiry form styling (min-h-[775px] on desktop) */
  formMode?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',    // 384px
  md: 'max-w-md',    // 448px
  lg: 'max-w-lg',    // 512px
  xl: 'max-w-xl',    // 576px
  '2xl': 'max-w-2xl', // 672px
  '3xl': 'max-w-3xl', // 768px
};

export default function PageCard({
  children,
  maxWidth = '3xl',
  centered = false,
  autoHeight = false,
  formMode = false,
}: PageCardProps) {
  // Determine height class
  let heightClass = 'min-h-[400px] lg:min-h-[600px]';
  if (autoHeight) {
    heightClass = '';
  } else if (formMode) {
    heightClass = 'min-h-[400px] lg:min-h-[775px]';
  }

  return (
    <main className="bg-stone-50 min-h-screen pt-5 lg:pt-5 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8">
      <div className={`${maxWidthClasses[maxWidth]} mx-auto`}>
        <div
          className={`
            bg-white rounded-md border border-stone-200 p-6 lg:p-8
            ${heightClass}
            ${centered ? 'flex flex-col items-center justify-center' : ''}
          `}
        >
          {children}
        </div>
      </div>
    </main>
  );
}

/**
 * Success state content - use inside PageCard with centered={true}
 */
interface SuccessContentProps {
  title: string;
  message: string;
  submessage?: string;
  variant?: 'success' | 'error' | 'info';
}

export function SuccessContent({ title, message, submessage, variant = 'success' }: SuccessContentProps) {
  const iconStyles = {
    success: 'bg-[#000000]',
    error: 'bg-red-100',
    info: 'bg-blue-100',
  };

  const iconColors = {
    success: 'text-white',
    error: 'text-red-600',
    info: 'text-blue-600',
  };

  return (
    <div className="flex flex-col items-center justify-center text-center py-8">
      <div className={`w-20 h-20 ${iconStyles[variant]} rounded-md flex items-center justify-center mb-6`}>
        {variant === 'success' && (
          <svg className={`w-10 h-10 ${iconColors[variant]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {variant === 'error' && (
          <svg className={`w-10 h-10 ${iconColors[variant]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {variant === 'info' && (
          <svg className={`w-10 h-10 ${iconColors[variant]}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">{title}</h1>
      <p className="text-lg font-medium text-gray-700 mb-2">{message}</p>
      {submessage && (
        <p className="text-sm text-gray-500">{submessage}</p>
      )}
    </div>
  );
}
