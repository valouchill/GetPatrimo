import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import { validateRequest } from '@/lib/validate-request';
import { SignatureUploadSchema } from '@/lib/validations/signature';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

const SIGNATURES_DIR = path.join(process.cwd(), 'uploads', 'signatures');

function ensureDir() {
  if (!fs.existsSync(SIGNATURES_DIR)) fs.mkdirSync(SIGNATURES_DIR, { recursive: true });
}

/**
 * GET /api/owner/signature
 * Retourne la signature courante du proprietaire (image binaire).
 */
export const GET = withErrorHandler(async () => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  if (!user.signatureUrl) {
    return NextResponse.json({ success: true, data: { hasSignature: false, signatureUrl: null } });
  }

  // Servir l'image via l'API authentifiee plutot qu'en acces direct /uploads
  const filePath = path.join(process.cwd(), user.signatureUrl);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ success: true, data: { hasSignature: false, signatureUrl: null } });
  }

  const buffer = fs.readFileSync(filePath);
  const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

  return NextResponse.json({
    success: true,
    data: {
      hasSignature: true,
      signatureDataUrl: base64,
      uploadedAt: user.signatureUploadedAt,
    },
  });
});

/**
 * POST /api/owner/signature
 * Sauvegarde la signature du proprietaire (base64 PNG/JPEG).
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const body = await request.json();
  const result = validateRequest(SignatureUploadSchema, body);
  if (!result.success) return result.response;

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email });
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  ensureDir();

  // Decoder le base64
  const { signatureData } = result.data;
  const base64Part = signatureData.split(',')[1];
  const buffer = Buffer.from(base64Part, 'base64');

  // Valider les magic bytes PNG (89 50 4E 47) ou JPEG (FF D8 FF)
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isJpeg = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  if (!isPng && !isJpeg) {
    return NextResponse.json({ error: 'Format image invalide' }, { status: 400 });
  }

  // Nom unique avec hash pour eviter les acces predictibles
  const hash = crypto.createHash('sha256').update(String(user._id)).digest('hex').slice(0, 12);
  const ext = isPng ? 'png' : 'jpg';
  const fileName = `sig_${hash}.${ext}`;
  const filePath = path.join(SIGNATURES_DIR, fileName);

  // Supprimer l'ancienne si elle existe
  if (user.signatureUrl) {
    const oldPath = path.join(process.cwd(), user.signatureUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  fs.writeFileSync(filePath, buffer);

  const signatureUrl = `/uploads/signatures/${fileName}`;
  user.signatureUrl = signatureUrl;
  user.signatureUploadedAt = new Date();
  await user.save();

  return NextResponse.json({
    success: true,
    data: { signatureUrl, uploadedAt: user.signatureUploadedAt },
  });
});

/**
 * DELETE /api/owner/signature
 * Supprime la signature du proprietaire.
 */
export const DELETE = withErrorHandler(async () => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email });
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouve' }, { status: 404 });

  if (user.signatureUrl) {
    const filePath = path.join(process.cwd(), user.signatureUrl);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  user.signatureUrl = '';
  user.signatureUploadedAt = undefined;
  await user.save();

  return NextResponse.json({ success: true });
});
