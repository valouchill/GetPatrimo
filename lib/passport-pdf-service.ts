/**
 * passport-pdf-service.ts — Service de génération PDF via WeasyPrint.
 *
 * Pipeline :
 *   1. ViewModel (depuis passportViewModel.js)
 *   2. HTML (depuis lib/passport-html-template.ts)
 *   3. PDF via subprocess Python WeasyPrint (scripts/generate_passport_pdf.py)
 *
 * WeasyPrint est invoqué via child_process en mode pipe :
 *   - HTML envoyé sur stdin
 *   - PDF binaire reçu sur stdout
 *   - Erreurs sur stderr (loggées + propagées)
 *
 * Avantage vs @react-pdf/renderer : HTML/CSS complet (gradients, shadows,
 * border-radius, @page rules) sans dépendre de Chromium.
 *
 * Dépendance container : python3 + weasyprint + cairo + pango + fontconfig
 * (cf. Dockerfile production stage).
 */

import { spawn } from 'child_process';
import path from 'path';
import { buildPassportHtml } from './passport-html-template';
import type { PassportViewModel } from '@/app/components/PassportPDF';

export interface GeneratePassportPdfOptions {
  data: PassportViewModel;
  qrCodeDataUrl: string;
  ownerSignupUrl?: string | null;
  /** Timeout en ms (par défaut 15s — WeasyPrint cold-start inclus) */
  timeoutMs?: number;
}

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'generate_passport_pdf.py');

/**
 * Génère un buffer PDF via WeasyPrint Python subprocess.
 *
 * @throws Error si le subprocess échoue (timeout, exit code non-zero, stderr)
 */
export async function generatePassportPdf({
  data,
  qrCodeDataUrl,
  ownerSignupUrl,
  timeoutMs = 15000,
}: GeneratePassportPdfOptions): Promise<Buffer> {
  const html = buildPassportHtml({ data, qrCodeDataUrl, ownerSignupUrl });

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
      reject(
        new Error(
          `[passport-pdf-service] Timeout après ${timeoutMs}ms lors de la génération WeasyPrint`,
        ),
      );
    }, timeoutMs);

    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));

    proc.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new Error(
          `[passport-pdf-service] Échec spawn python : ${err.message}. Vérifier que python3 et weasyprint sont installés (cf. Dockerfile).`,
        ),
      );
    });

    proc.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const stderr = Buffer.concat(errChunks).toString('utf8').trim();
      if (code !== 0) {
        reject(
          new Error(
            `[passport-pdf-service] WeasyPrint exit code ${code}. stderr: ${stderr || '(vide)'}`,
          ),
        );
        return;
      }

      const pdfBuffer = Buffer.concat(chunks);
      if (pdfBuffer.length === 0) {
        reject(new Error('[passport-pdf-service] PDF généré vide.'));
        return;
      }
      // Validation rapide : un PDF commence par "%PDF-"
      if (!pdfBuffer.subarray(0, 5).toString('utf8').startsWith('%PDF-')) {
        reject(
          new Error(
            `[passport-pdf-service] Sortie invalide (n'est pas un PDF). stderr: ${stderr || '(vide)'}`,
          ),
        );
        return;
      }

      resolve(pdfBuffer);
    });

    // Envoi du HTML sur stdin
    proc.stdin.write(html, 'utf8');
    proc.stdin.end();
  });
}
