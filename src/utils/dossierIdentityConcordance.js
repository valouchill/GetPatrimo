'use strict';

/**
 * Concordance d'identité au niveau DOSSIER (anti-fraude inter-documents).
 *
 * Vérifie, de façon DÉTERMINISTE, que les nom/prénom des documents d'un même
 * profil concordent : entre eux ET avec l'identité Didit KYC. Réutilise les
 * comparateurs de `documentSubjectIdentity` (accents, prénoms d'usage, isolation
 * des slots colocataires, neutralisation NON-BLOQUANTE quand un nom est absent).
 *
 * - Gated par `IDENTITY_CONCORDANCE_ENABLED` (les APPELANTS lisent le flag ;
 *   `evaluateDossierIdentityConcordance` lui-même évalue toujours et est PUR).
 * - Ne lève jamais (fail-safe : renvoie un résultat neutre en cas d'erreur).
 * - Jamais de comparaison inter-slots : un doc colocataire (slot 2-4) n'est
 *   comparé qu'à SA propre identité, jamais au locataire principal.
 */
const {
  extractIdentityCandidate,
  buildExpectedIdentityTarget,
  compareIdentityToExpected,
  hasUsableIdentity,
} = require('./documentSubjectIdentity');

function isConcordanceEnabled() {
  return process.env.IDENTITY_CONCORDANCE_ENABLED === 'true';
}

// Barème (échelle phase1AuditService, capé sur l'échelle 0-100 du patrimomètre).
const MALUS_CRITICAL = 30; // mismatch impliquant l'ID / l'ancre Didit (fraude forte)
const MALUS_WARNING = 18; // mismatch sur un justificatif de revenu, ancre faible

function docType(doc) {
  return String(
    (doc.aiAnalysis && doc.aiAnalysis.document_metadata && doc.aiAnalysis.document_metadata.type) ||
      doc.type ||
      ''
  ).toUpperCase();
}

function inferDocKind(doc) {
  const t = docType(doc);
  if (/CARTE_IDENTITE|PASSEPORT|\bCNI\b|IDENTIT|TITRE_SEJOUR/.test(t)) return 'identity';
  if (/VISALE/.test(t)) return 'visale';
  if (/BULLETIN|SALAIRE|PAIE|PAYSLIP|AVIS|IMPOSITION|IMPOT|CONTRAT|EMPLOI|TRAVAIL|EMPLOYEUR|PENSION|RETRAITE|BOURSE/.test(t)) {
    return 'income';
  }
  return 'other';
}

function docSubject(doc) {
  const st = String(doc.subjectType || '').toUpperCase();
  if (st === 'GUARANTOR' || doc.category === 'GUARANTOR') {
    return { subjectType: 'guarantor', subjectSlot: Number(doc.subjectSlot) === 2 ? 2 : 1 };
  }
  if (st === 'VISALE' || inferDocKind(doc) === 'visale') {
    return { subjectType: 'visale', subjectSlot: 1 };
  }
  return { subjectType: 'tenant', subjectSlot: Number(doc.subjectSlot) || 1 };
}

function fullName(identity) {
  return String((identity && identity.fullName) || '').trim();
}

function collectDocumentIdentity(doc) {
  const identity = extractIdentityCandidate({
    extractedData: (doc.aiAnalysis && doc.aiAnalysis.extractedData) || undefined,
    document_metadata: (doc.aiAnalysis && doc.aiAnalysis.document_metadata) || undefined,
    ownerName: (doc.aiAnalysis && doc.aiAnalysis.ownerName) || undefined,
  });
  const subject = docSubject(doc);
  return {
    id: doc.id != null ? doc.id : null,
    label: doc.fileName || doc.name || docType(doc) || 'document',
    identity,
    comparable: hasUsableIdentity(identity),
    kind: inferDocKind(doc),
    subjectType: subject.subjectType,
    subjectSlot: subject.subjectSlot,
  };
}

function locationLabel(c) {
  if (c.subjectType === 'guarantor') return `garant ${c.subjectSlot}`;
  if (c.subjectType === 'visale') return 'certificat Visale';
  return c.subjectSlot >= 2 ? `colocataire ${c.subjectSlot}` : 'locataire';
}

function buildMessage(c, expectedName) {
  const detected = fullName(c.identity) || '(nom illisible)';
  const expected = String(expectedName || '').trim() || "l'identité du profil";
  return `Concordance d'identité (${locationLabel(c)}) : le nom détecté sur « ${c.label} » (${detected}) ne correspond pas à ${expected}.`;
}

const NEUTRAL = () => ({
  evaluated: false,
  matches: true,
  needsHumanReview: false,
  scoreMalus: 0,
  flaggedDocumentIds: [],
  warnings: [],
  findings: [],
});

/**
 * @param {{documents:Array, tenant?:Object, diditIdentity?:Object|null,
 *          diditStatus?:string, coTenants?:Array, guarantorOne?:Object|null,
 *          guarantorTwo?:Object|null}} input
 * @returns {{evaluated:boolean, matches:boolean, needsHumanReview:boolean,
 *           scoreMalus:number, flaggedDocumentIds:Array, warnings:string[],
 *           findings:Array}}
 */
function evaluateDossierIdentityConcordance(input = {}) {
  try {
    const documents = Array.isArray(input.documents) ? input.documents : [];
    const tenant = input.tenant || {};
    const di = input.diditIdentity || null;
    const diditVerified = String(input.diditStatus || '').toLowerCase() === 'verified';
    const coTenants = Array.isArray(input.coTenants) ? input.coTenants : [];
    const guarantorOne = input.guarantorOne || null;
    const guarantorTwo = input.guarantorTwo || null;

    const collected = documents.map(collectDocumentIdentity).filter((c) => c.comparable);
    if (!collected.length) return NEUTRAL();

    const result = NEUTRAL();
    const flagged = new Set();
    let comparedAny = false;

    const addFinding = (code, severity, c, expectedName) => {
      result.findings.push({
        code,
        severity,
        subjectType: c.subjectType,
        subjectSlot: c.subjectSlot,
        detectedName: fullName(c.identity),
        expectedName: String(expectedName || '').trim(),
        docId: c.id,
        message: buildMessage(c, expectedName),
      });
      if (c.id != null) flagged.add(c.id);
    };

    // Ancre du locataire principal (slot 1) : Didit KYC vérifié > profil déclaré.
    const diditIdentity = diditVerified ? { firstName: di && di.firstName, lastName: di && di.lastName } : null;
    const tenantAnchor = hasUsableIdentity(diditIdentity)
      ? { identity: diditIdentity, strong: true }
      : hasUsableIdentity(tenant)
        ? { identity: { firstName: tenant.firstName, lastName: tenant.lastName }, strong: false }
        : null;

    // Regroupe par sujet/slot (isolation stricte des slots).
    const groups = new Map();
    for (const c of collected) {
      const key = `${c.subjectType}:${c.subjectSlot}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }

    for (const [key, docs] of groups) {
      const [subjectType, slotStr] = key.split(':');
      const slot = Number(slotStr) || 1;

      let anchor = null; // { firstName, lastName }
      let anchorStrong = false; // ancre Didit ⇒ mismatch toujours critique

      if (subjectType === 'tenant' && slot <= 1) {
        if (tenantAnchor) {
          anchor = tenantAnchor.identity;
          anchorStrong = tenantAnchor.strong;
        }
      } else if (subjectType === 'tenant') {
        // Colocataire : SA propre identité (jamais le locataire principal).
        anchor = buildExpectedIdentityTarget({ subjectType: 'tenant', subjectSlot: slot, tenant, coTenants });
      } else if (subjectType === 'guarantor') {
        anchor = buildExpectedIdentityTarget({ subjectType: 'guarantor', subjectSlot: slot, guarantorOne, guarantorTwo });
      } else if (subjectType === 'visale') {
        // La pièce Visale doit porter le nom du locataire principal (ancre slot 1).
        if (tenantAnchor) {
          anchor = tenantAnchor.identity;
          anchorStrong = tenantAnchor.strong;
        }
      }

      if (hasUsableIdentity(anchor)) {
        const anchorName = `${anchor.firstName || ''} ${anchor.lastName || ''}`.trim();
        for (const c of docs) {
          // Didit a vérifié l'identité (ancre forte) : la pièce d'identité elle-même
          // n'est PAS pénalisée pour un écart OCR / nom d'usage — Didit fait déjà foi.
          // Le recoupement des AUTRES pièces (revenus, avis, Visale) vs l'identité
          // vérifiée reste actif → anti-fraude inter-documents intact.
          if (anchorStrong && c.kind === 'identity') continue;
          const cmp = compareIdentityToExpected(c.identity, anchor);
          if (cmp.comparable) comparedAny = true;
          if (cmp.comparable && !cmp.matches) {
            const critical = anchorStrong || c.kind === 'identity';
            const code =
              subjectType === 'visale'
                ? 'VISALE_HOLDER_MISMATCH'
                : anchorStrong
                  ? 'IDENTITY_DOC_VS_DIDIT_MISMATCH'
                  : 'IDENTITY_DOC_VS_PROFILE_MISMATCH';
            addFinding(code, critical ? 'critical' : 'warning', c, anchorName);
          }
        }
      } else {
        // Pas d'ancre exploitable → recoupement croisé INTRA-sujet, ancré sur la
        // pièce d'identité du groupe (jamais inter-sujet / inter-slot).
        const idDoc = docs.find((c) => c.kind === 'identity');
        if (idDoc) {
          for (const c of docs) {
            if (c === idDoc) continue;
            const cmp = compareIdentityToExpected(c.identity, idDoc.identity);
            if (cmp.comparable) comparedAny = true;
            if (cmp.comparable && !cmp.matches) {
              addFinding('CROSS_DOCUMENT_IDENTITY_MISMATCH', 'critical', c, fullName(idDoc.identity));
            }
          }
        }
      }
    }

    result.evaluated = comparedAny;
    result.matches = result.findings.length === 0;
    result.needsHumanReview = result.findings.length > 0;
    result.flaggedDocumentIds = Array.from(flagged);
    result.warnings = result.findings.map((f) => f.message);
    result.scoreMalus = result.findings.length
      ? result.findings.some((f) => f.severity === 'critical')
        ? MALUS_CRITICAL
        : MALUS_WARNING
      : 0;
    return result;
  } catch (_e) {
    return NEUTRAL(); // fail-safe : ne casse jamais le scoring
  }
}

module.exports = {
  evaluateDossierIdentityConcordance,
  isConcordanceEnabled,
  collectDocumentIdentity,
  inferDocKind,
  MALUS_CRITICAL,
  MALUS_WARNING,
};
