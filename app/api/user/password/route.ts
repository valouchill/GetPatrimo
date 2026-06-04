import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { auditLog } from '@/lib/services/audit';
import { logger } from '@/lib/server-logger';

 
const bcrypt = require('bcryptjs');
 
const User = require('@/models/User');

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
    if (!newPassword || !PASSWORD_REGEX.test(newPassword)) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre et 1 caractère spécial' },
        { status: 400 }
      );
    }

    await connectDiditDb();
    const user = await User.findOne({ email: session.user.email }).select('+password');
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // If user has existing password, verify current one
    if (user.password && user.password.startsWith('$2')) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Le mot de passe actuel est requis' },
          { status: 400 }
        );
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return NextResponse.json(
          { error: 'Le mot de passe actuel est incorrect' },
          { status: 400 }
        );
      }
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    await auditLog({ userId: String(user._id), action: 'PASSWORD_CHANGED' });

    return NextResponse.json({ success: true, message: 'Mot de passe mis à jour' });
  } catch (error) {
    logger.error('[password POST]', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
