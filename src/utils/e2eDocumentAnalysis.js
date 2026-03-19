function normalizeComparableValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function inferMockType(fileName) {
  const normalized = normalizeComparableValue(fileName);

  if (normalized.includes('VISALE')) return 'CERTIFICAT_VISALE';
  if (normalized.includes('IDENTITE') || normalized.includes('CNI') || normalized.includes('ID')) return 'CARTE_IDENTITE';
  if (normalized.includes('SALAIRE') || normalized.includes('PAYSLIP') || normalized.includes('BULLETIN')) return 'BULLETIN_SALAIRE';
  if (normalized.includes('IMPOT') || normalized.includes('TAX')) return 'AVIS_IMPOSITION';
  if (normalized.includes('DOMICILE') || normalized.includes('QUITTANCE') || normalized.includes('EDF') || normalized.includes('FACTURE') || normalized.includes('HOME')) {
    return 'JUSTIFICATIF_DOMICILE';
  }
  if (normalized.includes('EMPLOYEUR') || normalized.includes('CONTRAT') || normalized.includes('WORK')) return 'CONTRAT_TRAVAIL';
  if (normalized.includes('PENSION') || normalized.includes('RETRAITE')) return 'PENSION';
  if (normalized.includes('BOURSE')) return 'ATTESTATION_BOURSE';
  if (normalized.includes('CAF') || normalized.includes('APL')) return 'AIDE_LOGEMENT';

  return 'AUTRE';
}

function getDetectedProfile(candidateStatus) {
  const normalized = normalizeComparableValue(candidateStatus);
  if (normalized.includes('ETUDIANT')) return 'STUDENT';
  if (normalized.includes('SALARIE')) return 'SALARIED';
  if (normalized.includes('INDEPENDANT')) return 'INDEPENDENT';
  if (normalized.includes('RETRAITE')) return 'RETIRED';
  return 'UNKNOWN';
}

function buildOwnerName({ fileName, diditIdentity, candidateName }) {
  const normalized = normalizeComparableValue(fileName);
  if (normalized.includes('GUARANTOR') || normalized.includes('GARANT')) {
    return 'JEAN-BAPTISTE DE SAINT-REMY';
  }

  const diditName = [diditIdentity?.lastName, diditIdentity?.firstName].filter(Boolean).join(' ').trim();
  if (diditName) return diditName;
  if (candidateName) return candidateName;
  return 'ALEXANDRINE-MARIE-CLAIRE DE LA ROCHEFOUCAULD-DUPONT';
}

function buildAdvice(type, reviewMode) {
  if (reviewMode) {
    return "Le document a été compris, mais je recommande une revue humaine légère pour confirmer sa parfaite lisibilité.";
  }

  switch (type) {
    case 'CARTE_IDENTITE':
      return "La pièce d'identité est exploitable et alimente correctement le bloc Identité.";
    case 'BULLETIN_SALAIRE':
      return "Le bulletin de salaire renforce le bloc Revenus avec une extraction stable.";
    case 'AVIS_IMPOSITION':
      return "L'avis d'imposition complète bien l'évaluation financière du dossier.";
    case 'JUSTIFICATIF_DOMICILE':
      return "Le justificatif de domicile est exploitable pour consolider le bloc administratif.";
    case 'CERTIFICAT_VISALE':
      return 'Le certificat Visale est utilisable pour le bloc Garantie.';
    default:
      return 'Document de test reçu et normalisé avec succès.';
  }
}

function buildE2EDocumentAnalysis({
  fileName,
  candidateStatus,
  candidateName,
  diditIdentity,
  rentAmount,
}) {
  const type = inferMockType(fileName);
  const normalizedFileName = normalizeComparableValue(fileName);
  const reviewMode = normalizedFileName.includes('REVIEW') || normalizedFileName.includes('NEEDS_REVIEW');
  const rejectedMode = normalizedFileName.includes('REJECTED') || normalizedFileName.includes('FRAUD');
  const ownerName = buildOwnerName({ fileName, diditIdentity, candidateName });
  const detectedProfile = getDetectedProfile(candidateStatus);

  const base = {
    document_metadata: {
      type,
      owner_name: ownerName,
      is_owner_match: !rejectedMode,
      date_emission: '2026-03-17',
      suggested_file_name: fileName,
    },
    financial_data: {
      monthly_net_income: 0,
      currency: 'EUR',
      is_recurring: false,
      extra_details: {},
    },
    trust_and_security: {
      fraud_score: rejectedMode ? 78 : reviewMode ? 18 : 6,
      forensic_alerts: rejectedMode ? ['Incohérence documentaire volontaire en mode E2E.'] : [],
      math_validation: !rejectedMode,
      needs_human_review: reviewMode,
      human_review_reason: reviewMode ? 'Mode revue simulé pour validation QA locale.' : '',
      partial_extraction: false,
      extracted_fields: ['type', 'owner_name', 'date_emission'],
    },
    ai_analysis: {
      detected_profile: detectedProfile,
      impact_on_patrimometer: rejectedMode ? 0 : 10,
      expert_advice: buildAdvice(type, reviewMode),
      improvement_tip: reviewMode ? 'Téléversez une version plus nette pour une validation immédiate.' : '',
    },
  };

  if (type === 'BULLETIN_SALAIRE') {
    base.financial_data.monthly_net_income = 1540;
    base.financial_data.is_recurring = true;
    base.financial_data.extra_details = {
      salaire_brut_mensuel: 1980,
      cotisations_mensuelles: 440,
    };
  }

  if (type === 'AVIS_IMPOSITION') {
    base.financial_data.monthly_net_income = 1540;
    base.financial_data.is_recurring = true;
    base.financial_data.extra_details = {
      revenu_fiscal_reference: 38800,
      nombre_mois_payes: 12,
    };
  }

  if (type === 'PENSION') {
    base.financial_data.monthly_net_income = 1720;
    base.financial_data.is_recurring = true;
    base.financial_data.extra_details = {
      montant_pension: 1720,
    };
  }

  if (type === 'ATTESTATION_BOURSE') {
    base.financial_data.monthly_net_income = 580;
    base.financial_data.extra_details = {
      montant_bourse: 580,
    };
  }

  if (type === 'AIDE_LOGEMENT') {
    base.financial_data.monthly_net_income = 240;
    base.financial_data.extra_details = {
      montant_apl: 240,
    };
  }

  if (type === 'CERTIFICAT_VISALE') {
    const maxRent = Math.max(Number(rentAmount) || 0, 1100) + 120;
    base.financial_data.extra_details = {
      visale: {
        numero_visa: 'V123456789',
        date_validite: '2026-12-31',
        loyer_maximum_garanti: maxRent,
        code_2d_doc: 'E2E-2D-DOC',
        code_2d_doc_valide: true,
      },
    };
    base.trust_and_security.digital_seal_authenticated = true;
    base.trust_and_security.digital_seal_status = 'AUTHENTIFIÉ_PAR_SCELLEMENT_NUMÉRIQUE';
    base.document_metadata.date_validite = '2026-12-31';
  }

  if (type === 'CARTE_IDENTITE') {
    base.document_metadata.date_validite = '2032-03-17';
    base.trust_and_security.extracted_fields.push('date_validite');
  }

  return base;
}

module.exports = {
  buildE2EDocumentAnalysis,
};
