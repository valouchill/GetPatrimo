/**
 * /dashboard/owner/lease — Module de contractualisation V1.
 *
 * Auth : déjà gérée par app/(platform)/dashboard/owner/layout.tsx
 * (redirect vers /auth/login si non connecté).
 *
 * V1 : données démo hardcodées (cf. DEMO_LEASE_DATA). En V2, la page
 * acceptera un applicationId via query param ou route dynamique pour
 * charger les vraies données du dossier sélectionné.
 */

import { LeasePreparationPage } from '../components/LeasePreparationPage';

export const metadata = {
  title: 'Préparation de bail · getpatrimo',
  description:
    'Téléchargez le modèle ALUR officiel et reportez les informations du dossier en un clic.',
};

export default function OwnerLeasePreparationPage(): React.ReactElement {
  return <LeasePreparationPage />;
}
