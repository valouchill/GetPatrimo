const mongoose = require('mongoose');

// --- Sous-schémas typés (remplacent Schema.Types.Mixed) ---

const AiAnalysisSchema = new mongoose.Schema({
  documentType: { type: String, default: '' },
  confidence: { type: Number, default: 0, min: 0, max: 1 },
  extractedFields: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  flags: [{ type: String }],
  summary: { type: String, default: '' },
  fraudScore: { type: Number, default: 0 },
}, { _id: false, strict: false });

const GuaranteeSchema = new mongoose.Schema({
  type: { type: String, default: '' },
  guarantorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guarantor' },
  amount: { type: Number, default: 0 },
  provider: { type: String, default: '' },
  visaleNumber: { type: String, default: '' },
}, { _id: false, strict: false });

const BreakdownSchema = new mongoose.Schema({
  loyer: { type: Number, default: 0 },
  charges: { type: Number, default: 0 },
  totalTTC: { type: Number, default: 0 },
  identity: { type: Number, default: 0 },
  income: { type: Number, default: 0 },
  activity: { type: Number, default: 0 },
  housing: { type: Number, default: 0 },
  guarantor: { type: Number, default: 0 },
}, { _id: false, strict: false });

const ChapterStateSchema = new mongoose.Schema({
  state: { type: String, default: '' },
  ready: { type: Boolean, default: false },
  completedAt: { type: Date },
}, { _id: false, strict: false });

const NextActionSchema = new mongoose.Schema({
  type: { type: String, default: '' },
  label: { type: String, default: '' },
  target: { type: String, default: '' },
}, { _id: false, strict: false });

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
    chapterStates: { type: Map, of: ChapterStateSchema, default: {} },
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
    category: { type: String, enum: ['IDENTITY', 'INCOME', 'ADDRESS', 'GUARANTOR'] },
    subjectType: { type: String, enum: ['TENANT', 'GUARANTOR', 'VISALE'], default: 'TENANT' },
    subjectSlot: { type: Number, enum: [1, 2] },
    type: { type: String }, // BULLETIN_SALAIRE, AVIS_IMPOSITION, etc.
    fileName: { type: String },
    fileUrl: { type: String },
    status: { type: String, enum: ['PENDING', 'ANALYZING', 'CERTIFIED', 'FLAGGED', 'REJECTED', 'ILLEGIBLE', 'NEEDS_REVIEW'], default: 'PENDING' },
    uploadedAt: { type: Date, default: Date.now },
    
    // Analyse IA
    aiAnalysis: { type: AiAnalysisSchema, default: null },
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

  guarantee: { type: GuaranteeSchema, default: null },
  
  // PatrimoMeter™ Score
  patrimometer: {
    score: { type: Number, default: 0, min: 0, max: 100 },
    grade: { type: String, enum: ['F', 'E', 'D', 'C', 'B', 'A', 'SOUVERAIN'], default: 'F' },
    badges: [{
      id: { type: String },
      label: { type: String },
      earnedAt: { type: Date },
    }],
    breakdown: { type: BreakdownSchema, default: {} },
    warnings: [{ type: String }],
    nextAction: { type: NextActionSchema, default: null },
    chapterStates: { type: Map, of: ChapterStateSchema, default: {} },
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
ApplicationSchema.index({ property: 1 });
ApplicationSchema.index({ property: 1, status: 1 });
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
