/**
 * passport-access.ts — Contrôle d'autorisation pour les passeports (V8.3).
 *
 * Corrige l'IDOR (audit V1 C1) : les routes passeport vérifiaient seulement
 * qu'un utilisateur était connecté, sans contrôler qu'il a le DROIT d'accéder
 * à CETTE candidature. Un compte locataire trivial pouvait énumérer les IDs
 * et télécharger les passeports (PII financières) d'autres candidats.
 *
 * Règle d'accès — autorisé si l'une des conditions est vraie :
 *   1. LOCATAIRE : la candidature lui appartient (userEmail / userId).
 *   2. PROPRIÉTAIRE : la Property liée à la candidature lui appartient.
 */

 
const Property = require('@/models/Property');
 
const User = require('@/models/User');

interface SessionLike {
  user?: { id?: string; email?: string } | null;
}

interface AppLike {
  userId?: string | null;
  userEmail?: string | null;
  /** Peut être un ObjectId, une string, ou un doc peuplé { _id } */
  property?: unknown;
}

/** Résout l'_id User (depuis session.user.id, sinon via email). */
async function resolveUserId(session: SessionLike): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const u = await User.findOne({ email: session.user.email })
      .select('_id')
      .lean();
    userId = u?._id?.toString();
  }
  return userId || null;
}

/** Extrait l'_id de Property quelle que soit la forme (peuplé / brut). */
function extractPropertyId(property: unknown): string | null {
  if (!property) return null;
  if (typeof property === 'string') return property;
  const asObj = property as { _id?: unknown };
  if (asObj._id) return String(asObj._id);
  return String(property);
}

/**
 * Vérifie qu'un utilisateur connecté a le droit d'accéder au passeport d'une
 * candidature. Retourne true si locataire propriétaire du dossier OU
 * propriétaire du bien lié.
 */
export async function userCanAccessApplicationPassport(
  app: AppLike,
  session: SessionLike,
): Promise<boolean> {
  if (!session?.user) return false;

  const email = String(session.user.email || '').toLowerCase();
  const sessionUserId = session.user.id ? String(session.user.id) : '';

  // 1. Locataire — le dossier lui appartient
  if (email && String(app.userEmail || '').toLowerCase() === email) {
    return true;
  }
  if (
    sessionUserId &&
    app.userId &&
    String(app.userId) === sessionUserId
  ) {
    return true;
  }

  // 2. Propriétaire — la Property du dossier lui appartient
  const propertyId = extractPropertyId(app.property);
  if (propertyId) {
    const userId = await resolveUserId(session);
    if (userId) {
      const owned = await Property.findOne({ _id: propertyId, user: userId })
        .select('_id')
        .lean();
      if (owned) return true;
    }
  }

  return false;
}
