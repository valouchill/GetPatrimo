'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { cx } from './premium';
import { useScrollLock } from '@/app/hooks/useScrollLock';

/**
 * Overlay — primitive d'overlay mobile-first (UNE source de vérité).
 *
 * Portail vers <body>, backdrop + panneau animés (framer-motion), verrou de
 * scroll compté, ESC, safe-area, cibles tactiles ≥ 44px. Le positionnement est
 * géré par un WRAPPER flex (pas de `translate` Tailwind) pour ne pas entrer en
 * conflit avec les transforms d'animation de framer-motion.
 *
 * Variantes responsives :
 *   - `dialog`     : centré mobile + desktop (drop-in de l'ancien <Modal>).
 *   - `sheet`      : bottom-sheet mobile / centré desktop. (défaut)
 *   - `fullscreen` : plein écran mobile / cadré centré desktop.
 *   - `drawer`     : bottom-sheet mobile / tiroir droit desktop.
 *
 * Deux modes de contenu :
 *   - Chrome : `title`/`description`/`footer` → header sticky + corps scrollable
 *     + footer sticky (safe-area) gérés par l'Overlay.
 *   - Raw    : aucun de ces props → `children` rendus directement dans le
 *     panneau (le consommateur gère son propre header/scroll/footer).
 */

export type OverlayVariant = 'dialog' | 'sheet' | 'fullscreen' | 'drawer';
export type OverlaySize = 'sm' | 'md' | 'lg' | 'xl' | '3xl' | '5xl' | '7xl';
export type OverlayZToken = 'modal' | 'drawer' | 'docViewer';

export interface OverlayProps {
  open: boolean;
  onClose: () => void;
  variant?: OverlayVariant;
  size?: OverlaySize;
  zToken?: OverlayZToken;
  /** Header personnalisé (sticky). Le consommateur inclut son propre bouton fermer. */
  header?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Footer sticky (safe-area bottom auto). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  /** Poignée mobile (par défaut : true pour sheet/drawer). */
  showHandle?: boolean;
  /** Glisser-pour-fermer (mobile, sheet/drawer). Désactivé par défaut (peut
   *  entrer en conflit avec le scroll interne — à activer après test). */
  swipeToDismiss?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  /** Classe additionnelle sur le panneau. */
  panelClassName?: string;
  /** Classe additionnelle sur le corps scrollable (mode chrome uniquement). */
  bodyClassName?: string;
}

/** Échelle z-index unifiée (valeurs explicites = sûres en Tailwind v4). */
const Z: Record<OverlayZToken, { backdrop: string; panel: string }> = {
  modal: { backdrop: 'z-[100]', panel: 'z-[110]' },
  drawer: { backdrop: 'z-[100]', panel: 'z-[120]' },
  docViewer: { backdrop: 'z-[200]', panel: 'z-[210]' },
};

const SIZE: Record<OverlaySize, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-4xl',
  '3xl': 'md:max-w-3xl',
  '5xl': 'md:max-w-5xl',
  '7xl': 'md:max-w-7xl',
};

const VARIANT: Record<OverlayVariant, { wrapper: string; panel: string }> = {
  dialog: {
    wrapper: 'items-center justify-center p-4',
    panel: 'w-full max-h-[90dvh] rounded-modal md:w-[calc(100vw-2rem)]',
  },
  sheet: {
    wrapper: 'items-end justify-center md:items-center md:p-4',
    panel:
      'w-full max-h-[92dvh] rounded-t-modal md:w-[calc(100vw-2rem)] md:max-h-[90dvh] md:rounded-modal',
  },
  fullscreen: {
    wrapper: 'items-stretch justify-center md:items-center md:p-6',
    panel:
      'w-full h-full max-h-none rounded-none md:h-auto md:w-[calc(100vw-2rem)] md:max-h-[92dvh] md:rounded-modal',
  },
  drawer: {
    wrapper: 'items-end justify-center md:items-stretch md:justify-end',
    panel:
      'w-full max-h-[92dvh] rounded-t-modal md:h-full md:max-h-none md:w-auto md:rounded-l-3xl md:rounded-t-none',
  },
};

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

function getMotion(variant: OverlayVariant, isDesktop: boolean) {
  const spring = { type: 'spring' as const, damping: 30, stiffness: 300 };
  const slide = { type: 'tween' as const, ease: [0.16, 1, 0.3, 1] as const, duration: 0.34 };
  if (variant === 'drawer') {
    return isDesktop
      ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' }, transition: slide }
      : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: slide };
  }
  if (!isDesktop && variant === 'sheet') {
    return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: slide };
  }
  if (!isDesktop && variant === 'fullscreen') {
    return { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 18 }, transition: slide };
  }
  return {
    initial: { opacity: 0, scale: 0.97, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.97, y: 8 },
    transition: spring,
  };
}

export function Overlay({
  open,
  onClose,
  variant = 'sheet',
  size = 'lg',
  zToken = 'modal',
  header,
  title,
  description,
  footer,
  children,
  closeOnBackdrop = true,
  showHandle,
  swipeToDismiss = false,
  ariaLabel,
  ariaLabelledBy,
  panelClassName,
  bodyClassName,
}: OverlayProps) {
  const isDesktop = useIsDesktop();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  useScrollLock(open);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!mounted) return null;

  const z = Z[zToken];
  const v = VARIANT[variant];
  const hasChrome = Boolean(title || header || footer);
  const handle =
    (showHandle ?? (variant === 'sheet' || variant === 'drawer')) && !isDesktop;
  const canSwipe = swipeToDismiss && !isDesktop && (variant === 'sheet' || variant === 'drawer');
  const m = getMotion(variant, isDesktop);

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={cx('fixed inset-0 bg-slate-950/55 backdrop-blur-sm', z.backdrop)}
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
          <div className={cx('fixed inset-0 flex pointer-events-none', z.panel, v.wrapper)}>
            <motion.div
              ref={panelRef}
              key="overlay-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : ariaLabelledBy}
              aria-label={!title && !ariaLabelledBy ? ariaLabel : undefined}
              tabIndex={-1}
              initial={m.initial}
              animate={m.animate}
              exit={m.exit}
              transition={m.transition}
              drag={canSwipe ? 'y' : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              dragSnapToOrigin
              onDragEnd={(_e, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) onClose();
              }}
              className={cx(
                'pointer-events-auto flex flex-col overflow-hidden bg-white shadow-premium outline-none',
                v.panel,
                SIZE[size],
                panelClassName,
              )}
            >
              {handle && (
                <div className="flex shrink-0 justify-center bg-white pt-2.5 pb-1">
                  <div className="h-1 w-10 rounded-full bg-slate-300" aria-hidden="true" />
                </div>
              )}

              {hasChrome ? (
                <>
                  {header ?? (
                    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 pt-4 pb-4 md:px-6">
                      <div className="min-w-0 flex-1">
                        {title && (
                          <h2 id={titleId} className="font-serif text-xl font-bold tracking-tight text-slate-900">
                            {title}
                          </h2>
                        )}
                        {description && (
                          <p id={descId} className="mt-1 text-sm text-slate-500">
                            {description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer"
                        className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 md:h-9 md:w-9"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                  <div
                    className={cx(
                      'flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] md:px-6',
                      bodyClassName,
                    )}
                  >
                    {children}
                  </div>
                  {footer && (
                    <div className="shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-6">
                      {footer}
                    </div>
                  )}
                </>
              ) : (
                children
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(node, document.body);
}
