/**
 * Garde d'authentification partagée pour les Server Actions (re-audit V1 — 3e passe).
 * Chaque export d'un fichier `'use server'` est un endpoint POST public : il faut
 * dériver l'identité de l'appelant de la SESSION, jamais d'un paramètre client.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

/** Email de la session courante (minuscule), ou null si non authentifié. */
export async function getSessionEmail(): Promise<string | null> {
  try {
    const session: any = await getServerSession(authOptions as any);
    const email: string | undefined = session?.user?.email?.toLowerCase();
    return email || null;
  } catch {
    return null;
  }
}

/** Vrai si une session existe et que son email correspond à `userEmail`. */
export async function sessionOwnsEmail(userEmail: string | undefined | null): Promise<boolean> {
  if (!userEmail) return false;
  const sessionEmail = await getSessionEmail();
  return !!sessionEmail && sessionEmail === String(userEmail).toLowerCase();
}
