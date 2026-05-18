/**
 * PatrimoTrust — Composants UI partagés "Banque Privée"
 *
 * Source unique pour les primitives UI réutilisables.
 * Voir /opt/doc2loc/DESIGN_SYSTEM.md pour la doc complète.
 */

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

// Re-export du module premium existant (déjà solide)
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
