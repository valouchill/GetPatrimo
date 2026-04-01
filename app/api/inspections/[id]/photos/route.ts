import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';
import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Inspection = require('@/models/Inspection');

/**
 * POST /api/inspections/[id]/photos
 * Upload a photo for a specific room in an inspection.
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const roomIndex = Number(formData.get('roomIndex') ?? 0);

  if (!file) {
    return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Seules les images sont acceptées' }, { status: 400 });
  }

  // Limit to 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 });
  }

  await connectDiditDb();
  const user = await User.findOne({ email: (session.user as { email: string }).email }).lean();
  if (!user) return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });

  const inspection = await Inspection.findById(id);
  if (!inspection) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  if (String(inspection.user) !== String(user._id)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  // Save file
  const uploadsDir = path.join(process.cwd(), 'uploads', 'edl', id);
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `room${roomIndex}_${Date.now()}.${ext}`;
  const filePath = path.join(uploadsDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const url = `/uploads/edl/${id}/${fileName}`;

  // Add photo to room
  if (inspection.rooms[roomIndex]) {
    inspection.rooms[roomIndex].photos.push({ url, caption: '', uploadedAt: new Date() });
    await inspection.save();
  }

  return NextResponse.json({ success: true, data: { url, fileName } });
});
