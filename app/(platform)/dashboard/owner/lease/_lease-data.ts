/**
 * _lease-data.ts — Mapper Mongo → LeasePreparationData partagé entre :
 *   - /dashboard/owner/lease/[applicationId] (page dédiée à un dossier)
 *   - /dashboard/owner/contracts (hub conditionnel)
 *
 * Helpers purs (pas de fetch, pas d'auth) : on prend les docs Mongo en
 * entrée et on retourne une LeasePreparationData prête à passer en prop.
 */

import type { LeasePreparationData } from '../components/LeasePreparationPage';

export interface MongoProperty {
  _id?: unknown;
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
  acceptedTenantId?: unknown;
}

export interface MongoApplication {
  _id?: unknown;
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

export interface MongoGuarantor {
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

export function formatPriceEur(n: number | undefined | null): string {
  if (n === undefined || n === null || !Number.isFinite(n) || n <= 0) {
    return 'À compléter';
  }
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n))} € / mois`;
}

export function buildAddress(p: MongoProperty): string {
  if (p.address && p.address.trim()) return p.address;
  const parts = [p.addressLine, [p.zipCode, p.city].filter(Boolean).join(' ')]
    .filter((s): s is string => !!s && s.trim().length > 0);
  return parts.length > 0 ? parts.join(', ') : 'À compléter';
}

export function buildAssetType(p: MongoProperty): string {
  const kind = PROPERTY_TYPE_LABELS[p.propertyType || 'APPARTEMENT'] || 'Bien';
  const surface =
    p.surfaceM2 && p.surfaceM2 > 0 ? ` — ${Math.round(p.surfaceM2)} m²` : '';
  return `${kind}${surface}`;
}

export function buildBirthInfo(app: MongoApplication): string {
  const date =
    app.didit?.identityData?.birthDate || app.profile?.birthDate || '';
  return date.trim() || 'À compléter';
}

export function buildFullName(app: MongoApplication): string {
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

export function buildLeasePreparationData(
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
          // Adresse + revenus du garant pas encore stockés dans le modèle Mongo
          address: 'À renseigner manuellement (cf. pièces du garant)',
          certifiedIncome: 'À renseigner manuellement (cf. bulletins de paie)',
        }
      : null;

  return { asset, tenant, guarantor: guarantorData };
}
