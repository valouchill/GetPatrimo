import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import fs from 'fs/promises';
import path from 'path';

import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';

export async function DELETE(request: NextRequest) {
  try {
    // Connexion a la base de donnees
    await connectDiditDb();

    // Verification de l'authentification
    const session = await getServerSession(authOptions as any);
    if (!session) {
      return NextResponse.json({ error: 'Non autorise' }, { status: 401 });
    }

    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
    }

    // Extraire le chemin du fichier depuis l'URL
    // L'URL est generalement de la forme /uploads/candidats/xxx/filename.pdf
    let filePath: string;

    if (url.startsWith('/uploads/')) {
      // Chemin relatif
      filePath = path.join(process.cwd(), url);
    } else if (url.startsWith('http')) {
      // URL complete - extraire le chemin
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      if (pathname.startsWith('/uploads/')) {
        filePath = path.join(process.cwd(), pathname);
      } else {
        return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Format URL non reconnu' }, { status: 400 });
    }

    // Protection contre le path traversal
    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(uploadsDir)) {
      return NextResponse.json({ error: 'Chemin non autorise' }, { status: 403 });
    }

    // Verifier que le fichier existe
    try {
      await fs.access(filePath);
    } catch {
      // Le fichier n'existe pas, considérer comme supprimé
      console.log('[DELETE] Fichier déjà supprimé ou inexistant:', filePath);
      return NextResponse.json({ success: true, message: 'Fichier déjà supprimé' });
    }

    // Supprimer le fichier
    await fs.unlink(filePath);
    console.log('[DELETE] Fichier supprimé:', filePath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE] Erreur suppression fichier:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du fichier' },
      { status: 500 }
    );
  }
}
