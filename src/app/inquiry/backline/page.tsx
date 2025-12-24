'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface CategoryInfo {
  name: string;
  slug: string;
  count: number;
  image: string;
}

const categoryConfig: Record<string, { slug: string; image: string }> = {
  'Drum Kits': { slug: 'drum-kits', image: '/images/categories/drum-kits.jpg' },
  'Cymbals': { slug: 'cymbals', image: '/images/categories/cymbals.jpg' },
  'Percussion': { slug: 'percussion', image: '/images/categories/percussion.jpg' },
  'Guitar Amps': { slug: 'guitar-amps', image: '/images/categories/guitar-amps.jpg' },
  'Bass Heads': { slug: 'bass-heads', image: '/images/categories/bass-heads.jpg' },
  'Bass Cabinets': { slug: 'bass-cabinets', image: '/images/categories/bass-cabinets.jpg' },
  'Keyboards': { slug: 'keyboards', image: '/images/categories/keyboards.jpg' },
  'Guitars': { slug: 'guitars', image: '/images/categories/guitars.jpg' },
  'Bass Guitars': { slug: 'bass-guitars', image: '/images/categories/bass-guitars.jpg' },
  'Accessories': { slug: 'accessories', image: '/images/categories/accessories.jpg' },
};

const categoryOrder = [
  'Drum Kits',
  'Cymbals',
  'Percussion',
  'Guitar Amps',
  'Bass Heads',
  'Bass Cabinets',
  'Keyboards',
  'Guitars',
  'Bass Guitars',
  'Accessories',
];

export default function BacklinePage() {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/hire-items');
        const data = await response.json();
        if (data.success) {
          const cats: CategoryInfo[] = Object.entries(data.items).map(([name, items]) => ({
            name,
            slug: categoryConfig[name]?.slug || name.toLowerCase().replace(/\s+/g, '-'),
            count: (items as unknown[]).length,
            image: categoryConfig[name]?.image || 'https://placehold.co/400x300/1a1a1a/ffffff?text=Equipment',
          }));

          // Sort by predefined order
          cats.sort((a, b) => {
            const indexA = categoryOrder.indexOf(a.name);
            const indexB = categoryOrder.indexOf(b.name);
            if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });

          setCategories(cats);
          setFilteredCategories(cats);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = categories.filter(
      (cat) => cat.name.toLowerCase().includes(query)
    );
    setFilteredCategories(filtered);
  }, [searchQuery, categories]);

  return (
    <main className="bg-stone-50 min-h-screen pt-5 lg:pt-5 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-md border border-stone-200 p-6 lg:p-8 min-h-[400px] lg:min-h-[775px]">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Backline Hire</h1>
              <Link href="/inquiry" className="text-gray-700 font-bold hover:text-gray-900 transition-colors text-sm">
                Back
              </Link>
            </div>
            <p className="text-gray-600 mb-4 font-medium">Browse our equipment and add items to your quote.</p>

            <div className="mb-6 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search categories..."
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
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No categories match your search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 flex-grow">
                {filteredCategories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/inquiry/backline/${category.slug}`}
                    className="border border-gray-200 rounded-md overflow-hidden hover:border-gray-400 hover:shadow-sm transition-all"
                  >
                    <div className="aspect-[4/3] relative w-full bg-gray-100">
                      <Image
                        src={category.image}
                        alt={category.name}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://placehold.co/400x300/1a1a1a/ffffff?text=Equipment';
                        }}
                      />
                    </div>
                    <div className="p-3">
                      <h2 className="font-semibold text-gray-900 text-sm lg:text-base">{category.name}</h2>
                      <p className="text-xs lg:text-sm text-gray-500">{category.count} {category.count === 1 ? 'item' : 'items'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
