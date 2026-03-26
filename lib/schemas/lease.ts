import { z } from 'zod';

/**
 * Schéma Zod pour le formulaire de création de bail.
 * Règles dépôt de garantie :
 * - Mobilité : dépôt = 0 €
 * - Nu/Vide : dépôt ≤ 1 mois loyer HC
 * - Meublé : dépôt ≤ 2 mois loyer HC
 */
export const LeaseSchema = z.object({
  leaseType: z.enum(['NUE', 'MEUBLEE', 'MOBILITE'], {
    error: 'Type de bail requis',
  }),
  startDate: z.string().min(1, 'Date de début requise'),
  paymentDay: z.number().int().min(1, 'Jour entre 1 et 31').max(31, 'Jour entre 1 et 31'),
  rentHC: z.number({ error: 'Montant invalide' }).min(0, 'Le loyer ne peut pas être négatif'),
  charges: z.number({ error: 'Montant invalide' }).min(0, 'Les charges ne peuvent pas être négatives'),
  deposit: z.number({ error: 'Montant invalide' }).min(0, 'Le dépôt ne peut pas être négatif'),
  durationMonths: z.number().int().min(1, 'Durée minimale : 1 mois'),
  clauses: z.string().max(2000, 'Clauses trop longues (2000 caractères max)').optional(),
}).refine(
  (data) => {
    if (data.leaseType === 'MOBILITE' && data.deposit !== 0) return false;
    return true;
  },
  { message: 'Le dépôt de garantie doit être de 0 € pour un bail mobilité', path: ['deposit'] }
).refine(
  (data) => {
    if (data.leaseType === 'NUE' && data.deposit > data.rentHC) return false;
    return true;
  },
  { message: 'Pour un bail nu, le dépôt de garantie ne peut excéder 1 mois de loyer HC', path: ['deposit'] }
).refine(
  (data) => {
    if (data.leaseType === 'MEUBLEE' && data.deposit > 2 * data.rentHC) return false;
    return true;
  },
  { message: 'Pour un bail meublé, le dépôt de garantie ne peut excéder 2 mois de loyer HC', path: ['deposit'] }
);

export type LeaseFormData = z.infer<typeof LeaseSchema>;
