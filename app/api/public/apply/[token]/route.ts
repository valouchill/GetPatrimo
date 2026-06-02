import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Property from '@/models/Property';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Passeport Locatif universel (codeless) : auto-candidature sans bien.
    // Court-circuit AVANT toute requête DB (un self-token n'a aucun bien associé).
    // Tout autre token introuvable garde le 404 (non-régression du flux invité).
    if (token.startsWith('PT-SELF-')) {
      return NextResponse.json({ property: null, universal: true });
    }

    await connectDiditDb();
    const property = await Property.findOne({ applyToken: token }).lean();

    if (!property) {
      return NextResponse.json({ msg: 'Lien invalide' }, { status: 404 });
    }

    return NextResponse.json({ property });
  } catch (error: any) {
    logger.error('GET /api/public/apply/[token]', { error: error instanceof Error ? error.message : error });
    return NextResponse.json(
      { msg: 'Erreur serveur', error: error?.message || 'unknown_error' },
      { status: 500 }
    );
  }
}
