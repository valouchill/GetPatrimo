/**
 * Service de révision IRL (Indice de Référence des Loyers)
 * Publié trimestriellement par l'INSEE.
 * Table de référence mise à jour : T1 2023 → T4 2025.
 */

// IRL values: key = "YYYY-QN" (e.g. "2025-Q4")
const IRL_TABLE: Record<string, number> = {
  // 2023
  '2023-Q1': 138.61,
  '2023-Q2': 140.59,
  '2023-Q3': 141.03,
  '2023-Q4': 142.06,
  // 2024
  '2024-Q1': 143.46,
  '2024-Q2': 144.44,
  '2024-Q3': 144.51,
  '2024-Q4': 145.17,
  // 2025
  '2025-Q1': 145.68,
  '2025-Q2': 146.22,
  '2025-Q3': 146.80,
  '2025-Q4': 147.10,
  // 2026 (projected)
  '2026-Q1': 147.50,
};

/**
 * Get the IRL index for a given quarter.
 * @param year - Year
 * @param quarter - Quarter (1-4)
 */
export function getIRLIndex(year: number, quarter: number): number | null {
  const key = `${year}-Q${quarter}`;
  return IRL_TABLE[key] ?? null;
}

/**
 * Get the most recent available IRL index.
 */
export function getLatestIRL(): { year: number; quarter: number; index: number } {
  const keys = Object.keys(IRL_TABLE).sort().reverse();
  const latest = keys[0];
  const [y, q] = latest.split('-Q');
  return { year: Number(y), quarter: Number(q), index: IRL_TABLE[latest] };
}

/**
 * Calculate the revised rent using IRL formula.
 * Formula: new_rent = old_rent × (new_index / old_index)
 *
 * @param previousRent - Current rent amount
 * @param previousIndex - IRL index at last revision
 * @param newIndex - Current IRL index
 * @returns New rent rounded to 2 decimal places
 */
export function calculateIRLRevision(
  previousRent: number,
  previousIndex: number,
  newIndex: number
): { newRent: number; increasePercent: number; increaseAmount: number } {
  const newRent = Math.round((previousRent * (newIndex / previousIndex)) * 100) / 100;
  const increaseAmount = Math.round((newRent - previousRent) * 100) / 100;
  const increasePercent = Math.round(((newRent - previousRent) / previousRent) * 1000) / 10;

  return { newRent, increasePercent, increaseAmount };
}

/**
 * Determine the reference quarter for a given anniversary date.
 * By convention, the reference IRL is from the quarter published
 * at the time of the anniversary.
 */
export function getReferenceQuarter(date: Date): { year: number; quarter: number } {
  const month = date.getMonth() + 1;
  // Published with ~1 quarter delay, so use previous quarter
  let quarter = Math.ceil(month / 3) - 1;
  let year = date.getFullYear();
  if (quarter <= 0) { quarter = 4; year -= 1; }
  return { year, quarter };
}
