/** Schéma PropertyData pour l'Agent conversationnel PatrimoTrust */
export type EtiquetteDPE = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface PropertyData {
  address: string | null;
  surface_m2: number | null;
  rooms: number | null;
  furnished: "vide" | "meuble" | null;
  etiquette_dpe: EtiquetteDPE | null;
  has_dpe_document: boolean;
  photos_count: number;
}

export const INITIAL_PROPERTY_DATA: PropertyData = {
  address: null,
  surface_m2: null,
  rooms: null,
  furnished: null,
  etiquette_dpe: null,
  has_dpe_document: false,
  photos_count: 0,
};

const REQUIRED_FIELDS: (keyof PropertyData)[] = [
  "address",
  "surface_m2",
  "furnished",
  "etiquette_dpe",
];

export function isPropertyDataComplete(data: PropertyData): boolean {
  if (!data.address?.trim()) return false;
  if (data.surface_m2 == null || data.surface_m2 <= 0) return false;
  if (!data.furnished) return false;
  if (!data.etiquette_dpe) return false;
  return true;
}
