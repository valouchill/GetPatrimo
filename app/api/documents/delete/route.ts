import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
    }

    // Extraire le chemin du fichier depuis l'URL
    // L'URL est généralement de la forme /uploads/candidats/xxx/filename.pdf
    let filePath: string;
    
    if (url.startsWith('/uploads/')) {
      // Chemin relatif
      filePath = path.join(process.cwd(), url);
    } else if (url.startsWith('http')) {
      // URL complète - extraire le chemin
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

    // Vérifier que le fichier existe
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
