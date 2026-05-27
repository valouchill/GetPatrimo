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
import {
  LeasePreparationPage,
  type LeasePreparationData,
} from '../../components/LeasePreparationPage';

export const dynamic = 'force-dynamic';

interface MongoProperty {
  _id: unknown;
  owner?: unknown;
  name?: string;
  address?: string;
  addressLine?: string;
  zipCode?: string;
  city?: string;
  rentAmount?: number;
  chargesAmount?: number;
  surfaceM2?: number | null;
  propertyType?: string;
}

interface MongoApplication {
  _id: unknown;
  property?: unknown;
  profile?: {
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    status?: string;
  };
  didit?: {
    identityData?: {
      firstName?: string;
      lastName?: string;
      birthDate?: string;
    };
  };
  financialSummary?: {
    totalMonthlyIncome?: number;
    incomeSource?: string;
  };
  guarantee?: { type?: string };
  guarantor?: {
    hasGuarantor?: boolean;
    guarantorId?: unknown;
  };
}

interface MongoGuarantor {
  _id?: unknown;
  firstName?: string;
  lastName?: string;
}

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: 'Appartement',
  MAISON: 'Maison',
  STUDIO: 'Studio',
  LOFT: 'Loft',
  LOCAL_COMMERCIAL: 'Local commercial',
  GARAGE: 'Garage',
  AUTRE: 'Autre',
};

function formatPriceEur(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n) || n <= 0) {
    return 'À compléter';
  }
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} € / mois`;
}

function buildAddress(p: MongoProperty): string {
  if (p.address && p.address.trim()) return p.address;
  const parts = [p.addressLine, [p.zipCode, p.city].filter(Boolean).join(' ')]
    .filter((s): s is string => !!s && s.trim().length > 0);
  return parts.length > 0 ? parts.join(', ') : 'À compléter';
}

function buildAssetType(p: MongoProperty): string {
  const kind = PROPERTY_TYPE_LABELS[p.propertyType || 'APPARTEMENT'] || 'Bien';
  const surface =
    p.surfaceM2 && p.surfaceM2 > 0 ? ` — ${Math.round(p.surfaceM2)} m²` : '';
  return `${kind}${surface}`;
}

function buildBirthInfo(app: MongoApplication): string {
  const date =
    app.didit?.identityData?.birthDate || app.profile?.birthDate || '';
  return date.trim() || 'À compléter';
}

function buildFullName(app: MongoApplication): string {
  const first =
    app.didit?.identityData?.firstName ||
    app.profile?.firstName ||
    '';
  const last =
    app.didit?.identityData?.lastName ||
    app.profile?.lastName ||
    '';
  const full = `${first} ${last}`.trim();
  return full || 'Candidat';
}

function buildLeasePreparationData(
  app: MongoApplication,
  property: MongoProperty,
  guarantor: MongoGuarantor | null,
): LeasePreparationData {
  // Bloc 1 — Actif
  const asset = {
    address: buildAddress(property),
    type: buildAssetType(property),
    rentMain: formatPriceEur(property.rentAmount),
    rentCharges: formatPriceEur(property.chargesAmount),
  };

  // Bloc 2 — Locataire
  const tenant = {
    fullName: buildFullName(app),
    birthInfo: buildBirthInfo(app),
    proSituation: app.profile?.status || 'À compléter',
    certifiedIncome: formatPriceEur(app.financialSummary?.totalMonthlyIncome),
  };

  // Bloc 3 — Garant (optionnel)
  const hasGuarantorPhysical =
    (app.guarantee?.type || '').toUpperCase().includes('PHYSICAL') ||
    (app.guarantor?.hasGuarantor === true && guarantor);
  const guarantorData =
    hasGuarantorPhysical && guarantor
      ? {
          fullName:
            `${guarantor.firstName || ''} ${guarantor.lastName || ''}`.trim() ||
            'À compléter',
          // Adresse et revenus du garant pas encore stockés dans le modèle
          // Mongo — à compléter par l'owner depuis les pièces uploadées
          address: 'À renseigner manuellement (cf. pièces du garant)',
          certifiedIncome: 'À renseigner manuellement (cf. bulletins de paie)',
        }
      : null;

  return { asset, tenant, guarantor: guarantorData };
}

export const metadata = {
  title: 'Préparation de bail · PatrimoTrust',
  description:
    'Téléchargez le modèle ALUR et reportez les informations du dossier en un clic.',
};

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
        'owner name address addressLine zipCode city rentAmount chargesAmount surfaceM2 propertyType',
      )
      .lean()) as MongoProperty | null;

    if (!property) {
      notFound();
    }

    // Ownership : la Property doit appartenir à l'owner connecté
    const userId =
      (session as any)?.user?.id || (session as any)?.user?._id;
    const propertyOwner = String((property as any).owner || '');
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
      <LeasePreparationPage
        data={data}
        applicationLabel={applicationLabel}
      />
    );
  } catch (err) {
    logger.error('GET /dashboard/owner/lease/[applicationId]', {
      applicationId,
      error: err instanceof Error ? err.message : String(err),
    });
    // En cas d'erreur Mongo / DB : redirige vers la page démo plutôt
    // que d'afficher un écran d'erreur (gracieux côté propriétaire).
    redirect('/dashboard/owner/lease');
  }
}
