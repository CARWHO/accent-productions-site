import Link from 'next/link';
import Image from 'next/image';

const services = [
  {
    title: 'Weddings',
    description: 'Ceremony and reception audio systems.',
    image: '/images/image1.jpg',
    href: '/services#weddings',
  },
  {
    title: 'Corporate Events',
    description: 'Conferences, presentations, and company events.',
    image: '/images/image2.jpg',
    href: '/services#corporate',
  },
  {
    title: 'Festivals',
    description: 'Large-scale outdoor sound systems.',
    image: '/images/image3.jpg',
    href: '/services#festivals',
  },
  {
    title: 'Private Parties',
    description: 'Sound equipment for any celebration.',
    image: '/images/image6.jpg',
    href: '/services#parties',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[80vh] min-h-[500px] flex items-center">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/image7.jpg"
            alt="Professional sound equipment"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Professional Sound Equipment Rental
            </h1>
            <p className="text-xl text-gray-200 mb-8">
              Auckland-based audio solutions for weddings, corporate events, festivals, and private parties.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/inquiry"
                className="bg-amber-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
              >
                Get a Quote
              </Link>
              <Link
                href="/services"
                className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                View Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-12">Our Services</h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
              <Link
                key={service.title}
                href={service.href}
                className="group block"
              >
                <div className="aspect-[4/3] relative rounded-lg overflow-hidden mb-4">
                  <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-amber-600 transition-colors">
                  {service.title}
                </h3>
                <p className="text-gray-600 text-sm mt-1">{service.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                10+ Years of Experience
              </h2>
              <p className="text-gray-600 mb-4">
                Since 2014, we&apos;ve provided professional audio equipment and technical support for over 500 events across Auckland.
              </p>
              <p className="text-gray-600 mb-6">
                We handle setup, operation, and breakdown - you focus on your event.
              </p>
              <Link
                href="/about"
                className="text-amber-600 font-medium hover:text-amber-700"
              >
                Learn more about us →
              </Link>
            </div>
            <div className="aspect-[4/3] relative rounded-lg overflow-hidden">
              <Image
                src="/images/image8.webp"
                alt="Sound equipment setup"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to get started?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Tell us about your event and we&apos;ll put together a custom quote.
          </p>
          <Link
            href="/inquiry"
            className="inline-block bg-amber-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
          >
            Request a Quote
          </Link>
        </div>
      </section>
    </main>
  );
}
