import type { Config } from "tailwindcss";
 
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0F172A",
        // Note: On garde les palettes Tailwind natives pour slate/emerald
        // et on ajoute juste les alias pour les couleurs principales
        cobalt: "#3B82F6",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
