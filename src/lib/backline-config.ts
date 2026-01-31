// Shared configuration for backline equipment categories

export const categoryConfig: Record<string, { slug: string; image: string }> = {
  'Drum Kits': { slug: 'drum-kits', image: '/images/drumkits.png' },
  'Cymbals': { slug: 'cymbals', image: '/images/cymbals.png' },
  'Percussion': { slug: 'percussion', image: '/images/percussion.png' },
  'Guitar Amps': { slug: 'guitar-amps', image: '/images/guitar-amps.png' },
  'Bass Heads': { slug: 'bass-heads', image: '/images/base-heads.png' },
  'Bass Cabinets': { slug: 'bass-cabinets', image: '/images/bass-cabinets.png' },
  'Keyboards': { slug: 'keyboards', image: '/images/keyboard.png' },
  'Guitars': { slug: 'guitars', image: '/images/guitars.png' },
};

export const slugToCategory: Record<string, string> = {
  'drum-kits': 'Drum Kits',
  'cymbals': 'Cymbals',
  'percussion': 'Percussion',
  'guitar-amps': 'Guitar Amps',
  'bass-heads': 'Bass Heads',
  'bass-cabinets': 'Bass Cabinets',
  'keyboards': 'Keyboards',
  'guitars': 'Guitars',
  'bass-guitars': 'Bass Guitars',
  'accessories': 'Accessories',
};

// Categories to hide from the listing
export const hiddenCategories = new Set(['Accessories']);

// Categories to merge (e.g., show "Guitars" but fetch both Guitars and Bass Guitars)
export const mergedCategories: Record<string, string[]> = {
  'Guitars': ['Guitars', 'Bass Guitars'],
};

export const categoryOrder = [
  'Drum Kits',
  'Cymbals',
  'Percussion',
  'Guitar Amps',
  'Bass Heads',
  'Bass Cabinets',
  'Keyboards',
  'Guitars',
];
