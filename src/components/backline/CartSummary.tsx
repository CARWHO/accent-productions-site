'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart-context';

export function CartSummary() {
  const { items, totalItems } = useCart();

  if (items.length === 0) {
    return null;
  }

  return (
    <Link
      href="/inquiry/backline/checkout"
      className="fixed bottom-6 right-6 z-40 bg-[#000000] text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-3 font-bold"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <span>{totalItems} {totalItems === 1 ? 'item' : 'items'}</span>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
