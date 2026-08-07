/**
 * GET /api/owner/notifications
 *
 * Agrège les notifications "Rapports de l'Auditeur IA" pour l'owner connecté.
 * Sources :
 *   1. ALERTE  — Application.aiAuditV2.resilience.level === 'ALERTE'
 *      OU      — au moins un forensicAudit[].status === 'ALERT'
 *   2. SUCCESS — Property.status === 'CANDIDATE_SELECTION'
 *      (acceptedTenantId set, contractualisation a preparer)
 *   3. INFO    — Application submittedAt < 7 jours AND
 *                aiAuditV2.resilience.level === 'PLATINUM'
 *                (nouveau candidat d'exception)
 *
 * Re-pondéré par recence (plus recent en premier). Plafond 30 notifications.
 *
 * Auth : NextAuth (même pattern que /api/owner/properties).
 * Pas de cache HTTP (live data, frequence de polling cote client : 60s).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Application from '@/models/Application';
import Property from '@/models/Property';

 
const User = require('@/models/User');
const Payment = require('@/models/Payment');

const MAX_NOTIFICATIONS = 30;
const RECENT_DAYS = 7;

type NotificationType = 'ALERT' | 'SUCCESS' | 'INFO';
type NotificationIcon = 'ShieldAlert' | 'FileCheck' | 'Star' | 'Wallet' | 'BellRing';

interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  /** ISO timestamp pour tri client (la 'time' label est calculee server-side) */
  occurredAt: string;
  icon: NotificationIcon;
  color: string;
  /** V7.10 — etat lu/non-lu agrege depuis User.readNotificationIds */
  read: boolean;
}

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email })
      .select('_id')
      .lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH} heure${diffH > 1 ? 's' : ''}`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return `Il y a ${diffD} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function shortName(profile: any): string {
  const first = (profile?.firstName || '').trim();
  const last = (profile?.lastName || '').trim();
  if (first && last) return `${first} ${last.charAt(0).toUpperCase()}.`;
  if (first) return first;
  return 'Candidat anonyme';
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    await connectDiditDb();

    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }

    // V7.10 — read state cote serveur (cross-device)
    const userDoc = (await User.findById(userId)
      .select('readNotificationIds')
      .lean()) as { readNotificationIds?: string[] } | null;
    const readSet = new Set<string>(userDoc?.readNotificationIds || []);

    // 1) Properties de l'owner (non archivées)
    const properties = (await Property.find({
      user: userId,
      archived: { $ne: true },
    })
      .select('_id name address acceptedTenantId status')
      .lean()) as Array<{
      _id: any;
      name?: string;
      address?: string;
      acceptedTenantId?: any;
      status?: string;
    }>;

    const propertyIds = properties.map((p) => p._id);
    const propertyById = new Map(
      properties.map((p) => [String(p._id), p]),
    );

    // 2) Applications avec aiAuditV2 OU submittedAt recent
    const recentCutoff = new Date(Date.now() - RECENT_DAYS * 86_400_000);
    const apps = (await Application.find({
      property: { $in: propertyIds },
      $or: [
        { aiAuditV2: { $ne: null } },
        { submittedAt: { $gte: recentCutoff } },
      ],
    })
      .select('_id profile property submittedAt updatedAt aiAuditV2 status')
      .lean()) as Array<{
      _id: any;
      profile?: any;
      property?: any;
      submittedAt?: Date;
      updatedAt?: Date;
      aiAuditV2?: any;
      status?: string;
    }>;

    const notifications: NotificationDTO[] = [];

    // ─── Sources de notifications ─────────────────────────────────

    for (const app of apps) {
      const prop = propertyById.get(String(app.property));
      const propertyLabel =
        (prop?.name || prop?.address || 'un de vos biens').trim();
      const audit = app.aiAuditV2;
      const auditDate: Date | null = audit?.cachedAt
        ? new Date(audit.cachedAt)
        : null;
      const submittedAt =
        app.submittedAt instanceof Date ? app.submittedAt : null;

      // A. ALERTE — audit V2 indique fraude / dossier en alerte
      if (audit?.resilience?.level === 'ALERTE') {
        const ts = auditDate || submittedAt || new Date();
        notifications.push({
          id: `alert-${String(app._id)}`,
          type: 'ALERT',
          title: 'Alerte Sécurité (Forensic)',
          message: `Le dossier de ${shortName(app.profile)} présente des anomalies graves. Score ${audit.resilience.score}/100 — examen recommandé avant tout engagement.`,
          time: formatRelativeTime(ts),
          occurredAt: ts.toISOString(),
          icon: 'ShieldAlert',
          color: 'text-red-600 bg-red-50',
          read: false, // override applique apres
        });
      } else if (Array.isArray(audit?.ai?.forensicAudit)) {
        // Sub-cas : au moins un controle forensicAudit en ALERT mais level != ALERTE
        const alertChecks = audit.ai.forensicAudit.filter(
          (c: any) => c?.status === 'ALERT',
        );
        if (alertChecks.length > 0) {
          const ts = auditDate || submittedAt || new Date();
          notifications.push({
            id: `forensic-${String(app._id)}`,
            type: 'ALERT',
            title: 'Contrôle forensic en alerte',
            message: `${shortName(app.profile)} — ${alertChecks[0].checkName} : ${alertChecks[0].details}`,
            time: formatRelativeTime(ts),
            occurredAt: ts.toISOString(),
            icon: 'ShieldAlert',
            color: 'text-red-600 bg-red-50',
            read: false,
          });
        }
      }

      // B. INFO — nouveau candidat PLATINUM dépose recemment
      if (
        audit?.resilience?.level === 'PLATINUM' &&
        submittedAt &&
        submittedAt >= recentCutoff
      ) {
        notifications.push({
          id: `platinum-${String(app._id)}`,
          type: 'INFO',
          title: 'Nouveau candidat PLATINUM',
          message: `Un profil d'excellence vient de déposer un dossier pour votre bien « ${propertyLabel} ».`,
          time: formatRelativeTime(submittedAt),
          occurredAt: submittedAt.toISOString(),
          icon: 'Star',
          color: 'text-amber-700 bg-amber-50',
          read: false,
        });
      }
    }

    // C. SUCCESS — Properties en CANDIDATE_SELECTION (bail à préparer)
    for (const prop of properties) {
      if (
        String(prop.status || '').toUpperCase() === 'CANDIDATE_SELECTION' &&
        prop.acceptedTenantId
      ) {
        // Trouver l'application sélectionnée pour personnaliser le message
        const selected = apps.find(
          (a) => String(a._id) === String(prop.acceptedTenantId),
        );
        const candidateName = selected
          ? shortName(selected.profile)
          : 'le candidat sélectionné';
        const ts = (selected?.updatedAt as Date) || new Date();
        notifications.push({
          id: `lease-${String(prop._id)}`,
          type: 'SUCCESS',
          title: 'Bail à préparer',
          message: `Le dossier de ${candidateName} pour « ${prop.name || prop.address || 'votre bien'} » est sélectionné — préparez le bail dès maintenant.`,
          time: formatRelativeTime(ts),
          occurredAt: ts.toISOString(),
          icon: 'FileCheck',
          color: 'text-emerald-700 bg-emerald-50',
          read: false,
        });
      }
    }

    // D. LOYERS — impayés (alerte) et encaissements récents (succès).
    // Prévu au plan du module loyers : sans cette source, le bailleur
    // n'apprenait un impayé que par l'email « critical_alert » à J+45.
    const payments = (await Payment.find({
      owner: userId,
      $or: [
        { status: { $in: ['LATE', 'UNPAID'] } },
        { status: 'CONFIRMED', confirmedAt: { $gte: recentCutoff } },
      ],
    })
      .select('status period amounts property confirmedAt receiptSentAt updatedAt createdAt')
      .lean()) as Array<{
      _id: any;
      status?: string;
      period?: { month?: number; year?: number };
      amounts?: { totalTTC?: number; paidAmount?: number };
      property?: any;
      confirmedAt?: Date;
      receiptSentAt?: Date | null;
      updatedAt?: Date;
      createdAt?: Date;
    }>;

    const MONTHS_FR = ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    for (const pay of payments) {
      const prop = propertyById.get(String(pay.property));
      const propertyLabel = (prop?.name || prop?.address || 'votre bien').trim();
      const periodLabel = `${MONTHS_FR[pay.period?.month || 0] || ''} ${pay.period?.year || ''}`.trim();
      const amount = (pay.amounts?.totalTTC || 0).toLocaleString('fr-FR');

      if (pay.status === 'LATE' || pay.status === 'UNPAID') {
        const ts = (pay.updatedAt as Date) || (pay.createdAt as Date) || new Date();
        notifications.push({
          id: `rent-late-${String(pay._id)}`,
          type: 'ALERT',
          title: pay.status === 'UNPAID' ? 'Loyer impayé (45 j et plus)' : 'Loyer en retard',
          message: `Le loyer de ${periodLabel} (${amount} €) pour « ${propertyLabel} » n'est toujours pas encaissé. Les relances automatiques sont en cours — vous pouvez aussi importer votre relevé pour vérifier.`,
          time: formatRelativeTime(ts),
          occurredAt: ts.toISOString(),
          icon: 'BellRing',
          color: 'text-red-600 bg-red-50',
          read: false,
        });
      } else if (pay.status === 'CONFIRMED' && pay.confirmedAt) {
        const ts = new Date(pay.confirmedAt);
        notifications.push({
          id: `rent-paid-${String(pay._id)}`,
          type: 'SUCCESS',
          title: 'Loyer encaissé',
          message: `Le loyer de ${periodLabel} (${amount} €) pour « ${propertyLabel} » est confirmé${pay.receiptSentAt ? ' — quittance envoyée au locataire' : ''}.`,
          time: formatRelativeTime(ts),
          occurredAt: ts.toISOString(),
          icon: 'Wallet',
          color: 'text-emerald-700 bg-emerald-50',
          read: false,
        });
      }
    }

    // Tri par récence (plus récent en premier) + plafond
    notifications.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const capped = notifications.slice(0, MAX_NOTIFICATIONS);

    // V7.10 — Applique le read state cote serveur (depuis User.readNotificationIds)
    const withReadState = capped.map((n) => ({
      ...n,
      read: readSet.has(n.id),
    }));

    return NextResponse.json(withReadState, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    logger.error('GET /api/owner/notifications', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
