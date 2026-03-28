import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <p className="mt-4 text-xl text-gray-600">Page introuvable</p>
        <p className="mt-2 text-gray-500">La page que vous recherchez n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
