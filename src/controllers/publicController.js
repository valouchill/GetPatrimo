// Controller pour les routes publiques
const path = require('path');
const Lead = require('../../models/Lead');
const Property = require('../../models/Property');
const Candidature = require('../../models/Candidature');
const User = require('../../models/User');
const { computePatrimoCoreScore } = require('../services/scoringService');
const { extractDocumentData, verifyDocumentConsistency, auditPayslip } = require('../services/aiService');
const { generateFraudReport, generateFraudEmailHTML, generateFraudEmailText } = require('../services/alertService');
const { sendEmail, isEmailConfigured } = require('../services/emailService');
const { uploadsDir } = require('../config/app');
const fs = require('fs');

/**
 * Récupère les informations d'un bien via son token public
 */
async function getApplyProperty(req, res) {
  try {
    const prop = await Property.findOne({ applyToken: req.params.token });
    if (!prop) {
      return res.status(404).json({ msg: "Lien invalide" });
    }
    return res.json({ property: prop });
  } catch (error) {
    console.error('Erreur getApplyProperty:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Récupère les informations d'un bien via son ID (pour Pack Sérénité Location)
 */
async function getPropertyById(req, res) {
  try {
    const prop = await Property.findById(req.params.propertyId);
    if (!prop) {
      return res.status(404).json({ msg: "Bien introuvable" });
    }
    // Retourne uniquement les informations publiques nécessaires
    return res.json({ 
      property: {
        _id: prop._id,
        name: prop.name,
        address: prop.address,
        addressLine: prop.addressLine,
        zipCode: prop.zipCode,
        city: prop.city,
        rentAmount: prop.rentAmount,
        chargesAmount: prop.chargesAmount,
        surfaceM2: prop.surfaceM2,
        requiredDocuments: prop.requiredDocuments || []
      }
    });
  } catch (error) {
    console.error('Erreur getPropertyById:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Upload de candidature publique avec analyse IA automatique
 */
async function submitCandidature(req, res) {
  try {
    const token = req.params.token;
    
    // Debug logs
    console.log('📤 submitCandidature appelé');
    console.log('Token reçu:', token);
    console.log('Files reçus:', req.files ? req.files.length : 0);
    console.log('Body:', Object.keys(req.body));
    
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(400).json({ msg: "Token manquant ou invalide" });
    }
    
    const prop = await Property.findOne({ applyToken: token });
    
    if (!prop) {
      console.log('❌ Bien non trouvé pour token:', token);
      return res.status(404).json({ msg: "Lien invalide - Bien non trouvé" });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const phone = String(req.body.phone || "").trim();
    const message = String(req.body.message || "").trim();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ msg: "Email requis" });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    console.log('Fichiers après traitement:', files.length);
    
    if (files.length === 0) {
      return res.status(400).json({ msg: "Ajoute au moins 1 document (PDF/JPG/PNG)" });
    }

    // Prépare les documents
    const docs = files.map(f => ({
      originalName: f.originalname,
      filename: f.filename,
      mimeType: f.mimetype,
      size: f.size,
      relPath: path.join('candidats', f.filename)
    }));

    // Crée la candidature
    const cand = await Candidature.create({
      user: prop.user,
      property: prop._id,
      firstName,
      lastName,
      email,
      phone,
      message,
      monthlyNetIncome: Number(req.body.monthlyNetIncome || 0) || 0,
      contractType: String(req.body.contractType || "").trim(),
      hasGuarantor: req.body.hasGuarantor === "1",
      guarantorType: String(req.body.guarantorType || "").trim(),
      docs
    });

    // Analyse IA des documents avec audits approfondis
    let extractedData = null;
    let scoringResult = null;
    let consistencyCheck = null;
    const analyzedDocuments = [];
    const payslipAudits = [];

    try {
      // Analyse chaque document selon son type
      for (const doc of docs) {
        const fileName = (doc.originalName || "").toLowerCase();
        let docType = 'auto';
        
        // Détermine le type de document
        if (fileName.includes('identite') || fileName.includes('cni') || fileName.includes('passeport')) {
          docType = 'id';
        } else if (fileName.includes('bulletin') || fileName.includes('salaire') || fileName.includes('paye')) {
          docType = 'payslip';
        } else if (fileName.includes('avis') || fileName.includes('imposition') || fileName.includes('impot')) {
          docType = 'tax';
        } else if (fileName.includes('contrat') || fileName.includes('cdi') || fileName.includes('cdd')) {
          docType = 'contract';
        }

        const filePath = path.join(uploadsDir, doc.relPath);
        if (fs.existsSync(filePath)) {
          try {
            const data = await extractDocumentData(filePath, docType);
            analyzedDocuments.push({
              type: docType,
              filePath: doc.relPath,
              extractedData: data
            });

            // Audit approfondi pour les fiches de paie
            if (docType === 'payslip') {
              const auditResult = auditPayslip(data);
              payslipAudits.push(auditResult);
              
              // Génère des messages pédagogiques pour les incohérences
              if (!auditResult.isValid && auditResult.alerts.length > 0) {
                auditResult.alerts.forEach(alert => {
                  const monthName = data.monthNumber ? ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][data.monthNumber - 1] : 'ce mois';
                  if (!consistencyCheck) consistencyCheck = { isValid: true, inconsistencies: [], messages: [] };
                  if (!consistencyCheck.messages) consistencyCheck.messages = [];
                  
                  consistencyCheck.messages.push({
                    type: alert.severity === 'critical' ? 'critical' : 'warning',
                    title: 'Incohérence détectée',
                    message: `Nous avons détecté une incohérence ${alert.code === 'MATH_INCONSISTENCY' ? 'mathématique' : alert.code === 'CUMUL_INCONSISTENCY' ? 'de cumul' : 'fiscale'} sur votre fiche de paie de ${monthName}. ${alert.message} Veuillez fournir l'original non modifié.`
                  });
                });
              }
            }

            // Met à jour la candidature avec les données extraites si meilleures
            if (data.netSalary > 0 && (!cand.monthlyNetIncome || data.netSalary > cand.monthlyNetIncome)) {
              cand.monthlyNetIncome = data.netSalary;
              extractedData = data;
            }
            if (data.contractType && !cand.contractType) {
              cand.contractType = data.contractType;
            }
          } catch (aiError) {
            console.error(`Erreur extraction IA pour ${doc.originalName} (non bloquant):`, aiError.message);
            // Continue même si l'IA échoue
          }
        }
      }

      // Vérifie la cohérence entre les documents (noms, fraude ID)
      if (analyzedDocuments.length > 1) {
        try {
          const consistencyResult = await verifyDocumentConsistency(analyzedDocuments);
          // Fusionne avec les messages des audits de fiches de paie
          if (consistencyCheck && consistencyCheck.messages) {
            consistencyResult.messages = [...(consistencyResult.messages || []), ...consistencyCheck.messages];
            consistencyResult.isValid = consistencyResult.isValid && consistencyCheck.isValid;
          }
          consistencyCheck = consistencyResult;
        } catch (consistencyError) {
          console.error("Erreur vérification cohérence (non bloquant):", consistencyError);
        }
      }

      // Calcule le score avec les données extraites et les audits
      scoringResult = computePatrimoCoreScore({
        cand,
        property: prop,
        extractedData,
        consistencyCheck,
        payslipAudits
      });

      // Met à jour la candidature avec le score et les alertes
      if (scoringResult) {
        cand.scoring = {
          version: scoringResult.version,
          total: scoringResult.total,
          grade: scoringResult.grade,
          ratio: scoringResult.ratio,
          remaining: scoringResult.remaining,
          breakdown: scoringResult.breakdown,
          flags: scoringResult.flags,
          alerts: scoringResult.alerts || [],
          hardGateTriggered: scoringResult.hardGateTriggered || false
        };
      }
      cand.scoredAt = new Date();
      await cand.save();

      // Envoie une alerte email au propriétaire si fraude détectée (score 0% avec alertes critiques)
      const hasCriticalFraud = scoringResult && 
        (scoringResult.total === 0 || 
         (scoringResult.alerts && scoringResult.alerts.some(a => a.type === 'critical')) ||
         (consistencyCheck && !consistencyCheck.isValid && consistencyCheck.messages && 
          consistencyCheck.messages.some(m => m.type === 'critical')));
      
      if (hasCriticalFraud && isEmailConfigured()) {
        try {
          // Récupère l'email du propriétaire
          const owner = await User.findById(prop.user);
          if (owner && owner.email) {
            const fraudReport = generateFraudReport(
              { scoring: scoringResult, consistencyCheck, payslipAudits, extractedData },
              cand,
              prop
            );

            await sendEmail({
              to: owner.email,
              subject: fraudReport.title,
              html: generateFraudEmailHTML(fraudReport),
              text: generateFraudEmailText(fraudReport)
            });

            console.log(`✅ Alerte fraude envoyée à ${owner.email} pour candidature ${cand._id}`);
          }
        } catch (emailError) {
          console.error("Erreur envoi email alerte fraude (non bloquant):", emailError);
          // Ne bloque pas le processus même si l'email échoue
        }
      }
    } catch (scoringError) {
      console.error("Erreur scoring (non bloquant):", scoringError);
      // Continue même si le scoring échoue
    }

    // Message générique pour le candidat (protection contre l'amélioration de fraude)
    // Le candidat ne doit JAMAIS recevoir les détails techniques de la fraude détectée
    const hasCriticalFraud = scoringResult && 
      (scoringResult.total === 0 || 
       (scoringResult.alerts && scoringResult.alerts.some(a => a.type === 'critical')) ||
       (consistencyCheck && !consistencyCheck.isValid && consistencyCheck.messages && 
        consistencyCheck.messages.some(m => m.type === 'critical')));
    
    const candidateMessage = scoringResult?.hardGateTriggered 
      ? "Dossier incomplet. Veuillez fournir les documents requis."
      : hasCriticalFraud
        ? "Votre dossier n'a pas pu être certifié en raison d'incohérences documentaires."
        : "Dossier reçu ✅";

    return res.json({ 
      msg: candidateMessage,
      candidatureId: cand._id,
      documents: docs,
      scoring: scoringResult,
      extractedData,
      consistencyCheck: consistencyCheck || { isValid: true, inconsistencies: [], messages: [] },
      payslipAudits: payslipAudits.map(a => ({
        isValid: a.isValid,
        alerts: a.alerts
      }))
    });
  } catch (error) {
    console.error('Erreur submitCandidature:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      msg: 'Erreur lors du dépôt',
      error: error.message || 'Erreur inconnue',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Enregistre un lead (prospect)
 */
async function createLead(req, res) {
  try {
    const { email, source, utm } = req.body || {};
    
    if (!email || !String(email).includes('@')) {
      return res.status(400).json({ msg: 'Email invalide' });
    }

    await Lead.create({
      email: String(email).trim().toLowerCase(),
      source: source ? String(source) : 'landing',
      utm: utm && typeof utm === 'object' ? utm : {},
      ip: req.headers['x-forwarded-for'] 
        ? String(req.headers['x-forwarded-for']).split(',')[0].trim() 
        : (req.ip || ''),
      userAgent: String(req.headers['user-agent'] || '')
    });

    return res.json({ msg: 'OK' });
  } catch (error) {
    console.error('Erreur createLead:', error);
    return res.status(500).json({ msg: 'Erreur serveur' });
  }
}

/**
 * Soumet une candidature via propertyId (Pack Sérénité Location)
 */
async function submitCandidatureByPropertyId(req, res) {
  try {
    const propertyId = req.params.propertyId;
    
    if (!propertyId || propertyId === 'null' || propertyId === 'undefined') {
      return res.status(400).json({ msg: "ID du bien manquant ou invalide" });
    }
    
    const prop = await Property.findById(propertyId);
    
    if (!prop) {
      console.log('❌ Bien non trouvé pour propertyId:', propertyId);
      return res.status(404).json({ msg: "Bien introuvable" });
    }

    const email = String(req.body.email || "").trim().toLowerCase();
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const phone = String(req.body.phone || "").trim();
    const message = String(req.body.message || "").trim();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ msg: "Email requis" });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    
    if (files.length === 0) {
      return res.status(400).json({ msg: "Ajoute au moins 1 document (PDF/JPG/PNG)" });
    }

    // Prépare les documents
    const docs = files.map(f => ({
      originalName: f.originalname,
      filename: f.filename,
      mimeType: f.mimetype,
      size: f.size,
      relPath: path.join('candidats', f.filename)
    }));

    // Crée la candidature
    const cand = await Candidature.create({
      user: prop.user,
      property: prop._id,
      firstName,
      lastName,
      email,
      phone,
      message,
      monthlyNetIncome: Number(req.body.monthlyNetIncome || 0) || 0,
      contractType: String(req.body.contractType || "").trim(),
      hasGuarantor: req.body.hasGuarantor === "1",
      guarantorType: String(req.body.guarantorType || "").trim(),
      docs
    });

    // Analyse IA des documents (même logique que submitCandidature)
    let extractedData = null;
    let scoringResult = null;
    let consistencyCheck = null;
    const analyzedDocuments = [];
    const payslipAudits = [];

    try {
      for (const doc of docs) {
        const fileName = (doc.originalName || "").toLowerCase();
        let docType = 'auto';
        
        if (fileName.includes('identite') || fileName.includes('cni') || fileName.includes('passeport')) {
          docType = 'id';
        } else if (fileName.includes('bulletin') || fileName.includes('salaire') || fileName.includes('paye')) {
          docType = 'payslip';
        } else if (fileName.includes('avis') || fileName.includes('imposition') || fileName.includes('impot')) {
          docType = 'tax';
        } else if (fileName.includes('contrat') || fileName.includes('cdi') || fileName.includes('cdd')) {
          docType = 'contract';
        }

        const filePath = path.join(uploadsDir, doc.relPath);
        if (fs.existsSync(filePath)) {
          try {
            const data = await extractDocumentData(filePath, docType);
            analyzedDocuments.push({
              type: docType,
              filePath: doc.relPath,
              extractedData: data
            });

            if (docType === 'payslip') {
              const auditResult = auditPayslip(data);
              payslipAudits.push(auditResult);
              
              if (!auditResult.isValid && auditResult.alerts.length > 0) {
                auditResult.alerts.forEach(alert => {
                  const monthName = data.monthNumber ? ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][data.monthNumber - 1] : 'ce mois';
                  if (!consistencyCheck) consistencyCheck = { isValid: true, inconsistencies: [], messages: [] };
                  if (!consistencyCheck.messages) consistencyCheck.messages = [];
                  
                  consistencyCheck.messages.push({
                    type: alert.severity === 'critical' ? 'critical' : 'warning',
                    title: 'Incohérence détectée',
                    message: `Nous avons détecté une incohérence ${alert.code === 'MATH_INCONSISTENCY' ? 'mathématique' : alert.code === 'CUMUL_INCONSISTENCY' ? 'de cumul' : 'fiscale'} sur votre fiche de paie de ${monthName}. ${alert.message} Veuillez fournir l'original non modifié.`
                  });
                });
              }
            }

            if (data.netSalary > 0 && (!cand.monthlyNetIncome || data.netSalary > cand.monthlyNetIncome)) {
              cand.monthlyNetIncome = data.netSalary;
              extractedData = data;
            }
            if (data.contractType && !cand.contractType) {
              cand.contractType = data.contractType;
            }
          } catch (aiError) {
            console.error(`Erreur extraction IA pour ${doc.originalName} (non bloquant):`, aiError.message);
          }
        }
      }

      if (analyzedDocuments.length > 1) {
        try {
          const consistencyResult = await verifyDocumentConsistency(analyzedDocuments);
          if (consistencyCheck && consistencyCheck.messages) {
            consistencyResult.messages = [...(consistencyResult.messages || []), ...consistencyCheck.messages];
            consistencyResult.isValid = consistencyResult.isValid && consistencyCheck.isValid;
          }
          consistencyCheck = consistencyResult;
        } catch (consistencyError) {
          console.error("Erreur vérification cohérence (non bloquant):", consistencyError);
        }
      }

      scoringResult = computePatrimoCoreScore({
        cand,
        property: prop,
        extractedData,
        consistencyCheck,
        payslipAudits
      });

      if (scoringResult) {
        cand.scoring = {
          version: scoringResult.version,
          total: scoringResult.total,
          grade: scoringResult.grade,
          ratio: scoringResult.ratio,
          remaining: scoringResult.remaining,
          breakdown: scoringResult.breakdown,
          flags: scoringResult.flags,
          alerts: scoringResult.alerts || [],
          hardGateTriggered: scoringResult.hardGateTriggered || false
        };
      }
      cand.scoredAt = new Date();
      await cand.save();

      const hasCriticalFraud = scoringResult && 
        (scoringResult.total === 0 || 
         (scoringResult.alerts && scoringResult.alerts.some(a => a.type === 'critical')) ||
         (consistencyCheck && !consistencyCheck.isValid && consistencyCheck.messages && 
          consistencyCheck.messages.some(m => m.type === 'critical')));
      
      if (hasCriticalFraud && isEmailConfigured()) {
        try {
          const owner = await User.findById(prop.user);
          if (owner && owner.email) {
            const fraudReport = generateFraudReport(
              { scoring: scoringResult, consistencyCheck, payslipAudits, extractedData },
              cand,
              prop
            );

            await sendEmail({
              to: owner.email,
              subject: fraudReport.title,
              html: generateFraudEmailHTML(fraudReport),
              text: generateFraudEmailText(fraudReport)
            });

            console.log(`✅ Alerte fraude envoyée à ${owner.email} pour candidature ${cand._id}`);
          }
        } catch (emailError) {
          console.error("Erreur envoi email alerte fraude (non bloquant):", emailError);
        }
      }
    } catch (scoringError) {
      console.error("Erreur scoring (non bloquant):", scoringError);
    }

    const hasCriticalFraud = scoringResult && 
      (scoringResult.total === 0 || 
       (scoringResult.alerts && scoringResult.alerts.some(a => a.type === 'critical')) ||
       (consistencyCheck && !consistencyCheck.isValid && consistencyCheck.messages && 
        consistencyCheck.messages.some(m => m.type === 'critical')));
    
    const candidateMessage = scoringResult?.hardGateTriggered 
      ? "Dossier incomplet. Veuillez fournir les documents requis."
      : hasCriticalFraud
        ? "Votre dossier n'a pas pu être certifié en raison d'incohérences documentaires."
        : "Dossier reçu ✅";

    return res.json({ 
      msg: candidateMessage,
      candidatureId: cand._id,
      documents: docs,
      scoring: scoringResult,
      extractedData,
      consistencyCheck: consistencyCheck || { isValid: true, inconsistencies: [], messages: [] },
      payslipAudits: payslipAudits.map(a => ({
        isValid: a.isValid,
        alerts: a.alerts
      }))
    });
  } catch (error) {
    console.error('Erreur submitCandidatureByPropertyId:', error);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      msg: 'Erreur lors du dépôt',
      error: error.message || 'Erreur inconnue',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

module.exports = {
  getApplyProperty,
  getPropertyById,
  submitCandidature,
  submitCandidatureByPropertyId,
  createLead
};
