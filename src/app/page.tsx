'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';

const services = [
  {
    title: 'Public Events',
    description: 'Ceremony and reception audio systems.',
    images: [
      { src: '/images/image1-public-parilament.png', location: 'Parliament, Wellington' },
      { src: '/images/image1-public-waitangipark.png', location: 'Waitangi Park, Wellington' },
      { src: '/images/image3-public-waitangipark.webp', location: 'Waitangi Park, Wellington' },
    ],
    href: '/services#public',
  },
  {
    title: 'Corporate Events',
    description: 'Conferences, presentations, and company events.',
    images: [
      { src: '/images/image1-corporate.png', location: 'Wellington CBD, New Zealand' },
      { src: '/images/image2-corporate.jpg', location: 'Wellington CBD, New Zealand' },
    ],
    href: '/services#corporate',
  },
  {
    title: 'Festivals',
    description: 'Large-scale outdoor sound systems.',
    images: [
      { src: '/images/image1-festival-bontanic-gardens.jpg', location: 'Botanic Gardens, Wellington' },
      { src: '/images/image2-festival-bontanic-gardens.jpg', location: 'Botanic Gardens, Wellington' },
      { src: '/images/image1-festival-cuba-st.png', location: 'Cuba Street, Wellington' },
      { src: '/images/image3-festival-waterfront.jpg', location: 'Waterfront, Wellington' },
      { src: '/images/image3-festival-newtown-festival.jpg', location: 'Newtown Festival, Wellington' },
    ],
    href: '/services#festivals',
  },
  {
    title: 'Private Events',
    description: 'Sound equipment for any celebration.',
    images: [
      { src: '/images/image1-private.png', location: 'Wellington CBD, New Zealand' },
      { src: '/images/image2-private.png', location: 'Wellington CBD, New Zealand' },
      { src: '/images/image3-private.png', location: 'Wellington CBD, New Zealand' },
    ],
    href: '/services#parties',
  },
];

function ServiceCard({ service }: { service: typeof services[0] }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (service.images.length <= 1) return;

    // Random initial delay (0-6 seconds) so carousels don't sync
    const initialDelay = Math.random() * 4000;

    const startInterval = () => {
      return setInterval(() => {
        setCurrentImageIndex((prev) => {
          const nextIndex = prev + 1;
          return nextIndex >= service.images.length ? 0 : nextIndex;
        });
      }, 6000);
    };

    const timeout = setTimeout(() => {
      intervalRef = startInterval();
    }, initialDelay);

    let intervalRef: NodeJS.Timeout;

    return () => {
      clearTimeout(timeout);
      if (intervalRef) clearInterval(intervalRef);
    };
  }, [service.images.length]);

  const allImages = service.images;

  return (
    <Link href={service.href} className="group block">
      <div className="aspect-[2/1] relative rounded-md overflow-hidden mb-4">
        {/* Image carousel container */}
        <div
          className="flex h-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
        >
          {allImages.map((img, index) => (
            <div key={index} className="min-w-full h-full relative">
              <Image
                src={img.src}
                alt={service.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded">
                <p className="text-white text-xs font-medium">{img.location}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Carousel Dots */}
        {service.images.length > 1 && (
          <div className="absolute bottom-3 left-3 flex gap-1.5">
            {service.images.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentImageIndex ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        )}
      </div>
      <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#000000] transition-colors">
        {service.title}
      </h3>
      <p className="text-gray-600 text-sm mt-2 font-medium">{service.description}</p>
    </Link>
  );
}

export default function Home() {
  const handleScrollToServices = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
      const headerOffset = 80; // Height of sticky header (h-20)
      const elementPosition = servicesSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[calc(100dvh-5rem)] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/image3-festival-newtown-festival.jpg"
            alt="Professional sound equipment"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute bottom-4 right-4 px-4 py-2 rounded">
            <p className="text-white text-sm font-medium">Newtown Festival, Wellington</p>
          </div>
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Professional Sound Equipment Rental
            </h1>
            <p className="text-xl text-gray-200 mb-8 font-medium">
              Wellington-based audio solutions for Corporate events, public events, festivals, and private parties.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/inquiry"
                className="bg-[#FFFFFF] text-black px-8 py-3 rounded-md font-bold hover:bg-[#152d47] transition-colors border border-[#000000]"
              >
                Get a Quote
              </Link>
              <a
                href="#services"
                onClick={handleScrollToServices}
                className="bg-white/10 backdrop-blur-sm text-white px-8 py-3 rounded-md font-bold hover:bg-white/20 transition-colors border border-white/40 cursor-pointer"
              >
                View Services
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative min-h-screen py-16 md:py-24 bg-white flex flex-col justify-center scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">Our Services</h2>

          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service) => (
              <ServiceCard key={service.title} service={service} />
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                10+ Years of Experience
              </h2>
              <p className="text-gray-700 mb-4 font-medium text-lg">
                Since 2014, we&apos;ve provided professional audio equipment and technical support for over 500 events across the Wellington region.
              </p>
              <p className="text-gray-700 mb-8 font-medium text-lg">
                We handle setup, operation, and breakdown - you focus on your event.
              </p>
              <Link
                href="/about"
                className="text-[#000000] font-bold hover:text-[#152d47] text-base underline underline-offset-4"
              >
                Learn more about us →
              </Link>
            </div>
            <div className="aspect-[4/3] relative rounded-md overflow-hidden">
              <Image
                src="/images/image1-public-waitangipark.png"
                alt="Sound equipment setup"
                fill
                className="object-cover"
              />
              <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded">
                <p className="text-white text-xs font-medium">Waitangi Park, Wellington</p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
