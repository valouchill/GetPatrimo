/**
 * Composants d'analyse candidat — Wow factor "Banque Privée"
 *
 * Utilisation :
 *   import { DecisionVerdict, ResilienceGauge, ForensicAuditCard, ... } from '@/app/components/audit';
 */

export { DecisionVerdict, verdictFromScore } from "./DecisionVerdict";
export type { DecisionVerdictProps } from "./DecisionVerdict";

export { ResilienceGauge } from "./ResilienceGauge";
export type { ResilienceGaugeProps } from "./ResilienceGauge";

export { ForensicAuditCard } from "./ForensicAuditCard";
export type { ForensicAuditCardProps, ForensicCheck } from "./ForensicAuditCard";

export { AIReasoningCard } from "./AIReasoningCard";
export type { AIReasoningCardProps } from "./AIReasoningCard";

export { PillarsRadar } from "./PillarsRadar";
export type { PillarsRadarProps, PillarAxis } from "./PillarsRadar";

export { RemainingIncomeChart } from "./RemainingIncomeChart";
export type { RemainingIncomeChartProps } from "./RemainingIncomeChart";

export { CandidateBenchmark } from "./CandidateBenchmark";
export type { CandidateBenchmarkProps } from "./CandidateBenchmark";

export { AuditTimeline } from "./AuditTimeline";
export type { AuditTimelineProps, AuditStep } from "./AuditTimeline";

export { SealCertificate } from "./SealCertificate";
export type { SealCertificateProps } from "./SealCertificate";

export { CertificationBadge, CertificationRow } from "./CertificationBadge";
export type { CertificationBadgeProps } from "./CertificationBadge";

export { CriteriaGrid, deriveCriteriaFromDossier } from "./CriteriaGrid";
export type { CriteriaGridProps, Criterion } from "./CriteriaGrid";

export { PayslipsBreakdown } from "./PayslipsBreakdown";
export type { PayslipsBreakdownProps, PayslipBreakdownItem } from "./PayslipsBreakdown";
