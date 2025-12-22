import Link from 'next/link';
import Image from 'next/image';

const services = [
  {
    title: 'Weddings',
    description: 'Ceremony and reception audio systems.',
    image: '/images/image9.webp',
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
      <section className="relative h-dvh min-h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/image7.jpg"
            alt="Professional sound equipment"
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>

        <div className="container relative z-10 mx-auto px-4">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Professional Sound Equipment Rental
            </h1>
            <p className="text-xl text-gray-200 mb-8">
              Wellington-based audio solutions for weddings, corporate events, festivals, and private parties.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/inquiry"
                className="bg-[#F47B20] text-white px-8 py-3 rounded-lg font-semibold hover:bg-[#D96B10] transition-colors"
              >
                Get a Quote
              </Link>
              <a
                href="#services"
                className="bg-white/20 backdrop-blur-sm text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/30 transition-colors border border-white/30"
              >
                View Services
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative min-h-screen py-16 md:py-24 bg-white flex flex-col justify-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Our Services</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {services.map((service) => (
              <Link
                key={service.title}
                href={service.href}
                className="group block"
              >
                <div className="aspect-[2/1] relative rounded-lg overflow-hidden mb-3">
                  <Image
                    src={service.image}
                    alt={service.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#F47B20] transition-colors">
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
                Since 2014, we&apos;ve provided professional audio equipment and technical support for over 500 events across the Wellington region.
              </p>
              <p className="text-gray-600 mb-6">
                We handle setup, operation, and breakdown - you focus on your event.
              </p>
              <Link
                href="/about"
                className="text-[#F47B20] font-medium hover:text-[#D96B10]"
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

    </main>
  );
}
