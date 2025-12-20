import Image from 'next/image';
import Link from 'next/link';

const values = [
  {
    title: 'Quality First',
    description: 'We never compromise on sound quality. Every piece of equipment we use is professional-grade and meticulously maintained.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    title: 'Reliability',
    description: 'When you book with us, you can count on us. We show up on time, every time, with backup equipment ready.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Customer Focus',
    description: 'Your event is unique, and we treat it that way. We listen to your needs and customize our solutions accordingly.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: 'Innovation',
    description: 'We stay current with the latest audio technology to provide you with the best possible sound experience.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

const milestones = [
  { year: '2014', title: 'Founded', description: 'Started with a passion for great sound' },
  { year: '2016', title: '100 Events', description: 'Reached our first major milestone' },
  { year: '2019', title: 'Expanded Fleet', description: 'Invested in premium equipment' },
  { year: '2022', title: '500+ Events', description: 'Celebrated half a thousand events' },
  { year: '2024', title: 'Growing Strong', description: 'Continuing to serve our community' },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-24 bg-gray-900">
        <div className="absolute inset-0 z-0 opacity-30">
          <Image
            src="/images/image5.jpg"
            alt="About Accent Productions"
            fill
            className="object-cover"
          />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium mb-6">
            About Us
          </span>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Passionate About
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500"> Perfect Sound</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            For over a decade, we&apos;ve been helping create memorable events with exceptional audio experiences.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
                Our Story
              </span>
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                From a Passion Project to a Trusted Partner
              </h2>
              <div className="space-y-4 text-lg text-gray-600">
                <p>
                  Accent Productions was born from a simple belief: every event deserves to sound amazing. What started as helping friends and family with their celebrations has grown into a full-service audio rental company serving the entire region.
                </p>
                <p>
                  Our founder&apos;s background in live sound engineering and genuine love for music laid the foundation for what we are today. We understand that sound isn&apos;t just about volume—it&apos;s about clarity, emotion, and creating the perfect atmosphere.
                </p>
                <p>
                  Today, we&apos;re proud to have been part of over 500 events, from intimate backyard weddings to large corporate conferences. Each event has taught us something new and pushed us to be better.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] relative rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/image8.webp"
                  alt="Our team at work"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-8 -left-8 bg-gradient-to-r from-amber-500 to-orange-500 text-white p-6 rounded-2xl shadow-xl">
                <div className="text-4xl font-bold">10+</div>
                <div className="text-white/90">Years of Excellence</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
              Our Values
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              What We Stand For
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              These core values guide everything we do and every decision we make.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value) => (
              <div key={value.title} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow">
                <div className="w-16 h-16 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white mb-6">
                  {value.icon}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{value.title}</h3>
                <p className="text-gray-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-24 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium mb-4">
              Our Journey
            </span>
            <h2 className="text-4xl font-bold text-white mb-4">
              Milestones Along the Way
            </h2>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-orange-500 -translate-y-1/2" />

            <div className="grid md:grid-cols-5 gap-8">
              {milestones.map((milestone, index) => (
                <div key={milestone.year} className="relative text-center">
                  <div className="hidden md:block absolute top-1/2 left-1/2 w-4 h-4 bg-amber-500 rounded-full -translate-x-1/2 -translate-y-1/2 z-10" />
                  <div className={`md:pt-12 ${index % 2 === 0 ? 'md:pb-0' : 'md:pt-0 md:pb-12 md:-mt-24'}`}>
                    <div className="bg-gray-800 rounded-xl p-6">
                      <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-2">
                        {milestone.year}
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-1">{milestone.title}</h3>
                      <p className="text-gray-400 text-sm">{milestone.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
              Our Commitment
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Dedicated to Your Success
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Our experienced team brings passion, expertise, and attention to detail to every event.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { stat: '500+', label: 'Events Completed' },
              { stat: '100%', label: 'Client Satisfaction' },
              { stat: '24/7', label: 'Support Available' },
            ].map((item) => (
              <div key={item.label} className="text-center p-8 bg-gray-50 rounded-2xl">
                <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 mb-2">
                  {item.stat}
                </div>
                <div className="text-gray-600 font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-amber-500 to-orange-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Let&apos;s Create Something Amazing Together
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Whether it&apos;s your first event or your hundredth, we&apos;d love to be part of making it special.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/inquiry"
              className="inline-flex items-center gap-2 bg-white text-gray-900 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-100 transition-all shadow-lg"
            >
              Start Your Project
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-transparent text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white/10 transition-all border-2 border-white"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
