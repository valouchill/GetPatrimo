"use client";

import * as React from "react";

import { Overlay } from "./Overlay";

/**
 * Modal — wrapper rétrocompatible au-dessus de <Overlay variant="dialog">.
 *
 * L'API publique (`ModalProps`) est inchangée : les consommateurs existants ne
 * bougent pas, mais gagnent automatiquement le scroll interne, la safe-area, le
 * z-index unifié et le bouton fermer ≥ 44px fournis par <Overlay>.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  ariaLabel?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  ariaLabel,
}: ModalProps) {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      variant="dialog"
      size={size}
      title={title}
      description={description}
      footer={
        footer ? (
          <div className="flex items-center justify-end gap-2">{footer}</div>
        ) : undefined
      }
      closeOnBackdrop={closeOnBackdrop}
      ariaLabel={ariaLabel}
    >
      {children}
    </Overlay>
  );
}
