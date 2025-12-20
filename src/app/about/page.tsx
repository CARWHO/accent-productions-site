import Image from 'next/image';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold text-white mb-4">About Us</h1>
          <p className="text-xl text-gray-400 max-w-2xl">
            Professional sound equipment rental in Auckland since 2014.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Our Story
              </h2>
              <div className="space-y-4 text-gray-600">
                <p>
                  Accent Productions started in 2014 with a simple goal: provide reliable, professional sound equipment for events in Auckland.
                </p>
                <p>
                  What began as helping friends with their weddings and parties has grown into a full-service audio rental company. We&apos;ve now provided sound for over 500 events - from backyard celebrations to corporate conferences.
                </p>
                <p>
                  We handle delivery, setup, operation, and breakdown. You focus on your event.
                </p>
              </div>
            </div>
            <div className="aspect-[4/3] relative rounded-lg overflow-hidden">
              <Image
                src="/images/image8.webp"
                alt="Sound equipment"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">500+</div>
              <div className="text-gray-600">Events completed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">10+</div>
              <div className="text-gray-600">Years in business</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gray-900 mb-2">Auckland</div>
              <div className="text-gray-600">Based and operated</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Have an event coming up?
          </h2>
          <p className="text-gray-400 mb-6">
            Get in touch for a free quote.
          </p>
          <Link
            href="/inquiry"
            className="inline-block bg-amber-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-600 transition-colors"
          >
            Request a Quote
          </Link>
        </div>
      </section>
    </main>
  );
}
