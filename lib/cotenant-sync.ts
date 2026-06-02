import Application from '@/models/Application';
import Property from '@/models/Property';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { recomputeApplicationScore } = require('@/src/utils/recomputeApplication');

interface CoTenantLike {
  applicationId?: unknown;
  slot?: number;
  _id?: unknown;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  profile?: string;
}

/**
 * Applique la certification d'un colocataire à SON Application : met à jour le
 * miroir `coTenants[slot]` (status CERTIFIED + identité) PUIS recalcule le score
 * du foyer (recomputeApplicationScore). Idempotent.
 *
 * Source UNIQUE du re-sync, appelée par le webhook Didit (push) ET la route
 * /api/cotenant/status (polling) → la boucle se ferme même si le webhook tarde.
 */
export async function syncCoTenantCertification(
  coTenant: CoTenantLike,
  identity: { firstName?: string; lastName?: string; birthDate?: string },
): Promise<void> {
  if (!coTenant?.applicationId) return;
  const application = await Application.findById(coTenant.applicationId);
  if (!application) return;

  const didit = {
    status: 'VERIFIED',
    verifiedAt: new Date(),
    identityData: {
      firstName: identity.firstName || coTenant.firstName || '',
      lastName: identity.lastName || coTenant.lastName || '',
      birthDate: identity.birthDate || '',
    },
  };

  const mirror = (application.coTenants || []).find(
    (c: { slot?: number }) => Number(c.slot) === Number(coTenant.slot),
  );
  if (mirror) {
    mirror.status = 'CERTIFIED';
    mirror.certificationMethod = 'DIDIT';
    mirror.didit = didit;
    if (identity.firstName) mirror.firstName = identity.firstName;
    if (identity.lastName) mirror.lastName = identity.lastName;
  } else {
    application.coTenants = application.coTenants || [];
    application.coTenants.push({
      slot: coTenant.slot,
      coTenantId: coTenant._id,
      firstName: coTenant.firstName || '',
      lastName: coTenant.lastName || '',
      email: coTenant.email || '',
      phone: coTenant.phone || '',
      profile: coTenant.profile || 'Etudiant',
      status: 'CERTIFIED',
      certificationMethod: 'DIDIT',
      invitationSent: true,
      didit,
    });
  }
  application.isColocation = true;

  let rentAmount = 0;
  if (application.property) {
    const prop = (await Property.findById(application.property)
      .select('rentAmount')
      .lean()) as { rentAmount?: number } | null;
    rentAmount = Number(prop?.rentAmount) || 0;
  }
  recomputeApplicationScore(application, {
    propertyRentAmount: rentAmount,
    fallbackIncome: application.financialSummary?.totalMonthlyIncome || 0,
  });
  await application.save();
}
