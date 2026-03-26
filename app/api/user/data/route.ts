import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Property = require('@/models/Property');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Application = require('@/models/Application');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Candidature = require('@/models/Candidature');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Lease = require('@/models/Lease');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Document = require('@/models/Document');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Event = require('@/models/Event');

const ANON_EMAIL = 'supprime@anonymise.rgpd';
const ANON_STRING = '[SUPPRIMÉ]';

/**
 * DELETE /api/user/data
 * RGPD : anonymise le compte et supprime les données personnelles.
 * - Anonymise le profil utilisateur (email, nom, téléphone)
 * - Supprime les candidatures et documents
 * - Anonymise les baux (conserve les données contractuelles, supprime les données personnelles)
 * - Log l'action
 */
export async function DELETE() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    await connectDiditDb();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const userId = user._id;

    // Logger avant suppression
    await Event.create({
      user: userId,
      type: 'RGPD_DELETE',
      meta: new Map([
        ['action', 'delete_personal_data'],
        ['email', session.user.email],
        ['date', new Date().toISOString()],
      ]),
    });

    // 1. Supprimer les candidatures
    await Candidature.deleteMany({ user: userId });

    // 2. Supprimer les applications
    await Application.deleteMany({
      $or: [{ user: userId }, { userEmail: session.user.email }],
    });

    // 3. Supprimer les documents (metadata — les fichiers physiques seront nettoyés par le cron)
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

    // 6. Anonymiser l'utilisateur
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
          deletedAt: new Date(),
        },
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Vos données personnelles ont été supprimées et votre compte anonymisé.',
    });
  } catch (err) {
    console.error('[DELETE /api/user/data] Erreur:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
