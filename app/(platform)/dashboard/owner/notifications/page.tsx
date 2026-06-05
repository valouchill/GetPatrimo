/**
 * /dashboard/owner/notifications — Historique complet de l'Auditeur IA.
 *
 * Affiche TOUTES les notifications (au-delà du cap 30 de la sidebar) avec
 * la même chaine de donnees + le shell layout (sidebar a gauche).
 *
 * V1 : reuse l'agregation /api/owner/notifications (live, cap 30 cote API
 * pour l'instant — on relevera ce cap quand on aura de la persistance
 * dediee aux notifications historiques).
 */

import { OwnerShell } from '../components/OwnerShell';
import { NotificationsArchiveClient } from './NotificationsArchiveClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Centre de notifications · getpatrimo",
  description:
    "Historique des Rapports de l'Auditeur IA neuro-symbolique.",
};

export default function OwnerNotificationsArchivePage(): React.ReactElement {
  return (
    <OwnerShell>
      <NotificationsArchiveClient />
    </OwnerShell>
  );
}
