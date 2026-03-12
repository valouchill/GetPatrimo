import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectDiditDb } from '@/app/api/didit/db';
import Property from '@/models/Property';

/**
 * PATCH /api/owner/properties/[id]
 * Met à jour les champs modifiables d'un bien (adresse, surface, loyer).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.address !== undefined) {
      updates.address = body.address;
      updates.name = body.address.slice(0, 80);
    }
    if (body.surfaceM2 !== undefined) updates.surfaceM2 = Number(body.surfaceM2) || null;
    if (body.rentAmount !== undefined) updates.rentAmount = Number(body.rentAmount) || 0;
    if (body.archived !== undefined) updates.archived = Boolean(body.archived);

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
    }

    const property = await Property.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!property) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, property });
  } catch (e) {
    console.error('PATCH /api/owner/properties/[id]', e);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
