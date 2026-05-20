/**
 * PatrimoTrust — Design Tokens (TypeScript)
 *
 * Source unique de vérité pour les composants TypeScript qui ont besoin
 * d'accéder aux tokens (animations, calculs, génération SVG, etc.).
 * Synchronisé avec tailwind.config.ts.
 */

export const colors = {
  // Brand
  primary: "#F59E0B",          // amber-500 — Or Brossé
  primaryHover: "#D97706",     // amber-600
  primarySoft: "#FEF3C7",      // amber-100
  secondary: "#064E3B",        // emerald-900 — Émeraude Profond
  secondaryHover: "#065F46",   // emerald-800
  secondarySoft: "#D1FAE5",    // emerald-100

  // Functional
  accent: "#10B981",           // emerald-500
  warning: "#F59E0B",
  danger: "#DC2626",           // red-600
  info: "#0EA5E9",             // sky-500

  // Surfaces
  surface: "#F8FAFC",          // slate-50
  surfaceElevated: "#FFFFFF",
  surfacePremium: "#0F1F1A",

  // Text
  textPrimary: "#0F172A",      // slate-900
  textSecondary: "#475569",    // slate-600
  textMuted: "#64748B",        // slate-500
  textOnPremium: "#F8FAFC",    // slate-50 sur fond dark

  // Borders
  border: "#E2E8F0",           // slate-200
  borderMuted: "#F1F5F9",      // slate-100
} as const;

/**
 * Tokens "verdict" — couleurs sémantiques par état du verdict propriétaire.
 * Voir lib/verdict-system.ts pour VERDICT_STYLES (classes Tailwind).
 * Ces hex sont utiles côté serveur (PDF, mails, SVG génériques).
 */
export const verdictColors = {
  recommended: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", dot: "#10B981" },
  review:      { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A", dot: "#F59E0B" },
  risky:       { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", dot: "#DC2626" },
  neutral:     { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0", dot: "#94A3B8" },
  premium:     { bg: "#0F1F1A", text: "#F8FAFC", border: "#F59E0B", dot: "#FCD34D" },
} as const;

/**
 * Tokens "uploadState" — couleurs sémantiques par état d'un document
 * dans le tunnel de dépôt /apply/[id].
 */
export const uploadStateColors = {
  empty:      { bg: "#F8FAFC", text: "#64748B", border: "#E2E8F0" },
  drag:       { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
  analyzing:  { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  certified:  { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  review:     { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  rejected:   { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA" },
} as const;

export const typography = {
  fontFamilySerif: "'Playfair Display', Merriweather, Georgia, serif",
  fontFamilySans: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

export const radius = {
  button: "0.75rem",     // 12px
  card: "1rem",          // 16px
  modal: "1.25rem",      // 20px
  pill: "9999px",
  input: "0.625rem",     // 10px
} as const;

export const shadows = {
  card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
  elevated: "0 4px 12px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)",
  premium: "0 12px 32px rgba(6, 78, 59, 0.12), 0 4px 8px rgba(245, 158, 11, 0.08)",
  amber: "0 8px 20px rgba(245, 158, 11, 0.18)",
  emerald: "0 8px 20px rgba(6, 78, 59, 0.18)",
} as const;

export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 30,
  header: 40,
  dropdown: 50,
  overlay: 100,
  modal: 200,
  drawer: 200,
  toast: 300,
} as const;
