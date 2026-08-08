import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import fs from 'fs';
import path from 'path';


const User = require('@/models/User');

const Property = require('@/models/Property');

const Application = require('@/models/Application');

const Candidature = require('@/models/Candidature');

const Lease = require('@/models/Lease');

const Document = require('@/models/Document');

const Event = require('@/models/Event');
const IdentitySession = require('@/models/IdentitySession');
const Guarantor = require('@/models/Guarantor');
const CoTenant = require('@/models/CoTenant');

const ANON_EMAIL = 'supprime@anonymise.rgpd';
const ANON_STRING = '[SUPPRIMÉ]';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

/**
 * Supprime un fichier uploadé de manière sûre (best-effort).
 * Accepte un `fileUrl` (contenant un segment `/uploads/…` ou préfixé `uploads/`)
 * ou un `relPath` relatif au dossier `uploads`. Garde-fou anti-traversée :
 * on n'unlink que ce qui résout strictement sous UPLOADS_DIR.
 * @returns true si un fichier a effectivement été supprimé.
 */
function safeUnlinkUpload(ref: string | undefined | null): boolean {
  if (!ref || typeof ref !== 'string') return false;
  let abs: string;
  const idx = ref.indexOf('/uploads/');
  if (idx !== -1) {
    abs = path.resolve(process.cwd(), ref.substring(idx + 1)); // 'uploads/…'
  } else if (ref.startsWith('uploads/')) {
    abs = path.resolve(process.cwd(), ref);
  } else {
    abs = path.resolve(UPLOADS_DIR, ref.replace(/^\/+/, '')); // relPath
  }
  if (abs !== UPLOADS_DIR && !abs.startsWith(UPLOADS_DIR + path.sep)) return false;
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      fs.unlinkSync(abs);
      return true;
    }
  } catch (err) {
    logger.warn('[RGPD] Échec suppression fichier', { abs, error: err instanceof Error ? err.message : String(err) });
  }
  return false;
}

/**
 * DELETE /api/user/data
 * RGPD (art. 17) : anonymise le compte et supprime les données personnelles.
 * - Supprime physiquement les fichiers uploadés (pièces d'identité, justificatifs)
 *   AVANT de détruire les enregistrements, pour ne pas laisser de fichiers orphelins.
 * - Anonymise le profil utilisateur (email, nom, téléphone) + bloque le compte.
 * - Supprime les candidatures/applications/documents ; anonymise baux & propriétés.
 * - Garde-fou : exige une confirmation explicite `{ confirm: true }` (action destructive).
 */
export async function DELETE(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Confirmation explicite obligatoire (évite une suppression accidentelle / CSRF).
    let confirmed = false;
    try {
      const body = await request.json();
      confirmed = body?.confirm === true;
    } catch {
      confirmed = false;
    }
    if (!confirmed) {
      return NextResponse.json(
        { error: 'Confirmation requise', code: 'CONFIRMATION_REQUIRED' },
        { status: 400 },
      );
    }

    await connectDiditDb();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const userId = user._id;
    const userEmail = session.user.email;

    // Logger avant suppression
    await Event.create({
      user: userId,
      type: 'RGPD_DELETE',
      meta: new Map([
        ['action', 'delete_personal_data'],
        ['email', userEmail],
        ['date', new Date().toISOString()],
      ]),
    });

    // 0. Supprimer les fichiers physiques AVANT de détruire les enregistrements.
    //    (Sans ça, les pièces d'identité restaient orphelines sur disque : le cron
    //     ne les retrouve plus une fois les Applications/Documents supprimés.)
    let filesDeleted = 0;
    try {
      const [apps, docs, cands] = await Promise.all([
        Application.find({ $or: [{ user: userId }, { userEmail }] }).select('documents').lean(),
        Document.find({ user: userId }).select('relPath').lean(),
        Candidature.find({ user: userId }).select('docs').lean(),
      ]);
      for (const a of apps) {
        for (const d of (a.documents || [])) {
          if (safeUnlinkUpload(d?.fileUrl)) filesDeleted += 1;
        }
      }
      for (const d of docs) {
        if (safeUnlinkUpload(d?.relPath)) filesDeleted += 1;
      }
      for (const c of cands) {
        for (const d of (c.docs || [])) {
          if (safeUnlinkUpload(d?.filePath || d?.path)) filesDeleted += 1;
        }
      }
    } catch (err) {
      // Best-effort : on continue l'anonymisation même si un fichier résiste.
      logger.warn('[RGPD] Nettoyage fichiers partiel', { error: err instanceof Error ? err.message : String(err) });
    }

    // 0. Collecter les applyToken du user AVANT toute suppression : c'est la clé
    //    de jointure vers l'identité KYC (IdentitySession/Guarantor/CoTenant),
    //    qui n'étaient JAMAIS effacées → droit à l'effacement (art. 17) inopérant.
    const [userApps, userProps] = await Promise.all([
      Application.find({ $or: [{ user: userId }, { userEmail }] }).select('_id applyToken').lean(),
      Property.find({ user: userId }).select('applyToken').lean(),
    ]);
    const applyTokens = [
      ...userApps.map((a: { applyToken?: string }) => a.applyToken),
      ...userProps.map((p: { applyToken?: string }) => p.applyToken),
    ].filter((t): t is string => Boolean(t));
    const appIds = userApps.map((a: { _id: unknown }) => a._id);

    // 0 bis. Purge de l'identité vérifiée (nom, prénom, date de naissance) :
    //   - IdentitySession et Guarantor par applyToken,
    //   - CoTenant par applicationId (ou applyToken).
    if (applyTokens.length > 0) {
      await IdentitySession.deleteMany({ applyToken: { $in: applyTokens } });
      await Guarantor.deleteMany({ applyToken: { $in: applyTokens } });
    }
    await CoTenant.deleteMany({
      $or: [
        ...(appIds.length ? [{ applicationId: { $in: appIds } }] : []),
        ...(applyTokens.length ? [{ applyToken: { $in: applyTokens } }] : []),
      ],
    });

    // 1. Supprimer les candidatures
    await Candidature.deleteMany({ user: userId });

    // 2. Supprimer les applications
    await Application.deleteMany({
      $or: [{ user: userId }, { userEmail }],
    });

    // 3. Supprimer les documents (metadata — fichiers physiques déjà supprimés ci-dessus)
    await Document.deleteMany({ user: userId });

    // 4. Anonymiser les baux (données contractuelles conservées, données personnelles supprimées)
    await Lease.updateMany(
      { user: userId },
      {
        $set: {
          tenantFirstName: ANON_STRING,
          tenantLastName: ANON_STRING,
          tenantEmail: ANON_EMAIL,
          tenantPhone: '',
          'guarantor.firstName': ANON_STRING,
          'guarantor.lastName': ANON_STRING,
          'guarantor.email': ANON_EMAIL,
          'guarantor.phone': '',
          'guarantor.address': '',
        },
      }
    );

    // 5. Anonymiser les propriétés (supprimer les données sensibles du propriétaire)
    await Property.updateMany(
      { user: userId },
      { $set: { applyToken: null, status: 'ARCHIVED' } }
    );

    // 6. Anonymiser + bloquer l'utilisateur (toute session JWT encore vivante sera
    //    rejetée au prochain refresh grâce à `suspended`).
    await User.updateOne(
      { _id: userId },
      {
        $set: {
          email: `${userId}@anonymise.rgpd`,
          firstName: ANON_STRING,
          lastName: ANON_STRING,
          phone: '',
          password: '',
          magicSignInToken: null,
          magicSignInExpiresAt: null,
          stripeCustomerId: null,
          suspended: true,
          suspendedAt: new Date(),
          suspendedReason: 'Suppression RGPD (auto)',
          deletedAt: new Date(),
        },
      }
    );

    logger.info('[RGPD] Compte anonymisé', { userId: String(userId), filesDeleted });

    return NextResponse.json({
      success: true,
      filesDeleted,
      message: 'Vos données personnelles ont été supprimées et votre compte anonymisé.',
    });
  } catch (err) {
    logger.error('[DELETE /api/user/data] Erreur', { error: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
