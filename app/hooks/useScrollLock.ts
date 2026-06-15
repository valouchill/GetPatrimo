'use client';

import * as React from 'react';

/**
 * Verrou de scroll du <body> **compté** (reference-counted).
 *
 * Plusieurs overlays peuvent être ouverts en même temps (ex. la visionneuse de
 * documents ouverte PAR-DESSUS la modale dossier). Un verrou naïf qui remet
 * `overflow` à sa valeur initiale dès la fermeture du premier overlay
 * déverrouillerait le body alors qu'un autre est encore ouvert. Le compteur
 * partagé garantit que `overflow` n'est restauré qu'à la fermeture du DERNIER.
 */
let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

export function useScrollLock(active: boolean): void {
  React.useEffect(() => {
    if (!active) return;
    if (typeof document === 'undefined') return;

    if (lockCount === 0) {
      const body = document.body;
      previousOverflow = body.style.overflow;
      previousPaddingRight = body.style.paddingRight;
      // Compense la disparition de la scrollbar (desktop) pour éviter le saut.
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
      body.style.overflow = 'hidden';
    }
    lockCount += 1;

    return () => {
      lockCount -= 1;
      if (lockCount <= 0) {
        lockCount = 0;
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPaddingRight;
      }
    };
  }, [active]);
}
