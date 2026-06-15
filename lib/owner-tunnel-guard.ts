import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

/**
 * Garde partagée des routes /api/owner-tunnel/* (proxys LLM GPT-4o).
 *
 * Sécurité (pentest ChatGPT P2) : le middleware Next bloque déjà l'anonyme (401), mais les
 * handlers n'avaient AUCUN contrôle de rôle ni de quota PAR UTILISATEUR — un compte locataire
 * connecté pouvait déclencher GPT-4o, et le rate-limit Express n'était que par IP (rotable).
 * Cette garde ajoute, en défense en profondeur :
 *   1. exigence d'un rôle propriétaire (owner/admin/superadmin) → 403 pour un locataire ;
 *   2. un quota PAR UTILISATEUR (clé = userId, pas l'IP) → 429.
 */
const OWNER_ROLES = new Set(['owner', 'admin', 'superadmin']);

export type OwnerTunnelGuardResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; response: NextResponse };

export async function guardOwnerTunnel(
  request: NextRequest,
  { max = 20, windowMs = 60_000 }: { max?: number; windowMs?: number } = {}
): Promise<OwnerTunnelGuardResult> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }

  const role = String((token as { role?: string }).role || 'owner');
  if (!OWNER_ROLES.has(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accès réservé aux propriétaires.' }, { status: 403 }),
    };
  }

  const userId = String((token as { id?: string }).id || token.sub || 'unknown');
  const { allowed } = checkRateLimit(`owner-tunnel-user:${userId}`, { windowMs, max });
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Trop de requêtes, réessayez dans une minute.' },
        { status: 429 }
      ),
    };
  }

  return { ok: true, userId, role };
}
