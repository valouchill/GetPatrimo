/**
 * Module D — Superviseur IA documentaire (JSON-only, gpt-4o-mini).
 *
 * Reçoit UNIQUEMENT le JSON déterministe assemblé (Module A forensic + Module B OCR
 * + Module C sceau fiscal) — JAMAIS d'image ni de PDF. Le LLM recoupe les données,
 * explique les contrôles (math Brut − Cotisations = Net, ordre des nets, RFR), remonte
 * les indices forensic du Module A, et produit un conseil UX (expert_advice).
 *
 * Le superviseur N'ATTRIBUE PAS de note/grade : le grade dossier reste 100 %
 * déterministe (resilience-index.ts) et le fraud_score est finalisé en code dans la
 * route. Module D ne fait qu'AJOUTER des observations au contrat JSON existant
 * (expert_advice, forensic_alerts, needs_human_review) — aucun champ déterministe
 * (fraud_score, math_validation, monthly_net_income, MRZ…) n'est modifié.
 *
 * Gated par DOC_SUPERVISOR_ENABLED (off ⇒ no-op = comportement actuel).
 * Fire-and-forget : ne lève jamais ; renvoie null si désactivé / sans clé / erreur.
 *
 * Requires RELATIFS (convention des services JS du repo).
 */

const { recordLlmCost } = require('./api-cost-logger');

const SUPERVISOR_TIMEOUT_MS = Number(process.env.OPENAI_DOC_SUPERVISOR_TIMEOUT_MS || 20_000);
const SUPERVISOR_MODEL = process.env.OPENAI_DOC_SUPERVISOR_MODEL || 'gpt-4o-mini';

/** Gate : le superviseur ne tourne que si explicitement activé (sinon flow actuel). */
function isSupervisorEnabled() {
  return process.env.DOC_SUPERVISOR_ENABLED === 'true';
}

const round2 = (n) => (Number.isFinite(Number(n)) ? Math.round(Number(n) * 100) / 100 : null);

/* ─────────────────────────────  Faits déterministes (sans image)  ───────────────────────────── */

/**
 * Extrait les faits déterministes d'un résultat normalisé (+ forensic Module A).
 * Aucune image / PDF : uniquement le JSON déjà extrait.
 */
function collectFacts(result = {}, forensic = {}) {
  const dm = result.document_metadata || {};
  const fd = result.financial_data || {};
  const ed = fd.extra_details || {};
  const ts = result.trust_and_security || {};
  return {
    type: dm.type || 'AUTRE',
    owner: dm.owner_name || '',
    dateEmission: dm.date_emission || '',
    dateValidite: dm.date_validite || '',
    monthlyNet: round2(fd.monthly_net_income),
    brut: round2(ed.salaire_brut_mensuel),
    cotisations: round2(ed.cotisations_mensuelles),
    netFiscal: round2(ed.net_fiscal),
    netSocial: round2(ed.net_social),
    netAPayer: round2(ed.net_a_payer),
    rfr: round2(ed.revenu_fiscal_reference),
    numeroFiscal: ed.numero_fiscal || '',
    referenceAvis: ed.reference_avis || '',
    nombreParts: ed.nombre_parts == null ? null : ed.nombre_parts,
    mathValidation: ts.math_validation, // boolean | undefined (déterministe, Module B)
    forensicAlerts: Array.isArray(ts.forensic_alerts) ? ts.forensic_alerts : [],
    mrzPresent: Boolean(ts.mrz_line1),
    // Module A — forensic métadonnées PDF (forme moderne {isAltered,reasons} ou legacy {suspicious,details}).
    isAltered: Boolean((forensic && (forensic.isAltered ?? forensic.suspicious)) || false),
    forensicReasons: Array.isArray(forensic && forensic.reasons)
      ? forensic.reasons
      : Array.isArray(forensic && forensic.details)
        ? forensic.details
        : [],
    creator: (forensic && forensic.creator) || '',
    producer: (forensic && forensic.producer) || '',
  };
}

/* ─────────────────────────────  Prompt (JSON-only)  ───────────────────────────── */

const SYSTEM_PROMPT = `Tu es le SUPERVISEUR documentaire de PatrimoTrust (location haut de gamme, façon banque privée).
On te transmet UNIQUEMENT des données DÉJÀ EXTRAITES (JSON) — aucune image, aucun PDF.
Ces chiffres viennent d'un OCR déterministe : tu NE les réécris PAS et tu NE les recalcules PAS
depuis une image ; tu VÉRIFIES leur cohérence interne et tu CONSEILLES.

RÈGLES STRICTES :
1. Sortie EXCLUSIVEMENT en JSON conforme au schéma — aucun texte libre.
2. Tu N'ATTRIBUES JAMAIS de note, score ou grade : c'est un algorithme déterministe qui le fait.
3. Contrôles attendus (adapte aux champs réellement présents) :
   - Fiche de paie : Brut − Cotisations ≈ Net social ; Net social ≤ Net fiscal ; Net à payer cohérent.
   - Avis d'imposition : RFR présent et plausible vs salaires déclarés ; numéro fiscal (13 chiffres)
     et référence d'avis (13 chiffres) présents.
   - CNI / passeport : MRZ présente ; nom et dates cohérents.
4. Remonte les indices forensic transmis (logiciel d'édition suspect, fichier altéré) en WARNING/ALERT —
   ne les invente pas s'ils sont absents.
5. La MRZ ne concerne QUE les pièces d'identité (CNI/passeport). Son absence sur une fiche de paie
   ou un avis d'imposition est NORMALE : ne la signale jamais et ne base aucune alerte dessus.
6. needsHumanReview=true UNIQUEMENT en cas d'incohérence mathématique, d'indice de falsification, ou
   de pièce illisible. Si TOUS les contrôles sont VERIFIED, alors needsHumanReview=false.
7. expertAdvice : 1 à 3 phrases, ton « banque privée » (factuel, rassurant, jamais alarmiste, sans émoji),
   destinées au propriétaire. Ne demande JAMAIS de vérifier un élément hors-sujet pour le type de pièce
   (ex : pas de MRZ sur une paie).
Ta sortie est CONSOMMÉE PAR DU CODE : toute déviation au schéma casse le pipeline.`;

/** Construit { system, user } à partir des seuls faits déterministes (pure, testable). */
function buildSupervisorPrompt(result, forensic) {
  const f = collectFacts(result, forensic);
  const L = [];
  L.push('=== DONNÉES DÉTERMINISTES DU DOCUMENT (aucune image fournie) ===');
  L.push(`Type détecté : ${f.type}`);
  if (f.owner) L.push(`Titulaire : ${f.owner}`);
  if (f.dateEmission) L.push(`Date d'émission : ${f.dateEmission}`);
  if (f.dateValidite) L.push(`Date de validité : ${f.dateValidite}`);
  L.push('');
  L.push('## Financier (déjà extrait — ne pas recalculer depuis une image)');
  L.push(`- Revenu net mensuel retenu : ${f.monthlyNet == null ? 'n/a' : `${f.monthlyNet} €`}`);
  if (f.brut != null) L.push(`- Salaire brut mensuel : ${f.brut} €`);
  if (f.cotisations != null) L.push(`- Cotisations salariales : ${f.cotisations} €`);
  if (f.netSocial != null) L.push(`- Net social : ${f.netSocial} €`);
  if (f.netFiscal != null) L.push(`- Net fiscal : ${f.netFiscal} €`);
  if (f.netAPayer != null) L.push(`- Net à payer : ${f.netAPayer} €`);
  if (f.rfr != null) L.push(`- Revenu fiscal de référence (annuel) : ${f.rfr} €`);
  if (f.numeroFiscal) L.push(`- Numéro fiscal : ${f.numeroFiscal}`);
  if (f.referenceAvis) L.push(`- Référence d'avis : ${f.referenceAvis}`);
  if (f.nombreParts != null) L.push(`- Nombre de parts : ${f.nombreParts}`);
  L.push('');
  L.push('## Contrôles déterministes déjà effectués');
  L.push(
    `- Contrôle math Brut − Cotisations = Net social : ${
      f.mathValidation === true ? 'OK' : f.mathValidation === false ? 'ÉCHEC' : 'non applicable'
    }`,
  );
  // La MRZ ne concerne que les pièces d'identité : ne l'évoquer que pour CNI/passeport,
  // sinon le LLM signale à tort son absence sur une paie/avis.
  const isIdentity = f.type === 'CARTE_IDENTITE' || f.type === 'PASSEPORT';
  if (isIdentity) L.push(`- MRZ présente : ${f.mrzPresent ? 'OUI' : 'NON'}`);
  L.push('');
  L.push('## Forensic métadonnées (Module A)');
  L.push(`- Fichier signalé altéré : ${f.isAltered ? 'OUI' : 'NON'}`);
  if (f.creator) L.push(`- Créateur : ${f.creator}`);
  if (f.producer) L.push(`- Producteur : ${f.producer}`);
  if (f.forensicReasons.length) L.push(`- Indices : ${f.forensicReasons.join(' ; ')}`);
  if (f.forensicAlerts.length) L.push(`- Alertes déjà présentes : ${f.forensicAlerts.join(' ; ')}`);
  return { system: SYSTEM_PROMPT, user: L.join('\n') };
}

/* ─────────────────────────────  Schéma de sortie (Structured Outputs)  ───────────────────────────── */

const SUPERVISOR_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['documentType', 'checks', 'consistency', 'needsHumanReview', 'expertAdvice'],
  properties: {
    documentType: { type: 'string', description: 'Type de document supervisé (écho).' },
    checks: {
      type: 'array',
      description: '2 à 5 contrôles de cohérence interne du document.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'status', 'detail'],
        properties: {
          name: { type: 'string', description: 'Nom court du contrôle.' },
          status: { type: 'string', enum: ['VERIFIED', 'WARNING', 'ALERT'] },
          detail: { type: 'string', description: 'Explication courte et factuelle.' },
        },
      },
    },
    consistency: {
      type: 'object',
      additionalProperties: false,
      required: ['mathConsistent', 'valuesCoherent'],
      properties: {
        mathConsistent: { type: 'boolean', description: 'Brut − Cotisations = Net (ou true si non applicable).' },
        valuesCoherent: { type: 'boolean', description: 'Ordre/plausibilité des montants respectés.' },
      },
    },
    needsHumanReview: { type: 'boolean' },
    expertAdvice: { type: 'string', description: '1 à 3 phrases de conseil au propriétaire.' },
  },
};

/** Normalise/sécurise la sortie brute du LLM (pure, défensive). */
function coerceSupervision(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const allowed = new Set(['VERIFIED', 'WARNING', 'ALERT']);
  const checks = Array.isArray(raw.checks)
    ? raw.checks
        .filter((c) => c && typeof c === 'object')
        .map((c) => ({
          name: String(c.name || '').slice(0, 120),
          status: allowed.has(c.status) ? c.status : 'WARNING',
          detail: String(c.detail || '').slice(0, 400),
        }))
        .filter((c) => c.name)
        .slice(0, 5)
    : [];
  const cons = raw.consistency && typeof raw.consistency === 'object' ? raw.consistency : {};
  return {
    documentType: String(raw.documentType || '').slice(0, 60),
    checks,
    consistency: {
      mathConsistent: cons.mathConsistent === true,
      valuesCoherent: cons.valuesCoherent === true,
    },
    needsHumanReview: raw.needsHumanReview === true,
    expertAdvice: String(raw.expertAdvice || '').slice(0, 600),
  };
}

/* ─────────────────────────────  Fusion NON destructive dans le contrat  ───────────────────────────── */

/**
 * Fusionne le verdict du superviseur dans le résultat normalisé, SANS toucher aux
 * champs déterministes (fraud_score, math_validation, monthly_net_income, MRZ, grade…).
 * N'écrit que : ai_analysis.expert_advice, trust_and_security.forensic_alerts (ajout),
 * trust_and_security.needs_human_review (jamais abaissé).
 */
function mergeSupervision(result, verdict) {
  if (!result || !verdict) return result;
  const ts = result.trust_and_security || (result.trust_and_security = {});
  const ai = result.ai_analysis || (result.ai_analysis = {});

  // 1) Conseil UX : NON destructif. On préserve un conseil déterministe déjà posé
  //    (ex : message d'authentification du sceau Visale) en y ajoutant celui du
  //    superviseur, plutôt que de l'écraser.
  if (verdict.expertAdvice) {
    const prev = String(ai.expert_advice || '').trim();
    ai.expert_advice = prev ? `${prev} ${verdict.expertAdvice}` : verdict.expertAdvice;
  }

  // 2) Alertes : on AJOUTE les contrôles non-VERIFIED, sans doublon, sans retirer
  //    les alertes déterministes existantes.
  if (!Array.isArray(ts.forensic_alerts)) ts.forensic_alerts = [];
  const existing = new Set(ts.forensic_alerts.map((a) => String(a)));
  verdict.checks
    .filter((c) => c.status !== 'VERIFIED')
    .forEach((c) => {
      const line = `[Superviseur] ${c.name} (${c.status}) : ${c.detail}`.trim();
      if (!existing.has(line)) {
        ts.forensic_alerts.push(line);
        existing.add(line);
      }
    });

  // 3) Revue humaine : on ne descend JAMAIS un drapeau déjà levé.
  if (verdict.needsHumanReview) ts.needs_human_review = true;

  return result;
}

/* ─────────────────────────────  Appel LLM gardé (gpt-4o-mini)  ───────────────────────────── */

/**
 * Supervise un document à partir de son JSON déterministe. Renvoie le verdict
 * normalisé, ou null (désactivé / pas de clé / erreur). Ne lève jamais.
 */
async function superviseDocument(result, forensic, opts = {}) {
  if (!isSupervisorEnabled()) return null;
  const apiKey = opts.openaiApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey || !result) return null;

  try {
    const { system, user } = buildSupervisorPrompt(result, forensic);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUPERVISOR_TIMEOUT_MS);
    let response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: SUPERVISOR_MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: 700,
          temperature: 0,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'document_supervision', strict: true, schema: SUPERVISOR_JSON_SCHEMA },
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) return null;

    const data = await response.json();
    // Coût réel (fire-and-forget) — catégorie dédiée pour le cockpit.
    recordLlmCost({
      model: SUPERVISOR_MODEL,
      usage: data.usage,
      category: 'LLM_SUPERVISOR',
      applicationId: opts.applicationId,
      meta: { source: 'document-supervisor', fileName: opts.fileName },
    });

    const text = data.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
    return coerceSupervision(parsed);
  } catch {
    // fire-and-forget : ne jamais interrompre l'analyse documentaire.
    return null;
  }
}

/**
 * Pratique : supervise puis fusionne dans le résultat (non destructif).
 * @returns {Promise<{result:object, verdict:(object|null)}>}
 */
async function applySupervision(result, forensic, opts = {}) {
  const verdict = await superviseDocument(result, forensic, opts);
  if (verdict) mergeSupervision(result, verdict);
  return { result, verdict };
}

module.exports = {
  isSupervisorEnabled,
  collectFacts,
  buildSupervisorPrompt,
  SUPERVISOR_JSON_SCHEMA,
  coerceSupervision,
  mergeSupervision,
  superviseDocument,
  applySupervision,
};
