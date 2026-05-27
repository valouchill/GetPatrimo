/**
 * Schéma Zod strict pour la sortie du LLM (Structured Outputs OpenAI).
 *
 * Architecture Neuro-Symbolique :
 *   - Le LLM extrait des données structurées dans CE format exact (jamais
 *     de score final, jamais de calcul agrégé)
 *   - Le code déterministe (lib/ai/tenant-analyzer.ts) calcule l'Indice
 *     de Résilience à partir des subScores + flags
 *
 * Garantie : aucune hallucination de score, cohérence absolue
 * (impossible d'avoir 95/100 sans CNI car les hard gates plafonnent).
 */

import { z } from 'zod';

export const AIAnalysisSchema = z.object({
  flags: z.object({
    isFraudDetected: z
      .boolean()
      .describe(
        'True si le document semble modifié, falsifié ou illogique mathématiquement.',
      ),
    isDossierComplete: z
      .boolean()
      .describe(
        'True si toutes les pièces majeures (CNI, Paie, Impôts) sont présentes et lisibles.',
      ),
    isIncomeSufficient: z
      .boolean()
      .describe(
        'True si le loyer représente moins de 35% des revenus nets, ou si un garant très solide compense.',
      ),
  }),
  subScores: z.object({
    financialStability: z
      .number()
      .min(0)
      .max(10)
      .describe('Note sur 10 de la stabilité financière'),
    documentAuthenticity: z
      .number()
      .min(0)
      .max(10)
      .describe('Note sur 10 de l\'authenticité (0 si fraude)'),
    professionalReliability: z
      .number()
      .min(0)
      .max(10)
      .describe('Note sur 10 de la situation pro'),
  }),
  synthesis: z.object({
    title: z
      .string()
      .describe(
        'Titre statutaire de l\'analyse (ex: Dossier d\'excellence, Vigilance requise)',
      ),
    executiveSummary: z
      .string()
      .describe('Résumé de l\'analyse en 3 phrases maximum. Ton rassurant et professionnel.'),
    anomaliesFound: z
      .array(z.string())
      .describe('Liste des problèmes. Tableau vide si parfait.'),
  }),
  ownerRecommendation: z.object({
    decisionAdvice: z
      .enum(['GO_FAST', 'MANUAL_CHECK', 'REJECT'])
      .describe('Le conseil global'),
    actionPlan: z
      .array(z.string())
      .describe(
        '1 à 3 actions concrètes (To-Do list) pour le propriétaire (ex: \'Validez ce dossier\', \'Réclamez l\'attestation employeur\').',
      ),
  }),
});

export type AIAnalysisType = z.infer<typeof AIAnalysisSchema>;

/**
 * Schéma de l'input que l'on transmet au LLM (les éléments du dossier
 * candidat sans pré-jugement). Pas envoyé tel quel à OpenAI — sérialisé
 * en prompt structuré dans tenant-analyzer.ts.
 */
export const AnalysisInputSchema = z.object({
  /** Identifiant de la candidature (pour traçabilité log) */
  applicationId: z.string().optional(),

  /** Profil candidat */
  candidate: z.object({
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    profession: z.string().nullable().optional(),
    employer: z.string().nullable().optional(),
    contractType: z.string().nullable().optional(),
    seniorityMonths: z.number().nullable().optional(),
  }),

  /** Données financières mesurées */
  financial: z.object({
    monthlyIncomeNet: z.number().nullable().optional(),
    targetRent: z.number().nullable().optional(),
    effortRatePercent: z.number().nullable().optional(),
    incomeStabilityMonths: z.number().nullable().optional(),
    taxIncomeAnnual: z.number().nullable().optional(),
    /** Sources : 'PAYSLIP' | 'TAX_NOTICE' | 'BANK' | 'DECLARED' */
    incomeSource: z.string().nullable().optional(),
  }),

  /** Statut identité */
  identity: z.object({
    diditVerified: z.boolean().optional(),
    cniPresent: z.boolean().optional(),
  }),

  /** Garantie */
  guarantee: z.object({
    mode: z.enum(['NONE', 'VISALE', 'PHYSICAL']).optional(),
    guarantorIncomeNet: z.number().nullable().optional(),
    coverage: z.string().nullable().optional(),
  }),

  /** Couverture documentaire (par catégorie) */
  documents: z.object({
    identityProvided: z.boolean(),
    payslipsCount: z.number(),
    taxNoticeProvided: z.boolean(),
    addressProofProvided: z.boolean(),
    employerCertificateProvided: z.boolean(),
    rejectedCount: z.number(),
    forensicAlertCount: z.number(),
  }),

  /** Audit forensic global (statut CLEAR / REVIEW / ALERT) */
  forensic: z.object({
    globalStatus: z.enum(['CLEAR', 'REVIEW', 'ALERT', 'PENDING']),
    suspiciousSoftwareDetected: z.boolean().optional(),
    mathematicalInconsistencies: z.boolean().optional(),
  }),
});

export type AnalysisInputType = z.infer<typeof AnalysisInputSchema>;

/**
 * JSON Schema (Draft-7 compatible OpenAI Structured Outputs) dérivé
 * manuellement du schéma Zod ci-dessus. Important : utiliser `strict: true`
 * côté OpenAI et `additionalProperties: false` partout.
 *
 * Note : on ne génère pas via zod-to-json-schema pour garder un contrôle
 * exact des descriptions et des contraintes propres à OpenAI (notamment
 * la limitation à minimum/maximum numériques sans `exclusiveMinimum`).
 */
export const AI_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['flags', 'subScores', 'synthesis', 'ownerRecommendation'],
  properties: {
    flags: {
      type: 'object',
      additionalProperties: false,
      required: ['isFraudDetected', 'isDossierComplete', 'isIncomeSufficient'],
      properties: {
        isFraudDetected: {
          type: 'boolean',
          description:
            'True si le document semble modifié, falsifié ou illogique mathématiquement.',
        },
        isDossierComplete: {
          type: 'boolean',
          description:
            'True si toutes les pièces majeures (CNI, Paie, Impôts) sont présentes et lisibles.',
        },
        isIncomeSufficient: {
          type: 'boolean',
          description:
            'True si le loyer représente moins de 35% des revenus nets, ou si un garant très solide compense.',
        },
      },
    },
    subScores: {
      type: 'object',
      additionalProperties: false,
      required: ['financialStability', 'documentAuthenticity', 'professionalReliability'],
      properties: {
        financialStability: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description: 'Note sur 10 de la stabilité financière',
        },
        documentAuthenticity: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description: 'Note sur 10 de l\'authenticité (0 si fraude)',
        },
        professionalReliability: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description: 'Note sur 10 de la situation pro',
        },
      },
    },
    synthesis: {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'executiveSummary', 'anomaliesFound'],
      properties: {
        title: {
          type: 'string',
          description:
            'Titre statutaire de l\'analyse (ex: Dossier d\'excellence, Vigilance requise)',
        },
        executiveSummary: {
          type: 'string',
          description:
            'Résumé de l\'analyse en 3 phrases maximum. Ton rassurant et professionnel.',
        },
        anomaliesFound: {
          type: 'array',
          items: { type: 'string' },
          description: 'Liste des problèmes. Tableau vide si parfait.',
        },
      },
    },
    ownerRecommendation: {
      type: 'object',
      additionalProperties: false,
      required: ['decisionAdvice', 'actionPlan'],
      properties: {
        decisionAdvice: {
          type: 'string',
          enum: ['GO_FAST', 'MANUAL_CHECK', 'REJECT'],
          description: 'Le conseil global',
        },
        actionPlan: {
          type: 'array',
          items: { type: 'string' },
          description: '1 à 3 actions concrètes (To-Do list) pour le propriétaire.',
        },
      },
    },
  },
} as const;
