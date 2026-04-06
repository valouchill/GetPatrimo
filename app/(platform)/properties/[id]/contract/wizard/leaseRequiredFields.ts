import type { SectionKey } from "./leaseFieldRules";

// ── Required field definitions per section ──────────────────────

export type RequiredField = {
  key: string;
  label: string;
  section: SectionKey;
};

// Champs bloquants — sans eux, impossible de générer un bail valide
const CORE_FIELDS: RequiredField[] = [
  { key: "leaseType", label: "Type de bail", section: "financier" },
  { key: "startDate", label: "Date de d\u00e9but", section: "duree" },
  { key: "durationMonths", label: "Dur\u00e9e du bail", section: "duree" },
  { key: "rentHC", label: "Loyer HC", section: "financier" },
];

const DEPOSIT_FIELD: RequiredField = {
  key: "deposit", label: "D\u00e9p\u00f4t de garantie", section: "financier",
};

const MOBILITY_FIELD: RequiredField = {
  key: "mobilityReason", label: "Motif du bail mobilit\u00e9", section: "mobilite",
};

// ── Required fields by lease type ───────────────────────────────

export function getRequiredFields(leaseType: string): RequiredField[] {
  const normalizedType = leaseType?.toUpperCase?.() || "VIDE";

  switch (normalizedType) {
    case "MOBILITE":
      return [...CORE_FIELDS, MOBILITY_FIELD];
    case "GARAGE_PARKING":
      return [...CORE_FIELDS, DEPOSIT_FIELD];
    default:
      return [...CORE_FIELDS, DEPOSIT_FIELD];
  }
}

// ── Recommended fields — affiches en warning, ne bloquent pas ───

export type RecommendedField = RequiredField;

const PROPERTY_RECOMMENDED: RecommendedField[] = [
  { key: "surfaceHabitable", label: "Surface habitable", section: "caracteristiques" },
  { key: "rooms", label: "Nombre de pi\u00e8ces", section: "caracteristiques" },
  { key: "typeHabitat", label: "Type d\u2019habitat", section: "caracteristiques" },
  { key: "constructionYear", label: "Ann\u00e9e de construction", section: "caracteristiques" },
  { key: "dpeClass", label: "Classe DPE", section: "caracteristiques" },
  { key: "dpeDate", label: "Date du DPE", section: "caracteristiques" },
  { key: "modeChauffage", label: "Mode de chauffage", section: "caracteristiques" },
  { key: "modeEauChaude", label: "Mode eau chaude", section: "caracteristiques" },
];

const PAYMENT_RECOMMENDED: RecommendedField[] = [
  { key: "paymentDay", label: "Jour de paiement", section: "paiement" },
  { key: "paymentMode", label: "Mode de paiement", section: "paiement" },
];

export function getRecommendedFields(leaseType: string): RecommendedField[] {
  const normalizedType = leaseType?.toUpperCase?.() || "VIDE";
  if (normalizedType === "GARAGE_PARKING") return [...PAYMENT_RECOMMENDED];
  return [...PROPERTY_RECOMMENDED, ...PAYMENT_RECOMMENDED];
}

// ── Helper to check if a value is "filled" ──────────────────────

export function isFieldFilled(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return true;
  return Boolean(value);
}
