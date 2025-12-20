import Link from 'next/link';

export function Header() {
  return (
    <header className="bg-white shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          Accent Productions
        </Link>
        <div className="flex gap-6">
          <Link href="/services" className="hover:text-gray-600">
            Services
          </Link>
          <Link href="/about" className="hover:text-gray-600">
            About
          </Link>
          <Link href="/contact" className="hover:text-gray-600">
            Contact
          </Link>
          <Link
            href="/inquiry"
            className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800"
          >
            Get a Quote
          </Link>
        </div>
      </nav>
    </header>
  );
}
