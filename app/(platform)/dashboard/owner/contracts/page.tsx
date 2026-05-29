/**
 * /dashboard/owner/contracts — Hub "Baux & Contrats".
 *
 * Page intelligente avec rendu conditionnel :
 *   - 0 sélection en cours → Empty State Premium + téléchargement libre
 *   - 1 sélection         → LeasePreparationPage inline (plan de travail)
 *   - 2+ sélections       → Liste des contractualisations en cours
 *
 * Source de vérité : Property.acceptedTenantId (ObjectId de l'Application
 * sélectionnée). Auth héritée du layout owner.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import Property from '@/models/Property';
import { logger } from '@/lib/server-logger';
import { LeasePreparationPage } from '../components/LeasePreparationPage';
import { OwnerShell } from '../components/OwnerShell';
import {
  buildAddress,
  buildFullName,
  buildLeasePreparationData,
  type MongoApplication,
  type MongoGuarantor,
  type MongoProperty,
} from '../lease/_lease-data';
import { ContractsEmptyState } from './ContractsEmptyState';
import { ContractsSelector } from './ContractsSelector';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Baux & Contrats · PatrimoTrust',
  description:
    'Préparez vos contrats de bail à partir des dossiers sélectionnés.',
};

export default async function OwnerContractsPage(): Promise<React.ReactElement> {
  await connectDiditDb();

  const session = await getServerSession(authOptions as any);
  if (!session) {
    redirect('/auth/login?callbackUrl=/dashboard/owner/contracts');
  }

  const userId =
    (session as any)?.user?.id || (session as any)?.user?._id || null;
  if (!userId) {
    redirect('/auth/login');
  }

  // 1) Toutes les Properties de l'owner avec un acceptedTenantId défini
  let activeContracts: Array<{
    propertyId: string;
    applicationId: string;
    candidateName: string;
    propertyAddress: string;
  }> = [];

  try {
    const properties = (await Property.find({
      owner: userId,
      acceptedTenantId: { $ne: null },
    })
      .select('_id name address addressLine zipCode city acceptedTenantId')
      .lean()) as MongoProperty[];

    if (properties.length > 0) {
      // 2) Fetch des Applications correspondantes
      const applicationIds = properties
        .map((p) => p.acceptedTenantId)
        .filter(Boolean);

      const apps = (await Application.find({
        _id: { $in: applicationIds },
      })
        .select('_id profile didit')
        .lean()) as MongoApplication[];

      const appById = new Map(
        apps.map((a) => [String(a._id), a as MongoApplication]),
      );

      activeContracts = properties
        .map((p) => {
          const app = appById.get(String(p.acceptedTenantId));
          if (!app) return null;
          return {
            propertyId: String(p._id || ''),
            applicationId: String(app._id || ''),
            candidateName: buildFullName(app),
            propertyAddress: p.name || buildAddress(p),
          };
        })
        .filter((c): c is NonNullable<typeof c> => c !== null);
    }
  } catch (err) {
    logger.error('GET /dashboard/owner/contracts', {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fallback gracieux : empty state
    activeContracts = [];
  }

  // ─── État 1 : aucune contractualisation en cours ──────────────────────
  if (activeContracts.length === 0) {
    return (
      <OwnerShell>
        <ContractsEmptyState />
      </OwnerShell>
    );
  }

  // ─── État 2 : exactement 1 sélection → LeasePreparationPage inline ───
  if (activeContracts.length === 1) {
    const contract = activeContracts[0];
    try {
      const app = (await Application.findById(contract.applicationId)
        .select('profile didit financialSummary property guarantee guarantor')
        .lean()) as MongoApplication | null;
      const property = (await Property.findById(contract.propertyId)
        .select(
          'owner name address addressLine zipCode city rentAmount chargesAmount surfaceM2 propertyType',
        )
        .lean()) as MongoProperty | null;

      if (!app || !property) {
        return (
          <OwnerShell>
            <ContractsEmptyState />
          </OwnerShell>
        );
      }

      let guarantor: MongoGuarantor | null = null;
      if (app.guarantor?.guarantorId) {
        try {
          const Guarantor = (await import('@/models/Guarantor')).default;
          guarantor = (await Guarantor.findById(app.guarantor.guarantorId)
            .select('firstName lastName')
            .lean()) as MongoGuarantor | null;
        } catch {
          /* non bloquant */
        }
      }

      const data = buildLeasePreparationData(app, property, guarantor);
      const applicationLabel = `Bail pour ${contract.candidateName} · ${contract.propertyAddress}`;

      return (
        <OwnerShell>
          <LeasePreparationPage
            data={data}
            applicationLabel={applicationLabel}
          />
        </OwnerShell>
      );
    } catch (err) {
      logger.error('contracts page: mapping failed', {
        applicationId: contract.applicationId,
        error: err instanceof Error ? err.message : String(err),
      });
      return (
        <OwnerShell>
          <ContractsEmptyState />
        </OwnerShell>
      );
    }
  }

  // ─── État 3 : 2+ sélections → liste de sélecteur ──────────────────────
  return (
    <OwnerShell>
      <ContractsSelector contracts={activeContracts} />
    </OwnerShell>
  );
}
