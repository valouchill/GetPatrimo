// Controller pour l'analyse de documents avec IA
const path = require('path');
const fs = require('fs');
const Document = require('../../models/Document');
const Property = require('../../models/Property');
const Candidature = require('../../models/Candidature');
const { uploadsDir } = require('../config/app');
const { extractDocumentData } = require('../services/aiService');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const { computePatrimoCoreScore } = require('../services/scoringService');
const { logEvent } = require('../services/eventService');

/**
 * Analyse un document avec l'IA et calcule le score
 * POST /api/documents/analyze
 */
async function analyzeDocument(req, res) {
  try {
    const { documentId, candidatureId } = req.body || {};

    if (!documentId) {
      return res.status(400).json({ msg: 'ID document manquant' });
    }

    // Récupère le document
    const doc = await Document.findOne({ 
      _id: documentId, 
      user: req.user.id 
    });

    if (!doc) {
      return res.status(404).json({ msg: 'Document introuvable' });
    }

    // Vérifie que le fichier existe
    const filePath = path.join(uploadsDir, doc.relPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ msg: 'Fichier introuvable sur le serveur' });
    }

    // Vérifie le type de fichier (PDF ou image)
    const ext = path.extname(doc.filename || doc.originalName || '').toLowerCase();
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
    if (!allowedExts.includes(ext)) {
      return res.status(400).json({ msg: 'Type de fichier non supporté (PDF/PNG/JPEG uniquement)' });
    }

    // Extraction des données via IA
    let extractedData = null;
    try {
      // L'API OpenAI Vision ne supporte que les images, pas les PDFs
      // Pour les PDFs (diagnostics), on retourne null et le frontend utilisera le fallback
      if (ext === '.pdf') {
        console.log('📄 PDF détecté : l\'API Vision ne supporte pas les PDFs, extraction basique uniquement');
        extractedData = null;
      } else {
        extractedData = await extractDocumentData(filePath);
      }
    } catch (error) {
      console.error('Erreur extraction IA:', error);
      
      // Gestion spécifique des erreurs MIME (PDF envoyé à l'API Vision)
      if (error.message.includes('Invalid MIME type') || error.message.includes('Only image types')) {
        // L'API Vision ne supporte pas les PDFs, c'est normal pour les diagnostics
        extractedData = null;
      } else if (error.message.includes('illisible') || error.message.includes('corrompu')) {
        return res.status(400).json({ 
          msg: error.message || 'Le document est illisible ou corrompu',
          error: 'DOCUMENT_UNREADABLE'
        });
      } else if (error.message.includes('OPENAI_API_KEY')) {
        return res.status(500).json({ 
          msg: 'Service IA non configuré',
          error: 'AI_SERVICE_UNAVAILABLE'
        });
      } else {
        // Pour les autres erreurs, on retourne quand même un résultat partiel (null)
        // Le frontend utilisera le fallback (extraction basique depuis le nom de fichier)
        extractedData = null;
      }
    }

    // Si une candidature est fournie, calcule le score
    let scoringResult = null;
    if (candidatureId) {
      try {
        const candidature = await Candidature.findOne({ 
          _id: candidatureId, 
          user: req.user.id 
        });

        if (!candidature) {
          return res.status(404).json({ msg: 'Candidature introuvable' });
        }

        const property = await Property.findOne({ 
          _id: candidature.property, 
          user: req.user.id 
        });

        if (!property) {
          return res.status(404).json({ msg: 'Bien introuvable' });
        }

        // Calcule le score avec les données extraites
        scoringResult = computePatrimoCoreScore({
          cand: candidature,
          property,
          extractedData
        });

        // Met à jour la candidature avec le score
        candidature.scoring = {
          version: scoringResult.version,
          total: scoringResult.total,
          grade: scoringResult.grade,
          ratio: scoringResult.ratio,
          breakdown: scoringResult.breakdown,
          flags: scoringResult.flags
        };
        candidature.scoredAt = new Date();

        // Met à jour les données si elles sont meilleures que les données déclaratives
        if (extractedData.netSalary > 0 && (!candidature.monthlyNetIncome || extractedData.netSalary > candidature.monthlyNetIncome)) {
          candidature.monthlyNetIncome = extractedData.netSalary;
        }
        if (extractedData.contractType && !candidature.contractType) {
          candidature.contractType = extractedData.contractType;
        }

        await candidature.save();

        await logEvent(req.user.id, {
          property: property._id,
          type: 'document_analyzed_with_ai',
          meta: {
            documentId: String(doc._id),
            candidatureId: String(candidatureId),
            score: scoringResult.total,
            grade: scoringResult.grade
          }
        });
      } catch (error) {
        console.error('Erreur calcul score:', error);
        // Continue même si le score échoue
      }
    }

    return res.json({
      msg: 'Analyse terminée avec succès',
      extractedData,
      scoring: scoringResult,
      document: {
        id: doc._id,
        originalName: doc.originalName,
        type: doc.type
      }
    });
  } catch (error) {
    console.error('Erreur analyzeDocument:', error);
    return res.status(500).json({ msg: 'Erreur serveur lors de l\'analyse' });
  }
}

function parseDateString(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const dt = new Date(year, month, day);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function extractDiagnosticDate(text) {
  if (!text) return null;
  const candidates = text.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/g);
  if (!candidates || candidates.length === 0) return null;
  for (const raw of candidates) {
    const dt = parseDateString(raw);
    if (dt) return dt;
  }
  return null;
}

let ocrQueue = Promise.resolve();

function enqueueOcr(task) {
  ocrQueue = ocrQueue.then(task).catch((error) => {
    console.error('Erreur file OCR:', error);
  });
  return ocrQueue;
}

async function runOcr(filePath, lang) {
  let worker;
  try {
    worker = await createWorker(lang);
    const { data } = await worker.recognize(filePath);
    return data?.text || '';
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

async function extractTextFromImage(filePath) {
  return enqueueOcr(async () => {
    try {
      return await runOcr(filePath, 'fra');
    } catch (error) {
      console.error('Erreur OCR FR:', error);
      try {
        return await runOcr(filePath, 'eng');
      } catch (fallbackError) {
        console.error('Erreur OCR EN:', fallbackError);
        return '';
      }
    }
  });
}

/**
 * Analyse un diagnostic (extraction date / statut)
 * POST /api/documents/diagnostics/analyze
 */
async function analyzeDiagnostic(req, res) {
  try {
    const { documentId, docType } = req.body || {};
    if (!documentId) {
      return res.status(400).json({ msg: 'ID document manquant' });
    }

    const doc = await Document.findOne({ _id: documentId, user: req.user.id });
    if (!doc) {
      return res.status(404).json({ msg: 'Document introuvable' });
    }

    const filePath = path.join(uploadsDir, doc.relPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ msg: 'Fichier introuvable sur le serveur' });
    }

    const ext = path.extname(doc.filename || doc.originalName || '').toLowerCase();
    let extractedDate = null;
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const parsed = await pdfParse(buffer);
      extractedDate = extractDiagnosticDate(parsed.text || '');
    } else {
      const ocrText = await extractTextFromImage(filePath);
      extractedDate = extractDiagnosticDate(ocrText);
    }

    let status = 'valid';
    let notes = '';
    let expired = false;
    const now = new Date();

    if (!extractedDate) {
      status = 'warning';
      notes = 'Date de diagnostic non détectée';
    } else if (String(docType) === 'erp') {
      const monthsDiff =
        (now.getFullYear() - extractedDate.getFullYear()) * 12 +
        (now.getMonth() - extractedDate.getMonth());
      if (monthsDiff > 6) {
        status = 'expired';
        expired = true;
        notes = 'ERP expiré (> 6 mois)';
      }
    } else if (String(docType) === 'dpe') {
      const threshold = new Date(2021, 0, 1);
      if (extractedDate < threshold) {
        status = 'warning';
        notes = 'Ancien modèle (avant 2021)';
      }
    }

    doc.diagnosticDate = extractedDate;
    doc.analysisStatus = status;
    doc.analysisNotes = notes;
    doc.isExpired = expired;
    await doc.save();

    return res.json({
      msg: 'Analyse diagnostic terminée',
      diagnosticDate: extractedDate,
      status,
      notes,
      expired,
      documentId: doc._id
    });
  } catch (error) {
    console.error('Erreur analyzeDiagnostic:', error);
    return res.status(500).json({ msg: 'Erreur serveur lors de l\'analyse' });
  }
}

module.exports = {
  analyzeDocument,
  analyzeDiagnostic
};
