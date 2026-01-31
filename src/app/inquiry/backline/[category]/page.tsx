'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EquipmentCard } from '@/components/backline/EquipmentCard';
import PageCard from '@/components/ui/PageCard';
import { slugToCategory, mergedCategories } from '@/lib/backline-config';

interface HireItem {
  id: string;
  category: string;
  name: string;
  notes: string | null;
  hire_rate_per_day: number | null;
  stock_quantity: number;
  image_url: string | null;
}

export default function CategoryPage() {
  const params = useParams();
  const slug = params.category as string;
  const categoryName = slugToCategory[slug] || slug;

  const [items, setItems] = useState<HireItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<HireItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchItems() {
      try {
        // Check if this category should fetch multiple database categories
        const categoriesToFetch = mergedCategories[categoryName] || [categoryName];

        // Fetch all categories in parallel
        const responses = await Promise.all(
          categoriesToFetch.map(cat =>
            fetch(`/api/hire-items?category=${encodeURIComponent(cat)}`)
          )
        );

        const allItems: HireItem[] = [];
        for (const response of responses) {
          const data = await response.json();
          if (data.success && data.allItems) {
            allItems.push(...data.allItems);
          }
        }

        if (allItems.length > 0 || categoriesToFetch.length > 0) {
          // Sort by name
          allItems.sort((a, b) => a.name.localeCompare(b.name));
          setItems(allItems);
          setFilteredItems(allItems);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching items:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, [categoryName]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(items);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.notes && item.notes.toLowerCase().includes(query))
    );
    setFilteredItems(filtered);
  }, [searchQuery, items]);

  return (
    <PageCard stretch>
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">{categoryName}</h1>
          <Link href="/inquiry/backline" className="text-gray-700 font-bold text-sm">
            Back
          </Link>
        </div>
        <p className="text-gray-600 mb-4 font-medium">
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} {searchQuery && 'found'}
        </p>

        <div className="mb-6 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${categoryName.toLowerCase()}...`}
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
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Failed to load equipment. Please try again.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? 'No equipment matches your search.' : 'No equipment found in this category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 flex-grow overflow-y-auto">
            {filteredItems.map((item) => (
              <EquipmentCard
                key={item.id}
                id={item.id}
                name={item.name}
                category={item.category}
                notes={item.notes}
                hireRate={item.hire_rate_per_day}
                stockQuantity={item.stock_quantity}
                imageUrl={item.image_url}
              />
            ))}
          </div>
        )}
      </div>
    </PageCard>
  );
}
