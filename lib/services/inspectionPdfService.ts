/**
 * Generate a PDF for a completed inspection (État des Lieux).
 * Uses PDFKit (same pattern as receipt generation in paymentService).
 */
import fs from 'fs';
import path from 'path';

const CONDITION_FR: Record<string, string> = {
  GOOD: 'Bon état',
  NORMAL_WEAR: 'Usure normale',
  DEGRADED: 'Dégradé',
  NEEDS_RENOVATION: 'À rénover',
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
  }[];
  const meterReadings = ins.meterReadings as { water?: number; gas?: number; electricity?: number; heating?: number } | undefined;

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
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica').text(`Date : ${date.toLocaleDateString('fr-FR')}`, { align: 'center' });
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

    // Rooms
    doc.font('Helvetica-Bold').text('ÉTAT DES PIÈCES');
    doc.moveDown(0.5);

    for (const room of rooms) {
      doc.font('Helvetica-Bold').fontSize(11).text(`▸ ${room.name}`);
      doc.font('Helvetica').fontSize(10);
      doc.text(`  Murs : ${CONDITION_FR[room.wallCondition] || room.wallCondition}`);
      doc.text(`  Sol : ${CONDITION_FR[room.floorCondition] || room.floorCondition}`);
      doc.text(`  Plafond : ${CONDITION_FR[room.ceilingCondition] || room.ceilingCondition}`);
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

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#94A3B8').text(
      'Document généré par PatrimoTrust — Ce document constitue un constat contradictoire de l\'état du logement.',
      { align: 'center' }
    );

    doc.end();
    stream.on('finish', () => resolve(`/uploads/edl/${fileName}`));
    stream.on('error', reject);
  });
}
