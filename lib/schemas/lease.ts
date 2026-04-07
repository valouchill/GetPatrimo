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
 * Schéma Zod pour le formulaire de création de bail.
 * Règles dépôt de garantie :
 * - Mobilité : dépôt = 0 €
 * - Vide : dépôt ≤ 1 mois loyer HC
 * - Meublé : dépôt ≤ 2 mois loyer HC
 */
export const LeaseSchema = z.object({
  // Core
  leaseType: z.enum(['VIDE', 'MEUBLE', 'MOBILITE', 'GARAGE_PARKING'], {
    error: 'Type de bail requis',
  }),
  startDate: z.string().min(1, 'Date de début requise'),
  paymentDay: z.number().int().min(1, 'Jour entre 1 et 31').max(31, 'Jour entre 1 et 31'),
  rentHC: z.number({ error: 'Montant invalide' }).min(0, 'Le loyer ne peut pas être négatif'),
  charges: z.number({ error: 'Montant invalide' }).min(0, 'Les charges ne peuvent pas être négatives'),
  deposit: z.number({ error: 'Montant invalide' }).min(0, 'Le dépôt ne peut pas être négatif'),
  durationMonths: z.number().int().min(1, 'Durée minimale : 1 mois'),
  clauses: z.string().max(2000, 'Clauses trop longues (2000 caractères max)').optional(),

  // Caractéristiques du bien
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

  // Financier étendu
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

  // Mobilité
  mobilityReason: z.string().optional(),

  // Garant
  guarantorOverrides: GuarantorOverridesSchema,

  // Usage & clauses structurées
  usageMixte: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  sublettingAllowed: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.leaseType === 'MOBILITE' && data.deposit !== 0) return false;
    return true;
  },
  { message: 'Le dépôt de garantie doit être de 0 € pour un bail mobilité', path: ['deposit'] }
).refine(
  (data) => {
    if (data.leaseType === 'VIDE' && data.deposit > data.rentHC) return false;
    return true;
  },
  { message: 'Pour un bail vide, le dépôt de garantie ne peut excéder 1 mois de loyer HC', path: ['deposit'] }
).refine(
  (data) => {
    if (data.leaseType === 'MEUBLE' && data.deposit > 2 * data.rentHC) return false;
    return true;
  },
  { message: 'Pour un bail meublé, le dépôt de garantie ne peut excéder 2 mois de loyer HC', path: ['deposit'] }
).refine(
  (data) => {
    if (data.leaseType === 'MOBILITE' && data.durationMonths > 10) return false;
    return true;
  },
  { message: 'Un bail mobilité ne peut excéder 10 mois', path: ['durationMonths'] }
);

export type LeaseFormData = z.infer<typeof LeaseSchema>;
