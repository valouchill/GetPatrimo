/**
 * renderHtmlToPdf — rendu HTML → PDF via WeasyPrint (subprocess Python).
 *
 * Brique PARTAGÉE, extraite de lib/passport-pdf-service.ts : le script
 * `scripts/generate_passport_pdf.py` est agnostique (HTML sur stdin, PDF sur
 * stdout), seul l'appelant était couplé au passeport.
 *
 * Utilisée par : passeport locatif, certificat de signature de bail, état des
 * lieux (photos résolues par WeasyPrint via base_url).
 *
 * Runtime container : python3 + weasyprint installés (cf. Dockerfile).
 */

import { spawn } from 'child_process';
import path from 'path';

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'generate_passport_pdf.py');

export interface RenderHtmlToPdfOptions {
  /** Timeout du subprocess (défaut 15 s — cold start WeasyPrint inclus). */
  timeoutMs?: number;
  /** Préfixe des messages d'erreur (facilite le diagnostic par module). */
  label?: string;
}

/**
 * @throws Error si le subprocess échoue (timeout, exit non-zero, sortie non-PDF).
 */
export async function renderHtmlToPdf(
  html: string,
  { timeoutMs = 15000, label = 'pdf-render' }: RenderHtmlToPdfOptions = {},
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [SCRIPT_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
      // Désactive le buffering Python pour récupérer stderr en temps réel
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    });

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      proc.kill('SIGKILL');
      reject(new Error(`[${label}] Timeout après ${timeoutMs}ms lors de la génération WeasyPrint`));
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `[${label}] Échec spawn python : ${err.message}. Vérifier que python3 et weasyprint sont installés (cf. Dockerfile).`,
        ),
      );
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const stderr = Buffer.concat(errChunks).toString('utf8').trim();
      if (code !== 0) {
        reject(new Error(`[${label}] WeasyPrint exit code ${code}. stderr: ${stderr || '(vide)'}`));
        return;
      }

      const pdfBuffer = Buffer.concat(chunks);
      if (pdfBuffer.length === 0) {
        reject(new Error(`[${label}] PDF généré vide.`));
        return;
      }
      if (!pdfBuffer.subarray(0, 5).toString('utf8').startsWith('%PDF-')) {
        reject(
          new Error(`[${label}] Sortie invalide (n'est pas un PDF). stderr: ${stderr || '(vide)'}`),
        );
        return;
      }

      resolve(pdfBuffer);
    });

    proc.stdin.write(html, 'utf8');
    proc.stdin.end();
  });
}
