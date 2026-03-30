import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-slate-900">404</h1>
        <p className="mt-4 text-xl text-slate-600">Page introuvable</p>
        <p className="mt-2 text-slate-500">La page que vous recherchez n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className="mt-6 inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-colors">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
