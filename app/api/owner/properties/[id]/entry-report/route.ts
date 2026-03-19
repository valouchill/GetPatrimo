import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import Property from '@/models/Property';
import { MoveInInventoryPDFDocument } from '@/app/components/MoveInInventoryPDF';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

async function resolveUserId(session: any): Promise<string | null> {
  let userId = session?.user?.id;
  if (!userId && session?.user?.email) {
    const user = await User.findOne({ email: session.user.email }).select('_id').lean();
    userId = user?._id?.toString();
  }
  return userId || null;
}

function formatCurrency(value: number | null | undefined) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(numeric);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authOptions as any);
    if (!session?.user?.id && !session?.user?.email) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    await connectDiditDb();
    const userId = await resolveUserId(session);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 401 });
    }

    const { id } = await params;
    const propertyDoc = await Property.findOne({ _id: id, user: userId }).lean();
    if (!propertyDoc) {
      return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 });
    }

    const property = propertyDoc as any;
    const pdfBuffer = await renderToBuffer(
      React.createElement(MoveInInventoryPDFDocument, {
        propertyAddress: property.address || property.name || 'Bien',
        rentLabel: formatCurrency(property.rentAmount),
        chargesLabel: formatCurrency(property.chargesAmount),
        generatedAtLabel: new Intl.DateTimeFormat('fr-FR').format(new Date()),
      }) as any
    );

    const fileName = `Etat_des_lieux_entree_${String(property.address || property.name || 'bien')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 48)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('GET /api/owner/properties/[id]/entry-report', error);
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF' }, { status: 500 });
  }
}
