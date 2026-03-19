const mongoose = require('mongoose');

/**
 * Modèle Application - Dossier de candidature locataire
 * Stocke l'état complet du tunnel, les documents, l'analyse IA et le score
 */
const ApplicationSchema = new mongoose.Schema({
  // Lien vers l'utilisateur authentifié (NextAuth)
  userId: { type: String, index: true },
  userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  
  // Lien vers la propriété
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  applyToken: { type: String, index: true },
  
  // Informations personnelles
  profile: {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    phone: { type: String, default: '' },
    birthDate: { type: String, default: '' },
    status: { type: String, default: 'Etudiant' },
  },
  
  // État du tunnel
  tunnel: {
    currentStep: { type: Number, default: 0 }, // 0-4 pour les 5 étapes
    completedSteps: [{ type: Number }],
    startedAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    progress: { type: Number, default: 0, min: 0, max: 100 }, // Pourcentage global
    chapterStates: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  
  // Certification Didit
  didit: {
    sessionId: { type: String },
    status: { type: String, enum: ['PENDING', 'VERIFIED', 'FAILED'], default: 'PENDING' },
    verifiedAt: { type: Date },
    identityData: {
      firstName: { type: String },
      lastName: { type: String },
      birthDate: { type: String },
    },
  },
  
  // Documents uploadés et analysés
  documents: [{
    id: { type: String },
    category: { type: String, enum: ['identity', 'income', 'address', 'guarantor'] },
    subjectType: { type: String, enum: ['tenant', 'guarantor', 'visale'], default: 'tenant' },
    subjectSlot: { type: Number, enum: [1, 2] },
    type: { type: String }, // BULLETIN_SALAIRE, AVIS_IMPOSITION, etc.
    fileName: { type: String },
    fileUrl: { type: String },
    status: { type: String, enum: ['pending', 'analyzing', 'certified', 'flagged', 'rejected', 'illegible', 'needs_review'], default: 'pending' },
    uploadedAt: { type: Date, default: Date.now },
    
    // Analyse IA
    aiAnalysis: {
      documentMetadata: mongoose.Schema.Types.Mixed,
      financialData: mongoose.Schema.Types.Mixed,
      trustAndSecurity: mongoose.Schema.Types.Mixed,
      aiAdvice: mongoose.Schema.Types.Mixed,
    },
  }],
  
  // Données financières agrégées
  financialSummary: {
    totalMonthlyIncome: { type: Number, default: 0 },
    incomeSource: { type: String }, // SALARY, PENSION, STUDENT, etc.
    certifiedIncome: { type: Boolean, default: false },
  },
  
  // Garant
  guarantor: {
    hasGuarantor: { type: Boolean, default: false },
    guarantorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guarantor' },
    status: { type: String, enum: ['NONE', 'PENDING', 'CERTIFIED', 'AUDITED'], default: 'NONE' },
    certificationMethod: { type: String, enum: ['DIDIT', 'AUDIT', 'VISALE'] },
  },

  guarantee: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  
  // PatrimoMeter™ Score
  patrimometer: {
    score: { type: Number, default: 0, min: 0, max: 100 },
    grade: { type: String, enum: ['F', 'E', 'D', 'C', 'B', 'A', 'SOUVERAIN'], default: 'F' },
    badges: [{
      id: { type: String },
      label: { type: String },
      earnedAt: { type: Date },
    }],
    breakdown: { type: mongoose.Schema.Types.Mixed, default: {} },
    warnings: [{ type: String }],
    nextAction: { type: mongoose.Schema.Types.Mixed, default: null },
    chapterStates: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastCalculatedAt: { type: Date },
  },
  
  // Statut global
  status: { 
    type: String, 
    enum: ['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'COMPLETE', 'SUBMITTED', 'ACCEPTED', 'REJECTED'],
    default: 'DRAFT'
  },
  
  // Coordonnées vérifiées
  contactVerified: {
    email: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date },
    phone: { type: Boolean, default: false },
    phoneVerifiedAt: { type: Date },
  },
  
  // Magic Link pour accès sans mot de passe
  magicLinkToken: { type: String, index: true },
  magicLinkExpires: { type: Date },
  
  // Métadonnées
  submittedAt: { type: Date },
  viewedByOwnerAt: { type: Date },
  ownerDecision: { type: String, enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'WAITLIST'], default: 'PENDING' },
  ownerNotes: { type: String },

  // Passeport PatrimoTrust™ — partage viral (lien unique, QR, stats visibilité)
  passportSlug: { type: String, sparse: true, unique: true, trim: true },
  passportViewCount: { type: Number, default: 0 },
  passportShareCount: { type: Number, default: 0 },
  passportLastViewedAt: { type: Date },

}, { timestamps: true });

// Index pour recherche rapide
ApplicationSchema.index({ userEmail: 1, applyToken: 1 });
ApplicationSchema.index({ userId: 1, status: 1 });
ApplicationSchema.index({ 'tunnel.lastActiveAt': -1 });

// Méthode pour calculer le grade basé sur le score
ApplicationSchema.methods.calculateGrade = function() {
  const score = this.patrimometer.score;
  if (score >= 90) return 'SOUVERAIN';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  if (score >= 40) return 'E';
  return 'F';
};

// Méthode pour calculer le progrès
ApplicationSchema.methods.calculateProgress = function() {
  const passportState = this.patrimometer?.chapterStates?.passport?.state;
  if (passportState === 'ready' || passportState === 'sealed' || this.patrimometer?.chapterStates?.passport?.ready) {
    return 100;
  }

  const score = Number(this.patrimometer?.score || 0);
  return Math.min(100, Math.max(0, score));
};

module.exports = mongoose.models.Application || mongoose.model('Application', ApplicationSchema);
