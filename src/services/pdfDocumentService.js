/**
 * Service de traitement PDF : extraction de métadonnées et conversion en images.
 * Extrait de app/api/analyze-document-v2/route.ts pour réduire la taille du fichier route.
 */

const {
  buildPdfRenderStrategies,
  cloneStablePdfBytes,
  isDetachedArrayBufferError,
  toStableBuffer,
} = require('../utils/pdfBufferUtils');

// Listes de logiciels : source unique de vérité (surchargeables par env via
// FORENSIC_SUSPICIOUS_SOFTWARE / FORENSIC_LEGITIMATE_SOFTWARE). Inclut iLovePDF /
// Smallpdf / Sejda en plus de la liste historique.
// eslint-disable-next-line global-require
const { getPhase1AuditConfig } = require('../config/phase1Audit');

/**
 * Module A — Forensic PDF (pdf-lib).
 * Lit les métadonnées embarquées (Creator / Producer / CreationDate / ModDate)
 * et détecte une éventuelle altération. Échec de lecture ⇒ fail-safe (aucun flag).
 *
 * @param {ArrayBuffer|Uint8Array|Buffer} pdfBuffer
 * @returns {Promise<{isAltered:boolean, reasons:string[], creator?:string, producer?:string, creationDate?:string, modificationDate?:string}>}
 */
async function analyzePdfForensics(pdfBuffer) {
  const out = {
    isAltered: false,
    reasons: [],
    creator: undefined,
    producer: undefined,
    creationDate: undefined,
    modificationDate: undefined,
  };
  try {
    const { PDFDocument } = await import('pdf-lib');
    const buffer = toStableBuffer(pdfBuffer);
    const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false, ignoreEncryption: true });

    const creator = String(pdfDoc.getCreator() || '').trim();
    const producer = String(pdfDoc.getProducer() || '').trim();
    let creationDate;
    let modDate;
    try { creationDate = pdfDoc.getCreationDate(); } catch { /* champ absent / malformé */ }
    try { modDate = pdfDoc.getModificationDate(); } catch { /* champ absent / malformé */ }

    out.creator = creator || undefined;
    out.producer = producer || undefined;
    out.creationDate = creationDate ? creationDate.toISOString() : undefined;
    out.modificationDate = modDate ? modDate.toISOString() : undefined;

    const { suspiciousSoftware, legitimateSoftware } = getPhase1AuditConfig();
    const haystack = `${creator} ${producer}`.toLowerCase();
    const suspect = (suspiciousSoftware || []).find((sw) => sw && haystack.includes(String(sw).toLowerCase()));
    const legit = (legitimateSoftware || []).find((sw) => sw && haystack.includes(String(sw).toLowerCase()));

    // Règle principale (Module A) : logiciel de retouche ⇒ document altéré.
    if (suspect) {
      out.isAltered = true;
      out.reasons.push(`Logiciel de retouche détecté (${suspect}) : ${creator || producer}`);
    }
    // Signal informatif (non bloquant : de nombreux PDF légitimes sont ré-enregistrés)
    // — modifié nettement après création.
    if (creationDate && modDate && modDate.getTime() - creationDate.getTime() > 24 * 60 * 60 * 1000) {
      out.reasons.push(
        `Document modifié plus de 24 h après sa création (création ${out.creationDate}, modification ${out.modificationDate}).`,
      );
    }
    // Signal informatif : Producer présent sans Creator et non reconnu.
    if (!suspect && !legit && producer && !creator) {
      out.reasons.push(`Producer « ${producer} » sans Creator — origine non identifiée.`);
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Extrait les métadonnées d'un PDF pour détecter le logiciel de création.
 * Conserve la forme de retour historique (`suspicious` / `details`) consommée par
 * la route ; adossée désormais au forensic pdf-lib (Module A).
 *
 * @param {ArrayBuffer|Uint8Array|Buffer} pdfBuffer
 * @returns {Promise<{creator?:string, producer?:string, creationDate?:string, modificationDate?:string, suspicious:boolean, details:string[]}>}
 */
async function extractPDFMetadata(pdfBuffer) {
  const f = await analyzePdfForensics(pdfBuffer);
  return {
    creator: f.creator,
    producer: f.producer,
    creationDate: f.creationDate,
    modificationDate: f.modificationDate,
    suspicious: f.isAltered,
    details: f.reasons,
  };
}

/**
 * Convertit un Buffer PDF en images PNG base64 via pdfjs-dist + canvas.
 * @param {ArrayBuffer|Uint8Array|Buffer} pdfBuffer
 * @param {number} maxPages
 * @param {number} dpi
 * @returns {Promise<string[]>}
 */
async function convertPDFToImages(pdfBuffer, maxPages = 3, dpi = 200) {
  const images = [];
  const stablePdfBytes = toStableBuffer(pdfBuffer);
  const strategies = buildPdfRenderStrategies(dpi);

  for (const strategy of strategies) {
    let loadingTask = null;
    let pdf = null;

    try {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const { createCanvas } = await import('canvas');

      pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.mjs';

      loadingTask = pdfjsLib.getDocument({
        data: cloneStablePdfBytes(stablePdfBytes),
        useSystemFonts: true,
        verbosity: 0,
      });

      const loadedPdf = await loadingTask.promise;
      pdf = loadedPdf;
      const numPages = Math.min(loadedPdf.numPages, maxPages);

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await loadedPdf.getPage(pageNum);
          const scale = strategy.dpi / 72;
          const scaledViewport = page.getViewport({ scale });
          const maxDimension = 5000;

          let viewport = scaledViewport;
          if (scaledViewport.width > maxDimension || scaledViewport.height > maxDimension) {
            const scaleDown = Math.min(maxDimension / scaledViewport.width, maxDimension / scaledViewport.height);
            viewport = page.getViewport({ scale: scale * scaleDown });
          }

          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext('2d');
          await page.render({ canvasContext: context, viewport }).promise;
          images.push(canvas.toDataURL('image/png'));
        } catch (pageError) {
          if (images.length === 0 && pageNum === 1) throw pageError;
        }
      }

      if (images.length > 0) return images;
    } catch (error) {
      if (isDetachedArrayBufferError(error)) {
        console.warn(`⚠️ Pdf.js a detaché le buffer pendant ${strategy.name}, nouvelle tentative...`);
      }
      if (strategy !== strategies[strategies.length - 1]) continue;
      throw new Error(`Impossible de convertir le PDF après ${strategies.length} tentatives: ${error instanceof Error ? error.message : error}`);
    } finally {
      try { pdf?.cleanup?.(); } catch { /* ignore */ }
      try { await pdf?.destroy?.(); } catch { /* ignore */ }
      try { await loadingTask?.destroy?.(); } catch { /* ignore */ }
    }
  }

  throw new Error('Impossible de convertir le PDF. Format non supporté ou PDF corrompu.');
}

module.exports = { extractPDFMetadata, analyzePdfForensics, convertPDFToImages };
