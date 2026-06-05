/**
 * Page démo : <CandidateDossier> + <SecureDocumentViewer>.
 *
 * Affiche un dossier candidat complet façon "Audit Forensic Banque Privée"
 * avec 5 pièces mock. Click "Consulter" → viewer filigrané.
 *
 * Accessible à : /dashboard/owner/demo/candidate-dossier
 */

import { CandidateDossierDemo } from '@/app/components/audit/CandidateDossier';

export const metadata = {
  title: 'Démo · Dossier Candidat — getpatrimo',
};

export default function CandidateDossierDemoPage() {
  return <CandidateDossierDemo />;
}
