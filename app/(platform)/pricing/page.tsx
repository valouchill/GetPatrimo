/**
 * /pricing — Page tarifaire publique "Pay-per-Listing".
 *
 * Accessible sans authentification (marketing). La logique de souscription
 * (Stripe Checkout) est dans le composant client PricingClient.
 */

import { Suspense } from 'react';
import { PricingClient } from './PricingClient';

export const metadata = {
  title: 'Tarifs · Maison Patrimo',
  description:
    'Paiement par logement : analysez vos dossiers locataires avec l’IA anti-fraude. Offres Essentiel, Analyse IA et Max.',
};

export default function PricingPage(): React.ReactElement {
  // useSearchParams() (dans PricingClient) requiert une Suspense boundary.
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <PricingClient />
    </Suspense>
  );
}
