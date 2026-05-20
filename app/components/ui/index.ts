/**
 * PatrimoTrust — Composants UI partagés "Banque Privée"
 *
 * Source unique pour les primitives UI réutilisables.
 * Voir /opt/doc2loc/DESIGN_SYSTEM.md pour la doc complète.
 *
 * V4.1 (PR26) : promotion des composants locaux owner/ui.tsx + extraction
 * des badges/verdict dans un système centralisé.
 */

// ─── Primitives existantes ───────────────────────────────────────────────────
export { Button } from "./Button";
export type { ButtonProps } from "./Button";

export { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "./Card";
export type { CardProps } from "./Card";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { Modal } from "./Modal";
export type { ModalProps } from "./Modal";

export { Skeleton, SkeletonText, SkeletonCard, SkeletonRow } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { PageHeader, SectionHeader } from "./PageHeader";
export type { PageHeaderProps, SectionHeaderProps } from "./PageHeader";

// ─── Re-export du module premium (legacy "banque privée") ────────────────────
// Le StatusBadge premium ici est l'historique (tone-based) — utilisé par
// PassportStudio + PassportLandingClient. Nouveau code → DocumentStatusBadge.
export {
  ActionBar,
  cx,
  InfoRow,
  MetricTile,
  PremiumSurface,
  PremiumSectionHeader,
  SignalList,
  StatusBadge,
  TimelineBlock,
} from "./premium";

// ─── Nouveaux composants V4.1 ────────────────────────────────────────────────

export { Avatar } from "./Avatar";
export type { AvatarProps } from "./Avatar";

export { LoadingSpinner } from "./LoadingSpinner";
export type { LoadingSpinnerProps, SpinnerColor } from "./LoadingSpinner";

export { VerdictBadge } from "./VerdictBadge";
export type { VerdictBadgeProps } from "./VerdictBadge";

export { GuaranteeBadge } from "./GuaranteeBadge";
export type { GuaranteeBadgeProps } from "./GuaranteeBadge";

export { ScorePill } from "./ScorePill";
export type { ScorePillProps } from "./ScorePill";

export { GradeBadge } from "./GradeBadge";
export type { GradeBadgeProps } from "./GradeBadge";

export { Tag, TAG_CLS } from "./Tag";
export type { TagProps, TagType } from "./Tag";

export { DocumentStatusBadge } from "./StatusBadge";
export type { StatusBadgeProps, BadgeVariant } from "./StatusBadge";
