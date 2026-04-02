/**
 * Generate a PDF for a completed inspection (État des Lieux).
 * Conforme au décret n°2016-382 du 30 mars 2016 et à la loi ALUR art. 3-2.
 * Uses PDFKit (same pattern as receipt generation in paymentService).
 */
import fs from 'fs';
import path from 'path';

const CONDITION_FR: Record<string, string> = {
  // Décret n°2016-382 labels
  TRES_BON: 'Très bon',
  BON: 'Bon',
  USAGE_NORMAL: 'Usure normale',
  MAUVAIS_ETAT: 'Mauvais état',
  HORS_SERVICE: 'Hors service',
  // Legacy values (backward compatibility)
  GOOD: 'Bon',
  NORMAL_WEAR: 'Usure normale',
  DEGRADED: 'Mauvais état',
  NEEDS_RENOVATION: 'Hors service',
};

export async function generateInspectionPdf(inspection: Record<string, unknown>): Promise<string> {
  const PDFDocument = require('pdfkit');

  const ins = typeof (inspection as { toObject?: () => Record<string, unknown> }).toObject === 'function'
    ? (inspection as { toObject: () => Record<string, unknown> }).toObject()
    : inspection;

  const type = ins.type as string;
  const date = ins.date ? new Date(ins.date as string) : new Date();
  const rooms = (ins.rooms || []) as {
    name: string;
    wallCondition: string;
    floorCondition: string;
    ceilingCondition: string;
    comment?: string;
    equipment?: { name: string; condition: string; comment?: string }[];
  }[];
  const meterReadings = ins.meterReadings as { water?: number; gas?: number; electricity?: number; heating?: number } | undefined;
  const keysDelivered = (ins.keysDelivered || []) as { type: string; quantity: number; description?: string }[];

  // Resolve property and lease data
  const Property = require('@/models/Property');
  const Lease = require('@/models/Lease');
  const User = require('@/models/User');

  const property = await Property.findById(ins.property).lean();
  const lease = await Lease.findById(ins.lease).lean();
  const owner = await User.findById(ins.user).lean();

  const propertyAddress = (property as { address?: string })?.address || 'Adresse non renseignée';
  const tenantName = lease ? `${(lease as { tenantFirstName?: string }).tenantFirstName || ''} ${(lease as { tenantLastName?: string }).tenantLastName || ''}`.trim() : 'Locataire';
  const ownerName = owner ? `${(owner as { firstName?: string }).firstName || ''} ${(owner as { lastName?: string }).lastName || ''}`.trim() || (owner as { email?: string }).email : 'Propriétaire';

  // Create directory
  const pdfDir = path.join(process.cwd(), 'uploads', 'edl');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

  const fileName = `edl_${type.toLowerCase()}_${String(ins._id)}.pdf`;
  const filePath = path.join(pdfDir, fileName);

  return new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    const title = type === 'ENTRY' ? "ÉTAT DES LIEUX D'ENTRÉE" : 'ÉTAT DES LIEUX DE SORTIE';
    doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text(
      'Établi contradictoirement entre les parties conformément au décret n°2016-382 du 30 mars 2016',
      { align: 'center' }
    );
    doc.moveDown(0.5);
    doc.fillColor('#000000').fontSize(11).font('Helvetica').text(`Date : ${date.toLocaleDateString('fr-FR')}`, { align: 'center' });
    doc.moveDown(1);

    // Parties
    doc.fontSize(11).font('Helvetica-Bold').text('BAILLEUR');
    doc.font('Helvetica').text(ownerName);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('LOCATAIRE');
    doc.font('Helvetica').text(tenantName);
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text('BIEN');
    doc.font('Helvetica').text(propertyAddress);
    doc.moveDown(1);

    // Meter readings
    if (meterReadings) {
      doc.font('Helvetica-Bold').text('RELEVÉS DE COMPTEURS');
      doc.moveDown(0.3);
      const meters = [
        { label: 'Eau', value: meterReadings.water },
        { label: 'Gaz', value: meterReadings.gas },
        { label: 'Électricité', value: meterReadings.electricity },
        { label: 'Chauffage', value: meterReadings.heating },
      ];
      for (const m of meters) {
        if (m.value != null) {
          doc.font('Helvetica').text(`  ${m.label} : ${m.value}`);
        }
      }
      doc.moveDown(1);
    }

    // Keys delivered (décret n°2016-382)
    doc.font('Helvetica-Bold').text('CLÉS ET MOYENS D\'ACCÈS REMIS');
    doc.moveDown(0.3);
    if (keysDelivered.length > 0) {
      for (const key of keysDelivered) {
        const desc = key.description ? ` — ${key.description}` : '';
        doc.font('Helvetica').text(`  ${key.type} × ${key.quantity}${desc}`);
      }
    } else {
      doc.font('Helvetica').text('  Néant / Non renseigné');
    }
    doc.moveDown(1);

    // Rooms
    doc.font('Helvetica-Bold').text('ÉTAT DES PIÈCES');
    doc.moveDown(0.5);

    for (const room of rooms) {
      doc.font('Helvetica-Bold').fontSize(11).text(`▸ ${room.name}`);
      doc.font('Helvetica').fontSize(10);
      doc.text(`  Murs : ${CONDITION_FR[room.wallCondition] || room.wallCondition}`);
      doc.text(`  Sol : ${CONDITION_FR[room.floorCondition] || room.floorCondition}`);
      doc.text(`  Plafond : ${CONDITION_FR[room.ceilingCondition] || room.ceilingCondition}`);
      // Equipment
      if (room.equipment?.length) {
        for (const eq of room.equipment) {
          const eqComment = eq.comment ? ` — ${eq.comment}` : '';
          doc.text(`  ${eq.name} : ${CONDITION_FR[eq.condition] || eq.condition}${eqComment}`);
        }
      }
      if (room.comment) {
        doc.text(`  Observations : ${room.comment}`);
      }
      doc.moveDown(0.5);
    }

    // Signatures placeholder
    doc.moveDown(1);
    doc.font('Helvetica-Bold').fontSize(11).text('SIGNATURES');
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10);
    doc.text(`Bailleur : ${ownerName}`);
    doc.text('Signature : ____________________');
    doc.moveDown(0.5);
    doc.text(`Locataire : ${tenantName}`);
    doc.text('Signature : ____________________');

    // Legal notice — loi ALUR art. 3-2 (10-day amendment period)
    doc.moveDown(1.5);
    doc.fontSize(8).fillColor('#374151').font('Helvetica-Bold').text(
      'MENTION LÉGALE (LOI ALUR ART. 3-2 — LOI N°89-462 DU 6 JUILLET 1989)',
      { align: 'left' }
    );
    doc.font('Helvetica').fillColor('#6b7280').text(
      type === 'ENTRY'
        ? 'Le locataire dispose d\'un délai de 10 jours calendaires à compter de la remise du présent document pour demander sa ' +
          'modification, par lettre recommandée avec avis de réception. À défaut de réclamation dans ce délai, l\'état des lieux ' +
          'd\'entrée est réputé accepté. Durant le premier mois de la période de chauffe, le locataire peut également demander ' +
          'que l\'état des lieux soit complété par l\'état des éléments de chauffage.'
        : 'Le présent état des lieux de sortie constitue un constat contradictoire de l\'état du logement au moment de la ' +
          'restitution des clés. Il est établi en présence des deux parties ou de leurs mandataires.',
      { align: 'left' }
    );

    // Footer
    doc.moveDown(1);
    doc.fontSize(8).fillColor('#94A3B8').text(
      'Document généré par PatrimoTrust — Conforme au décret n°2016-382 du 30 mars 2016.',
      { align: 'center' }
    );

    doc.end();
    stream.on('finish', () => resolve(`/uploads/edl/${fileName}`));
    stream.on('error', reject);
  });
}
