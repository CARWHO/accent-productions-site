import Image from 'next/image';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="pt-24 pb-12 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">About Us</h1>
          <p className="text-xl text-gray-700 max-w-2xl font-medium">
            Wellington based audio solution for festivals, public events, and private functions & support to local & touring bands.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-8">
                Our Story
              </h2>
              <div className="space-y-5 text-gray-700 text-lg font-medium">
                <p>
                  Since 2005, Accent Productions has been the go-to sound team for events across Wellington. Over 2000 gigs later, we're still at it..
                </p>
                <p className="font-semibold">Notable partnerships:</p>
                <ul className="list-none space-y-1">
                  <li>Newtown Festival: 2005–2026 (20+ years)</li>
                  <li>Cuba Dupa: 2022–2026 (4 years)</li>
                </ul>
                <p>
                  We've worked everything from backyard weddings to multi-stage street festivals. Same crew, same gear, same approach every time: show up early, get it right, pack it out clean.
                </p>
                <p>
                  We handle delivery, setup, operation, and breakdown. You focus on your event.
                </p>
              </div>
            </div>
            <div className="aspect-[4/3] relative rounded-md overflow-hidden">
              <Image
                src="/images/image1-festival-cuba-st.png"
                alt="Sound equipment"
                fill
                className="object-cover"
              />
              <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded">
                <p className="text-white text-xs font-medium">Wellington CBD, New Zealand</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
