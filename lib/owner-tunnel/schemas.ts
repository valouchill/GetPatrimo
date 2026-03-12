/** Schémas tunnel propriétaire GetPatrimo - pipeline déterministe */
export type EtiquetteDPE = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export interface DPEResult {
  surface_habitable_m2: number | null;
  etiquette_energie: EtiquetteDPE;
  etiquette_ges: EtiquetteDPE;
  estimation_cout_annuel: number | null;
}

export interface VisionAtouts {
  parquet_massif: boolean;
  cuisine_equipee: boolean;
  luminosite: boolean;
  balcon: boolean;
}

export interface PricingInput {
  loyer_base_euros: number;
  atouts: VisionAtouts;
  code_postal?: string;
  surface_m2?: number;
}

export interface PricingResult {
  loyer_final_euros: number;
  justification_paragraphe: string;
}

export interface AnnoncePayload {
  surface_m2: number;
  etiquette_energie: EtiquetteDPE;
  etiquette_ges: EtiquetteDPE;
  atouts: VisionAtouts;
  loyer_final_euros: number;
  justification_prix: string;
  adresse?: string;
  nb_pieces?: number;
  type_bien?: string;
}
