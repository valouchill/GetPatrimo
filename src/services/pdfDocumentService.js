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

const SUSPICIOUS_SOFTWARE = [
  'Adobe Photoshop', 'Canva', 'GIMP', 'Paint',
  'Illustrator', 'InDesign', 'Photoshop', 'ImageMagick',
];

const LEGITIMATE_SOFTWARE = [
  'Payfit', 'Sage', 'Cegid', 'Silae', 'ADP', 'Sage Paie',
  'Cegid Paie', 'Silae Paie', 'Microsoft', 'LibreOffice',
  'Apache', 'iText', 'PDFKit',
];

/**
 * Extrait les métadonnées d'un PDF pour détecter le logiciel de création.
 * @param {ArrayBuffer|Uint8Array|Buffer} pdfBuffer
 * @returns {Promise<{creator?:string, producer?:string, creationDate?:string, modificationDate?:string, suspicious:boolean, details:string[]}>}
 */
async function extractPDFMetadata(pdfBuffer) {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = toStableBuffer(pdfBuffer);
    const data = await pdfParse(buffer);

    const metadata = data.info || {};
    const creator = metadata.Creator || metadata.Producer || '';
    const producer = metadata.Producer || '';
    const creatorLower = creator.toLowerCase();
    const producerLower = producer.toLowerCase();

    const isSuspicious = SUSPICIOUS_SOFTWARE.some(sw =>
      creatorLower.includes(sw.toLowerCase()) || producerLower.includes(sw.toLowerCase())
    );
    const isLegitimate = LEGITIMATE_SOFTWARE.some(sw =>
      creatorLower.includes(sw.toLowerCase()) || producerLower.includes(sw.toLowerCase())
    );

    const details = [];
    if (isSuspicious) {
      details.push(`⚠️ PDF créé par un logiciel de retouche: ${creator || producer}`);
      details.push(`Logiciel détecté: ${creator || producer}`);
    } else if (isLegitimate) {
      details.push(`✅ PDF créé par un logiciel légitime: ${creator || producer}`);
    } else if (creator || producer) {
      details.push(`ℹ️ Créateur détecté: ${creator || producer}`);
    }

    return {
      creator: creator || producer || undefined,
      producer: producer || undefined,
      creationDate: metadata.CreationDate || undefined,
      modificationDate: metadata.ModDate || undefined,
      suspicious: isSuspicious,
      details,
    };
  } catch {
    return { suspicious: false, details: ["Impossible d'extraire les métadonnées du PDF"] };
  }
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

module.exports = { extractPDFMetadata, convertPDFToImages };
