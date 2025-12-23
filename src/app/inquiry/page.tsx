'use client';

import Link from 'next/link';
import Image from 'next/image';

const serviceTypes = [
  {
    title: 'Soundgear / Full Event Hire',
    description: 'Complete sound equipment and setup for your event. Includes delivery, setup, operation, and breakdown.',
    href: '/inquiry/soundgear',
    image: '/images/event-fullhire.png',
  },
  {
    title: 'Backline Hire',
    description: 'Equipment-only rental. Choose the gear you need and pick up or have it delivered.',
    href: '/inquiry/backline',
    image: '/images/soundgear-rental.png',
  },
  {
    title: 'Contractor',
    description: 'Hire a sound engineer, audio technician, or DJ for your event.',
    href: '/inquiry/contractor',
    image: '/images/soundtech-hire.png',
  },
];

export default function InquiryPage() {
  return (
    <main className="bg-stone-50 min-h-screen pt-5 lg:pt-5 pb-8 lg:pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-md border border-stone-200 p-6 lg:p-8 min-h-[400px] lg:min-h-[775px] flex flex-col">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Get a Quote</h1>
          <p className="text-gray-600 mb-6 font-medium">Select the type of service you need</p>

          <div className="flex-1 flex flex-col gap-4">
            {serviceTypes.map((service) => (
              <Link
                key={service.title}
                href={service.href}
                className="flex-1 flex border-2 border-gray-200 rounded-md overflow-hidden transition-all hover:border-gray-400 hover:shadow-sm"
              >
                <div className="w-32 sm:w-48 lg:w-56 relative flex-shrink-0">
                  <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="p-4 lg:p-6 flex flex-col justify-center">
                  <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-1 lg:mb-2">{service.title}</h2>
                  <p className="text-sm lg:text-base text-gray-600 font-medium">{service.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
