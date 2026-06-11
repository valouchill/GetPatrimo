import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

 
const User = require('@/models/User');
 
const AdminAuditLog = require('@/models/AdminAuditLog');

export type AdminRole = 'admin' | 'superadmin';

export interface AdminUserLite {
  totpEnabled?: boolean;
  _id: any;
  email: string;
  role: AdminRole;
  firstName?: string;
  lastName?: string;
}

export class AdminHttpError extends Error {
  statusCode: number;
  code?: string;
  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function parseAdminEmails(): string[] {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Loads the current session user from DB with role/suspended info.
 * Throws AdminHttpError(401) if no session, (401) if user not found,
 * (403) if suspended.
 */
export async function getSessionUser(): Promise<AdminUserLite> {
  const session: any = await getServerSession(authOptions as any);
  if (!session?.user?.id && !session?.user?.email) {
    throw new AdminHttpError(401, 'Non autorisé');
  }

  await connectDiditDb();

  let user: any = null;
  if (session?.user?.id) {
    user = await User.findById(session.user.id)
      .select('email role firstName lastName suspended totpEnabled')
      .lean();
  }
  if (!user && session?.user?.email) {
    user = await User.findOne({ email: session.user.email })
      .select('email role firstName lastName suspended totpEnabled')
      .lean();
  }
  if (!user?.email) {
    throw new AdminHttpError(401, 'Utilisateur introuvable');
  }
  if (user.suspended) {
    throw new AdminHttpError(403, 'Compte suspendu');
  }
  return user as AdminUserLite;
}

/**
 * Returns the current user if admin or superadmin.
 * Throws AdminHttpError(403) otherwise.
 */
export async function requireAdmin(): Promise<AdminUserLite> {
  const user = await getSessionUser();
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    throw new AdminHttpError(403, 'Accès refusé — admin requis', 'ADMIN_REQUIRED');
  }
  assertAdminTotp(user);
  return user;
}

/**
 * AIPD M3 — MFA obligatoire pour toute action d'administration. Un compte admin sans
 * TOTP actif conserve ses accès « owner » mais doit activer la double authentification
 * (profil → 2FA) avant d'administrer. Évite qu'un simple vol de mot de passe admin
 * donne accès à l'ensemble des dossiers (pièces d'identité, avis fiscaux).
 */
function assertAdminTotp(user: AdminUserLite): void {
  // Kill-switch d'urgence partagé avec l'enforcement TOTP du login (auth-options) :
  // TOTP_ENFORCEMENT_ENABLED=false désactive l'exigence sans redéploiement.
  if (process.env.TOTP_ENFORCEMENT_ENABLED === 'false') return;
  if (!user.totpEnabled) {
    throw new AdminHttpError(
      403,
      'Double authentification (2FA) requise pour l’administration — activez-la dans votre profil puis reconnectez-vous.',
      'ADMIN_2FA_REQUIRED'
    );
  }
}

/**
 * Returns the current user if superadmin. Throws AdminHttpError(403) otherwise.
 */
export async function requireSuperadmin(): Promise<AdminUserLite> {
  const user = await getSessionUser();
  if (user.role !== 'superadmin') {
    throw new AdminHttpError(403, 'Accès refusé — superadmin requis', 'SUPERADMIN_REQUIRED');
  }
  assertAdminTotp(user);
  return user;
}

export function assertNotSelf(actorId: any, targetId: any): void {
  if (String(actorId) === String(targetId)) {
    throw new AdminHttpError(400, 'Action interdite sur votre propre compte', 'CANNOT_TARGET_SELF');
  }
}

/**
 * Convert an AdminHttpError (or generic error) into a NextResponse.
 */
export function adminErrorResponse(err: unknown): NextResponse {
  if (err instanceof AdminHttpError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.statusCode }
    );
  }
  const message = err instanceof Error ? err.message : 'Erreur serveur';
  console.error('[admin] unhandled error:', err);
  return NextResponse.json({ error: message }, { status: 500 });
}

interface LogAdminActionParams {
  actor: AdminUserLite;
  action: string;
  targetType: string;
  targetId?: any;
  before?: unknown;
  after?: unknown;
  note?: string;
  req?: NextRequest | Request;
}

export async function logAdminAction(params: LogAdminActionParams): Promise<void> {
  const { actor, action, targetType, targetId, before, after, note, req } = params;

  let ip = '';
  let userAgent = '';
  if (req) {
    const h = (req as any).headers;
    ip = String(h?.get?.('x-forwarded-for') || h?.get?.('x-real-ip') || '')
      .split(',')[0]
      .trim();
    userAgent = String(h?.get?.('user-agent') || '');
  }

  try {
    await connectDiditDb();
    await AdminAuditLog.create({
      actorId: actor._id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action,
      targetType,
      targetId,
      before: before ?? null,
      after: after ?? null,
      ip,
      userAgent,
      note: note || '',
    });
  } catch (err) {
    console.error('[admin] failed to write audit log:', err);
  }
}

/**
 * Wraps an admin route handler with auth + error handling.
 * Usage: export const GET = withAdmin(async (req, ctx, admin) => { ... });
 */
type AdminHandler = (
  req: NextRequest,
  ctx: any,
  admin: AdminUserLite
) => Promise<NextResponse> | NextResponse;

export function withAdmin(handler: AdminHandler, opts: { superadmin?: boolean } = {}) {
  return async (req: NextRequest, ctx: any): Promise<NextResponse> => {
    try {
      const admin = opts.superadmin ? await requireSuperadmin() : await requireAdmin();
      return await handler(req, ctx, admin);
    } catch (err) {
      return adminErrorResponse(err);
    }
  };
}
