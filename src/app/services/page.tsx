'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';

const services = [
  {
    id: 'public',
    title: 'Public Events',
    description: 'Audio systems for ceremonies and receptions. Wireless microphones for vows, speaker systems for music, and everything in between.',
    image: '/images/image1-public-waitangipark.png',
    location: 'Wellington CBD, New Zealand',
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
    image: '/images/image1-public-parilament.png',
    location: 'Parliament, Wellington',
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
    image: '/images/image2-festival-bontanic-gardens.jpg',
    location: 'Botanic Gardens, Wellington',
    includes: [
      'Line array speaker systems',
      'Stage monitors',
      'Front of house mixing',
      'Multi-stage capability',
    ],
  },
  {
    id: 'parties',
    title: 'Private Events',
    description: 'Sound equipment for birthdays, anniversaries, and celebrations. We deliver, set up, and pick up.',
    image: '/images/image2-corporate.jpg',
    location: 'CBD, Wellington',
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
          <p className="text-xl text-gray-700 max-w-2xl font-medium">
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
                <div className="w-full grid lg:grid-cols-2 gap-6 md:gap-8 lg:gap-16 items-center">
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                      {service.title}
                    </h2>
                    <p className="text-gray-700 mb-6 md:mb-8 text-base md:text-lg font-medium">{service.description}</p>
                    <ul className="space-y-3 md:space-y-4 mb-8 md:mb-10">
                      {service.includes.map((item) => (
                        <li key={item} className="flex items-start gap-3 md:gap-4">
                          <svg
                            className="w-5 h-5 md:w-6 md:h-6 text-[#000000] mt-0.5 flex-shrink-0"
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
                          <span className="text-gray-700 text-base md:text-lg font-medium">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/inquiry?type=${service.id === 'parties' ? 'private_party' : service.id === 'weddings' ? 'wedding' : service.id}`}
                      className="inline-block bg-[#000000] text-white px-6 py-3 md:px-8 md:py-3.5 rounded-md font-bold hover:bg-[#152d47] transition-colors text-base md:text-base border border-[#000000]"
                    >
                      Get a Quote
                    </Link>
                  </div>
                  <div className={`aspect-[4/3] relative rounded-md overflow-hidden ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                    <Image
                      src={service.image}
                      alt={service.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded">
                      <p className="text-white text-xs font-medium">{service.location}</p>
                    </div>
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
