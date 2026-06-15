import { NextRequest, NextResponse } from 'next/server';
import { scanDPE } from '../../../../lib/owner-tunnel/dpe-scanner';
import { logger } from '@/lib/server-logger';
import { guardOwnerTunnel } from '@/lib/owner-tunnel-guard';

export async function POST(request: NextRequest) {
  try {
    const guard = await guardOwnerTunnel(request);
    if (!guard.ok) return guard.response;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    // Sécurité (audit passe-5) : borne la taille du fichier (10 Mo) — aucun DPE/photo légitime
    // au-delà ; évite un payload massif (DoS mémoire / coût OpenAI).
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (10 Mo max).' }, { status: 413 });
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY manquante' }, { status: 500 });
    const buffer = await file.arrayBuffer();
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    let pdfText: string | undefined;
    if (isPdf) {
      const pdf = (await import('pdf-parse')).default;
      const data = await pdf(Buffer.from(buffer));
      pdfText = data.text || '';
    }
    const dpe = await scanDPE({ buffer, mimeType: file.type || 'image/jpeg', isPdf, pdfText }, apiKey);
    return NextResponse.json({ success: true, dpe });
  } catch (e) {
    logger.error('owner-tunnel scan-dpe', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: "Erreur lors de l'analyse du DPE." }, { status: 500 });
  }
}
