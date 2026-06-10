/**
 * Anti-abus pour les Server Actions login-less qui envoient des emails
 * (invitations garant/colocataire, création de compte + magic-link).
 *
 * Ces actions sont des endpoints POST publics non authentifiés : le tunnel `apply`
 * est login-less par design (le locataire invite son garant / crée son compte AVANT
 * d'avoir une session), donc on ne peut pas exiger de session sans casser le funnel.
 * On borne le débit par IP ET par clé métier (applyToken / email cible) pour empêcher
 * le spam / phishing en masse via le domaine d'envoi.
 *
 * Store en mémoire (cf. lib/rate-limit.ts) — OK en mono-instance ; migrer vers Redis
 * si déploiement multi-instances.
 */
import { headers } from 'next/headers';
import { checkRateLimit } from '@/lib/rate-limit';

/** IP client d'une Server Action, depuis les en-têtes proxy (spoofable mais 1 couche). */
export async function getActionClientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for') || '';
    const ip = fwd.split(',')[0].trim() || h.get('x-real-ip') || '';
    return ip || 'unknown';
  } catch {
    return 'unknown';
  }
}

type RateOpts = {
  ipMax?: number;
  ipWindowMs?: number;
  keyMax?: number;
  keyWindowMs?: number;
};

/**
 * Retourne true si une limite est franchie (l'appelant DOIT alors refuser l'action).
 * Deux fenêtres : par IP (anti-attaquant qui balaye plusieurs tokens) et par clé métier
 * (anti-spam d'un même dossier / d'une même adresse cible).
 */
export async function actionRateLimited(
  scope: string,
  businessKey: string,
  opts: RateOpts = {}
): Promise<boolean> {
  const ip = await getActionClientIp();
  const byIp = checkRateLimit(`${scope}:ip:${ip}`, {
    windowMs: opts.ipWindowMs ?? 60_000,
    max: opts.ipMax ?? 10,
  });
  const byKey = checkRateLimit(`${scope}:key:${(businessKey || 'unknown').toLowerCase()}`, {
    windowMs: opts.keyWindowMs ?? 10 * 60_000,
    max: opts.keyMax ?? 15,
  });
  return !byIp.allowed || !byKey.allowed;
}
