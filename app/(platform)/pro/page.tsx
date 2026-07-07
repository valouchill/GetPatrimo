/**
 * /pro — Landing B2B (agences, administrateurs de biens, mandataires).
 *
 * Scope « vendre d'abord » : grille 99/199/sur devis AFFICHÉE (aucun checkout),
 * CTA unique = demande de pilote gratuit (10 dossiers) via le formulaire Lead
 * (source 'pilote-b2b'). L'abonnement Stripe se construira au premier payeur.
 */

import { ProClient } from './ProClient';

export const metadata = {
  title: 'Maison Patrimo Pro — audit anti-fraude pour agences et gestionnaires',
  description:
    "Audit forensic des dossiers locataires pour les professionnels : détection de falsifications, rapport par dossier, comparaison des candidats. Pilote gratuit sur 10 dossiers.",
};

export default function ProPage() {
  return <ProClient />;
}
