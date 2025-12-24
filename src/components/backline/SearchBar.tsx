'use client';

import { useState, useEffect, useRef } from 'react';
import { useCart } from '@/lib/cart-context';

interface HireItem {
  id: string;
  category: string;
  name: string;
  notes: string | null;
  hire_rate_per_day: number | null;
}

interface SearchBarProps {
  placeholder?: string;
}

export function SearchBar({ placeholder = 'Search equipment...' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HireItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const { addItem, isInCart, getItemQuantity, updateQuantity } = useCart();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/hire-items?search=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.success) {
          setResults(data.allItems || []);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleAddToCart = (item: HireItem) => {
    addItem({
      id: item.id,
      name: item.name,
      category: item.category,
      notes: item.notes,
    });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && results.length > 0 && setShowResults(true)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-md pl-10 pr-4 py-2.5 text-base focus:outline-none focus:border-[#000000] transition-colors bg-white font-medium"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {results.map((item) => {
            const inCart = isInCart(item.id);
            const quantity = getItemQuantity(item.id);

            return (
              <div
                key={item.id}
                className="p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-grow">
                    <p className="font-medium text-gray-900 truncate">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.category}
                      {item.notes && ` • ${item.notes}`}
                    </p>
                  </div>
                  {inCart ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 transition-colors text-sm"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-semibold text-sm">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center border border-gray-300 rounded hover:bg-gray-100 transition-colors text-sm"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(item)}
                      className="px-3 py-1.5 bg-[#000000] text-white text-sm font-medium rounded hover:bg-gray-800 transition-colors flex-shrink-0"
                    >
                      Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showResults && query.trim() && results.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
          No equipment found
        </div>
      )}
    </div>
  );
}
