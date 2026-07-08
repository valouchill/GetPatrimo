import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { withAdmin, logAdminAction, AdminHttpError } from '@/lib/auth-admin';
import { PilotGrantCreateSchema } from '@/lib/validations/admin';

const User = require('@/models/User');
const Property = require('@/models/Property');
const Application = require('@/models/Application');
const PilotGrant = require('@/models/PilotGrant');

/**
 * /api/admin/pilots — gestion des pilotes B2B (superadmin).
 *
 * POST { email, audits? } : octroie X audits offerts (défaut 10) sur TOUS les
 * biens non archivés du compte — mêmes sémantiques que scripts/grant-pilot.sh :
 * managed=true, tier élevé à PREMIUM minimum (jamais rétrogradé), quota += X.
 * Trace l'octroi dans PilotGrant (date de début) + AdminAuditLog.
 *
 * GET : liste des pilotes (un par compte) avec audits offerts cumulés, date du
 * 1er octroi, date du 1er et du dernier audit réellement lancé (aiAuditV2 sur
 * les candidatures des biens du compte, démo exclue) et consommation quota.
 */

const TIER_ORDER = ['FREE', 'ESSENTIAL', 'PREMIUM', 'MAX'];
const higherTier = (a: string, b: string): string =>
  TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;

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
    if (!user) {
      throw new AdminHttpError(
        404,
        "Aucun compte avec cet email — l'agence doit d'abord créer son compte (gratuit).",
      );
    }

    const properties = await Property.find({ user: user._id, archived: { $ne: true } })
      .select('tier dossiersQuota managed address name')
      .lean();
    if (!properties.length) {
      throw new AdminHttpError(
        400,
        "Ce compte n'a aucun bien — demandez à l'agence de créer son premier bien (ou créez-le avec elle en démo), puis relancez l'octroi.",
      );
    }

    // Tier dépendant de la valeur courante → une écriture par bien (volumes pilote : quelques biens).
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

    // Un pilote = un compte : cumule les grants (octroi initial + extensions).
    const byUser = new Map<
      string,
      { email: string; totalAudits: number; grantedAt: Date; lastGrantAt: Date; grants: number }
    >();
    for (const g of grants as any[]) {
      const key = String(g.user);
      const row = byUser.get(key);
      if (row) {
        row.totalAudits += g.audits;
        row.lastGrantAt = g.createdAt;
        row.grants += 1;
      } else {
        byUser.set(key, {
          email: g.email,
          totalAudits: g.audits,
          grantedAt: g.createdAt,
          lastGrantAt: g.createdAt,
          grants: 1,
        });
      }
    }
    const userIds = Array.from(byUser.keys());

    // État quota par compte (source de vérité de la consommation).
    const props = await Property.find({ user: { $in: userIds }, archived: { $ne: true } })
      .select('user dossiersQuota dossiersAnalyzedCount')
      .lean();
    const propsByUser = new Map<string, { quota: number; consumed: number; count: number; ids: any[] }>();
    for (const p of props as any[]) {
      const key = String(p.user);
      const row = propsByUser.get(key) || { quota: 0, consumed: 0, count: 0, ids: [] };
      row.quota += p.dossiersQuota || 0;
      row.consumed += p.dossiersAnalyzedCount || 0;
      row.count += 1;
      row.ids.push(p._id);
      propsByUser.set(key, row);
    }

    // Dates du 1er/dernier audit réel : aiAuditV2.cachedAt sur les candidatures
    // des biens du compte (démo/dossier exemple exclus via meta.isSample).
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

    const pilots = userIds
      .map((uid) => {
        const g = byUser.get(uid)!;
        const p = propsByUser.get(uid);
        const a = auditsByUser.get(uid);
        return {
          userId: uid,
          email: g.email,
          grants: g.grants,
          totalAudits: g.totalAudits,
          grantedAt: g.grantedAt,
          lastGrantAt: g.lastGrantAt,
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
