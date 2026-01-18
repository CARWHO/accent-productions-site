'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import PageCard from '@/components/ui/PageCard';

interface CategoryInfo {
  name: string;
  slug: string;
  count: number;
  image: string;
}

const categoryConfig: Record<string, { slug: string; image: string }> = {
  'Drum Kits': { slug: 'drum-kits', image: '/images/drumkits.png' },
  'Cymbals': { slug: 'cymbals', image: '/images/cymbals.png' },
  'Percussion': { slug: 'percussion', image: '/images/percussion.png' },
  'Guitar Amps': { slug: 'guitar-amps', image: '/images/guitar-amps.png' },
  'Bass Heads': { slug: 'bass-heads', image: '/images/base-heads.png' },
  'Bass Cabinets': { slug: 'bass-cabinets', image: '/images/bass-cabinets.png' },
  'Keyboards': { slug: 'keyboards', image: '/images/keyboard.png' },
  'Guitars': { slug: 'guitars', image: '/images/guitars.png' },
};

// Categories to hide from the listing
const hiddenCategories = new Set(['Accessories']);

// Categories to merge into "Guitars"
const mergedCategories: Record<string, string[]> = {
  'Guitars': ['Guitars', 'Bass Guitars'],
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
          const itemsByCategory = data.items as Record<string, unknown[]>;

          // Track which categories have been merged
          const mergedInto = new Set<string>();
          Object.values(mergedCategories).forEach(sources => {
            sources.forEach(source => mergedInto.add(source));
          });

          const cats: CategoryInfo[] = [];

          // First, add merged categories
          Object.entries(mergedCategories).forEach(([targetName, sourceNames]) => {
            const totalCount = sourceNames.reduce((sum, sourceName) => {
              return sum + (itemsByCategory[sourceName]?.length || 0);
            }, 0);

            if (totalCount > 0) {
              cats.push({
                name: targetName,
                slug: categoryConfig[targetName]?.slug || targetName.toLowerCase().replace(/\s+/g, '-'),
                count: totalCount,
                image: categoryConfig[targetName]?.image || 'https://placehold.co/400x300/1a1a1a/ffffff?text=Equipment',
              });
            }
          });

          // Then add non-merged categories (excluding hidden ones)
          Object.entries(itemsByCategory).forEach(([name, items]) => {
            if (!mergedInto.has(name) && !hiddenCategories.has(name)) {
              cats.push({
                name,
                slug: categoryConfig[name]?.slug || name.toLowerCase().replace(/\s+/g, '-'),
                count: (items as unknown[]).length,
                image: categoryConfig[name]?.image || 'https://placehold.co/400x300/1a1a1a/ffffff?text=Equipment',
              });
            }
          });

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
    <PageCard stretch>
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Backline Hire</h1>
          <Link href="/inquiry" className="text-gray-700 font-bold text-sm">
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
            <div className="animate-spin h-8 w-8 border-4 border-black border-t-transparent rounded-full"></div>
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
                className="border border-gray-200 rounded-md overflow-hidden"
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
    </PageCard>
  );
}
