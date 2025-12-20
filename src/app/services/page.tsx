import Image from 'next/image';
import Link from 'next/link';

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
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white mb-4">Services</h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Sound equipment rental for events of all sizes.
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-20">
            {services.map((service, index) => (
              <div
                key={service.id}
                id={service.id}
                className="grid lg:grid-cols-2 gap-12 items-center"
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    {service.title}
                  </h2>
                  <p className="text-gray-600 mb-6">{service.description}</p>
                  <ul className="space-y-3 mb-8">
                    {service.includes.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <svg
                          className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"
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
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/inquiry"
                    className="inline-block bg-amber-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
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
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Not sure what you need?
          </h2>
          <p className="text-gray-600 mb-6">
            Tell us about your event and we&apos;ll recommend the right setup.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </section>
    </main>
  );
}
