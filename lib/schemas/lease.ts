import { z } from 'zod';

const GuarantorOverridesSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  address: z.string().optional(),
  zipCode: z.string().optional(),
  city: z.string().optional(),
  birthDate: z.string().optional(),
}).optional();

/**
 * Sch\u00e9ma Zod pour le formulaire de cr\u00e9ation de bail.
 * R\u00e8gles d\u00e9p\u00f4t de garantie :
 * - Mobilit\u00e9 : d\u00e9p\u00f4t = 0 \u20ac
 * - Nu/Vide : d\u00e9p\u00f4t \u2264 1 mois loyer HC
 * - Meubl\u00e9 : d\u00e9p\u00f4t \u2264 2 mois loyer HC
 */
export const LeaseSchema = z.object({
  // Core
  leaseType: z.enum(['NUE', 'MEUBLEE', 'MOBILITE', 'GARAGE_PARKING'], {
    error: 'Type de bail requis',
  }),
  startDate: z.string().min(1, 'Date de d\u00e9but requise'),
  paymentDay: z.number().int().min(1, 'Jour entre 1 et 31').max(31, 'Jour entre 1 et 31'),
  rentHC: z.number({ error: 'Montant invalide' }).min(0, 'Le loyer ne peut pas \u00eatre n\u00e9gatif'),
  charges: z.number({ error: 'Montant invalide' }).min(0, 'Les charges ne peuvent pas \u00eatre n\u00e9gatives'),
  deposit: z.number({ error: 'Montant invalide' }).min(0, 'Le d\u00e9p\u00f4t ne peut pas \u00eatre n\u00e9gatif'),
  durationMonths: z.number().int().min(1, 'Dur\u00e9e minimale : 1 mois'),
  clauses: z.string().max(2000, 'Clauses trop longues (2000 caract\u00e8res max)').optional(),

  // Caract\u00e9ristiques du bien
  surfaceHabitable: z.number().positive().optional(),
  rooms: z.number().int().positive().optional(),
  typeHabitat: z.enum(['collectif', 'individuel']).optional(),
  constructionYear: z.number().int().min(1600).max(2030).optional(),
  dpeClass: z.string().max(1).optional(),
  dpeDate: z.string().optional(),
  energyEstimate: z.string().optional(),
  modeChauffage: z.string().optional(),
  modeEauChaude: z.string().optional(),
  regimeJuridique: z.enum(['monopropriete', 'copropriete']).optional(),

  // Accessoires
  balcony: z.boolean().optional(),
  terrace: z.boolean().optional(),
  garden: z.boolean().optional(),
  loggia: z.boolean().optional(),
  caveNumero: z.string().optional(),
  garageNumero: z.string().optional(),
  parkingNumber: z.string().optional(),
  garageVelo: z.boolean().optional(),
  grenier: z.boolean().optional(),
  comble: z.boolean().optional(),
  airesJeux: z.boolean().optional(),
  ascenseur: z.boolean().optional(),
  espacesVerts: z.boolean().optional(),
  gardiennage: z.boolean().optional(),
  laverie: z.boolean().optional(),
  localPoubelle: z.boolean().optional(),
  accessoireAutre: z.string().optional(),
  partiesCommunesAutres: z.string().optional(),

  // Financier \u00e9tendu
  loyerRevise: z.boolean().optional(),
  irlReference: z.string().optional(),
  irlReferenceDate: z.string().optional(),
  irlQuarterReference: z.string().optional(),
  loyerReference: z.string().optional(),
  loyerReferenceMajore: z.string().optional(),
  complementLoyer: z.string().optional(),
  soumisDecretRelocation: z.boolean().optional(),
  soumisLoyerReferenceMajore: z.boolean().optional(),
  paymentInArrears: z.boolean().optional(),

  // Paiement
  paymentMode: z.string().optional(),
  paymentLocation: z.string().optional(),

  // Mandataire
  hasMandataire: z.boolean().optional(),
  mandataireNomPrenom: z.string().optional(),
  mandataireDenomination: z.string().optional(),
  mandataireAdresse: z.string().optional(),
  mandataireActivite: z.string().optional(),
  mandataireCartePro: z.string().optional(),
  isSocieteCivile: z.boolean().optional(),

  // Mobilit\u00e9
  mobilityReason: z.string().optional(),

  // Garant
  guarantorOverrides: GuarantorOverridesSchema,

  // Usage & clauses structur\u00e9es
  usageMixte: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  sublettingAllowed: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.leaseType === 'MOBILITE' && data.deposit !== 0) return false;
    return true;
  },
  { message: 'Le d\u00e9p\u00f4t de garantie doit \u00eatre de 0 \u20ac pour un bail mobilit\u00e9', path: ['deposit'] }
).refine(
  (data) => {
    if (data.leaseType === 'NUE' && data.deposit > data.rentHC) return false;
    return true;
  },
  { message: 'Pour un bail nu, le d\u00e9p\u00f4t de garantie ne peut exc\u00e9der 1 mois de loyer HC', path: ['deposit'] }
).refine(
  (data) => {
    if (data.leaseType === 'MEUBLEE' && data.deposit > 2 * data.rentHC) return false;
    return true;
  },
  { message: 'Pour un bail meubl\u00e9, le d\u00e9p\u00f4t de garantie ne peut exc\u00e9der 2 mois de loyer HC', path: ['deposit'] }
).refine(
  (data) => {
    if (data.leaseType === 'MOBILITE' && data.durationMonths > 10) return false;
    return true;
  },
  { message: 'Un bail mobilit\u00e9 ne peut exc\u00e9der 10 mois', path: ['durationMonths'] }
);

export type LeaseFormData = z.infer<typeof LeaseSchema>;
