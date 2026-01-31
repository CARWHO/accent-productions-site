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
      'Handheld and lapel wireless mics',
      'Weatherproof outdoor PA systems',
      'Aux input for your own playlists',
      'Technician on-site for the duration',
    ],
  },
  {
    id: 'corporate',
    title: 'Corporate Events',
    description: 'Professional audio for conferences, presentations, and company events. Clear speech reinforcement for any venue size.',
    image: '/images/image1-public-parilament.png',
    location: 'Parliament, Wellington',
    includes: [
      'Gooseneck, handheld, and lapel options',
      'Distributed speaker coverage for large rooms',
      'Feed to livestream or recording',
      'Quiet, unobtrusive setup',
    ],
  },
  {
    id: 'festivals',
    title: 'Festivals',
    description: 'Large-scale sound systems for outdoor events. Line arrays, stage monitors, and full front-of-house setups.',
    image: '/images/image1-festival-slavfest.jpeg',
    location: 'Slavfest, Wellington',
    includes: [
      'Flown or ground-stacked line arrays',
      'Wedge and in-ear monitor options',
      'Full backline and DI setup',
      'Experienced crew for load-in and show',
    ],
  },
  {
    id: 'parties',
    title: 'Private Events',
    description: 'Sound equipment for birthdays, anniversaries, and celebrations. We deliver, set up, and pick up.',
    image: '/images/image2-private-newtown.jpeg',
    location: 'Newtown, Wellington',
    includes: [
      'Compact PA with sub for up to 150 guests',
      'CDJs, mixer, or aux playback',
      'Wireless mic for toasts',
      'Same-day delivery and collection',
    ],
  },
];

export default function ServicesPage() {
  useEffect(() => {
    // Handle scroll to hash on mount
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash) {
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
      }
    }
  }, []);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="pt-24 pb-12 md:pb-12 bg-white border-b border-gray-200">
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
                className="min-h-[calc(100vh-12rem)] md:min-h-[calc(100vh-14rem)] py-8 md:py-12 flex items-start"
              >
                <div className="w-full grid lg:grid-cols-2 gap-6 md:gap-8 lg:gap-16 items-center">
                  <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                      {service.title}
                    </h2>
                    <p className="text-gray-700 mb-6 md:mb-8 text-base md:text-lg font-medium">{service.description}</p>
                    <ul className="mb-8 md:mb-10 text-gray-600 text-base md:text-lg">
                      {service.includes.map((item, i) => (
                        <li key={item} className="inline">
                          {item}{i < service.includes.length - 1 && <span className="mx-2">·</span>}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/inquiry?type=${service.id === 'parties' ? 'private_party' : service.id === 'weddings' ? 'wedding' : service.id}`}
                      className="inline-block bg-[#000000] text-white px-6 py-3 md:px-8 md:py-3.5 rounded-md font-bold transition-colors text-base md:text-base border border-[#000000]"
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
