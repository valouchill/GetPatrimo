/**
 * Field Registry — Reverse mapping template variables → form fields + metadata.
 * Used by the inline editor to know what widget to render for each contract variable.
 */

export type FieldType = 'number' | 'text' | 'date' | 'select' | 'pill' | 'toggle' | 'readonly';

export interface FieldMeta {
  formField: string;
  type: FieldType;
  label: string;
  suffix?: string;
  options?: { value: string; label: string; info?: string }[];
  tooltip?: string;
  min?: number;
  max?: number;
}

// ── Reverse mapping: template variable → form field + metadata ───────

const REGISTRY: Record<string, FieldMeta> = {
  // Core financials
  loyer_mensuel:            { formField: 'rentHC', type: 'number', label: 'Loyer hors charges', suffix: '€/mois', tooltip: 'Montant du loyer mensuel hors charges. Soumis au plafonnement en zone tendue (art. 140, loi ELAN).', min: 0 },
  loyer_principal_chiffres: { formField: 'rentHC', type: 'number', label: 'Loyer hors charges', suffix: '€', min: 0 },
  loyer_chiffres:           { formField: 'rentHC', type: 'number', label: 'Loyer', suffix: '€', min: 0 },
  mention_loyer_chiffres:   { formField: 'rentHC', type: 'number', label: 'Loyer', suffix: '€', min: 0 },
  forfait_charges_mensuel:  { formField: 'charges', type: 'number', label: 'Charges mensuelles', suffix: '€/mois', tooltip: 'Provision pour charges ou forfait de charges. Si forfait, non régularisable.' },
  charges_chiffres:         { formField: 'charges', type: 'number', label: 'Charges', suffix: '€' },
  mention_charges_chiffres: { formField: 'charges', type: 'number', label: 'Charges', suffix: '€' },
  montant_provisions_charges: { formField: 'charges', type: 'number', label: 'Provisions charges', suffix: '€' },
  depot_garantie:           { formField: 'deposit', type: 'number', label: 'Dépôt de garantie', suffix: '€', tooltip: 'Limité à 1 mois de loyer HC pour un bail vide, 2 mois pour un meublé. Interdit pour un bail mobilité (art. 25-6, loi du 6/7/1989).' },
  depot_garantie_chiffres:  { formField: 'deposit', type: 'number', label: 'Dépôt de garantie', suffix: '€' },

  // Dates
  date_debut_location:  { formField: 'startDate', type: 'date', label: 'Date de début du bail', tooltip: 'Date de prise d\'effet du contrat. Le bail prend effet à la remise des clés.' },
  date_effet_bail:      { formField: 'startDate', type: 'date', label: 'Date d\'effet' },
  date_prise_effet:     { formField: 'startDate', type: 'date', label: 'Date de prise d\'effet' },

  // Duration
  duree_bail_mois: { formField: 'durationMonths', type: 'number', label: 'Durée du bail', suffix: 'mois', tooltip: 'Bail vide : 3 ans minimum (6 ans si bailleur personne morale). Meublé : 1 an. Mobilité : 1 à 10 mois.' },
  duree_contrat:   { formField: 'durationMonths', type: 'number', label: 'Durée', suffix: 'mois' },
  duree_location:  { formField: 'durationMonths', type: 'number', label: 'Durée', suffix: 'mois' },

  // Payment
  paiement_jour_mois: { formField: 'paymentDay', type: 'number', label: 'Jour de paiement', suffix: 'du mois', min: 1, max: 28 },
  mode_paiement:      { formField: 'paymentMode', type: 'select', label: 'Mode de paiement', options: [
    { value: 'Virement bancaire', label: 'Virement bancaire' },
    { value: 'Prélèvement automatique', label: 'Prélèvement automatique' },
    { value: 'Chèque', label: 'Chèque' },
    { value: 'Espèces', label: 'Espèces', info: 'Attention : interdit au-delà de 1000 €' },
  ]},
  lieu_paiement: { formField: 'paymentLocation', type: 'text', label: 'Lieu de paiement' },

  // Property characteristics
  surface_habitable_m2: { formField: 'surfaceHabitable', type: 'number', label: 'Surface habitable', suffix: 'm²', tooltip: 'Surface habitable au sens de l\'art. R111-2 du CCH. Mesure loi Boutin obligatoire.' },
  surface_totale_m2:    { formField: 'surfaceHabitable', type: 'number', label: 'Surface', suffix: 'm²' },
  nb_pieces_principales: { formField: 'rooms', type: 'number', label: 'Nombre de pièces principales', min: 1 },
  nb_pieces_places:     { formField: 'rooms', type: 'number', label: 'Pièces', min: 1 },
  dpe_classe:           { formField: 'dpeClass', type: 'select', label: 'Classe DPE', options: [
    { value: 'A', label: 'A', info: 'Excellente performance' },
    { value: 'B', label: 'B', info: 'Très bonne performance' },
    { value: 'C', label: 'C', info: 'Bonne performance' },
    { value: 'D', label: 'D', info: 'Performance moyenne' },
    { value: 'E', label: 'E', info: 'Performance médiocre' },
    { value: 'F', label: 'F', info: 'Passoire énergétique — restriction de location depuis 2025' },
    { value: 'G', label: 'G', info: 'Passoire énergétique — interdiction de location depuis 2025' },
  ], tooltip: 'Diagnostic de Performance Énergétique. Obligatoire. Les logements F et G sont soumis à des restrictions.' },
  date_dpe:             { formField: 'dpeDate', type: 'date', label: 'Date du DPE' },
  mode_chauffage:       { formField: 'modeChauffage', type: 'select', label: 'Mode de chauffage', options: [
    { value: 'individuel gaz', label: 'Individuel gaz' },
    { value: 'individuel électrique', label: 'Individuel électrique' },
    { value: 'collectif', label: 'Collectif' },
    { value: 'pompe à chaleur', label: 'Pompe à chaleur' },
    { value: 'autre', label: 'Autre' },
  ]},
  mode_eau_chaude:      { formField: 'modeEauChaude', type: 'select', label: 'Production eau chaude', options: [
    { value: 'individuel gaz', label: 'Individuel gaz' },
    { value: 'individuel électrique', label: 'Individuel électrique' },
    { value: 'collectif', label: 'Collectif' },
    { value: 'autre', label: 'Autre' },
  ]},

  // Revision
  irl_reference:        { formField: 'irlReference', type: 'text', label: 'Indice IRL de référence', tooltip: 'Indice de Référence des Loyers publié par l\'INSEE. Permet la révision annuelle du loyer (art. 17-1, loi du 6/7/1989).' },
  irl_reference_date:   { formField: 'irlReferenceDate', type: 'text', label: 'Date de référence IRL' },
  loyer_reference:      { formField: 'loyerReference', type: 'text', label: 'Loyer de référence (€/m²)', tooltip: 'Fixé par arrêté préfectoral dans les zones soumises à l\'encadrement des loyers.' },
  loyer_reference_majore: { formField: 'loyerReferenceMajore', type: 'text', label: 'Loyer de référence majoré (€/m²)' },
  complement_loyer:     { formField: 'complementLoyer', type: 'text', label: 'Complément de loyer', tooltip: 'Justifié par des caractéristiques exceptionnelles (vue, terrasse, etc.). Contestable par le locataire.' },
  complement_loyer_details: { formField: 'complementLoyer', type: 'text', label: 'Détails complément' },

  // Mandataire
  mandataire_nom_prenom:    { formField: 'mandataireNomPrenom', type: 'text', label: 'Nom du mandataire' },
  mandataire_denomination:  { formField: 'mandataireDenomination', type: 'text', label: 'Dénomination du mandataire' },
  mandataire_adresse:       { formField: 'mandataireAdresse', type: 'text', label: 'Adresse du mandataire' },
  mandataire_activite:      { formField: 'mandataireActivite', type: 'text', label: 'Activité du mandataire' },
  mandataire_carte_pro:     { formField: 'mandataireCartePro', type: 'text', label: 'N° carte professionnelle' },

  // Clauses
  autres_conditions_particulieres: { formField: 'clauses', type: 'text', label: 'Clauses particulières', tooltip: 'Conditions spécifiques au bail. Ne peuvent pas déroger aux dispositions d\'ordre public de la loi du 6/7/1989.' },

  // Readonly (computed server-side)
  loyer_lettres:              { formField: '', type: 'readonly', label: 'Loyer en lettres' },
  loyer_principal_lettres:    { formField: '', type: 'readonly', label: 'Loyer en lettres' },
  depot_garantie_lettres:     { formField: '', type: 'readonly', label: 'Dépôt en lettres' },
  charges_lettres:            { formField: '', type: 'readonly', label: 'Charges en lettres' },
  date_fin_bail:              { formField: '', type: 'readonly', label: 'Date de fin calculée' },
  date_fin_location:          { formField: '', type: 'readonly', label: 'Date de fin calculée' },
  date_signature:             { formField: '', type: 'readonly', label: 'Date de signature' },
  bailleur_nom_prenom:        { formField: '', type: 'readonly', label: 'Nom du bailleur' },
  bailleur_denomination:      { formField: '', type: 'readonly', label: 'Dénomination du bailleur' },
  bailleur_adresse:           { formField: '', type: 'readonly', label: 'Adresse du bailleur' },
  bailleur_email:             { formField: '', type: 'readonly', label: 'Email du bailleur' },
  bailleur_telephone:         { formField: '', type: 'readonly', label: 'Téléphone du bailleur' },
  locataire_nom_prenom:       { formField: '', type: 'readonly', label: 'Nom du locataire' },
  locataire_email:            { formField: '', type: 'readonly', label: 'Email du locataire' },
  locataire_telephone:        { formField: '', type: 'readonly', label: 'Téléphone du locataire' },
  logement_adresse:           { formField: '', type: 'readonly', label: 'Adresse du bien' },
  logement_code_postal:       { formField: '', type: 'readonly', label: 'Code postal' },
  logement_ville:             { formField: '', type: 'readonly', label: 'Ville' },
  premiere_echeance_loyer:    { formField: '', type: 'readonly', label: 'Première échéance' },
  mention_engagement_max_chiffres: { formField: '', type: 'readonly', label: 'Engagement total' },
};

// ── Checkbox variable → toggle field mapping ────────────────────

const CHECKBOX_VAR_TO_TOGGLE: Record<string, { formField: string; isTrue: boolean; label: string; tooltip?: string }> = {
  coche_loyer_revise_oui:     { formField: 'loyerRevise', isTrue: true, label: 'Révision du loyer', tooltip: 'Indexation annuelle sur l\'IRL (art. 17-1, loi du 6/7/1989).' },
  coche_loyer_revise_non:     { formField: 'loyerRevise', isTrue: false, label: 'Pas de révision' },
  coche_decret_loyers_oui:    { formField: 'soumisDecretRelocation', isTrue: true, label: 'Encadrement des loyers', tooltip: 'Zone tendue : le loyer est plafonné par arrêté préfectoral.' },
  coche_decret_loyers_non:    { formField: 'soumisDecretRelocation', isTrue: false, label: 'Hors encadrement' },
  coche_loyer_ref_majore_oui: { formField: 'soumisLoyerReferenceMajore', isTrue: true, label: 'Loyer de référence majoré' },
  coche_loyer_ref_majore_non: { formField: 'soumisLoyerReferenceMajore', isTrue: false, label: 'Pas de majoré' },
  coche_mandataire_oui:       { formField: 'hasMandataire', isTrue: true, label: 'Mandataire', tooltip: 'Agent immobilier ou administrateur de biens agissant pour le compte du bailleur.' },
  coche_mandataire_non:       { formField: 'hasMandataire', isTrue: false, label: 'Pas de mandataire' },
  coche_societe_civile_oui:   { formField: 'isSocieteCivile', isTrue: true, label: 'Société civile familiale' },
  coche_societe_civile_non:   { formField: 'isSocieteCivile', isTrue: false, label: 'Non' },
  coche_paiement_terme_echu:  { formField: 'paymentInArrears', isTrue: true, label: 'Terme échu', tooltip: 'Paiement en fin de mois (terme échu) ou en début de mois (à échoir).' },
  coche_paiement_a_echoir:    { formField: 'paymentInArrears', isTrue: false, label: 'À échoir' },
  coche_usage_mixte:          { formField: 'usageMixte', isTrue: true, label: 'Usage mixte (habitation + professionnel)' },
  coche_usage_habitation:     { formField: 'usageMixte', isTrue: false, label: 'Usage habitation exclusif' },
};

// ── Pill/exclusive choice mappings ──────────────────────────────

const PILL_VAR_TO_FIELD: Record<string, { formField: string; value: string; label: string }> = {
  coche_habitat_collectif:  { formField: 'typeHabitat', value: 'collectif', label: 'Collectif' },
  coche_habitat_individuel: { formField: 'typeHabitat', value: 'individuel', label: 'Individuel' },
  coche_monopropriete:      { formField: 'regimeJuridique', value: 'monopropriete', label: 'Monopropriété' },
  coche_copropriete:        { formField: 'regimeJuridique', value: 'copropriete', label: 'Copropriété' },
};

// ── Public API ──────────────────────────────────────────────────

export function resolveFieldForVariable(varName: string): FieldMeta | null {
  // Direct match
  if (REGISTRY[varName]) return REGISTRY[varName];

  // Checkbox toggle
  if (CHECKBOX_VAR_TO_TOGGLE[varName]) {
    const t = CHECKBOX_VAR_TO_TOGGLE[varName];
    return { formField: t.formField, type: 'toggle', label: t.label, tooltip: t.tooltip };
  }

  // Pill/exclusive choice
  if (PILL_VAR_TO_FIELD[varName]) {
    const p = PILL_VAR_TO_FIELD[varName];
    return { formField: p.formField, type: 'pill', label: p.label };
  }

  // Equipment checkboxes (coche_balcon, coche_terrasse, etc.) — toggle
  if (varName.startsWith('coche_')) {
    const fieldName = varName.replace('coche_', '').replace(/_/g, '');
    return { formField: varName, type: 'toggle', label: varName.replace('coche_', '').replace(/_/g, ' ') };
  }

  return null;
}

export function getFieldTooltip(varName: string): string | null {
  const meta = resolveFieldForVariable(varName);
  return meta?.tooltip || null;
}

export function isReadonlyVariable(varName: string): boolean {
  const meta = resolveFieldForVariable(varName);
  return meta?.type === 'readonly';
}

export { REGISTRY, CHECKBOX_VAR_TO_TOGGLE, PILL_VAR_TO_FIELD };
