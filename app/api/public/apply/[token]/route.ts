import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { logger } from '@/lib/server-logger';
import Property from '@/models/Property';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    await connectDiditDb();

    const { token } = await params;
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
