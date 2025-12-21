'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

const services = [
  {
    id: 'weddings',
    title: 'Weddings',
    description: 'Audio systems for ceremonies and receptions. Wireless microphones for vows, speaker systems for music, and everything in between.',
    image: '/images/image1.jpg',
    includes: [
      'Wireless microphones for ceremony',
      'Speaker systems for reception',
      'Music playback equipment',
      'On-site technician',
    ],
  },
  {
    id: 'corporate',
    title: 'Corporate Events',
    description: 'Professional audio for conferences, presentations, and company events. Clear speech reinforcement for any venue size.',
    image: '/images/image2.jpg',
    includes: [
      'Lectern and lapel microphones',
      'PA systems',
      'Video conferencing audio',
      'Background music',
    ],
  },
  {
    id: 'festivals',
    title: 'Festivals',
    description: 'Large-scale sound systems for outdoor events. Line arrays, stage monitors, and full front-of-house setups.',
    image: '/images/image3.jpg',
    includes: [
      'Line array speaker systems',
      'Stage monitors',
      'Front of house mixing',
      'Multi-stage capability',
    ],
  },
  {
    id: 'parties',
    title: 'Private Parties',
    description: 'Sound equipment for birthdays, anniversaries, and celebrations. We deliver, set up, and pick up.',
    image: '/images/image6.jpg',
    includes: [
      'Speaker and subwoofer packages',
      'DJ equipment',
      'Microphones for speeches',
      'Delivery and setup included',
    ],
  },
];

export default function ServicesPage() {
  useEffect(() => {
    // Handle scroll to hash on mount
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        // Small delay to ensure page is rendered
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            const headerOffset = 80; // Account for sticky header
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
              top: offsetPosition,
              behavior: 'smooth',
            });
          }
        }, 100);
      }
    }
  }, []);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="pt-24 pb-8 md:pb-12 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">Services</h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            Sound equipment rental for events of all sizes.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8 md:space-y-12 lg:space-y-16">
            {services.map((service, index) => (
              <div
                key={service.id}
                id={service.id}
                className="min-h-[calc(100vh-12rem)] md:min-h-[calc(100vh-14rem)] py-8 md:py-12 flex items-center"
              >
                <div className="w-full grid lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 items-center">
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">
                      {service.title}
                    </h2>
                    <p className="text-gray-600 mb-4 md:mb-6 text-sm md:text-base">{service.description}</p>
                    <ul className="space-y-2 md:space-y-3 mb-6 md:mb-8">
                      {service.includes.map((item) => (
                        <li key={item} className="flex items-start gap-2 md:gap-3">
                          <svg
                            className="w-4 h-4 md:w-5 md:h-5 text-[#F47B20] mt-0.5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span className="text-gray-700 text-sm md:text-base">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/inquiry?type=${service.id === 'parties' ? 'private_party' : service.id === 'weddings' ? 'wedding' : service.id}`}
                      className="inline-block bg-[#F47B20] text-white px-5 py-2.5 md:px-6 md:py-3 rounded-lg font-semibold hover:bg-[#D96B10] transition-colors text-sm md:text-base"
                    >
                      Get a Quote
                    </Link>
                  </div>
                  <div className={`aspect-[4/3] relative rounded-lg overflow-hidden ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <Image
                      src={service.image}
                      alt={service.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
