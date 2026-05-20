/**
 * Page démo : workflow "Tinder Like" stack-based pour la revue des
 * candidatures locataires. 5 fiches mock empilées, boutons d'action
 * ronds, swipe drag activé.
 *
 * Accessible à : /dashboard/owner/demo/candidatures-stack
 */

import { CandidaturesStackViewDemo } from '@/app/components/audit/CandidaturesStackView';

export const metadata = {
  title: 'Démo · Stack Candidatures — PatrimoTrust',
};

export default function CandidaturesStackDemoPage() {
  return <CandidaturesStackViewDemo />;
}
