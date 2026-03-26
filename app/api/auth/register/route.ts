import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { validateRequest } from '@/lib/validate-request';
import { RegisterSchema } from '@/lib/validations/auth';
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
    const result = validateRequest(RegisterSchema, body);
    if (!result.success) return result.response;

    const email = result.data.email.trim().toLowerCase();
    const password = result.data.password;

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
