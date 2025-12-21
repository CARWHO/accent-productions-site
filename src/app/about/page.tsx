import Image from 'next/image';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="pt-24 pb-12 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">About Us</h1>
          <p className="text-xl text-gray-600 max-w-2xl">
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
    </main>
  );
}
