'use client';

import Link from 'next/link';
import Image from 'next/image';
import PageCard from '@/components/ui/PageCard';

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
    <PageCard formMode>
      <div className="flex flex-col h-full min-h-[350px] lg:min-h-[720px]">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Get a Quote</h1>
        <p className="text-gray-600 mb-6 font-medium">Select the type of service you need</p>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {serviceTypes.map((service) => (
            <Link
              key={service.title}
              href={service.href}
              className="flex-1 flex border-2 border-gray-200 rounded-md overflow-hidden transition-all hover:border-gray-400 hover:shadow-sm min-h-0"
            >
              <div className="w-1/3 sm:w-2/5 relative flex-shrink-0">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 p-4 lg:p-6 flex flex-col justify-center">
                <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-1 lg:mb-2">{service.title}</h2>
                <p className="text-sm lg:text-base text-gray-600 font-medium">{service.description}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex gap-4 pt-5">
          <Link href="/" className="px-5 py-2.5 text-gray-700 font-bold hover:text-gray-900 transition-colors">Back</Link>
        </div>
      </div>
    </PageCard>
  );
}
