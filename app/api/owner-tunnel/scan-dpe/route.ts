import { NextRequest, NextResponse } from 'next/server';
import { scanDPE } from '../../../../lib/owner-tunnel/dpe-scanner';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
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
    console.error('owner-tunnel scan-dpe:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erreur scan DPE' }, { status: 500 });
  }
}
