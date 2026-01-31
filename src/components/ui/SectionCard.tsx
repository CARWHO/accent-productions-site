'use client';

import { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export function SectionCard({
  title,
  children,
  className = '',
  padding = 'md'
}: SectionCardProps) {
  const paddingStyles = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={`bg-white border rounded-lg ${paddingStyles[padding]} ${className}`}>
      {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
      {children}
    </div>
  );
}
