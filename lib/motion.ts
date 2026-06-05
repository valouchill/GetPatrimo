/**
 * getpatrimo — Motion utilities (framer-motion + a11y)
 *
 * Centralise :
 *  - Hook `useReducedMotion()` (wrap natif framer-motion pour usage cohérent)
 *  - Variants partagés (fadeIn, slideUp, modal, scaleIn)
 *  - Helper `getMotion(variants, reduced)` qui retourne des variants vides
 *    si `prefers-reduced-motion: reduce`.
 *
 * Pattern d'usage :
 *   const reduced = useReducedMotion();
 *   <motion.div {...getMotion(motionVariants.fadeIn, reduced)}>
 *
 * Garantit WCAG 2.1 — toutes les animations décoratives respectent
 * `prefers-reduced-motion: reduce` automatiquement.
 */

import { useReducedMotion as useReducedMotionFramer } from 'framer-motion';
import type { Variants, Transition } from 'framer-motion';

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Wrapper du hook framer-motion natif pour usage uniforme dans l'app.
 * Retourne `true` si l'utilisateur préfère réduire les animations.
 */
export function useReducedMotion(): boolean {
  return useReducedMotionFramer() ?? false;
}

// ─── Variants partagés ───────────────────────────────────────────────────────

/**
 * Easing "premium" : courbe douce, sortie rapide.
 * Référence : Apple Design Awards 2024.
 */
const EASE_PREMIUM: Transition['ease'] = [0.16, 1, 0.3, 1];

export const motionVariants = {
  /** Fade-in simple (cards, sections) */
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.3, ease: EASE_PREMIUM },
  },

  /** Slide-up depuis 12px (cards d'entrée stagger) */
  slideUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 6 },
    transition: { duration: 0.4, ease: EASE_PREMIUM },
  },

  /** Modal centrée (zoom léger + fade) */
  modal: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
    transition: { duration: 0.25, ease: EASE_PREMIUM },
  },

  /** Bottom-sheet mobile (slide depuis le bas) */
  bottomSheet: {
    initial: { y: '100%' },
    animate: { y: 0 },
    exit: { y: '100%' },
    transition: { duration: 0.3, ease: EASE_PREMIUM },
  },

  /** Backdrop modal (fade léger) */
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },

  /** Scale-in subtil (badges, sceaux) */
  scaleIn: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.25, ease: EASE_PREMIUM },
  },
} as const;

// ─── Helper getMotion ────────────────────────────────────────────────────────

interface MotionConfig {
  initial?: Record<string, unknown>;
  animate?: Record<string, unknown>;
  exit?: Record<string, unknown>;
  transition?: Transition;
}

/**
 * Renvoie une config motion qui respecte `prefers-reduced-motion`.
 * Si `reduced=true`, retourne une config vide (pas d'animation).
 *
 * Usage :
 *   const reduced = useReducedMotion();
 *   <motion.div {...getMotion(motionVariants.fadeIn, reduced)}>
 */
export function getMotion(
  config: MotionConfig,
  reduced: boolean,
): MotionConfig {
  if (reduced) {
    return {
      initial: false as unknown as Record<string, unknown>,
      animate: { opacity: 1 },
      transition: { duration: 0 },
    };
  }
  return config;
}

// ─── Variants staggered (containers avec enfants) ────────────────────────────

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE_PREMIUM },
  },
};
