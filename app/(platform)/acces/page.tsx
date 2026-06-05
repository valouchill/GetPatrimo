import { Suspense } from 'react';
import AccessCodeClient from './AccessCodeClient';

export const metadata = {
  title: 'Accéder à ma candidature · getpatrimo',
  description:
    'Saisissez le code reçu de votre propriétaire pour déposer votre dossier locataire en toute sécurité.',
};

function AccessLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-emerald-50/30 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="animate-pulse rounded-modal border border-slate-200 bg-white p-8 shadow-premium">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-slate-100" />
          <div className="mx-auto mb-2 h-3 w-32 rounded bg-slate-100" />
          <div className="mx-auto mb-6 h-8 w-64 rounded bg-slate-100" />
          <div className="h-14 w-full rounded-input bg-slate-100" />
          <div className="mt-4 h-12 w-full rounded-button bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<AccessLoading />}>
      <AccessCodeClient />
    </Suspense>
  );
}
