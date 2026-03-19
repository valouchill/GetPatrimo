#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../models/User');
const Property = require('../models/Property');
const Application = require('../models/Application');
const Guarantor = require('../models/Guarantor');
const { computeApplicationPatrimometer } = require('../src/utils/applicationScoring');
const { buildPassportViewModel } = require('../src/utils/passportViewModel');
const { resolveLocalMongoUri } = require('./resolve-local-mongo-uri');

const OUTPUT_DIR = path.join(__dirname, '..', '.e2e');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'seed-output.json');
const BASE_URL = String(process.env.E2E_BASE_URL || 'http://127.0.0.1:3101').replace(/\/$/, '');
const NOW = new Date();

const PERSONAS = {
  owner: {
    email: (process.env.E2E_OWNER_EMAIL || 'e2e.owner@doc2loc.local').toLowerCase(),
    firstName: 'Valentin-Auguste',
    lastName: 'de Montferrand',
    phone: '0601020304',
    address: '145 avenue du General de Gaulle',
    zipCode: '75016',
    city: 'Paris',
    plan: 'PRO',
  },
  tenant: {
    email: (process.env.E2E_TENANT_EMAIL || 'e2e.tenant@doc2loc.local').toLowerCase(),
    firstName: 'Alexandrine-Marie-Claire',
    lastName: 'de La Rochefoucauld-Dupont',
    phone: '0611223344',
    address: '47 boulevard des Horizons, Batiment A, Appartement 1204',
    zipCode: '69006',
    city: 'Lyon',
  },
  guarantor: {
    email: (process.env.E2E_GUARANTOR_EMAIL || 'e2e.guarantor@doc2loc.local').toLowerCase(),
    firstName: 'Jean-Baptiste',
    lastName: 'de Saint-Remy',
    phone: '0622334455',
    address: '18 avenue des Tilleuls',
    zipCode: '33000',
    city: 'Bordeaux',
  },
};

function buildDoc({
  id,
  category = 'income',
  subjectType = 'tenant',
  subjectSlot,
  type,
  status = 'certified',
  fileName,
  dateEmission,
  flagged = false,
  aiAnalysis,
}) {
  return {
    id,
    category,
    subjectType,
    subjectSlot,
    type,
    fileName: fileName || `${type.toLowerCase()}-${id}.pdf`,
    fileUrl: `/uploads/e2e/${fileName || `${type.toLowerCase()}-${id}.pdf`}`,
    status,
    flagged,
    uploadedAt: dateEmission || NOW.toISOString(),
    dateEmission,
    aiAnalysis,
  };
}

function buildStrongTenantDocs() {
  return [
    buildDoc({ id: 'id', category: 'identity', type: 'CARTE_IDENTITE', dateEmission: '2026-03-01' }),
    buildDoc({ id: 'salary-1', type: 'BULLETIN_SALAIRE', dateEmission: '2026-02-28' }),
    buildDoc({ id: 'salary-2', type: 'BULLETIN_SALAIRE', dateEmission: '2026-01-28' }),
    buildDoc({ id: 'salary-3', type: 'BULLETIN_SALAIRE', dateEmission: '2025-12-28' }),
    buildDoc({ id: 'tax', type: 'AVIS_IMPOSITION', dateEmission: '2025-09-01' }),
    buildDoc({
      id: 'employment',
      type: 'ATTESTATION_EMPLOYEUR',
      fileName: 'attestation_employeur_confirmed.pdf',
      dateEmission: '2026-03-01',
    }),
    buildDoc({ id: 'home', category: 'address', type: 'JUSTIFICATIF_DOMICILE', dateEmission: '2026-03-03' }),
  ];
}

function buildReviewDocs() {
  return [
    ...buildStrongTenantDocs(),
    buildDoc({
      id: 'guarantor-id',
      category: 'guarantor',
      subjectType: 'guarantor',
      subjectSlot: 1,
      type: 'CARTE_IDENTITE',
      dateEmission: '2026-02-10',
    }),
    buildDoc({
      id: 'guarantor-salary-1',
      category: 'guarantor',
      subjectType: 'guarantor',
      subjectSlot: 1,
      type: 'BULLETIN_SALAIRE',
      dateEmission: '2026-02-27',
    }),
    buildDoc({
      id: 'guarantor-salary-2',
      category: 'guarantor',
      subjectType: 'guarantor',
      subjectSlot: 1,
      type: 'BULLETIN_SALAIRE',
      dateEmission: '2026-01-27',
    }),
    buildDoc({
      id: 'guarantor-salary-3',
      category: 'guarantor',
      subjectType: 'guarantor',
      subjectSlot: 1,
      type: 'BULLETIN_SALAIRE',
      dateEmission: '2025-12-27',
    }),
    buildDoc({
      id: 'guarantor-tax',
      category: 'guarantor',
      subjectType: 'guarantor',
      subjectSlot: 1,
      type: 'AVIS_IMPOSITION',
      dateEmission: '2025-09-15',
    }),
    buildDoc({
      id: 'guarantor-home-review',
      category: 'guarantor',
      subjectType: 'guarantor',
      subjectSlot: 1,
      type: 'JUSTIFICATIF_DOMICILE',
      status: 'needs_review',
      dateEmission: '2026-03-04',
    }),
  ];
}

function buildVisaleDocs(maxRent) {
  return [
    ...buildStrongTenantDocs(),
    buildDoc({
      id: 'visale',
      category: 'income',
      subjectType: 'visale',
      type: 'CERTIFICAT_VISALE',
      dateEmission: '2026-03-05',
      fileName: 'certificat_visale_valide.pdf',
      aiAnalysis: {
        trust_and_security: {
          digital_seal_authenticated: true,
          fraud_score: 6,
          forensic_alerts: [],
        },
        financial_data: {
          extra_details: {
            visale: {
              loyer_maximum_garanti: maxRent,
            },
          },
        },
      },
    }),
  ];
}

function buildPatrimometer({
  profileStatus,
  diditStatus,
  rentAmount,
  detectedIncome,
  documents,
  guarantee,
}) {
  const computed = computeApplicationPatrimometer({
    candidateStatus: profileStatus,
    diditStatus: String(diditStatus || '').toLowerCase(),
    propertyRentAmount: rentAmount,
    detectedIncome,
    documents,
    guarantee,
  });

  return computed;
}

function buildApplicationShape({
  applicationId,
  property,
  profile,
  didit,
  documents,
  guarantee,
  financialSummary,
  status,
  currentStep,
  completedSteps,
  passportSlug,
  ownerNotes,
  createdAt,
  updatedAt,
  submittedAt,
  viewedByOwnerAt,
}) {
  const computed = buildPatrimometer({
    profileStatus: profile.status,
    diditStatus: didit.status,
    rentAmount: property.rentAmount,
    detectedIncome: financialSummary.totalMonthlyIncome,
    documents,
    guarantee,
  });

  const applicationForPassport = {
    _id: applicationId,
    status,
    profile,
    didit,
    documents,
    guarantee: computed.guarantee,
    financialSummary,
    property,
    passportSlug,
    passportViewCount: status === 'SUBMITTED' ? 18 : 4,
    passportShareCount: status === 'SUBMITTED' ? 6 : 1,
    createdAt,
    updatedAt,
    submittedAt,
  };

  const passport = buildPassportViewModel({
    application: applicationForPassport,
    audience: 'candidate',
    baseUrl: BASE_URL,
    slug: passportSlug,
  });

  const chapterStates = {
    ...computed.chapterStates,
    passport: {
      ...computed.chapterStates.passport,
      state: passport.state,
      ready: passport.state === 'ready' || passport.state === 'sealed',
      shareEnabled: passport.shareEnabled,
    },
  };

  return {
    profile,
    didit,
    documents,
    financialSummary,
    guarantee: computed.guarantee,
    guarantor: computed.legacyGuarantor,
    patrimometer: {
      score: computed.score,
      grade: computed.grade,
      breakdown: computed.breakdown,
      warnings: computed.warnings,
      nextAction: computed.nextAction,
      chapterStates,
      lastCalculatedAt: updatedAt,
    },
    tunnel: {
      currentStep,
      completedSteps,
      startedAt: createdAt,
      lastActiveAt: updatedAt,
      completedAt: status === 'COMPLETE' || status === 'SUBMITTED' ? updatedAt : null,
      progress: chapterStates.passport.ready ? 100 : Math.max(computed.score, currentStep * 20),
      chapterStates,
    },
    status,
    submittedAt,
    viewedByOwnerAt,
    ownerNotes,
    passportSlug,
    passportViewCount: status === 'SUBMITTED' ? 18 : 4,
    passportShareCount: status === 'SUBMITTED' ? 6 : 1,
    passportLastViewedAt: status === 'SUBMITTED' ? viewedByOwnerAt : null,
  };
}

async function upsertUser(definition) {
  return User.findOneAndUpdate(
    { email: definition.email },
    {
      $set: {
        email: definition.email,
        firstName: definition.firstName,
        lastName: definition.lastName,
        phone: definition.phone,
        address: definition.address,
        zipCode: definition.zipCode,
        city: definition.city,
        plan: definition.plan || 'FREE',
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function upsertProperty({ ownerId, name, address, city, zipCode, rentAmount, chargesAmount, surfaceM2, applyToken, acceptedTenantId }) {
  return Property.findOneAndUpdate(
    { applyToken },
    {
      $set: {
        user: ownerId,
        name,
        address,
        addressLine: address,
        city,
        zipCode,
        rentAmount,
        chargesAmount,
        surfaceM2,
        managed: true,
        archived: false,
        status: 'CANDIDATE_SELECTION',
        applyToken,
        acceptedTenantId: acceptedTenantId || null,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function upsertApplication({ filter, payload }) {
  return Application.findOneAndUpdate(
    filter,
    {
      $set: payload,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );
}

async function main() {
  const mongoUri = resolveLocalMongoUri(process.env.MONGO_URI);
  if (!mongoUri) {
    throw new Error('MONGO_URI manquant');
  }

  await mongoose.connect(mongoUri);

  const owner = await upsertUser(PERSONAS.owner);
  const tenant = await upsertUser(PERSONAS.tenant);
  const guarantorUser = await upsertUser(PERSONAS.guarantor);

  const strongProperty = await upsertProperty({
    ownerId: owner._id,
    name: 'Residence Panorama des Jardins de la Rive Gauche - Batiment Lumiere',
    address: '145 avenue du General de Gaulle, Batiment C, Appartement 47, 75016 Paris, Ile-de-France',
    city: 'Paris',
    zipCode: '75016',
    rentAmount: 1180,
    chargesAmount: 120,
    surfaceM2: 42,
    applyToken: 'PT-E2E-READY',
  });

  const reviewProperty = await upsertProperty({
    ownerId: owner._id,
    name: 'Les Terrasses du Parc - Suite Horizon',
    address: '88 allee des Cerisiers, Residence Les Terrasses du Parc, 69006 Lyon, Auvergne-Rhone-Alpes',
    city: 'Lyon',
    zipCode: '69006',
    rentAmount: 1320,
    chargesAmount: 140,
    surfaceM2: 54,
    applyToken: 'PT-E2E-REVIEW',
  });

  const visaleProperty = await upsertProperty({
    ownerId: owner._id,
    name: 'Atelier Canopée - Loft Signature',
    address: '12 rue des Tisserands, 33000 Bordeaux, Nouvelle-Aquitaine',
    city: 'Bordeaux',
    zipCode: '33000',
    rentAmount: 980,
    chargesAmount: 90,
    surfaceM2: 38,
    applyToken: 'PT-E2E-VISALE',
  });

  const baseProfile = {
    firstName: PERSONAS.tenant.firstName,
    lastName: PERSONAS.tenant.lastName,
    phone: PERSONAS.tenant.phone,
    birthDate: '1998-09-16',
    status: 'Salarie',
  };

  const strongDocuments = buildStrongTenantDocs();
  const strongShape = buildApplicationShape({
    applicationId: new mongoose.Types.ObjectId(),
    property: strongProperty.toObject(),
    profile: baseProfile,
    didit: {
      status: 'VERIFIED',
      verifiedAt: '2026-03-10T09:30:00.000Z',
      identityData: {
        firstName: PERSONAS.tenant.firstName,
        lastName: PERSONAS.tenant.lastName,
        birthDate: '1998-09-16',
      },
    },
    documents: strongDocuments,
    guarantee: { mode: 'NONE' },
    financialSummary: {
      totalMonthlyIncome: 4280,
      incomeSource: 'SALARY',
      certifiedIncome: true,
    },
    status: 'SUBMITTED',
    currentStep: 4,
    completedSteps: [0, 1, 2, 3, 4],
    passportSlug: 'e2e-camille-ready',
    ownerNotes: 'Dossier premium de reference pour le tunnel proprietaire et le passeport public.',
    createdAt: '2026-03-08T09:00:00.000Z',
    updatedAt: '2026-03-16T14:20:00.000Z',
    submittedAt: '2026-03-16T14:20:00.000Z',
    viewedByOwnerAt: '2026-03-16T16:00:00.000Z',
  });

  const strongApplication = await upsertApplication({
    filter: { userEmail: tenant.email, applyToken: strongProperty.applyToken },
    payload: {
      userId: String(tenant._id),
      userEmail: tenant.email,
      property: strongProperty._id,
      applyToken: strongProperty.applyToken,
      ...strongShape,
      contactVerified: {
        email: true,
        emailVerifiedAt: '2026-03-08T09:10:00.000Z',
        phone: true,
        phoneVerifiedAt: '2026-03-08T09:10:00.000Z',
      },
    },
  });

  const reviewDocuments = buildReviewDocs();
  const reviewShape = buildApplicationShape({
    applicationId: new mongoose.Types.ObjectId(),
    property: reviewProperty.toObject(),
    profile: baseProfile,
    didit: {
      status: 'VERIFIED',
      verifiedAt: '2026-03-12T08:45:00.000Z',
      identityData: {
        firstName: PERSONAS.tenant.firstName,
        lastName: PERSONAS.tenant.lastName,
        birthDate: '1998-09-16',
      },
    },
    documents: reviewDocuments,
    guarantee: {
      mode: 'PHYSICAL',
      guarantors: [
        {
          slot: 1,
          profile: 'Salarie',
          firstName: PERSONAS.guarantor.firstName,
          lastName: PERSONAS.guarantor.lastName,
          status: 'PENDING',
          certificationMethod: 'DIDIT',
          score: 0,
        },
      ],
    },
    financialSummary: {
      totalMonthlyIncome: 3020,
      incomeSource: 'SALARY',
      certifiedIncome: true,
    },
    status: 'IN_PROGRESS',
    currentStep: 3,
    completedSteps: [0, 1, 2],
    passportSlug: 'e2e-camille-review',
    ownerNotes: "Dossier de revue avec garant physique pour tester les warnings, l'UX des statuts et les ajustements responsive.",
    createdAt: '2026-03-09T10:00:00.000Z',
    updatedAt: '2026-03-16T12:05:00.000Z',
    submittedAt: null,
    viewedByOwnerAt: '2026-03-16T12:30:00.000Z',
  });

  const reviewApplication = await upsertApplication({
    filter: { userEmail: tenant.email, applyToken: reviewProperty.applyToken },
    payload: {
      userId: String(tenant._id),
      userEmail: tenant.email,
      property: reviewProperty._id,
      applyToken: reviewProperty.applyToken,
      ...reviewShape,
      contactVerified: {
        email: true,
        emailVerifiedAt: '2026-03-09T10:10:00.000Z',
        phone: true,
        phoneVerifiedAt: '2026-03-09T10:10:00.000Z',
      },
    },
  });

  const visaleDocuments = buildVisaleDocs(1150);
  const visaleShape = buildApplicationShape({
    applicationId: new mongoose.Types.ObjectId(),
    property: visaleProperty.toObject(),
    profile: baseProfile,
    didit: {
      status: 'VERIFIED',
      verifiedAt: '2026-03-11T11:00:00.000Z',
      identityData: {
        firstName: PERSONAS.tenant.firstName,
        lastName: PERSONAS.tenant.lastName,
        birthDate: '1998-09-16',
      },
    },
    documents: visaleDocuments,
    guarantee: {
      mode: 'VISALE',
      visale: {
        certified: true,
        compatibleWithRent: true,
        maxRent: 1150,
        digitalSeal: true,
        status: 'CERTIFIED',
      },
    },
    financialSummary: {
      totalMonthlyIncome: 3310,
      incomeSource: 'SALARY',
      certifiedIncome: true,
    },
    status: 'COMPLETE',
    currentStep: 4,
    completedSteps: [0, 1, 2, 3, 4],
    passportSlug: 'e2e-camille-visale',
    ownerNotes: 'Dossier Visale certifie pour auditer le mode garantie autonome.',
    createdAt: '2026-03-10T08:00:00.000Z',
    updatedAt: '2026-03-16T09:40:00.000Z',
    submittedAt: null,
    viewedByOwnerAt: '2026-03-16T10:00:00.000Z',
  });

  const visaleApplication = await upsertApplication({
    filter: { userEmail: tenant.email, applyToken: visaleProperty.applyToken },
    payload: {
      userId: String(tenant._id),
      userEmail: tenant.email,
      property: visaleProperty._id,
      applyToken: visaleProperty.applyToken,
      ...visaleShape,
      contactVerified: {
        email: true,
        emailVerifiedAt: '2026-03-10T08:10:00.000Z',
        phone: true,
        phoneVerifiedAt: '2026-03-10T08:10:00.000Z',
      },
    },
  });

  await Property.updateOne(
    { _id: strongProperty._id },
    {
      $set: {
        acceptedTenantId: strongApplication._id,
      },
    }
  );

  const seededGuarantor = await Guarantor.findOneAndUpdate(
    { invitationToken: 'e2e-guarantor-token-review' },
    {
      $set: {
        property: reviewProperty._id,
        applyToken: reviewProperty.applyToken,
        slot: 1,
        email: guarantorUser.email,
        firstName: PERSONAS.guarantor.firstName,
        lastName: PERSONAS.guarantor.lastName,
        status: 'PENDING',
        diditSessionId: '',
        identityVerification: {
          status: 'PENDING',
          firstName: '',
          lastName: '',
          birthDate: '',
          humanVerified: false,
        },
        invitationToken: 'e2e-guarantor-token-review',
        invitationSentAt: NOW,
        isDirectCertification: false,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    personas: {
      owner: { email: owner.email, id: String(owner._id) },
      tenant: { email: tenant.email, id: String(tenant._id) },
      guarantor: { email: guarantorUser.email, id: String(guarantorUser._id) },
    },
    properties: {
      strong: { id: String(strongProperty._id), applyToken: strongProperty.applyToken, name: strongProperty.name },
      review: { id: String(reviewProperty._id), applyToken: reviewProperty.applyToken, name: reviewProperty.name },
      visale: { id: String(visaleProperty._id), applyToken: visaleProperty.applyToken, name: visaleProperty.name },
    },
    applications: {
      strong: {
        id: String(strongApplication._id),
        applyToken: strongApplication.applyToken,
        passportSlug: strongApplication.passportSlug,
        status: strongApplication.status,
      },
      review: {
        id: String(reviewApplication._id),
        applyToken: reviewApplication.applyToken,
        passportSlug: reviewApplication.passportSlug,
        status: reviewApplication.status,
      },
      visale: {
        id: String(visaleApplication._id),
        applyToken: visaleApplication.applyToken,
        passportSlug: visaleApplication.passportSlug,
        status: visaleApplication.status,
      },
    },
    guarantor: {
      invitationToken: seededGuarantor.invitationToken,
      email: seededGuarantor.email,
    },
    routes: {
      home: '/',
      login: '/auth/login',
      fastTrack: '/fast-track',
      tenantDashboard: '/dashboard/tenant',
      ownerDashboard: '/dashboard/owner',
      applyStrong: `/apply/${strongProperty.applyToken}`,
      applyReview: `/apply/${reviewProperty.applyToken}`,
      applyVisale: `/apply/${visaleProperty.applyToken}`,
      successStrong: `/apply/success?candidatureId=${encodeURIComponent(String(strongApplication._id))}`,
      passportStrong: `/p/${encodeURIComponent(strongApplication.passportSlug)}`,
      verifyStrong: `/verify/${encodeURIComponent(strongApplication.passportSlug)}`,
      guarantorReview: `/verify-guarantor/${encodeURIComponent(seededGuarantor.invitationToken)}`,
      ownerPropertyStrong: `/dashboard/owner/property/${encodeURIComponent(String(strongProperty._id))}?applicationId=${encodeURIComponent(String(strongApplication._id))}`,
      ownerPropertyReview: `/dashboard/owner/property/${encodeURIComponent(String(reviewProperty._id))}?applicationId=${encodeURIComponent(String(reviewApplication._id))}`,
      leaseStrong: `/properties/${encodeURIComponent(String(strongProperty._id))}/contract?applicationId=${encodeURIComponent(String(strongApplication._id))}`,
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`E2E seed generated: ${OUTPUT_FILE}`);
  console.log(JSON.stringify(output, null, 2));

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('E2E seed failed:', error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
