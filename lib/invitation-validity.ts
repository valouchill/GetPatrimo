/**
 * Sécurité (pentest ChatGPT P2) : validité d'un token d'invitation garant/colocataire.
 *
 * Un token d'invitation est « fermé » (n'ouvre plus l'accès au statut/à la session KYC) s'il a
 * été révoqué ou s'il a expiré — SAUF si le dossier est déjà CERTIFIED (un dossier certifié reste
 * consultable, on ne veut pas verrouiller un garant déjà validé). Les documents legacy sans
 * `invitationExpiresAt` (champ absent) sont considérés valides (rétro-compatibilité).
 */
export interface InvitationLike {
  status?: string;
  invitationExpiresAt?: Date | string | null;
  invitationRevokedAt?: Date | string | null;
}

export function isInvitationClosed(doc: InvitationLike | null | undefined): boolean {
  if (!doc) return false;
  if (doc.status === 'CERTIFIED') return false;
  if (doc.invitationRevokedAt) return true;
  if (doc.invitationExpiresAt && new Date(doc.invitationExpiresAt).getTime() < Date.now()) {
    return true;
  }
  return false;
}
