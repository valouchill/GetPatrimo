// Service de génération de PDF (quittances et baux)
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Crée un buffer PDF pour une quittance de loyer
 * @param {Object} property - Données du bien
 * @param {Object} tenant - Données du locataire
 * @param {Object} owner - Données du propriétaire
 * @returns {Promise<Buffer>}
 */
function createPdfBuffer(property, tenant, owner) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const now = new Date();
      const f = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('fr-FR');
      const l = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('fr-FR');
      const today = now.toLocaleDateString('fr-FR');

      const ownerName = (owner?.firstName && owner?.lastName) 
        ? (owner.firstName + " " + owner.lastName) 
        : (owner?.email || 'Bailleur');
      
      const tenantName = tenant 
        ? ((tenant.firstName || '') + " " + (tenant.lastName || '')).trim() 
        : "Locataire";
      
      const propName = property?.name || "Logement";
      const addr = property?.address || [
        property?.addressLine, 
        property?.zipCode, 
        property?.city
      ].filter(Boolean).join(", ");

      const rent = Number(property?.rentAmount || 0) || 0;
      const charges = Number(property?.chargesAmount || 0) || 0;

      // En-tête
      doc.rect(0, 0, 600, 120).fill('#f8f9fa');
      doc.fillColor('#333').font('Helvetica-Bold').fontSize(22).text("QUITTANCE DE LOYER", 40, 40);
      doc.font('Helvetica').fontSize(10).text(`Période du ${f} au ${l}`, 40, 70);

      // Bailleur
      doc.fillColor('#333').font('Helvetica-Bold').fontSize(12).text("Bailleur", 40, 140);
      doc.font('Helvetica').fontSize(10).text(ownerName, 40, 158);

      // Locataire
      doc.font('Helvetica-Bold').fontSize(12).text("Locataire", 320, 140);
      doc.font('Helvetica').fontSize(10).text(tenantName, 320, 158);

      // Logement
      doc.font('Helvetica-Bold').fontSize(12).text("Logement", 40, 190);
      doc.font('Helvetica').fontSize(10).text(`${propName}\n${addr || ''}`, 40, 208);

      // Tableau
      doc.rect(40, 270, 515, 25).fill('#333');
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10).text("DÉSIGNATION", 50, 278);
      doc.text("MONTANT", 450, 278, { align: 'right', width: 90 });

      doc.fillColor('#333').font('Helvetica').fontSize(10);
      let y = 310;
      doc.text("Loyer mensuel", 50, y);
      doc.text(rent.toFixed(2) + " EUR", 450, y, { align: 'right', width: 90 });
      y += 22;
      doc.text("Provision charges", 50, y);
      doc.text(charges.toFixed(2) + " EUR", 450, y, { align: 'right', width: 90 });
      y += 30;

      doc.font('Helvetica-Bold').text("TOTAL PAYÉ", 50, y);
      doc.text((rent + charges).toFixed(2) + " EUR", 450, y, { align: 'right', width: 90 });

      // Certification
      doc.font('Helvetica').fontSize(10).text(
        `Je soussigné(e) ${ownerName}, certifie avoir reçu le montant total.`,
        40, 460, { width: 515, align: 'justify' }
      );
      doc.text(`Fait le ${today}`, 40, 530);
      doc.rect(380, 520, 150, 60).strokeColor('#333').stroke();
      doc.fontSize(8).text("Signature", 390, 525);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Génère le PDF du bail et le sauvegarde sur le disque
 * @param {Object} lease - Données du bail
 * @param {Object} property - Données du bien
 * @param {Object} candidature - Données de la candidature (locataire)
 * @returns {Promise<string>} - Chemin relatif du PDF généré
 */
async function generateLeasePdf(lease, property, candidature) {
  // Charge les diagnostics avant de générer le PDF
  const Document = require('../../models/Document');
  let diagnosticDocuments = [];
  try {
    diagnosticDocuments = await Document.find({
      property: property._id || property.id,
      type: { $in: ['dpe', 'electricite', 'gaz', 'erp', 'plomb', 'amiante', 'surface'] }
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('Erreur chargement diagnostics pour PDF:', error);
    // Continue même si le chargement échoue
  }

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      // Crée le dossier de sauvegarde si nécessaire
      const uploadsDir = path.join(__dirname, '../../uploads/leases');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Nom du fichier
      const filename = `bail-${lease._id}-${Date.now()}.pdf`;
      const filepath = path.join(uploadsDir, filename);
      const relPath = path.join('leases', filename);

      // Stream vers fichier
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // === EN-TÊTE ===
      doc.rect(0, 0, 595, 100).fill('#0F172A'); // Navy background
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('CONTRAT DE LOCATION', 50, 30, { align: 'center' });
      doc.font('Helvetica').fontSize(12).text('Bail de location d\'habitation', 50, 60, { align: 'center' });

      let y = 120;

      // === ARTICLE 1 - OBJET DU CONTRAT ===
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Article 1 - Objet du contrat', 50, y);
      y += 25;
      doc.fillColor('#333').font('Helvetica').fontSize(11).text(
        'Le présent contrat de location a pour objet la location d\'un bien situé à l\'adresse suivante :',
        50, y, { width: 495, align: 'justify' }
      );
      y += 20;
      doc.fillColor('#10B981').font('Helvetica-Bold').fontSize(12).text(property.address, 60, y);
      y += 25;
      
      const surfaceText = property.surfaceM2 ? `D'une surface de ${property.surfaceM2} m², ` : '';
      const chargesText = property.chargesAmount > 0 
        ? `et des charges de ${property.chargesAmount.toFixed(2)} €.`
        : '.';
      
      doc.fillColor('#333').font('Helvetica').fontSize(11).text(
        `${surfaceText}pour un loyer hors charges de ${property.rentAmount.toFixed(2)} € ${chargesText}`,
        50, y, { width: 495, align: 'justify' }
      );
      y += 40;

      // === ARTICLE 2 - LOCATAIRE ===
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Article 2 - Locataire', 50, y);
      y += 25;
      doc.fillColor('#333').font('Helvetica').fontSize(11);
      doc.text(`Nom : ${candidature.lastName || ''}`, 50, y);
      y += 18;
      doc.text(`Prénom : ${candidature.firstName || ''}`, 50, y);
      y += 18;
      doc.text(`Email : ${candidature.email}`, 50, y);
      y += 18;
      if (candidature.phone) {
        doc.text(`Téléphone : ${candidature.phone}`, 50, y);
        y += 18;
      }
      y += 10;

      // === ARTICLE 3 - DURÉE ET DATES ===
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Article 3 - Durée et dates', 50, y);
      y += 25;
      const startDateStr = lease.startDate.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      doc.fillColor('#333').font('Helvetica').fontSize(11).text(
        `Le présent bail prend effet le ${startDateStr}.`,
        50, y, { width: 495, align: 'justify' }
      );
      y += 20;
      doc.text(`Dépôt de garantie : ${lease.depositAmount.toFixed(2)} €`, 50, y);
      y += 40;

      // === ARTICLE 4 - ACTE DE CAUTIONNEMENT ===
      if (lease.guarantor && (lease.guarantor.firstName || lease.guarantor.visaleNumber)) {
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Article 4 - Acte de Cautionnement', 50, y);
        y += 25;
        doc.fillColor('#333').font('Helvetica').fontSize(11);
        
        if (lease.guarantor.visaleNumber) {
          doc.text(`Garantie Visale : Numéro ${lease.guarantor.visaleNumber}`, 50, y);
        } else if (lease.guarantor.firstName && lease.guarantor.lastName) {
          doc.text(`Garant : ${lease.guarantor.firstName} ${lease.guarantor.lastName}`, 50, y);
          y += 18;
          if (lease.guarantor.income > 0) {
            doc.text(`Revenus : ${lease.guarantor.income.toFixed(2)} €/mois`, 50, y);
          }
        }
        y += 30;
      }

      // === CLAUSES ADDITIONNELLES ===
      if (lease.additionalClauses) {
        doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Article 5 - Clauses additionnelles', 50, y);
        y += 25;
        doc.fillColor('#333').font('Helvetica').fontSize(11).text(lease.additionalClauses, 50, y, {
          width: 495,
          align: 'justify'
        });
        y += 60;
      }

      // === SIGNATURES ===
      y = Math.max(y, 650);
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#333').lineWidth(1).stroke();
      y += 20;
      
      doc.fillColor('#333').font('Helvetica').fontSize(10);
      doc.text('Signature Locataire', 50, y);
      doc.text('Signature Propriétaire', 320, y);
      y += 60;
      
      // Zones de signature
      doc.rect(50, y - 50, 200, 50).strokeColor('#999').stroke();
      doc.rect(320, y - 50, 200, 50).strokeColor('#999').stroke();

      // === ANNEXES - DIAGNOSTICS (intégrées directement dans le bail) ===
      if (diagnosticDocuments.length > 0) {
          // Nouvelle page pour les annexes
          doc.addPage();
          y = 50;

          doc.rect(0, 0, 595, 100).fill('#0F172A');
          doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('ANNEXES AU CONTRAT DE LOCATION', 50, 30, { align: 'center' });
          doc.font('Helvetica').fontSize(12).text('Dossier de Diagnostic Technique (DDT)', 50, 60, { align: 'center' });

          y = 120;

          // Liste des diagnostics
          doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Documents de diagnostic', 50, y);
          y += 25;

          const diagnosticNames = {
            'dpe': 'Diagnostic de Performance Énergétique (DPE)',
            'electricite': 'Diagnostic Électricité',
            'gaz': 'Diagnostic Gaz',
            'erp': 'État des Risques et Pollutions (ERP)',
            'plomb': 'Constat de Risque d\'Exposition au Plomb (CREP)',
            'amiante': 'Diagnostic Amiante',
            'surface': 'Surface Boutin'
          };

          diagnosticDocuments.forEach((docItem, index) => {
            if (y > 700) {
              doc.addPage();
              y = 50;
            }

            const docType = docItem.type || 'autre';
            const docName = diagnosticNames[docType] || docItem.originalName || 'Document';
            const uploadDate = docItem.createdAt 
              ? new Date(docItem.createdAt).toLocaleDateString('fr-FR')
              : 'Date inconnue';

            doc.fillColor('#10B981').font('Helvetica-Bold').fontSize(12).text(`${index + 1}. ${docName}`, 50, y);
            y += 20;
            doc.fillColor('#333').font('Helvetica').fontSize(10);
            doc.text(`Fichier : ${docItem.originalName || 'Non spécifié'}`, 60, y);
            y += 16;
            doc.text(`Date d'upload : ${uploadDate}`, 60, y);
            y += 20;

            // Ligne de séparation
            doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').lineWidth(1).stroke();
            y += 20;
          });

          // Reconnaissance
          y += 20;
          if (y > 700) {
            doc.addPage();
            y = 50;
          }

          doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Reconnaissance', 50, y);
          y += 25;
          doc.fillColor('#333').font('Helvetica').fontSize(11).text(
            'Je soussigné(e), locataire du bien décrit ci-dessus, reconnais avoir pris connaissance de l\'ensemble des documents de diagnostic technique listés dans les présentes annexes.',
            50, y, { width: 495, align: 'justify' }
          );
          y += 40;

          doc.text('Fait le _________________', 50, y);
          y += 40;
          doc.rect(50, y, 200, 50).strokeColor('#999').stroke();
          doc.fontSize(8).text('Signature Locataire', 60, y + 5);
        }

      // === PIED DE PAGE ===
      const pageHeight = doc.page.height;
      doc.fillColor('#999').font('Helvetica').fontSize(8)
        .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} par GetPatrimo`, 50, pageHeight - 30, {
          align: 'center',
          width: 495
        });

      doc.end();

      stream.on('finish', () => {
        resolve(relPath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Génère un PDF d'annexes contenant tous les diagnostics du bien
 * @param {Array} diagnosticDocuments - Liste des documents de diagnostic
 * @param {Object} property - Données du bien
 * @returns {Promise<string>} - Chemin relatif du PDF généré
 */
async function generateAnnexesPdf(diagnosticDocuments, property) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      // Crée le dossier de sauvegarde si nécessaire
      const uploadsDir = path.join(__dirname, '../../uploads/leases');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Nom du fichier
      const filename = `annexes-${property._id || property.id}-${Date.now()}.pdf`;
      const filepath = path.join(uploadsDir, filename);
      const relPath = path.join('leases', filename);

      // Stream vers fichier
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // === EN-TÊTE ===
      doc.rect(0, 0, 595, 100).fill('#0F172A'); // Navy background
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(24).text('ANNEXES AU CONTRAT DE LOCATION', 50, 30, { align: 'center' });
      doc.font('Helvetica').fontSize(12).text('Dossier de Diagnostic Technique (DDT)', 50, 60, { align: 'center' });

      let y = 120;

      // === INFORMATIONS DU BIEN ===
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Bien concerné', 50, y);
      y += 25;
      doc.fillColor('#333').font('Helvetica').fontSize(11);
      doc.text(`Adresse : ${property.address}`, 50, y);
      y += 18;
      if (property.zipCode && property.city) {
        doc.text(`${property.zipCode} ${property.city}`, 50, y);
        y += 18;
      }
      y += 20;

      // === LISTE DES DIAGNOSTICS ===
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Documents de diagnostic', 50, y);
      y += 25;

      const diagnosticNames = {
        'dpe': 'Diagnostic de Performance Énergétique (DPE)',
        'electricite': 'Diagnostic Électricité',
        'gaz': 'Diagnostic Gaz',
        'erp': 'État des Risques et Pollutions (ERP)',
        'plomb': 'Constat de Risque d\'Exposition au Plomb (CREP)',
        'amiante': 'Diagnostic Amiante',
        'surface': 'Surface Boutin'
      };

      if (diagnosticDocuments.length === 0) {
        doc.fillColor('#999').font('Helvetica').fontSize(11).text('Aucun document de diagnostic disponible.', 50, y);
        y += 30;
      } else {
        diagnosticDocuments.forEach((docItem, index) => {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }

          const docType = docItem.type || 'autre';
          const docName = diagnosticNames[docType] || docItem.originalName || 'Document';
          const uploadDate = docItem.createdAt 
            ? new Date(docItem.createdAt).toLocaleDateString('fr-FR')
            : 'Date inconnue';

          doc.fillColor('#10B981').font('Helvetica-Bold').fontSize(12).text(`${index + 1}. ${docName}`, 50, y);
          y += 20;
          doc.fillColor('#333').font('Helvetica').fontSize(10);
          doc.text(`Fichier : ${docItem.originalName || 'Non spécifié'}`, 60, y);
          y += 16;
          doc.text(`Date d'upload : ${uploadDate}`, 60, y);
          y += 20;

          // Ligne de séparation
          doc.moveTo(50, y).lineTo(545, y).strokeColor('#E2E8F0').lineWidth(1).stroke();
          y += 20;
        });
      }

      // === RECONNAISSANCE ===
      y += 20;
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('Reconnaissance', 50, y);
      y += 25;
      doc.fillColor('#333').font('Helvetica').fontSize(11).text(
        'Je soussigné(e), locataire du bien décrit ci-dessus, reconnais avoir pris connaissance de l\'ensemble des documents de diagnostic technique listés dans les présentes annexes.',
        50, y, { width: 495, align: 'justify' }
      );
      y += 40;

      doc.text('Fait le _________________', 50, y);
      y += 40;
      doc.rect(50, y, 200, 50).strokeColor('#999').stroke();
      doc.fontSize(8).text('Signature Locataire', 60, y + 5);

      // === PIED DE PAGE ===
      const pageHeight = doc.page.height;
      doc.fillColor('#999').font('Helvetica').fontSize(8)
        .text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} par GetPatrimo`, 50, pageHeight - 30, {
          align: 'center',
          width: 495
        });

      doc.end();

      stream.on('finish', () => {
        resolve(relPath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { 
  createPdfBuffer,
  generateLeasePdf,
  generateAnnexesPdf
};
