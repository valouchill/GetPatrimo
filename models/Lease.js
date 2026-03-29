const mongoose = require('mongoose');

const LeaseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  candidature: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidature', default: null },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },

  // Source du bail : FLOW (process complet) ou MANUAL (ajout direct en gestion)
  source: { type: String, enum: ['FLOW', 'MANUAL'], default: 'FLOW' },
  
  // Informations locataire
  tenantFirstName: { type: String, required: true },
  tenantLastName: { type: String, required: true },
  tenantEmail: { type: String, required: true },
  tenantPhone: { type: String, default: '' },
  
  // Informations bail
  startDate: { type: Date, required: [true, 'La date de début est obligatoire'] },
  endDate: { type: Date },
  rentAmount: { type: Number, required: [true, 'Le loyer est obligatoire'], min: [0, 'Le loyer ne peut pas être négatif'] },
  chargesAmount: { type: Number, default: 0, min: [0, 'Les charges ne peuvent pas être négatives'] },
  depositAmount: { type: Number, default: 0, min: [0, 'Le dépôt ne peut pas être négatif'] },
  propertyType: { type: String, enum: ['MEUBLE', 'NU', 'MOBILITE', 'GARAGE_PARKING'], default: 'NU' },
  leaseType: { type: String, enum: ['VIDE', 'MEUBLE', 'MOBILITE', 'GARAGE_PARKING'], default: 'VIDE' },
  paymentDay: { type: Number, default: 5, min: [1, 'Jour de paiement minimum 1'], max: [31, 'Jour de paiement maximum 31'] },
  durationMonths: { type: Number, default: 12, min: [1, 'Durée minimum 1 mois'] },
  additionalClauses: { type: String, default: '' },
  
  // Informations garant (pour acte de cautionnement)
  guarantor: {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    income: { type: Number, default: 0 },
    profession: { type: String, default: '' },
    visaleNumber: { type: String, default: '' }
  },
  
  // Signature
  signatureStatus: { 
    type: String, 
    enum: ['PENDING', 'SIGNED_BY_OWNER', 'SIGNED_BY_TENANT', 'SIGNED_BOTH', 'CANCELLED'], 
    default: 'PENDING' 
  },
  ownerSignedAt: { type: Date },
  tenantSignedAt: { type: Date },
  ownerSignatureData: { type: String }, // Base64 ou URL
  tenantSignatureData: { type: String },
  
  // OpenSign - Signature électronique
  opensignDocumentId: { type: String }, // ID du document dans OpenSign
  opensignStatus: {
    type: String,
    enum: ['DRAFT', 'PENDING', 'SIGNED', 'EXPIRED', 'CANCELLED'],
    required: false
  },
  opensignSigningLinks: {
    tenant: { type: String },
    guarantor: { type: String },
    owner: { type: String }
  },
  opensignCompletedAt: { type: Date },
  signedPdfPath: { type: String }, // Chemin vers le PDF final certifié
  opensignDocuments: [{
    kind: { type: String, enum: ['LEASE', 'GUARANTEE'] },
    documentId: { type: String },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'SIGNED', 'EXPIRED', 'CANCELLED'],
      default: 'PENDING',
    },
    signingLinks: {
      tenant: { type: String },
      guarantor: { type: String },
      owner: { type: String },
    },
    signedPdfPath: { type: String },
    completedAt: { type: Date },
  }],
  
  // État des lieux
  edlStatus: { 
    type: String, 
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED'], 
    default: 'PENDING' 
  },
  edlData: {
    rooms: [{
      name: String,
      condition: { type: String, enum: ['NEUF', 'USAGE', 'DEGRADE'] },
      photos: [{
        filename: String,
        relPath: String,
        uploadedAt: { type: Date, default: Date.now }
      }],
      notes: String
    }],
    completedAt: Date
  },
  
  // Documents générés
  contractPdfPath: { type: String },
  annexesPdfPath: { type: String }, // PDF des annexes DDT
  edlPdfPath: { type: String },
  generatedDocuments: [{
    kind: { type: String, enum: ['LEASE', 'GUARANTEE'] },
    template: { type: String },
    fileName: { type: String },
    mimeType: { type: String },
    docxPath: { type: String },
    pdfPath: { type: String },
    createdAt: { type: Date, default: Date.now },
  }],
  
}, { timestamps: true });

// Validation: endDate > startDate
LeaseSchema.pre('save', function(next) {
  if (this.endDate && this.startDate && this.endDate <= this.startDate) {
    return next(new Error('La date de fin doit être postérieure à la date de début.'));
  }
  next();
});

// Validation: dépôt de garantie selon le type de bail (loi ALUR / loi ELAN)
LeaseSchema.pre('save', function(next) {
  const deposit = this.depositAmount || 0;
  const rent = this.rentAmount || 0;
  const type = (this.leaseType || '').toUpperCase();

  if (type === 'MOBILITE' && deposit !== 0) {
    return next(new Error('Le dépôt de garantie doit être de 0 € pour un bail mobilité.'));
  }
  if ((type === 'VIDE' || type === 'NU') && deposit > rent) {
    return next(new Error('Le dépôt de garantie ne peut excéder 1 mois de loyer HC pour un bail nu.'));
  }
  if (type === 'MEUBLE' && deposit > 2 * rent) {
    return next(new Error('Le dépôt de garantie ne peut excéder 2 mois de loyer HC pour un bail meublé.'));
  }
  next();
});

LeaseSchema.index({ user: 1, property: 1 });
LeaseSchema.index({ property: 1 });
LeaseSchema.index({ candidature: 1 });
LeaseSchema.index({ applicationId: 1 });

// Éviter la recompilation du modèle dans Next.js
module.exports = mongoose.models.Lease || mongoose.model('Lease', LeaseSchema);
