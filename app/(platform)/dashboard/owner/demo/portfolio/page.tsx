/**
 * Page démo : <PropertiesPortfolio> — Vue Portefeuille d'Actifs Banque Privée.
 * Accessible à : /dashboard/owner/demo/portfolio
 *
 * Affiche 3 actifs mock avec copy-Sésame fonctionnel + toast de succès.
 */

import { PropertiesPortfolioDemo } from '@/app/components/audit/PropertiesPortfolio';

export const metadata = {
  title: 'Démo · Portefeuille — PatrimoTrust',
};

export default function PortfolioDemoPage() {
  return <PropertiesPortfolioDemo />;
}
