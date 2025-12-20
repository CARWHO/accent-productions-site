import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gray-900 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Professional Sound for Your Events
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Accent Productions provides top-quality sound equipment and expertise
            for weddings, corporate events, festivals, and private parties.
          </p>
          <Link
            href="/inquiry"
            className="inline-block bg-white text-gray-900 px-8 py-4 rounded-md font-semibold text-lg hover:bg-gray-100 transition-colors"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>

      {/* Services Overview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">
            What We Do
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: 'Weddings', desc: 'Crystal clear audio for your special day' },
              { title: 'Corporate', desc: 'Professional sound for meetings & conferences' },
              { title: 'Festivals', desc: 'Large-scale sound systems for outdoor events' },
              { title: 'Private Parties', desc: 'Perfect sound for any celebration' },
            ].map((service) => (
              <div key={service.title} className="text-center p-6 border rounded-lg">
                <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
                <p className="text-gray-600">{service.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/services"
              className="text-gray-900 font-medium hover:underline"
            >
              Learn more about our services &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-gray-600 mb-8">
            Tell us about your event and we&apos;ll provide a custom quote.
          </p>
          <Link
            href="/inquiry"
            className="inline-block bg-gray-900 text-white px-8 py-4 rounded-md font-semibold hover:bg-gray-800 transition-colors"
          >
            Request a Quote
          </Link>
        </div>
      </section>
    </main>
  );
}
