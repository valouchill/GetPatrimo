import type { LeaseFormData } from "./types";

// ── Section keys ────────────────────────────────────────────────
export type SectionKey =
  | "locataire"
  | "bien"
  | "caracteristiques"
  | "equipements"
  | "financier"
  | "revision"
  | "duree"
  | "paiement"
  | "mobilite"
  | "garant"
  | "mandataire"
  | "clauses";

// ── Visibility rules ────────────────────────────────────────────

type Rule = (fd: LeaseFormData, hasGuarantor: boolean) => boolean;

const always: Rule = () => true;

export const SECTION_VISIBILITY: Record<SectionKey, Rule> = {
  locataire: always,
  bien: always,
  caracteristiques: (fd) => fd.leaseType !== "GARAGE_PARKING",
  equipements: (fd) => fd.leaseType !== "GARAGE_PARKING",
  financier: always,
  revision: (fd) => fd.leaseType !== "GARAGE_PARKING",
  duree: always,
  paiement: always,
  mobilite: (fd) => fd.leaseType === "MOBILITE",
  garant: (_fd, hasGuarantor) => hasGuarantor,
  mandataire: always,
  clauses: always,
};

export const FIELD_VISIBILITY: Record<string, Rule> = {
  // Deposit masqué en mobilité
  deposit: (fd) => fd.leaseType !== "MOBILITE",

  // IRL visible seulement si révision activée
  irlReference: (fd) => fd.loyerRevise === true,
  irlReferenceDate: (fd) => fd.loyerRevise === true,
  irlQuarterReference: (fd) => fd.loyerRevise === true,

  // Encadrement des loyers
  loyerReference: (fd) => fd.soumisDecretRelocation === true,
  loyerReferenceMajore: (fd) => fd.soumisDecretRelocation === true,
  complementLoyer: (fd) => fd.soumisLoyerReferenceMajore === true,

  // Mandataire champs
  mandataireNomPrenom: (fd) => fd.hasMandataire === true,
  mandataireDenomination: (fd) => fd.hasMandataire === true,
  mandataireAdresse: (fd) => fd.hasMandataire === true,
  mandataireActivite: (fd) => fd.hasMandataire === true,
  mandataireCartePro: (fd) => fd.hasMandataire === true,
  isSocieteCivile: (fd) => fd.hasMandataire === true,

  // Numéros conditionnels (visible quand le parent est coché)
  caveNumero: (fd) => Boolean(fd.caveNumero) || fd.caveNumero === "",
  garageNumero: (fd) => Boolean(fd.garageNumero) || fd.garageNumero === "",
  parkingNumber: (fd) => Boolean(fd.parkingNumber) || fd.parkingNumber === "",

  // Mobilité
  mobilityReason: (fd) => fd.leaseType === "MOBILITE",

  // Garant
  guarantorOverrides: (_fd, hasGuarantor) => hasGuarantor,
};

// ── Duration constraints per lease type ─────────────────────────

export function getDurationConstraints(leaseType: string) {
  switch (leaseType) {
    case "MOBILITE":
      return { min: 1, max: 10, defaultValue: 10, hint: "1 à 10 mois (bail mobilité)" };
    case "VIDE":
    case "NUE":
      return { min: 1, max: 120, defaultValue: 36, hint: "36 mois minimum recommandé (bail nu)" };
    case "MEUBLEE":
    case "MEUBLE":
      return { min: 1, max: 120, defaultValue: 12, hint: "12 mois minimum recommandé (bail meublé)" };
    case "GARAGE_PARKING":
      return { min: 1, max: 120, defaultValue: 12, hint: "Durée libre" };
    default:
      return { min: 1, max: 120, defaultValue: 12, hint: "" };
  }
}

// ── Deposit constraints per lease type ──────────────────────────

export function getDepositConstraints(leaseType: string, rentHC: number) {
  switch (leaseType) {
    case "MOBILITE":
      return { max: 0, hint: "Pas de dépôt pour un bail mobilité" };
    case "VIDE":
    case "NUE":
      return { max: rentHC, hint: `Maximum 1 mois de loyer (${rentHC} €)` };
    case "MEUBLEE":
    case "MEUBLE":
      return { max: 2 * rentHC, hint: `Maximum 2 mois de loyer (${2 * rentHC} €)` };
    default:
      return { max: Infinity, hint: "" };
  }
}

// ── Notice period per lease type (informational) ────────────────

export function getNoticePeriod(leaseType: string) {
  switch (leaseType) {
    case "MOBILITE":
      return { tenant: "1 mois", owner: "Pas de préavis (fin au terme)" };
    case "VIDE":
    case "NUE":
      return { tenant: "3 mois (1 mois en zone tendue)", owner: "6 mois avant échéance" };
    case "MEUBLEE":
    case "MEUBLE":
      return { tenant: "1 mois", owner: "3 mois avant échéance" };
    default:
      return { tenant: "Variable", owner: "Variable" };
  }
}
