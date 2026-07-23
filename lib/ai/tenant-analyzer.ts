/**
 * tenant-analyzer.ts — Moteur d'analyse neuro-symbolique des dossiers locataires.
 *
 * Architecture (V6.0) :
 *
 *   [LLM partie "Neuro"]
 *   - OpenAI GPT-4o avec Structured Outputs (response_format json_schema strict)
 *   - Sortie validée par Zod (AIAnalysisSchema)
 *   - Le LLM produit des flags, sub-scores, synthesis et recommandation
 *
 *   [Code partie "Symbolique"]
 *   - computeResilienceIndex() : algorithme déterministe
 *   - Hard gates qui plafonnent le score si flags critiques
 *   - Cohérence garantie : 95/100 impossible si CNI absente
 *
 * Avantages :
 *   - ZÉRO hallucination de score
 *   - Audit & reproductibilité du calcul (le LLM ne peut pas mentir
 *     sur le résultat final, il ne fait qu'extraire des observations)
 *   - Évolution du barème sans réentraîner / re-prompter le LLM
 *
 * Le scoring "patrimoCoreScore V3" (src/services/scoringService.js) reste
 * disponible pour les calculs Mongo historiques. Ce nouveau service est
 * complémentaire et destiné aux analyses à la demande.
 */

import 'server-only';
import OpenAI from 'openai';
import {
  AIAnalysisSchema,
  AI_ANALYSIS_JSON_SCHEMA,
  AnalysisInputSchema,
  type AIAnalysisType,
  type AnalysisInputType,
} from './analysis-schema';
import {
  calculateFinalScore,
  computeResilienceIndex,
  getGradeFromScore,
  type Level,
  type LevelAdvice,
  type LevelInfo,
  type LevelStatus,
  type ResilienceResult,
  type ScoringFlags,
  type SubScores,
} from './resilience-index';

// Re-export pour usage côté API + UI
export {
  calculateFinalScore,
  computeResilienceIndex,
  getGradeFromScore,
};
export type {
  Level,
  LevelAdvice,
  LevelInfo,
  LevelStatus,
  ResilienceResult,
  ScoringFlags,
  SubScores,
};

// ─── Configuration ───────────────────────────────────────────────────────────

const DEFAULT_MODEL = process.env.OPENAI_ANALYSIS_MODEL || 'gpt-4o-2024-08-06';
const DEFAULT_TIMEOUT_MS = 30_000;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY manquant dans l\'environnement.');
  }
  return new OpenAI({ apiKey, timeout: DEFAULT_TIMEOUT_MS });
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es un auditeur forensic de dossiers locatifs pour Maison Patrimo,
plateforme haut de gamme façon banque privée. Ton rôle : analyser le dossier
fourni et produire une analyse structurée OBJECTIVE et FACTUELLE.

RÈGLES STRICTES :
1. Tu produis EXCLUSIVEMENT du JSON conforme au schéma fourni — pas de texte libre.
2. Tu ne calcules JAMAIS de score global agrégé. Tu fournis uniquement les
   3 sub-scores sur 10 + les 3 flags booléens. L'algorithme déterministe
   calculera l'Indice de Résilience final à partir de tes observations.
3. Si une pièce majeure manque (CNI, fiches de paie, avis d'imposition),
   isDossierComplete=false ET tu listes la pièce dans anomaliesFound.
   EXCEPTION BIOMÉTRIE (eIDAS Didit) : si "Identité vérifiée Didit (eIDAS) = OUI",
   alors la CNI est considérée PRÉSENTE et AUTHENTIQUE à 100% (la biométrie
   eIDAS vaut plus qu'un scan PDF). Dans ce cas :
     - NE marque PAS isDossierComplete=false pour absence de CNI ;
       isDossierComplete=false UNIQUEMENT si une pièce NON-identité manque
       (fiches de paie, avis d'imposition).
     - documentAuthenticity ne doit PAS être pénalisé pour l'identité.
     - Valorise-le dans actionPlan, ex: "Identité biométrique certifiée
       eIDAS, sécurité maximale.".
4. Si tu détectes la moindre incohérence mathématique ou trace d'édition
   logicielle suspecte, isFraudDetected=true ET documentAuthenticity ≤ 2.
5. Le ratio loyer/revenus > 35% sans garant solide → isIncomeSufficient=false.
6. Ton synthesis.executiveSummary doit faire 3 phrases MAXIMUM, ton "banque
   privée" — rassurant, factuel, jamais alarmiste. Pas d'émojis.
7. ownerRecommendation.actionPlan : 1 à 3 actions concrètes formulées à
   l'impératif (ex: "Validez ce dossier", "Réclamez l'attestation employeur").
8. Si flags.isFraudDetected = true → decisionAdvice = "REJECT".
9. Si flags.isDossierComplete = false → decisionAdvice = "MANUAL_CHECK"
   minimum (jamais GO_FAST).
10. forensicAudit : tu DOIS produire 3 à 5 contrôles techniques anti-fraude
    pointus, exploitables dans une "Trust-List" et sur le Passeport PDF.
    Chaque contrôle = { checkName, status (VERIFIED|WARNING|ALERT), details }.
    Exemples de contrôles attendus (adapte aux pièces réellement présentes) :
      - "Métadonnées PDF"           — auteur, éditeur, dates de création
      - "Traces d'édition"          — détection Canva/Photoshop/Illustrator/GIMP
      - "Cohérence mathématique"    — totaux URSSAF, brut/net, cumuls annuels
      - "Provenance fiche de paie"  — logiciel d'édition (SILAE, ADP, Cegid…)
      - "Authenticité CNI / titre"  — format, lisibilité, MRZ, hologrammes
      - "Cohérence inter-pièces"    — nom, employeur, montants concordants
      - "Avis d'imposition"         — référence fiscale plausible, format DGFiP
      - "Origine IA / synthèse"     — signatures C2PA/Content Credentials,
        XMP trainedAlgorithmicMedia, outil de génération IA, artefacts visuels
    RÈGLE DURE : si l'audit forensic global indique « contenu généré par IA
    détecté », le forensicAudit DOIT contenir un contrôle "Origine IA / synthèse"
    avec status ALERT, et isFraudDetected DOIT être true (un document synthétique
    n'a aucune raison légitime d'exister dans un dossier locataire).
    Le 'details' DOIT être court, technique, rassurant en cas de VERIFIED
    ("Aucune trace de logiciel d'édition grand public détectée") et factuel
    en cas de WARNING/ALERT ("Métadonnées indiquent Photoshop 24.0 — vérifier").
    Si une catégorie de pièce manque, NE PAS inventer le contrôle correspondant.

Ton output sera CONSOMMÉ PAR UN ALGORITHME — toute déviation au schéma
casse le pipeline. Reste factuel, structuré, jamais bavard.`;

function buildUserPrompt(input: AnalysisInputType): string {
  const c = input.candidate;
  const f = input.financial;
  const d = input.documents;
  const g = input.guarantee;
  const forensic = input.forensic;

  const lines: string[] = [];
  lines.push('=== DOSSIER À ANALYSER ===');
  lines.push('');
  lines.push('## Candidat');
  lines.push(`- Nom : ${c.firstName || '?'} ${c.lastName || '?'}`);
  lines.push(`- Profession / situation : ${c.profession || 'non renseigné'}`);
  lines.push(`- Type de contrat : ${c.contractType || 'non renseigné'}`);
  lines.push(`- Employeur : ${c.employer || 'non renseigné'}`);
  lines.push(`- Ancienneté : ${c.seniorityMonths ?? 'non renseignée'} mois`);
  lines.push('');
  lines.push('## Financier');
  lines.push(`- Revenus nets mensuels : ${f.monthlyIncomeNet ?? 'non renseigné'} €`);
  lines.push(`- Loyer cible (charges comprises) : ${f.targetRent ?? 'non renseigné'} €`);
  lines.push(`- Taux d'effort calculé : ${f.effortRatePercent ?? 'non calculable'} %`);
  lines.push(`- Stabilité des revenus : ${f.incomeStabilityMonths ?? 'inconnue'} mois`);
  lines.push(`- Revenu fiscal annuel (N-1) : ${f.taxIncomeAnnual ?? 'non renseigné'} €`);
  lines.push(`- Source des revenus : ${f.incomeSource || 'inconnue'}`);
  lines.push('');
  lines.push('## Identité');
  lines.push(`- Identité vérifiée Didit (eIDAS) : ${input.identity.diditVerified ? 'OUI' : 'NON'}`);
  lines.push(`- CNI fournie comme pièce : ${input.identity.cniPresent ? 'OUI' : 'NON'}`);
  lines.push('');
  lines.push('## Garantie');
  lines.push(`- Mode : ${g.mode || 'NONE'}`);
  if (g.guarantorIncomeNet) {
    lines.push(`- Revenus du garant : ${g.guarantorIncomeNet} € / mois`);
  }
  if (g.coverage) lines.push(`- Couverture : ${g.coverage}`);
  lines.push('');
  lines.push('## Couverture documentaire');
  lines.push(`- CNI fournie : ${d.identityProvided ? 'OUI' : 'NON'}`);
  lines.push(`- Fiches de paie : ${d.payslipsCount} pièce(s)`);
  lines.push(`- Avis d'imposition : ${d.taxNoticeProvided ? 'OUI' : 'NON'}`);
  lines.push(`- Justificatif de domicile : ${d.addressProofProvided ? 'OUI' : 'NON'}`);
  lines.push(`- Attestation / contrat employeur : ${d.employerCertificateProvided ? 'OUI' : 'NON'}`);
  lines.push(`- Pièces rejetées par audit : ${d.rejectedCount}`);
  lines.push(`- Alertes forensic : ${d.forensicAlertCount}`);
  lines.push('');
  lines.push('## Audit forensic global');
  lines.push(`- Statut : ${forensic.globalStatus}`);
  if (forensic.suspiciousSoftwareDetected) {
    lines.push('- ⚠ Logiciel d\'édition suspect détecté');
  }
  if (forensic.mathematicalInconsistencies) {
    lines.push('- ⚠ Incohérences mathématiques détectées');
  }
  if (forensic.aiGeneratedContentDetected) {
    lines.push('- 🚨 CONTENU GÉNÉRÉ PAR IA détecté sur au moins une pièce (signature C2PA / XMP trainedAlgorithmicMedia / outil IA)');
  }

  return lines.join('\n');
}

// ─── Partie "Neuro" : appel LLM avec Structured Outputs ──────────────────────

/**
 * Appelle OpenAI avec Structured Outputs pour obtenir une analyse JSON
 * strictement conforme au schéma. Validation Zod côté serveur en filet.
 *
 * @throws Error si l'API échoue ou si la réponse ne valide pas le schéma.
 */
export async function analyzeApplication(
  input: AnalysisInputType,
  options: { model?: string; timeoutMs?: number; costMeta?: Record<string, unknown> } = {},
): Promise<AIAnalysisType> {
  // Validation des entrées (filet anti-bug code appelant)
  const parsedInput = AnalysisInputSchema.parse(input);

  const client = getOpenAIClient();
  const model = options.model || DEFAULT_MODEL;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(parsedInput) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'tenant_analysis',
        strict: true,
        // Structured Outputs OpenAI : schéma compatible JSON Schema draft-7
        schema: AI_ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    temperature: 0, // Determinisme maximum
  });

  // Coût RÉEL de l'appel de scoring LLM (fire-and-forget — n'interrompt jamais).
  try {
     
    require('@/src/services/api-cost-logger').recordLlmCost({
      model,
      usage: completion.usage,
      category: 'LLM_SCORING',
      meta: { source: 'tenant-analyzer', ...(options.costMeta || {}) },
    });
  } catch {
    /* fire-and-forget */
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error('[tenant-analyzer] OpenAI a renvoyé un contenu vide.');
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[tenant-analyzer] JSON invalide retourné par OpenAI : ${(err as Error).message}`,
    );
  }

  // Validation Zod — filet de sécurité même si OpenAI respecte le schéma
  const validated = AIAnalysisSchema.safeParse(parsedJson);
  if (!validated.success) {
    throw new Error(
      `[tenant-analyzer] Réponse OpenAI ne valide pas le schéma Zod : ${validated.error.message}`,
    );
  }

  return validated.data;
}

// ─── Pipeline complet : analyse + scoring ────────────────────────────────────
// Note : computeResilienceIndex est désormais dans lib/ai/resilience-index.ts
// pour pouvoir être testé en Node pur (sans server-only ni OpenAI SDK).

export interface FullAnalysisResult {
  /** Sortie brute du LLM (structuré, validé Zod) */
  ai: AIAnalysisType;
  /** Indice de Résilience calculé par l'algo déterministe */
  resilience: ResilienceResult;
  /** Métadonnées d'audit (traçabilité) */
  meta: {
    model: string;
    analyzedAt: string;
    applicationId?: string;
  };
}

/**
 * Pipeline complet "neuro-symbolique" : appelle le LLM puis calcule
 * déterministiquement l'Indice de Résilience.
 *
 * Recommandé pour usage en route API.
 */
export async function runFullAnalysis(
  input: AnalysisInputType,
  options: { model?: string; timeoutMs?: number; costMeta?: Record<string, unknown> } = {},
): Promise<FullAnalysisResult> {
  const ai = await analyzeApplication(input, options);
  // V8.3 — Identité certifiée eIDAS (Didit) : la biométrie souveraine prime sur
  // tout scan PDF de CNI. Le LLM émet parfois un contrôle « Authenticité CNI »
  // en WARNING/ALERT malgré la consigne → on le force à VERIFIED pour ne pas
  // afficher d'alerte CNI fantôme alors que l'identité est déjà certifiée.
  if (input.identity?.diditVerified === true && Array.isArray(ai.forensicAudit)) {
    const IDENTITY_RE = /(cni|identit|titre de s[e\u00e9]jour|mrz)/i;
    ai.forensicAudit = ai.forensicAudit.map((c) =>
      IDENTITY_RE.test(c.checkName || '') && c.status !== 'VERIFIED'
        ? {
            ...c,
            status: 'VERIFIED' as const,
            details:
              'Identité certifiée eIDAS (Didit) — vérification biométrique souveraine ; le scan de la pièce d’identité n’est pas requis.',
          }
        : c,
    );
  }
  // V8.2 — Exception biométrique : l'identité vérifiée eIDAS (Didit) est un
  // fait DÉTERMINISTE (pas une supposition du LLM) → on le passe à l'algo.
  const resilience = computeResilienceIndex(ai, {
    isBiometricVerified: input.identity?.diditVerified === true,
  });
  return {
    ai,
    resilience,
    meta: {
      model: options.model || DEFAULT_MODEL,
      analyzedAt: new Date().toISOString(),
      applicationId: input.applicationId,
    },
  };
}

// (helpers déplacés dans resilience-index.ts pour la testabilité)
