export const colors = {
  primary: '#F97316',       // orange-500 — CTA, boutons primaires, liens actifs
  primaryHover: '#EA580C',  // orange-600 — Hover sur CTA
  secondary: '#1E293B',     // slate-800 — Titres, textes importants, header
  accent: '#10B981',        // emerald-500 — Succès, scores positifs, validations
  warning: '#F59E0B',       // amber-500 — En cours, attente
  danger: '#EF4444',        // red-500 — Erreurs, impayés, alertes
  surface: '#F8FAFC',       // slate-50 — Fond de page
  card: '#FFFFFF',          // Fond des cartes
  textPrimary: '#1E293B',   // slate-800 — Texte principal
  textSecondary: '#64748B', // slate-500 — Texte secondaire
  border: '#E2E8F0',        // slate-200 — Bordures, séparateurs
} as const;

export const typography = {
  fontFamily: "'Inter', sans-serif",
  fontFamilySerif: "'DM Serif Display', serif",
} as const;

export const radius = {
  button: '8px',
  card: '12px',
  modal: '16px',
  input: '8px',
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.05)',
  md: '0 4px 6px rgba(0,0,0,0.07)',
  lg: '0 10px 15px rgba(0,0,0,0.1)',
} as const;
