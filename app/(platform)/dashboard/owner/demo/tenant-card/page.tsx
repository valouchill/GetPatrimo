/**
 * Page démo : <TenantCard> — Carte candidat Banque Privée / Luxe.
 * Accessible à : /dashboard/owner/demo/tenant-card
 *
 * Affiche 3 variations (idéal / à vérifier / alerte) pour valider la
 * lisibilité des statuts et la cohérence visuelle.
 */

import { TenantCardDemo } from '@/app/components/audit/TenantCard';

export const metadata = {
  title: 'Démo · TenantCard — Maison Patrimo',
};

export default function TenantCardDemoPage() {
  return <TenantCardDemo />;
}
