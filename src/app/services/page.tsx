import Image from 'next/image';
import Link from 'next/link';

const services = [
  {
    id: 'weddings',
    title: 'Wedding Sound Services',
    subtitle: 'Make Your Special Day Sound Perfect',
    description: 'Your wedding day deserves nothing but the best. We provide crystal-clear audio for ceremonies, receptions, and everything in between. From heartfelt vows to the first dance, every moment will be heard perfectly.',
    image: '/images/image1.jpg',
    features: [
      'Wireless microphones for ceremonies',
      'Premium speaker systems for receptions',
      'Background music management',
      'Professional DJ equipment available',
      'Backup equipment on standby',
      'Dedicated sound technician',
    ],
  },
  {
    id: 'corporate',
    title: 'Corporate Events',
    subtitle: 'Professional Audio for Business',
    description: 'Impress clients and engage employees with professional-grade sound systems. Whether it\'s a small boardroom presentation or a large conference, we ensure your message is delivered clearly.',
    image: '/images/image2.jpg',
    features: [
      'Conference room audio systems',
      'Wireless presentation microphones',
      'Multi-room audio distribution',
      'Video conferencing integration',
      'Podium and lectern setups',
      'Breakout room solutions',
    ],
  },
  {
    id: 'festivals',
    title: 'Festival & Outdoor Events',
    subtitle: 'Big Sound for Big Crowds',
    description: 'From community gatherings to large-scale festivals, we have the equipment and expertise to deliver powerful, clear sound to audiences of any size in outdoor environments.',
    image: '/images/image3.jpg',
    features: [
      'High-powered line array systems',
      'Stage monitoring solutions',
      'Weatherproof equipment',
      'Generator-compatible setups',
      'Multiple stage configurations',
      'Crowd management audio',
    ],
  },
  {
    id: 'parties',
    title: 'Private Parties',
    subtitle: 'Turn Up the Celebration',
    description: 'Birthday parties, anniversaries, graduations, or any celebration - we bring the sound that gets people on their feet. Quality audio makes every party memorable.',
    image: '/images/image6.jpg',
    features: [
      'Portable PA systems',
      'Subwoofers for bass impact',
      'Wireless microphones for speeches',
      'LED lighting packages available',
      'Easy setup and breakdown',
      'Flexible rental periods',
    ],
  },
];

const equipment = [
  { name: 'JBL Professional', category: 'Speakers' },
  { name: 'Shure', category: 'Microphones' },
  { name: 'QSC', category: 'Amplifiers' },
  { name: 'Allen & Heath', category: 'Mixers' },
  { name: 'Sennheiser', category: 'Wireless Systems' },
  { name: 'Crown', category: 'Power Amps' },
];

export default function ServicesPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-24 bg-gray-900">
        <div className="absolute inset-0 z-0 opacity-30">
          <Image
            src="/images/image4.jpg"
            alt="Sound equipment"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium mb-6">
            Our Services
          </span>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Professional Sound for
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500"> Every Occasion</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            From intimate gatherings to large-scale events, we provide tailored audio solutions that bring your vision to life.
          </p>
        </div>
      </section>

      {/* Services List */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-32">
            {services.map((service, index) => (
              <div
                key={service.id}
                id={service.id}
                className={`grid lg:grid-cols-2 gap-16 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
                    {service.subtitle}
                  </span>
                  <h2 className="text-4xl font-bold text-gray-900 mb-6">
                    {service.title}
                  </h2>
                  <p className="text-lg text-gray-600 mb-8">
                    {service.description}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4 mb-8">
                    {service.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/inquiry"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-full font-semibold hover:from-amber-600 hover:to-orange-600 transition-all"
                  >
                    Get a Quote
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>

                <div className={`relative ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className="aspect-[4/3] relative rounded-2xl overflow-hidden shadow-2xl">
                    <Image
                      src={service.image}
                      alt={service.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl -z-10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Equipment Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
              Our Equipment
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Industry-Leading Brands
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              We only use professional-grade equipment from trusted manufacturers to ensure the best sound quality for your event.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {equipment.map((item) => (
              <div
                key={item.name}
                className="bg-white rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-500">{item.category}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium mb-4">
              How It Works
            </span>
            <h2 className="text-4xl font-bold text-white mb-4">
              Simple Process, Outstanding Results
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              We make it easy to get professional sound for your event.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Tell Us About Your Event',
                description: 'Fill out our inquiry form with details about your event, venue, and requirements.',
              },
              {
                step: '02',
                title: 'Get a Custom Quote',
                description: 'We\'ll prepare a tailored proposal based on your specific needs and budget.',
              },
              {
                step: '03',
                title: 'Confirm & Schedule',
                description: 'Once approved, we\'ll schedule delivery, setup, and breakdown times.',
              },
              {
                step: '04',
                title: 'Enjoy Your Event',
                description: 'Our team handles everything so you can focus on enjoying your event.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-amber-500 to-orange-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Contact us today for a free consultation and let us help you create an unforgettable audio experience.
          </p>
          <Link
            href="/inquiry"
            className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-100 transition-all shadow-lg"
          >
            Request a Quote
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </section>
    </main>
  );
}
