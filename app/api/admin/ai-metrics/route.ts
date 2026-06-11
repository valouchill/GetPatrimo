/**
 * GET /api/admin/ai-metrics — Suivi de la précision IA (AIPD M10, v1).
 *
 * Calculé à la demande depuis les données existantes (aucune collecte nouvelle) :
 *  - volumes et confiance moyenne par type de document détecté ;
 *  - taux de pièces FLAGGED/REJECTED par type (proxy de sévérité) ;
 *  - « overrides » bailleur : dossiers contenant ≥ 1 pièce signalée mais finalement
 *    RETENUS (proxy de faux positifs) — à examiner lors de la revue trimestrielle ;
 *  - contestations art. 22 (en attente / traitées) et ré-analyses.
 * Tableau de bord UI : V2 — cette API suffit pour la revue trimestrielle.
 */
import { NextResponse } from 'next/server';
import { withAdmin } from '@/lib/auth-admin';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import Property from '@/models/Property';

const Contestation = require('@/models/Contestation');

export const GET = withAdmin(async () => {
  await connectDiditDb();

  // 1) Répartition par type de document détecté (unwind des pièces analysées)
  const byType = await Application.aggregate([
    { $match: { 'documents.0': { $exists: true } } },
    { $unwind: '$documents' },
    {
      $group: {
        _id: { $ifNull: ['$documents.aiAnalysis.documentType', '$documents.type'] },
        count: { $sum: 1 },
        avgConfidence: { $avg: '$documents.aiAnalysis.confidence' },
        avgFraudScore: { $avg: '$documents.aiAnalysis.fraudScore' },
        flagged: {
          $sum: {
            $cond: [{ $in: ['$documents.status', ['FLAGGED', 'NEEDS_REVIEW']] }, 1, 0],
          },
        },
        rejected: { $sum: { $cond: [{ $eq: ['$documents.status', 'REJECTED'] }, 1, 0] } },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 40 },
  ]);

  // 2) Proxy de faux positifs : dossiers avec pièce(s) signalée(s) mais RETENUS par le bailleur.
  const flaggedApps = await Application.find({
    'documents.status': { $in: ['FLAGGED', 'NEEDS_REVIEW', 'REJECTED'] },
  }).select('_id').lean();
  const flaggedIds = flaggedApps.map((a) => a._id);
  const overriddenCount = flaggedIds.length
    ? await Property.countDocuments({ acceptedTenantId: { $in: flaggedIds } })
    : 0;

  // 3) Contestations art. 22 + ré-analyses
  const [contestNew, contestReviewed, reanalyses] = await Promise.all([
    Contestation.countDocuments({ status: 'NEW' }),
    Contestation.countDocuments({ status: 'REVIEWED' }),
    Application.aggregate([
      { $match: { reanalyzeCount: { $gt: 0 } } },
      { $group: { _id: null, apps: { $sum: 1 }, total: { $sum: '$reanalyzeCount' } } },
    ]),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    byDocumentType: byType.map((t) => ({
      documentType: t._id || 'inconnu',
      count: t.count,
      avgConfidence: t.avgConfidence != null ? Number(t.avgConfidence.toFixed(3)) : null,
      avgFraudScore: t.avgFraudScore != null ? Number(t.avgFraudScore.toFixed(3)) : null,
      flagged: t.flagged,
      rejected: t.rejected,
      flagRatePct: t.count ? Number((((t.flagged + t.rejected) / t.count) * 100).toFixed(1)) : 0,
    })),
    falsePositiveProxy: {
      applicationsWithFlaggedDocs: flaggedIds.length,
      acceptedDespiteFlags: overriddenCount,
      note: 'Dossiers retenus malgré des pièces signalées — à examiner en revue trimestrielle (M10).',
    },
    contestations: { pending: contestNew, reviewed: contestReviewed },
    reanalyses: reanalyses[0] ? { applications: reanalyses[0].apps, total: reanalyses[0].total } : { applications: 0, total: 0 },
  });
});
