import path from 'path';
import fs from 'fs';

/**
 * Sécurité (pentest files-1, files-2) — résout un `fileUrl` candidat (potentiellement
 * hostile : path traversal, chemin absolu, URL externe) en chemin absolu CONFINÉ sous
 * `<cwd>/uploads`. Retourne `null` si la source est externe (http/data), s'évade du
 * dossier uploads, ou n'existe pas sur disque.
 */
export function safeUploadsPath(fileUrl: string | undefined | null): string | null {
  const url = String(fileUrl || '');
  if (!url || /^(https?:|data:)/i.test(url)) return null; // externe / inline → pas un fichier local légitime
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');

  // Isole le chemin relatif sous uploads/ : segment après '/uploads/' s'il existe,
  // sinon on retire un préfixe '/uploads/' / '/' éventuel.
  let rel: string;
  const idx = url.indexOf('/uploads/');
  if (idx >= 0) rel = url.slice(idx + '/uploads/'.length);
  else rel = url.replace(/^\/+/, '').replace(/^uploads\//i, '');

  const abs = path.resolve(uploadsRoot, rel);
  if (abs !== uploadsRoot && !abs.startsWith(uploadsRoot + path.sep)) return null; // évasion → refus
  try {
    if (!fs.existsSync(abs)) return null;
  } catch {
    return null;
  }
  return abs;
}
