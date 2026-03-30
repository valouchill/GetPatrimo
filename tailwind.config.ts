import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0F172A",
        cobalt: "#3B82F6",
        primary: "#F97316",
        "primary-hover": "#EA580C",
        secondary: "#1E293B",
        accent: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        surface: "#F8FAFC",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "'DM Serif Display'", "serif"],
        sans: ["var(--font-inter)", "'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
