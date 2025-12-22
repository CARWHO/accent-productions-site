import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="bg-gray-100 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
          <div className="flex items-center gap-8">
            <Link href="/">
              <Image
                src="/images/logowhitefooter.png"
                alt="Accent Productions"
                width={120}
                height={35}
                className="h-8 w-auto"
              />
            </Link>
            <nav className="flex gap-6 text-sm text-gray-600">
              <Link href="/services" className="hover:text-gray-900">Services</Link>
              <Link href="/about" className="hover:text-gray-900">About</Link>
            </nav>
          </div>
          <div className="text-sm text-gray-500">
            <p>+64 21 123 4567 · hello@accentproductions.co.nz</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Accent Productions
        </div>
      </div>
    </footer>
  );
}
