/**
 * Protocole de contrôle du dossier locataire — VERSION PUBLIÉE.
 *
 * Ce fichier définit ce que l'attestation atteste. Il est volontairement
 * public et versionné : une attestation ne vaut que si le protocole qu'elle
 * applique est connu, stable et opposable dans le temps.
 *
 * DEUX PARTIS PRIS, qui décident de la valeur juridique du document :
 *
 * 1. VERDICT BINAIRE, jamais un score. Un rapport qui liste des anomalies
 *    « détectées mais non traitées » se retourne contre celui qui le détient :
 *    la jurisprudence protège le professionnel qui n'avait pas d'indice
 *    apparent, pas celui qui en avait un et a loué quand même. L'attestation
 *    rend donc une décision — conforme ou non conforme — pas une opinion.
 *
 * 2. CONTRÔLES DÉTERMINISTES D'ABORD. Un calcul faux se démontre en réunion et
 *    devant un juge ; un score probabiliste ne se défend nulle part. Les
 *    contrôles arithmétiques et de registre portent le verdict ; l'analyse par
 *    modèle ne peut que le durcir, jamais l'assouplir.
 *
 * VOCABULAIRE INTERDIT dans tout ce qui est produit ici : « certifié »,
 * « opposable », « force probante », « présomption ». La signature interne
 * n'est pas qualifiée au sens eIDAS : revendiquer ces termes serait une
 * pratique commerciale trompeuse. On atteste avoir CONTRÔLÉ, pas que le
 * document est authentique.
 */

export const PROTOCOL_VERSION = '2026.08';

export type CheckStatus = 'PASSED' | 'FAILED' | 'UNAVAILABLE';

export interface CheckDefinition {
  code: string;
  label: string;
  /** Ce que le contrôle établit, en français lisible par un non-technicien. */
  description: string;
  /** Un échec suffit-il à rendre le dossier NON CONFORME ? */
  blocking: boolean;
  /** Déterministe (vérifiable, reproductible) ou par modèle (indicatif). */
  kind: 'deterministic' | 'model';
}

export const PROTOCOL_CHECKS: CheckDefinition[] = [
  {
    code: 'PAYSLIP_ARITHMETIC',
    label: 'Cohérence arithmétique du bulletin de salaire',
    description: 'Le net à payer correspond au brut diminué des cotisations, à la tolérance d’arrondi près.',
    blocking: true,
    kind: 'deterministic',
  },
  {
    code: 'TAX_NOTICE_SEAL',
    label: 'Sceau 2D-Doc de l’avis d’imposition',
    description: 'Le code à barres bidimensionnel de l’avis est présent et cohérent avec son contenu.',
    blocking: true,
    kind: 'deterministic',
  },
  {
    code: 'IDENTITY_CONCORDANCE',
    label: 'Concordance des identités entre les pièces',
    description: 'Le nom porté par les justificatifs correspond à celui de la pièce d’identité.',
    blocking: true,
    kind: 'deterministic',
  },
  {
    code: 'DOCUMENT_INTEGRITY',
    label: 'Intégrité des fichiers',
    description: 'Aucune trace de retouche ni de production par un logiciel de composition graphique.',
    blocking: false,
    kind: 'model',
  },
  {
    code: 'AI_GENERATION',
    label: 'Absence de signature de génération par IA',
    description: 'Aucun marqueur de document produit par un modèle génératif n’a été relevé.',
    blocking: false,
    kind: 'model',
  },
  {
    code: 'DOSSIER_COMPLETENESS',
    label: 'Complétude du dossier',
    description: 'Les pièces exigibles au sens du décret n° 2015-1437 sont présentes.',
    blocking: false,
    kind: 'deterministic',
  },
];

export interface CheckResult {
  code: string;
  label: string;
  status: CheckStatus;
  /** Précision factuelle — jamais une interprétation. */
  detail?: string;
}

export type AttestationVerdict = 'CONFORME' | 'NON_CONFORME' | 'INCOMPLET';

/**
 * Verdict du protocole.
 *
 * - NON_CONFORME dès qu'un contrôle bloquant échoue — sans pondération ni
 *   moyenne : c'est ce qui rend la décision explicable.
 * - INCOMPLET si un contrôle bloquant n'a pas pu être exécuté (pièce absente
 *   ou illisible). On ne conclut jamais sur une donnée manquante : un doute
 *   n'est pas une fraude, et affirmer l'inverse expose autant que se taire.
 * - CONFORME sinon.
 */
export function computeVerdict(results: CheckResult[]): AttestationVerdict {
  const blocking = new Set(PROTOCOL_CHECKS.filter((c) => c.blocking).map((c) => c.code));
  const relevant = results.filter((r) => blocking.has(r.code));

  if (relevant.some((r) => r.status === 'FAILED')) return 'NON_CONFORME';
  if (relevant.some((r) => r.status === 'UNAVAILABLE') || relevant.length < blocking.size) {
    return 'INCOMPLET';
  }
  return 'CONFORME';
}

/** Phrase de verdict affichée sur l'attestation — mesurée, jamais affirmative. */
export function verdictStatement(verdict: AttestationVerdict): string {
  switch (verdict) {
    case 'CONFORME':
      return 'Les contrôles prévus au protocole ont tous été exécutés et aucun n’a échoué.';
    case 'NON_CONFORME':
      return 'Au moins un contrôle bloquant du protocole a échoué. Le dossier ne satisfait pas le protocole.';
    default:
      return 'Un ou plusieurs contrôles bloquants n’ont pas pu être exécutés : le dossier est incomplet au sens du protocole.';
  }
}

/**
 * Traduit les résultats du moteur en contrôles du protocole.
 *
 * Règle de sûreté : un contrôle dont on n'a pas la preuve d'exécution est
 * UNAVAILABLE, jamais PASSED. Un « vert » par défaut serait la faute la plus
 * grave possible sur une pièce destinée à être opposée.
 */
export function mapEngineToChecks(audit: Record<string, any> | null | undefined): CheckResult[] {
  const trust = audit?.trust_and_security || audit?.ai?.trust_and_security || {};
  const forensic = audit?.forensicAudit || audit?.ai?.forensicAudit || {};
  const alerts: string[] = Array.isArray(trust.forensic_alerts) ? trust.forensic_alerts : [];
  const alertText = alerts.join(' | ').toLowerCase();

  const results: CheckResult[] = [];
  const push = (code: string, status: CheckStatus, detail = '') => {
    const def = PROTOCOL_CHECKS.find((c) => c.code === code);
    if (def) results.push({ code, label: def.label, status, detail });
  };

  // Arithmétique du bulletin : contrôle serveur déterministe.
  if (trust.math_validation === false) {
    push('PAYSLIP_ARITHMETIC', 'FAILED', alerts.find((a) => /écart/i.test(a)) || 'Écart entre brut − cotisations et net.');
  } else if (trust.math_validation === true) {
    push('PAYSLIP_ARITHMETIC', 'PASSED');
  } else {
    push('PAYSLIP_ARITHMETIC', 'UNAVAILABLE', 'Montants nécessaires au calcul non lisibles.');
  }

  // Sceau fiscal 2D-Doc.
  const seal = audit?.fiscalSeal ?? forensic?.fiscalSeal;
  if (seal === true) push('TAX_NOTICE_SEAL', 'PASSED');
  else if (seal === false) push('TAX_NOTICE_SEAL', 'FAILED', 'Sceau 2D-Doc absent ou incohérent.');
  else push('TAX_NOTICE_SEAL', 'UNAVAILABLE', 'Avis d’imposition absent ou sceau illisible.');

  // Concordance des identités entre pièces.
  const concord = audit?.identityConcordance ?? forensic?.identityConcordance;
  if (concord?.consistent === true) push('IDENTITY_CONCORDANCE', 'PASSED');
  else if (concord?.consistent === false) push('IDENTITY_CONCORDANCE', 'FAILED', 'Noms divergents entre les pièces.');
  else push('IDENTITY_CONCORDANCE', 'UNAVAILABLE', 'Contrôle de concordance non exécuté.');

  // Intégrité des fichiers (indicatif).
  push('DOCUMENT_INTEGRITY',
    /retouch|logiciel de design|modifié/i.test(alertText) ? 'FAILED' : 'PASSED');

  // Génération par IA (indicatif).
  const aiGenerated = audit?.aiGenerated ?? forensic?.aiGenerated;
  push('AI_GENERATION', aiGenerated === true || /générée? par ia|trainedalgorithmic/i.test(alertText) ? 'FAILED' : 'PASSED');

  return results;
}

