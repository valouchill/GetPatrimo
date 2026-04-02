'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'cookie-consent';

type ConsentValue = 'accepted' | 'refused';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  function handleChoice(value: ConsentValue) {
    localStorage.setItem(CONSENT_KEY, value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl shadow-lg p-5 sm:p-6">
        <p className="text-sm text-slate-700 leading-relaxed mb-4">
          Ce site utilise uniquement des cookies strictement nécessaires à son fonctionnement
          (authentification, sécurité). Aucun cookie analytique ou publicitaire n&apos;est déposé sans
          votre consentement.{' '}
          <Link href="/privacy#cookies" className="text-cobalt hover:underline">
            En savoir plus
          </Link>
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleChoice('accepted')}
            className="px-4 py-2 bg-cobalt text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            Accepter tout
          </button>
          <button
            onClick={() => handleChoice('refused')}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
          >
            Refuser tout
          </button>
          <Link
            href="/privacy#cookies"
            className="px-4 py-2 text-slate-500 text-sm font-medium rounded-lg hover:text-slate-700 transition-colors inline-flex items-center"
          >
            Personnaliser
          </Link>
        </div>
      </div>
    </div>
  );
}
