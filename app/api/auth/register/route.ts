import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 });
    if (!allowed) {
      return NextResponse.json({ error: 'Trop de tentatives, réessayez dans 1 minute.' }, { status: 429 });
    }

    const body = await req.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 });
    }
    if (!/^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule et 1 chiffre.' },
        { status: 400 }
      );
    }

    await connectDiditDb();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'Un compte existe déjà avec cet email' }, { status: 409 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    await User.create({
      email,
      password: hashed,
      plan: 'FREE',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[register]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
