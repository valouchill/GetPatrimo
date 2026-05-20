/**
 * Page démo : Vue Analyse IA du Candidat avec toggle Louna/Thomas.
 * Accessible à : /dashboard/owner/demo/ai-report
 *
 * Permet de visualiser les 2 états extrêmes de l'UI (dossier idéal vs
 * dossier risque) sans avoir besoin d'un vrai dossier en base.
 */

import { CandidateAiReportDemo } from '@/app/components/audit/CandidateAiReport';

export const metadata = {
  title: 'Démo · Analyse IA du Candidat — PatrimoTrust',
};

export default function AiReportDemoPage() {
  return <CandidateAiReportDemo />;
}
