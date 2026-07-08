import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { PilotGrantCreateSchema } from '@/lib/validations/admin';
import { sendMailWithRetry } from '@/lib/email-retry';
import { logger } from '@/lib/server-logger';

const User = require('@/models/User');
const Property = require('@/models/Property');
const Application = require('@/models/Application');
const PilotGrant = require('@/models/PilotGrant');

/**
 * /api/admin/pilots — gestion des pilotes B2B (superadmin).
 *
 * POST { email, audits? } :
 *  - compte existant avec ≥1 bien → octroi IMMÉDIAT sur tous les biens non
 *    archivés (managed=true, tier≥PREMIUM, quota += X — sémantiques de
 *    scripts/grant-pilot.sh) ;
 *  - pas de compte (ou aucun bien) → grant PENDING + email d'invitation à
 *    l'agence ; l'application est automatique à la création du premier bien
 *    (hook dans POST /api/owner/properties).
 *
 * GET : liste des pilotes (un par email) avec statut, audits offerts cumulés,
 * date du 1er octroi, 1er/dernier audit réel (aiAuditV2, démo exclue) et
 * consommation quota.
 */

const TIER_ORDER = ['FREE', 'ESSENTIAL', 'PREMIUM', 'MAX'];
const higherTier = (a: string, b: string): string =>
  TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;

function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://maisonpatrimo.com').replace(/\/$/, '');
}

/** Email d'invitation pilote (grant PENDING) — fire-and-forget côté route. */
async function sendPilotInvitationEmail(email: string, audits: number): Promise<boolean> {
  const BREVO_USER = process.env.BREVO_USER;
  const BREVO_PASS = process.env.BREVO_PASS;
  if (!BREVO_USER || !BREVO_PASS) {
    logger.warn('pilot-invite: BREVO non configuré, email non envoyé', { email });
    return false;
  }
  const nodemailer = (await import('nodemailer')).default;
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: BREVO_USER, pass: BREVO_PASS },
  });
  const registerUrl = `${getBaseUrl()}/auth/register?role=owner&utm_source=pilote-invite`;
  return sendMailWithRetry(
    transporter,
    {
      from: process.env.MAIL_FROM || '"Maison Patrimo" <no-reply@maisonpatrimo.com>',
      to: email,
      replyTo: process.env.MAIL_REPLY_TO || 'contact@maisonpatrimo.com',
      subject: `🎁 Vos ${audits} audits forensic offerts vous attendent — Maison Patrimo`,
      html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:22px;margin:0 0 4px;">Maison Patrimo</h1>
  <p style="font-size:12px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;margin:0 0 24px;">Pilote professionnel</p>
  <p style="font-size:15px;line-height:1.7;">Bonjour,</p>
  <p style="font-size:15px;line-height:1.7;">
    <strong>${audits} audits forensic anti-fraude</strong> ont été offerts à votre agence pour tester
    Maison Patrimo sur vos vrais dossiers locataires : détection de faux bulletins (métadonnées,
    cohérence des cumuls, recoupement fiscal), score par candidat et comparaison par lot.
  </p>
  <p style="font-size:15px;line-height:1.7;">
    Pour en profiter : créez votre compte <strong>avec cette adresse email (${email})</strong>,
    ajoutez votre premier lot — vos audits offerts s'activeront automatiquement.
  </p>
  <p style="text-align:center;margin:28px 0;">
    <a href="${registerUrl}" style="background:#064e3b;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block;">
      Créer mon compte et activer mes audits
    </a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#64748b;">
    Sans engagement — le pilote sert à vous faire une opinion sur vos propres dossiers.
    Une question ? Répondez simplement à cet email.
  </p>
</div>`,
    },
    { label: 'pilot-invite' },
  );
}

export const POST = withAdmin(
  async (req: NextRequest, _ctx: any, admin) => {
    await connectDiditDb();
    const body = await req.json().catch(() => ({}));
    const parsed = PilotGrantCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AdminHttpError(400, 'Données invalides (email + audits entre 1 et 500)');
    }
    const { email, audits } = parsed.data;

    const user = await User.findOne({ email }).select('email role').lean();
    const properties = user
      ? await Property.find({ user: user._id, archived: { $ne: true } })
          .select('tier dossiersQuota managed')
          .lean()
      : [];

    // ── Cas différé : pas de compte, ou compte sans bien → PENDING + invitation.
    if (!user || !properties.length) {
      const grant = await PilotGrant.create({
        user: user ? user._id : null,
        email,
        audits,
        status: 'PENDING',
        grantedBy: admin.email,
      });
      const emailSent = await sendPilotInvitationEmail(email, audits);
      await logAdminAction({
        actor: admin,
        action: 'pilot.grant.pending',
        targetType: 'User',
        targetId: user ? String(user._id) : email,
        after: { email, audits, accountExists: !!user, emailSent },
        req,
      });
      return NextResponse.json({
        ok: true,
        pending: true,
        grantId: String(grant._id),
        email,
        audits,
        emailSent,
        message: user
          ? `Compte sans bien : les ${audits} audits s'appliqueront à la création de son premier bien. Invitation envoyée${emailSent ? '' : ' (⚠️ échec email — relancez manuellement)'}.`
          : `Pas encore de compte : invitation envoyée à ${email}. Les ${audits} audits s'activeront à l'inscription + création du premier bien${emailSent ? '' : ' (⚠️ échec email — relancez manuellement)'}.`,
      });
    }

    // ── Cas immédiat : compte + biens → octroi tout de suite.
    await Property.bulkWrite(
      properties.map((p: any) => ({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: { tier: higherTier(p.tier || 'FREE', 'PREMIUM'), managed: true },
            $inc: { dossiersQuota: audits },
          },
        },
      })),
    );

    const grant = await PilotGrant.create({
      user: user._id,
      email,
      audits,
      status: 'APPLIED',
      appliedAt: new Date(),
      propertiesCount: properties.length,
      grantedBy: admin.email,
    });

    await logAdminAction({
      actor: admin,
      action: 'pilot.grant',
      targetType: 'User',
      targetId: String(user._id),
      after: { email, audits, properties: properties.length },
      req,
    });

    return NextResponse.json({
      ok: true,
      pending: false,
      grantId: String(grant._id),
      email,
      audits,
      properties: properties.length,
    });
  },
  { superadmin: true },
);

export const GET = withAdmin(
  async (_req: NextRequest) => {
    await connectDiditDb();

    const grants = await PilotGrant.find().sort({ createdAt: 1 }).lean();
    if (!grants.length) return NextResponse.json({ pilots: [] });

    // Un pilote = un email (les grants PENDING n'ont pas forcément de user).
    const byEmail = new Map<
      string,
      {
        email: string;
        userId: string | null;
        totalAudits: number;
        pendingAudits: number;
        grantedAt: Date;
        lastGrantAt: Date;
        grants: number;
      }
    >();
    for (const g of grants as any[]) {
      const key = g.email;
      const row = byEmail.get(key) || {
        email: key,
        userId: null,
        totalAudits: 0,
        pendingAudits: 0,
        grantedAt: g.createdAt,
        lastGrantAt: g.createdAt,
        grants: 0,
      };
      row.totalAudits += g.audits;
      if (g.status === 'PENDING') row.pendingAudits += g.audits;
      if (g.user) row.userId = String(g.user);
      row.lastGrantAt = g.createdAt;
      row.grants += 1;
      byEmail.set(key, row);
    }

    // Comptes désormais inscrits mais dont le grant PENDING n'a pas de user lié.
    const unlinkedEmails = Array.from(byEmail.values())
      .filter((r) => !r.userId)
      .map((r) => r.email);
    if (unlinkedEmails.length) {
      const users = await User.find({ email: { $in: unlinkedEmails } })
        .select('email')
        .lean();
      for (const u of users as any[]) {
        const row = byEmail.get(u.email);
        if (row) row.userId = String(u._id);
      }
    }

    const userIds = Array.from(byEmail.values())
      .map((r) => r.userId)
      .filter(Boolean) as string[];

    // État quota par compte (source de vérité de la consommation).
    const props = userIds.length
      ? await Property.find({ user: { $in: userIds }, archived: { $ne: true } })
          .select('user dossiersQuota dossiersAnalyzedCount')
          .lean()
      : [];
    const propsByUser = new Map<string, { quota: number; consumed: number; count: number }>();
    for (const p of props as any[]) {
      const key = String(p.user);
      const row = propsByUser.get(key) || { quota: 0, consumed: 0, count: 0 };
      row.quota += p.dossiersQuota || 0;
      row.consumed += p.dossiersAnalyzedCount || 0;
      row.count += 1;
      propsByUser.set(key, row);
    }

    // Dates du 1er/dernier audit réel (démo exclue via meta.isSample).
    const allPropIds = (props as any[]).map((p) => p._id);
    const audits = allPropIds.length
      ? await Application.aggregate([
          {
            $match: {
              property: { $in: allPropIds },
              'aiAuditV2.cachedAt': { $exists: true },
              'aiAuditV2.meta.isSample': { $ne: true },
            },
          },
          {
            $group: {
              _id: '$property',
              first: { $min: '$aiAuditV2.cachedAt' },
              last: { $max: '$aiAuditV2.cachedAt' },
              count: { $sum: 1 },
            },
          },
        ])
      : [];
    const propOwner = new Map((props as any[]).map((p) => [String(p._id), String(p.user)]));
    const auditsByUser = new Map<string, { first: Date | null; last: Date | null; count: number }>();
    for (const a of audits as any[]) {
      const key = propOwner.get(String(a._id));
      if (!key) continue;
      const row = auditsByUser.get(key) || { first: null, last: null, count: 0 };
      if (!row.first || a.first < row.first) row.first = a.first;
      if (!row.last || a.last > row.last) row.last = a.last;
      row.count += a.count;
      auditsByUser.set(key, row);
    }

    const pilots = Array.from(byEmail.values())
      .map((r) => {
        const p = r.userId ? propsByUser.get(r.userId) : undefined;
        const a = r.userId ? auditsByUser.get(r.userId) : undefined;
        // INVITED : pas de compte · PENDING_PROPERTY : compte sans bien (grant en
        // attente) · ACTIVE : grant appliqué.
        const status = !r.userId
          ? 'INVITED'
          : r.pendingAudits > 0
            ? 'PENDING_PROPERTY'
            : 'ACTIVE';
        return {
          email: r.email,
          userId: r.userId,
          status,
          grants: r.grants,
          totalAudits: r.totalAudits,
          pendingAudits: r.pendingAudits,
          grantedAt: r.grantedAt,
          lastGrantAt: r.lastGrantAt,
          properties: p?.count ?? 0,
          quota: p?.quota ?? 0,
          consumed: p?.consumed ?? 0,
          auditedApplications: a?.count ?? 0,
          firstAuditAt: a?.first ?? null,
          lastAuditAt: a?.last ?? null,
        };
      })
      .sort((x, y) => new Date(y.grantedAt).getTime() - new Date(x.grantedAt).getTime());

    return NextResponse.json({ pilots });
  },
  { superadmin: true },
);
