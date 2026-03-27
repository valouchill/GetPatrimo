const writtenNumber = require('written-number');
const {
  computeSmartDeposit,
  deriveLeaseType,
  normalizeLeaseType,
} = require('./leaseWizardShared');

writtenNumber.defaults.lang = 'fr';

const TEXT_SOFT_FALLBACK = '[ A COMPLETER ]';
const INPUT_LINE_FALLBACK = '..........';

function checkbox(value) {
  return value ? '☒' : '☐';
}

function amount(value) {
  const numeric = Number(value) || 0;
  return numeric.toFixed(2);
}

function integerString(value) {
  const numeric = Math.round(Number(value) || 0);
  return String(numeric);
}

function amountInWords(value) {
  const numeric = Math.round(Number(value) || 0);
  return numeric > 0 ? writtenNumber(numeric, { lang: 'fr' }) : 'zero';
}

function formatDate(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR');
}

function formatLongDate(dateInput) {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === 0) return value;
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
}

function splitIntoLines(value, count) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return Array.from({ length: count }, () => '');
  }

  const words = text.split(' ');
  const lines = Array.from({ length: count }, () => '');
  let lineIndex = 0;

  for (const word of words) {
    if (!lines[lineIndex]) {
      lines[lineIndex] = word;
      continue;
    }

    const candidate = `${lines[lineIndex]} ${word}`;
    const remainingSlots = count - lineIndex - 1;
    const shouldWrap = candidate.length > 52 && remainingSlots > 0;
    if (shouldWrap) {
      lineIndex += 1;
      lines[lineIndex] = word;
      continue;
    }
    lines[lineIndex] = candidate;
  }

  return lines;
}

function buildLineMap(prefix, value, count) {
  const lines = splitIntoLines(value, count);
  return lines.reduce((acc, line, index) => {
    acc[`${prefix}_ligne_${index + 1}`] = line;
    return acc;
  }, {});
}

function isMissingValue(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function getSoftFallbackValue(key) {
  const normalizedKey = String(key || '');
  if (normalizedKey.startsWith('coche_')) return '☐';
  if (normalizedKey.includes('_ligne_')) return INPUT_LINE_FALLBACK;
  if (normalizedKey.startsWith('date_') || normalizedKey.endsWith('_date')) return INPUT_LINE_FALLBACK;
  return TEXT_SOFT_FALLBACK;
}

function applySoftFallbacks(data, templateVariables = []) {
  const completed = { ...(data || {}) };
  const targetKeys = templateVariables.length > 0 ? templateVariables : Object.keys(completed);

  for (const key of targetKeys) {
    if (isMissingValue(completed[key])) {
      completed[key] = getSoftFallbackValue(key);
    }
  }

  return completed;
}

const WARNING_RULES = [
  { label: 'Surface habitable', keys: ['surface_habitable_m2', 'surface_totale_m2'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Classe DPE', keys: ['dpe_classe'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Date DPE', keys: ['date_dpe'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Montant du dernier loyer', keys: ['dernier_loyer_infos'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Nombre de pieces principales', keys: ['nb_pieces_principales'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Identifiant fiscal du logement', keys: ['logement_id_fiscal'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Periode de construction', keys: ['periode_construction', 'annee_construction'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  // Diagnostics obligatoires (loi ALUR / décret 2020-1609)
  { label: 'CREP (Constat de Risque d\'Exposition au Plomb)', keys: ['crep_date', 'crep_resultat'], leaseTypes: ['VIDE', 'MEUBLE'] },
  { label: 'État des Risques et Pollutions (ERP)', keys: ['erp_date', 'erp_resultat'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Diagnostic Électricité', keys: ['diagnostic_electricite_date'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Diagnostic Gaz', keys: ['diagnostic_gaz_date'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
  { label: 'Diagnostic Bruit (plan d\'exposition)', keys: ['diagnostic_bruit_date', 'zone_bruit'], leaseTypes: ['VIDE', 'MEUBLE', 'MOBILITE'] },
];

function collectLeaseWarnings(rawData, templateVariables = [], leaseType = 'VIDE') {
  const warnings = [];

  for (const rule of WARNING_RULES) {
    if (Array.isArray(rule.leaseTypes) && !rule.leaseTypes.includes(leaseType)) {
      continue;
    }

    const isMissing = rule.keys.every((key) => isMissingValue(rawData?.[key]));
    if (isMissing) warnings.push(rule.label);
  }

  return warnings;
}

function getConstructionPeriod(year) {
  const numericYear = Number(year) || 0;
  if (!numericYear) return '';
  if (numericYear < 1949) return 'Avant 1949';
  if (numericYear <= 1974) return '1949 - 1974';
  if (numericYear <= 1989) return '1975 - 1989';
  if (numericYear <= 2005) return '1990 - 2005';
  return 'Depuis 2005';
}

function getConstructionCheckboxes(year) {
  const label = getConstructionPeriod(year);
  return {
    coche_avant_1949: checkbox(label === 'Avant 1949'),
    coche_1949_1974: checkbox(label === '1949 - 1974'),
    coche_1975_1989: checkbox(label === '1975 - 1989'),
    coche_1989_2005: checkbox(label === '1990 - 2005'),
    coche_depuis_2005: checkbox(label === 'Depuis 2005'),
  };
}

function normalizeLandlord(landlord, formData) {
  const type = firstNonEmpty(formData?.landlordType, landlord?.type, landlord?.companyName ? 'company' : 'person');
  const isCompany = String(type).toLowerCase() === 'company';
  const name = isCompany
    ? firstNonEmpty(formData?.landlordCompanyName, landlord?.companyName, landlord?.denomination, landlord?.email)
    : firstNonEmpty(
        formData?.landlordFullName,
        [landlord?.firstName, landlord?.lastName].filter(Boolean).join(' ').trim(),
        landlord?.email
      );

  return {
    type,
    isCompany,
    name: String(name || '').trim(),
    address: firstNonEmpty(
      formData?.landlordAddress,
      landlord?.address,
      [landlord?.addressLine, landlord?.zipCode, landlord?.city].filter(Boolean).join(', ')
    ),
    email: firstNonEmpty(formData?.landlordEmail, landlord?.email),
    phone: firstNonEmpty(formData?.landlordPhone, landlord?.phone),
    city: firstNonEmpty(formData?.signatureCity, landlord?.city),
  };
}

function normalizeProperty(property, formData) {
  const rentHC = Number(firstNonEmpty(formData?.rentHC, formData?.rentAmount, property?.rentHC, property?.rentAmount)) || 0;
  const charges = Number(firstNonEmpty(formData?.charges, formData?.chargesAmount, property?.charges, property?.chargesAmount)) || 0;
  const leaseType = deriveLeaseType(property, formData?.leaseType);
  const deposit = Number(firstNonEmpty(formData?.deposit, formData?.depositAmount, computeSmartDeposit(leaseType, rentHC))) || 0;
  const startDate = firstNonEmpty(formData?.startDate, formData?.dateEffet, property?.startDate);
  const endDate = firstNonEmpty(formData?.endDate, formData?.dateFin, property?.endDate);
  const durationMonths = Number(firstNonEmpty(formData?.durationMonths, formData?.dureeBailMois, leaseType === 'MOBILITE' ? 10 : 12)) || 0;
  const paymentDay = Number(firstNonEmpty(formData?.paymentDay, 5)) || 5;
  const constructionYear = firstNonEmpty(property?.constructionYear, property?.yearBuilt, property?.builtYear, formData?.constructionYear);
  const habitatType = firstNonEmpty(formData?.typeHabitat, property?.habitatType, 'collectif');
  const address = firstNonEmpty(
    formData?.propertyAddress,
    property?.address,
    [property?.addressLine, property?.zipCode, property?.city].filter(Boolean).join(', ')
  );

  return {
    leaseType,
    rentHC,
    charges,
    deposit,
    startDate,
    endDate,
    durationMonths,
    paymentDay,
    constructionYear,
    habitatType,
    address,
    zipCode: firstNonEmpty(formData?.propertyZipCode, property?.zipCode),
    city: firstNonEmpty(formData?.propertyCity, property?.city),
    fiscalId: firstNonEmpty(formData?.propertyFiscalId, property?.fiscalId, property?.taxId),
    surface: firstNonEmpty(formData?.surfaceHabitable, property?.surfaceHabitableM2, property?.surfaceM2),
    rooms: firstNonEmpty(formData?.rooms, property?.rooms, property?.nbPieces),
    dpeClass: firstNonEmpty(formData?.dpeClass, property?.dpeClass, property?.etiquetteDPE, property?.dpe?.class),
    energyEstimate: firstNonEmpty(formData?.energyEstimate, property?.energyEstimate),
    legalRegime: firstNonEmpty(formData?.legalRegime, property?.legalRegime, property?.status === 'AVAILABLE' ? 'Location vide' : ''),
    heatingMode: firstNonEmpty(formData?.modeChauffage, property?.heatingMode, property?.heatingType),
    hotWaterMode: firstNonEmpty(formData?.modeEauChaude, property?.hotWaterMode),
    paymentMode: firstNonEmpty(formData?.paymentMode, 'virement bancaire'),
    paymentLocation: firstNonEmpty(formData?.paymentLocation, property?.address, ''),
    previousRentInfo: firstNonEmpty(formData?.previousRentInfo, ''),
    irlReference: firstNonEmpty(formData?.irlReference, ''),
    loyerReference: firstNonEmpty(formData?.loyerReference, ''),
    loyerReferenceMajore: firstNonEmpty(formData?.loyerReferenceMajore, ''),
    complementLoyer: firstNonEmpty(formData?.complementLoyer, ''),
    guaranteeType: firstNonEmpty(formData?.guaranteeType, formData?.guarantorType, ''),
    clauses: firstNonEmpty(formData?.clauses, formData?.additionalClauses, ''),
    equipments: firstNonEmpty(formData?.equipments, property?.equipments),
    ticEquipments: firstNonEmpty(formData?.ticEquipments, formData?.equipementsTic),
    otherParts: firstNonEmpty(formData?.otherParts, formData?.autresPartiesLogement),
    privatePremises: firstNonEmpty(formData?.privatePremises, property?.privatePremises),
    commonPremises: firstNonEmpty(formData?.commonPremises, property?.commonPremises),
    works: firstNonEmpty(formData?.works, formData?.travauxEffectues),
    guaranteeEndDate: firstNonEmpty(formData?.guaranteeEndDate, endDate),
    revisionDate: firstNonEmpty(formData?.revisionDate, startDate),
    signatureDate: firstNonEmpty(formData?.signatureDate, new Date()),
    signatureCity: firstNonEmpty(formData?.signatureCity, property?.city),
    paymentPeriodDate: firstNonEmpty(formData?.paymentPeriodDate, startDate),
  };
}

function normalizeTenant(tenant) {
  const fullName = String(
    firstNonEmpty(
      tenant?.fullName,
      [tenant?.firstName, tenant?.lastName].filter(Boolean).join(' ').trim(),
      tenant?.email
    )
  ).trim();

  return {
    ...tenant,
    fullName,
    address: firstNonEmpty(
      tenant?.address,
      [tenant?.addressLine, tenant?.zipCode, tenant?.city].filter(Boolean).join(', ')
    ),
    birthDate: firstNonEmpty(tenant?.birthDate, tenant?.diditBirthDate, tenant?.identityBirthDate),
  };
}

function normalizeGuarantor(tenant, formData) {
  const source = {
    ...(tenant?.guarantor || {}),
    ...((formData && formData.guarantorOverrides) || {}),
  };

  const fullName = [source.firstName, source.lastName].filter(Boolean).join(' ').trim();
  return {
    firstName: firstNonEmpty(source.firstName),
    lastName: firstNonEmpty(source.lastName),
    fullName: firstNonEmpty(fullName, source.email),
    email: firstNonEmpty(source.email),
    phone: firstNonEmpty(source.phone),
    address: firstNonEmpty(source.address),
    zipCode: firstNonEmpty(source.zipCode),
    city: firstNonEmpty(source.city),
    birthDate: firstNonEmpty(source.birthDate),
    profession: firstNonEmpty(source.profession),
    income: Number(firstNonEmpty(source.income, 0)) || 0,
    visaleNumber: firstNonEmpty(source.visaleNumber),
  };
}

function buildLeaseData(property, tenant, landlord, formData = {}) {
  const normalizedProperty = normalizeProperty(property, formData);
  const normalizedTenant = normalizeTenant(tenant);
  const normalizedLandlord = normalizeLandlord(landlord, formData);
  const normalizedGuarantor = normalizeGuarantor(tenant, formData);
  const leaseType = normalizeLeaseType(normalizedProperty.leaseType) || 'VIDE';
  const totalMonthly = normalizedProperty.rentHC + normalizedProperty.charges;
  const commitmentBase = totalMonthly * Math.max(normalizedProperty.durationMonths || 12, 1);
  const firstPaymentDate = new Date(normalizedProperty.startDate || new Date());
  if (!Number.isNaN(firstPaymentDate.getTime())) {
    firstPaymentDate.setDate(Math.min(normalizedProperty.paymentDay || 5, 28));
  }
  const constructionCheckboxes = getConstructionCheckboxes(normalizedProperty.constructionYear);
  const mandataireIdentite = [
    formData.mandataireNomPrenom || formData.mandataireDenomination,
    formData.mandataireAdresse,
  ].filter(Boolean);
  const localDescription = [
    formData.localDescription,
    formData.parkingType,
    formData.parkingNumber || formData.garageNumero || property?.parkingNumber,
  ].filter(Boolean).join(' - ');
  const tenantIdentity = [normalizedTenant.fullName, normalizedTenant.email, normalizedTenant.phone].filter(Boolean).join(' - ');
  const localDescriptionLines = splitIntoLines(localDescription, 3);
  const tenantIdentityLines = splitIntoLines(tenantIdentity, 3);

  const baseData = {
    bailleur_nom_prenom: normalizedLandlord.name,
    bailleur_denomination: normalizedLandlord.isCompany ? normalizedLandlord.name : '',
    bailleur_adresse: normalizedLandlord.address,
    bailleur_email: normalizedLandlord.email,
    bailleur_identite_ligne_1: normalizedLandlord.name,
    bailleur_identite_ligne_2: normalizedLandlord.address,
    bailleur_identite_ligne_3: normalizedLandlord.email,
    bailleur_identite_ligne_4: normalizedLandlord.phone,
    caution_nom_prenom: normalizedGuarantor.fullName,
    caution_adresse: normalizedGuarantor.address,
    caution_code_postal: normalizedGuarantor.zipCode,
    caution_ville: normalizedGuarantor.city,
    caution_date_naissance: formatDate(normalizedGuarantor.birthDate),
    date_dpe: formatDate(firstNonEmpty(formData.dpeDate, property?.dpeDate, property?.dpe?.date, property?.energyReportDate)),
    date_debut_location: formatDate(normalizedProperty.startDate),
    date_effet_bail: formatDate(normalizedProperty.startDate),
    date_prise_effet: formatDate(normalizedProperty.startDate),
    date_fin_location: formatDate(normalizedProperty.endDate),
    date_signature: formatLongDate(normalizedProperty.signatureDate),
    date_signature_caution: formatLongDate(normalizedProperty.signatureDate),
    date_echeance_cautionnement: formatDate(normalizedProperty.guaranteeEndDate),
    date_revision: formatDate(normalizedProperty.revisionDate),
    date_revision_annuelle: formatDate(normalizedProperty.revisionDate),
    date_periode_paiement: formatDate(normalizedProperty.paymentPeriodDate),
    depot_garantie: amount(normalizedProperty.deposit),
    descriptif_local_ligne_1: localDescriptionLines[0],
    descriptif_local_ligne_2: localDescriptionLines[1],
    descriptif_local_ligne_3: localDescriptionLines[2],
    duree_bail_mois: integerString(normalizedProperty.durationMonths),
    duree_contrat: `${integerString(normalizedProperty.durationMonths)} mois`,
    duree_location: `${integerString(normalizedProperty.durationMonths)} mois`,
    duree_reduite: integerString(normalizedProperty.durationMonths),
    dpe_classe: normalizedProperty.dpeClass,
    depenses_energetiques_estimees: String(normalizedProperty.energyEstimate || ''),
    equipements_logement: String(normalizedProperty.equipments || ''),
    equipements_tic: String(normalizedProperty.ticEquipments || ''),
    forfait_charges_mensuel: amount(normalizedProperty.charges),
    garantie_type: String(normalizedProperty.guaranteeType || ''),
    garant_nom_adresse: [normalizedGuarantor.fullName, normalizedGuarantor.address].filter(Boolean).join(' - '),
    honoraires_bailleur_autres_prestations: amount(formData.honorairesBailleurAutresPrestations),
    honoraires_bailleur_edl: amount(formData.honorairesBailleurEdl),
    honoraires_bailleur_visite_dossier_bail: amount(formData.honorairesBailleurVisiteDossierBail),
    honoraires_locataire_edl: amount(formData.honorairesLocataireEdl),
    honoraires_locataire_visite_dossier_bail: amount(formData.honorairesLocataireVisiteDossierBail),
    irl_reference: String(normalizedProperty.irlReference || ''),
    irl_reference_date: String(formData.irlReferenceDate || ''),
    lieu_paiement: String(normalizedProperty.paymentLocation || normalizedLandlord.address || ''),
    lieu_signature: String(normalizedProperty.signatureCity || normalizedLandlord.city || normalizedProperty.city || ''),
    lieu_signature_caution: String(normalizedProperty.signatureCity || normalizedLandlord.city || normalizedProperty.city || ''),
    locataire_nom_prenom: normalizedTenant.fullName,
    locataire_identite_ligne_1: normalizedTenant.fullName,
    locataire_identite_ligne_2: [normalizedTenant.email, normalizedTenant.phone].filter(Boolean).join(' - '),
    locataires_nom_prenoms_emails: [normalizedTenant.fullName, normalizedTenant.email].filter(Boolean).join(' - '),
    locataires_nom_prenoms_emails_ligne_1: tenantIdentityLines[0],
    locataires_nom_prenoms_emails_ligne_2: tenantIdentityLines[1],
    locataires_nom_prenoms_emails_ligne_3: tenantIdentityLines[2],
    localisation_local_ligne_1: normalizedProperty.address,
    localisation_local_ligne_2: [normalizedProperty.zipCode, normalizedProperty.city].filter(Boolean).join(' '),
    logement_adresse: normalizedProperty.address,
    logement_code_postal: String(normalizedProperty.zipCode || ''),
    logement_ville: String(normalizedProperty.city || ''),
    logement_id_fiscal: String(normalizedProperty.fiscalId || ''),
    loyer_mensuel: amount(normalizedProperty.rentHC),
    loyer_principal_chiffres: amount(normalizedProperty.rentHC),
    loyer_principal_lettres: amountInWords(normalizedProperty.rentHC),
    loyer_chiffres: amount(normalizedProperty.rentHC),
    loyer_lettres: amountInWords(normalizedProperty.rentHC),
    loyer_periodicite: 'mensuel',
    loyer_reference: String(normalizedProperty.loyerReference || ''),
    loyer_reference_majore: String(normalizedProperty.loyerReferenceMajore || ''),
    mention_loyer_chiffres: amount(normalizedProperty.rentHC),
    mention_loyer_lettres: amountInWords(normalizedProperty.rentHC),
    mention_charges_chiffres: amount(normalizedProperty.charges),
    mention_charges_lettres: amountInWords(normalizedProperty.charges),
    mention_engagement_max_chiffres: amount(commitmentBase),
    mention_engagement_max_lettres: amountInWords(commitmentBase),
    mention_date_lieu_signature: `${formatLongDate(normalizedProperty.signatureDate)} à ${normalizedProperty.signatureCity || normalizedLandlord.city || normalizedProperty.city || ''}`.trim(),
    mention_irl_trimestre_reference: String(formData.irlQuarterReference || ''),
    mode_chauffage: String(normalizedProperty.heatingMode || ''),
    mode_eau_chaude: String(normalizedProperty.hotWaterMode || ''),
    mode_paiement: String(normalizedProperty.paymentMode || ''),
    montant_provisions_charges: amount(normalizedProperty.charges),
    charges_chiffres: amount(normalizedProperty.charges),
    charges_lettres: amountInWords(normalizedProperty.charges),
    nb_pieces_principales: String(normalizedProperty.rooms || ''),
    nb_pieces_places: String(normalizedProperty.rooms || ''),
    annee_construction: String(normalizedProperty.constructionYear || ''),
    parking_numero: String(formData.parkingNumber || property?.parkingNumber || ''),
    periodicite_paiement: 'mensuelle',
    periodicite_loyer: 'mensuelle',
    periode_construction: getConstructionPeriod(normalizedProperty.constructionYear),
    plafond_honoraires_bail_m2: amount(formData.plafondHonorairesBailM2),
    plafond_honoraires_edl_m2: amount(formData.plafondHonorairesEdlM2),
    premiere_echeance_loyer: formatDate(firstPaymentDate),
    premiere_echeance_charges: formatDate(firstPaymentDate),
    premiere_echeance_totale: formatDate(firstPaymentDate),
    premiere_echeance_assurance_coloc: formatDate(firstPaymentDate),
    premiere_echeance_contribution: formatDate(firstPaymentDate),
    preavis_non_renouvellement_mois: leaseType === 'GARAGE_PARKING' ? '1' : '3',
    regime_juridique: String(normalizedProperty.legalRegime || ''),
    soumis_decret_relocation: String(formData.soumisDecretRelocation || ''),
    soumis_loyer_reference_majore: String(formData.soumisLoyerReferenceMajore || ''),
    surface_habitable_m2: String(normalizedProperty.surface || ''),
    surface_totale_m2: String(normalizedProperty.surface || ''),
    type_habitat: String(normalizedProperty.habitatType || ''),
    date_periode_paiement: formatDate(firstPaymentDate),
    dernier_loyer_infos: String(normalizedProperty.previousRentInfo || ''),
    complement_loyer: String(normalizedProperty.complementLoyer || ''),
    complement_loyer_details: String(normalizedProperty.complementLoyer || ''),
    autres_conditions_particulieres: String(normalizedProperty.clauses || ''),
    autres_parties_logement: String(normalizedProperty.otherParts || ''),
    locaux_privatifs: String(normalizedProperty.privatePremises || ''),
    locaux_communs: String(normalizedProperty.commonPremises || ''),
    travaux_effectues: String(normalizedProperty.works || ''),
    travaux_amelioration_depuis_dernier_contrat: String(formData.previousWorks || ''),
    majoration_loyer_travaux_bailleur: String(formData.majorationLoyerTravauxBailleur || ''),
    diminution_loyer_travaux_locataire: String(formData.diminutionLoyerTravauxLocataire || ''),
    eau_chaude_precision: String(formData.eauChaudePrecision || ''),
    chauffage_precision: String(formData.chauffagePrecision || ''),
    participation_economies_charges: String(formData.participationEconomiesCharges || ''),
    justification_travaux_contribution: String(formData.justificationTravauxContribution || ''),
    mandataire_nom_prenom: String(formData.mandataireNomPrenom || ''),
    mandataire_denomination: String(formData.mandataireDenomination || ''),
    mandataire_adresse: String(formData.mandataireAdresse || ''),
    mandataire_activite: String(formData.mandataireActivite || ''),
    mandataire_carte_pro: String(formData.mandataireCartePro || ''),
    mandataire_identite_ligne_1: mandataireIdentite[0] || '',
    mandataire_identite_ligne_2: mandataireIdentite[1] || '',
    cave_numero: String(formData.caveNumero || ''),
    garage_numero: String(formData.garageNumero || ''),
    accessoire_autre: String(formData.accessoireAutre || ''),
    parties_communes_autres: String(formData.partiesCommunesAutres || ''),
    assurance_coloc_annuelle: amount(formData.assuranceColocAnnuelle),
    assurance_coloc_mensuelle: amount(formData.assuranceColocMensuelle),
    premiere_echeance_assurance_coloc: formatDate(firstPaymentDate),
    revision_forfait_charges: String(formData.revisionForfaitCharges || ''),
    reevaluation_mensuelle: String(formData.reevaluationMensuelle || ''),
    reevaluation_modalites: String(formData.reevaluationModalites || ''),
    paiement_jour_mois: String(normalizedProperty.paymentDay || 5),
    coche_bailleur_personne_physique: checkbox(!normalizedLandlord.isCompany),
    coche_bailleur_personne_morale: checkbox(normalizedLandlord.isCompany),
    coche_societe_civile_oui: checkbox(Boolean(formData.isSocieteCivile)),
    coche_societe_civile_non: checkbox(!Boolean(formData.isSocieteCivile)),
    coche_mandataire_oui: checkbox(Boolean(formData.hasMandataire)),
    coche_mandataire_non: checkbox(!Boolean(formData.hasMandataire)),
    coche_duree_3_ans: checkbox(!normalizedLandlord.isCompany && leaseType === 'VIDE'),
    coche_duree_6_ans: checkbox(normalizedLandlord.isCompany && leaseType === 'VIDE'),
    coche_duree_reduite: checkbox(leaseType === 'MOBILITE' || Boolean(formData.dureeReduite)),
    coche_provision_charges: checkbox(normalizedProperty.charges > 0 && leaseType !== 'MOBILITE'),
    coche_charges_provisionnelles: checkbox(normalizedProperty.charges > 0 && leaseType !== 'MOBILITE'),
    coche_charges_sans_provision: checkbox(normalizedProperty.charges === 0),
    coche_forfait_charges: checkbox(leaseType === 'MEUBLE' || leaseType === 'MOBILITE'),
    coche_assurance_coloc_oui: checkbox(Boolean(formData.assuranceColocObligatoire)),
    coche_assurance_coloc_non: checkbox(!Boolean(formData.assuranceColocObligatoire)),
    coche_paiement_a_echoir: checkbox(!Boolean(formData.paymentInArrears)),
    coche_paiement_terme_echu: checkbox(Boolean(formData.paymentInArrears)),
    coche_loyer_revise_oui: checkbox(Boolean(formData.loyerRevise)),
    coche_loyer_revise_non: checkbox(!Boolean(formData.loyerRevise)),
    coche_decret_loyers_oui: checkbox(Boolean(formData.soumisDecretRelocation)),
    coche_decret_loyers_non: checkbox(!Boolean(formData.soumisDecretRelocation)),
    coche_loyer_ref_majore_oui: checkbox(Boolean(formData.soumisLoyerReferenceMajore)),
    coche_loyer_ref_majore_non: checkbox(!Boolean(formData.soumisLoyerReferenceMajore)),
    coche_usage_habitation: checkbox(!Boolean(formData.usageMixte)),
    coche_usage_mixte: checkbox(Boolean(formData.usageMixte)),
    coche_habitat_collectif: checkbox(String(normalizedProperty.habitatType || '').toLowerCase() !== 'individuel'),
    coche_habitat_individuel: checkbox(String(normalizedProperty.habitatType || '').toLowerCase() === 'individuel'),
    coche_monopropriete: checkbox(String(formData.regimeJuridique || '').toLowerCase().includes('mono')),
    coche_copropriete: checkbox(String(formData.regimeJuridique || '').toLowerCase().includes('copro')),
    coche_chauffage_collectif: checkbox(String(normalizedProperty.heatingMode || '').toLowerCase().includes('collectif')),
    coche_chauffage_individuel: checkbox(!String(normalizedProperty.heatingMode || '').toLowerCase().includes('collectif')),
    coche_eau_chaude_collective: checkbox(String(normalizedProperty.hotWaterMode || '').toLowerCase().includes('collectif')),
    coche_eau_chaude_individuelle: checkbox(!String(normalizedProperty.hotWaterMode || '').toLowerCase().includes('collectif')),
    coche_balcon: checkbox(Boolean(formData.balcony)),
    coche_terrasse: checkbox(Boolean(formData.terrace)),
    coche_jardin: checkbox(Boolean(formData.garden)),
    coche_loggia: checkbox(Boolean(formData.loggia)),
    coche_cave: checkbox(Boolean(formData.caveNumero)),
    coche_garage: checkbox(leaseType === 'GARAGE_PARKING' || Boolean(formData.garageNumero)),
    coche_parking: checkbox(leaseType === 'GARAGE_PARKING' || Boolean(formData.parkingNumber)),
    coche_garage_velo: checkbox(Boolean(formData.garageVelo)),
    coche_grenier: checkbox(Boolean(formData.grenier)),
    coche_comble: checkbox(Boolean(formData.comble)),
    coche_aires_jeux: checkbox(Boolean(formData.airesJeux)),
    coche_ascenseur: checkbox(Boolean(formData.ascenseur)),
    coche_espaces_verts: checkbox(Boolean(formData.espacesVerts)),
    coche_gardiennage: checkbox(Boolean(formData.gardiennage)),
    coche_laverie: checkbox(Boolean(formData.laverie)),
    coche_local_poubelle: checkbox(Boolean(formData.localPoubelle)),
    coche_autres_parties: checkbox(Boolean(normalizedProperty.otherParts)),
    coche_parties_communes_autres: checkbox(Boolean(formData.partiesCommunesAutres)),
    coche_accessoire_autre: checkbox(Boolean(formData.accessoireAutre)),
    coche_situation_stage: checkbox(String(formData.mobilityReason || '').toLowerCase().includes('stage')),
    coche_situation_contrat_apprentissage: checkbox(String(formData.mobilityReason || '').toLowerCase().includes('apprentissage')),
    coche_situation_formation_professionnelle: checkbox(String(formData.mobilityReason || '').toLowerCase().includes('formation')),
    coche_situation_mutation_professionnelle: checkbox(String(formData.mobilityReason || '').toLowerCase().includes('mutation')),
    coche_situation_mission_temporaire: checkbox(String(formData.mobilityReason || '').toLowerCase().includes('mission')),
    coche_situation_service_civique: checkbox(String(formData.mobilityReason || '').toLowerCase().includes('service civique')),
    coche_situation_etudes_superieures: checkbox(String(formData.mobilityReason || '').toLowerCase().includes('etude')),
  };

  return {
    ...baseData,
    ...buildLineMap('autres_conditions_particulieres', baseData.autres_conditions_particulieres, 4),
    ...buildLineMap('locaux_privatifs', baseData.locaux_privatifs, 2),
    ...buildLineMap('locaux_communs', baseData.locaux_communs, 2),
    ...buildLineMap('equipements_tic', baseData.equipements_tic, 2),
    ...buildLineMap('travaux_effectues', baseData.travaux_effectues, 2),
    ...buildLineMap('travaux_amelioration_depuis_dernier_contrat', baseData.travaux_amelioration_depuis_dernier_contrat, 3),
    ...buildLineMap('majoration_loyer_travaux_bailleur', baseData.majoration_loyer_travaux_bailleur, 3),
    ...buildLineMap('diminution_loyer_travaux_locataire', baseData.diminution_loyer_travaux_locataire, 3),
    ...constructionCheckboxes,
  };
}

function buildLeaseArtifacts(property, tenant, landlord, formData = {}, templateVariables = []) {
  const rawData = buildLeaseData(property, tenant, landlord, formData);
  const leaseType = normalizeLeaseType(deriveLeaseType(property, formData?.leaseType)) || 'VIDE';
  const mergeData = applySoftFallbacks(rawData, templateVariables);
  const warnings = collectLeaseWarnings(rawData, templateVariables, leaseType);

  return {
    rawData,
    mergeData,
    warnings,
  };
}

module.exports = {
  TEXT_SOFT_FALLBACK,
  INPUT_LINE_FALLBACK,
  applySoftFallbacks,
  buildLeaseArtifacts,
  buildLeaseData,
  amountInWords,
  collectLeaseWarnings,
  formatDate,
  formatLongDate,
  getSoftFallbackValue,
  isMissingValue,
};
