import { z } from 'zod';

/**
 * Schéma Zod pour le formulaire de candidature locataire.
 */
export const ApplySchema = z.object({
  firstName: z.string().min(1, 'Prénom requis').max(100),
  lastName: z.string().min(1, 'Nom requis').max(100),
  email: z.string().email('Email invalide'),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Numéro de téléphone invalide').optional().or(z.literal('')),
  monthlyNetIncome: z.number({ error: 'Montant invalide' }).min(0, 'Le revenu ne peut pas être négatif'),
  employmentType: z.enum(['CDI', 'CDD', 'FREELANCE', 'FONCTIONNAIRE', 'RETRAITE', 'ETUDIANT', 'AUTRE'], {
    error: 'Type de contrat requis',
  }),
  hasGuarantor: z.boolean(),
  guarantorType: z.enum(['NONE', 'PHYSIQUE', 'VISALE']).optional(),
  moveInDate: z.string().min(1, 'Date d\'emménagement requise').optional(),
  message: z.string().max(500, 'Message trop long (500 caractères max)').optional(),
});

export type ApplyFormData = z.infer<typeof ApplySchema>;
