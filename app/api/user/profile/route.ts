import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

export async function GET() {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    await connectDiditDb();
    const user = await User.findOne({ email: session.user.email })
      .select('firstName lastName email phone address zipCode city plan credits stripeCustomerId oauthProvider')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        zipCode: user.zipCode || '',
        city: user.city || '',
        plan: user.plan || 'FREE',
        hasPassword: false, // We don't expose this, will check separately
        isOAuth: Boolean(user.oauthProvider),
      },
    });
  } catch (error) {
    logger.error('[profile GET]', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { firstName, lastName, phone, address, zipCode, city } = body;

    await connectDiditDb();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Update only provided fields
    if (firstName !== undefined) user.firstName = String(firstName).trim();
    if (lastName !== undefined) user.lastName = String(lastName).trim();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (address !== undefined) user.address = String(address).trim();
    if (zipCode !== undefined) user.zipCode = String(zipCode).trim();
    if (city !== undefined) user.city = String(city).trim();

    await user.save();

    return NextResponse.json({
      success: true,
      data: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        zipCode: user.zipCode,
        city: user.city,
      },
    });
  } catch (error: any) {
    if (error?.name === 'ValidationError') {
      const messages = Object.values(error.errors || {}).map((e: any) => e.message);
      return NextResponse.json({ error: messages.join(', ') || 'Données invalides' }, { status: 400 });
    }
    logger.error('[profile PUT]', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
