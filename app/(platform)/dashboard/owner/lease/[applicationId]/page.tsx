/**
 * /dashboard/owner/lease/[applicationId] — Module de contractualisation
 * V2 (données réelles).
 *
 * Charge l'Application + Property depuis Mongo, valide l'ownership, et
 * passe les données mappées à <LeasePreparationPage>.
 *
 * Auth : héritée du layout owner (redirect /auth/login si non connecté).
 * Ownership : 404 si la Property n'appartient pas à l'owner connecté.
 */

import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import Property from '@/models/Property';
import { logger } from '@/lib/server-logger';
import { LeasePreparationPage } from '../../components/LeasePreparationPage';
import { OwnerShell } from '../../components/OwnerShell';
import {
  buildAddress,
  buildFullName,
  buildLeasePreparationData,
  type MongoApplication,
  type MongoGuarantor,
  type MongoProperty,
} from '../_lease-data';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Préparation de bail · Maison Patrimo',
  description:
    'Téléchargez le modèle ALUR et reportez les informations du dossier en un clic.',
};

function isNextNavigationError(error: unknown): boolean {
  const digest = typeof (error as { digest?: unknown })?.digest === 'string'
    ? String((error as { digest: string }).digest)
    : '';
  return digest.startsWith('NEXT_REDIRECT') || digest.startsWith('NEXT_HTTP_ERROR_FALLBACK');
}

export default async function OwnerLeasePreparationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}): Promise<React.ReactElement> {
  const { applicationId } = await params;

  try {
    await connectDiditDb();

    const session = await getServerSession(authOptions as any);
    if (!session) {
      redirect('/auth/login?callbackUrl=/dashboard/owner/lease');
    }

    const app = (await Application.findById(applicationId)
      .select(
        'profile didit financialSummary property guarantee guarantor',
      )
      .lean()) as MongoApplication | null;

    if (!app) {
      notFound();
    }

    const property = (await Property.findById(app.property as unknown)
      .select(
        'user owner name address addressLine zipCode city rentAmount chargesAmount surfaceM2 propertyType',
      )
      .lean()) as MongoProperty | null;

    if (!property) {
      notFound();
    }

    // Ownership : la Property doit appartenir à l'owner connecté
    const userId =
      (session as any)?.user?.id || (session as any)?.user?._id;
    const propertyOwner = String((property as any).user || (property as any).owner || '');
    if (userId && propertyOwner && String(userId) !== propertyOwner) {
      // 404 plutôt que 403 pour ne pas révéler l'existence de la ressource
      notFound();
    }

    // Guarantor (optionnel, lazy require pour éviter import inutile)
    let guarantor: MongoGuarantor | null = null;
    if (app.guarantor?.guarantorId) {
      try {
        const Guarantor = (await import('@/models/Guarantor')).default;
        guarantor = (await Guarantor.findById(app.guarantor.guarantorId)
          .select('firstName lastName')
          .lean()) as MongoGuarantor | null;
      } catch (err) {
        logger.warn('lease page: guarantor lookup failed', {
          applicationId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const data = buildLeasePreparationData(app, property, guarantor);
    const candidateName = buildFullName(app);
    const propertyName = property.name || buildAddress(property);
    const applicationLabel = `Bail pour ${candidateName} · ${propertyName}`;

    return (
      <OwnerShell>
        <LeasePreparationPage
          data={data}
          applicationLabel={applicationLabel}
        />
      </OwnerShell>
    );
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    logger.error('GET /dashboard/owner/lease/[applicationId]', {
      applicationId,
      error: err instanceof Error ? err.message : String(err),
    });
    redirect('/dashboard/owner/contracts');
  }
}
