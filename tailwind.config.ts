import type { Config } from "tailwindcss";

/**
 * getpatrimo — Design Tokens "Banque Privée de l'Immobilier"
 *
 * Palette officielle (manifeste produit) :
 *   - Or Brossé (amber-500)        → CTA majeurs, accents premium
 *   - Émeraude Profond (emerald-900) → Surfaces premium, validation, succès
 *   - Gris Perle (slate-50/100)     → Fonds de page, surfaces neutres
 *
 * Typographie :
 *   - Playfair Display (serif)      → Titres, hero, autorité
 *   - Inter (sans-serif)            → Corps, UI, clarté
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // — Brand —
        primary: "#F59E0B",          // amber-500 — Or Brossé : CTA, boutons primaires
        "primary-hover": "#D97706",  // amber-600
        "primary-soft": "#FEF3C7",   // amber-100 — backgrounds CTA légers
        secondary: "#064E3B",        // emerald-900 — Émeraude Profond : surfaces premium
        "secondary-hover": "#065F46", // emerald-800
        "secondary-soft": "#D1FAE5", // emerald-100

        // — Functional —
        accent: "#10B981",           // emerald-500 — Succès, scores positifs
        warning: "#F59E0B",          // amber-500
        danger: "#DC2626",           // red-600 — Erreurs (plus sombre que red-500)
        info: "#0EA5E9",             // sky-500

        // — Surfaces —
        surface: "#F8FAFC",          // slate-50 — Fond de page
        "surface-elevated": "#FFFFFF",
        "surface-premium": "#0F1F1A", // emerald-950 mix — fonds premium dark

        // — Legacy (à retirer progressivement) —
        navy: "#0F172A",
        cobalt: "#3B82F6",
      },
      fontFamily: {
        serif: ["'Playfair Display'", "Merriweather", "Georgia", "serif"],
        sans: ["'Inter'", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        button: "0.75rem",     // 12px — boutons standards
        card: "1rem",          // 16px — cards
        modal: "1.25rem",      // 20px — modals/sheets
        pill: "9999px",        // pills/badges
      },
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)",
        elevated: "0 4px 12px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)",
        premium: "0 12px 32px rgba(6, 78, 59, 0.12), 0 4px 8px rgba(245, 158, 11, 0.08)",
        amber: "0 8px 20px rgba(245, 158, 11, 0.18)",
        emerald: "0 8px 20px rgba(6, 78, 59, 0.18)",
      },
      backgroundImage: {
        "gradient-premium": "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
        "gradient-emerald": "linear-gradient(135deg, #064E3B 0%, #065F46 100%)",
        "gradient-surface": "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "slide-up": "slideUp 240ms cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
