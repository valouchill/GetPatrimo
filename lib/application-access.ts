/**
 * Helpers d'autorisation et d'échappement pour les candidatures (revue V1 — S7).
 */


const Property = require('@/models/Property');

/**
 * Vrai si le bien rattaché à la candidature appartient à `userId`.
 * Résout le bien via la réf `property`, sinon via `applyToken`.
 * À utiliser pour autoriser toute action propriétaire sur une candidature
 * (changement d'étape, contact du candidat, etc.) — évite les IDOR.
 */
export async function ownerOwnsApplication(
  application: { property?: unknown; applyToken?: string } | null | undefined,
  userId: unknown,
): Promise<boolean> {
  if (!application || !userId) return false;
  let propertyId: unknown = application.property;
  if (!propertyId && application.applyToken) {
    const prop = (await Property.findOne({ applyToken: application.applyToken })
      .select('_id')
      .lean()) as { _id?: unknown } | null;
    propertyId = prop?._id;
  }
  if (!propertyId) return false;
  return !!(await Property.exists({ _id: propertyId, user: userId }));
}

/** Échappe les caractères HTML dangereux (anti-XSS dans les emails / templates). */
export function escapeHtml(input: unknown): string {
  return String(input == null ? '' : input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
