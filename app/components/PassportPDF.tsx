'use client';

import React from 'react';
import path from 'path';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
  Svg,
  Circle,
  Path as SvgPath,
  G,
  Font,
} from '@react-pdf/renderer';
import { MARKETING } from '@/lib/passport-marketing-copy';

// ============================================================================
// FONT REGISTRATION (with safe fallback to Times-Roman built-in)
// ============================================================================
// On charge Playfair Display (variable font, wght axis) pour les titres serif.
// Le corps reste sur Helvetica (built-in @react-pdf/renderer) — pas besoin de
// charger une seconde font, ce qui garde le PDF léger.
try {
  Font.register({
    family: 'Playfair',
    fonts: [
      { src: path.join(process.cwd(), 'public/fonts/PlayfairDisplay.ttf'), fontWeight: 'normal' },
      { src: path.join(process.cwd(), 'public/fonts/PlayfairDisplay.ttf'), fontWeight: 'bold' },
    ],
  });
} catch (err) {
  // eslint-disable-next-line no-console
  console.warn('[PassportPDF] Playfair font not loaded, falling back to Times-Roman built-in', err);
}

// ============================================================================
// TYPES
// ============================================================================
export interface PassportViewModel {
  state: 'draft' | 'review' | 'ready' | 'sealed';
  stateLabel: string;
  stateMeta: {
    watermark: string;
  };
  shareEnabled: boolean;
  shareUrl: string | null;
  previewUrl: string | null;
  verificationUrl: string | null;
  score: number;
  grade: string;
  summary: string;
  readinessReasons: string[];
  warnings: string[];
  nextAction: string | null;
  hero: {
    name: string;
    fullName: string;
    profession: string;
    region: string;
    propertyName: string;
    gradeLabel: string;
    badge: string;
    candidateStatus: string | null;
    identityVerified: boolean;
  };
  solvency: {
    monthlyIncome: number;
    exactMonthlyIncome: number;
    monthlyIncomeLabel: string | null;
    exactMonthlyIncomeLabel: string | null;
    rentAmount: number;
    rentAmountLabel: string | null;
    effortRate: number | null;
    effortRateLabel: string | null;
    certifiedIncome: boolean;
  };
  guarantee: {
    mode: 'NONE' | 'VISALE' | 'PHYSICAL';
    label: string;
    score: number;
    status: string;
    summary: string;
    shareBadge: string;
    requirement: string;
    satisfied: boolean;
    guarantors: Array<{
      slot: 1 | 2;
      profile: string;
      score: number;
      status: string;
      certificationMethod: string | null;
      label: string;
    }>;
  };
  pillars: Array<{
    id: string;
    label: string;
    score: number;
    max: number;
    verified: boolean;
    status: string;
    summary: string;
    certifiedCount: number;
    reviewCount: number;
    rejectedCount: number;
  }>;
  documentCoverage: {
    counts: {
      totalDocuments: number;
      tenantDocuments: number;
      certifiedDocuments: number;
      reviewDocuments: number;
      rejectedDocuments: number;
      viewCount: number;
      shareCount: number;
    };
    blocks: Array<{
      id: string;
      label: string;
      status: string;
      certifiedCount: number;
      reviewCount: number;
      rejectedCount: number;
      totalCount: number;
      latestDocumentAt: string | null;
    }>;
  };
  auditTimeline: Array<{
    id: string;
    title: string;
    status: string;
    time: string | null;
    description: string;
  }>;
  metrics: {
    viewCount: number;
    shareCount: number;
    passportId: string;
    generatedAt: string | null;
    validUntil: string | null;
    certificationDate: string | null;
  };
  marketing?: {
    ownerSignupUrl: string | null;
    verifyUrl: string | null;
    requestAuditUrl: string | null;
    homepageUrl: string | null;
    candidateFirstName: string | null;
    propertyName: string | null;
  };
}

// ============================================================================
// COLORS — Banque privée + accents or brossé
// ============================================================================
const colors = {
  // Neutrals
  ink: '#0F172A',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate: '#475569',
  line: '#CBD5E1',
  soft: '#F8FAFC',
  white: '#FFFFFF',

  // Banque privée — émeraude
  emerald: '#0F766E',
  emerald600: '#059669',
  emeraldSoft: '#CCFBF1',
  emeraldVeryLight: '#ECFDF5',

  // Or brossé — l'accent marketing dominant
  gold: '#F59E0B', // amber-500 — accent principal
  goldSoft: '#FCD34D', // amber-300 — clair
  goldDeep: '#B45309', // amber-700 — profond
  goldFaint: '#FEF3C7', // amber-100 — très clair / bg subtil

  // Alertes
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  blue: '#1D4ED8',
  blueSoft: '#DBEAFE',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  seal: '#111827',
};

// ============================================================================
// STYLESHEET
// ============================================================================
const styles = StyleSheet.create({
  // ----- Base pages -----
  pageLight: {
    position: 'relative',
    paddingTop: 36,
    paddingBottom: 32,
    paddingHorizontal: 36,
    backgroundColor: colors.white,
    fontFamily: 'Helvetica',
    color: colors.ink,
    fontSize: 10,
  },
  pageDark: {
    position: 'relative',
    padding: 0,
    backgroundColor: colors.slate900,
    fontFamily: 'Helvetica',
    color: colors.white,
  },
  pageInner: {
    flex: 1,
    paddingTop: 38,
    paddingBottom: 32,
    paddingHorizontal: 40,
  },

  // ----- Watermark -----
  watermark: {
    position: 'absolute',
    top: '43%',
    left: 60,
    fontSize: 54,
    color: '#E2E8F0',
    opacity: 0.35,
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  watermarkDark: {
    position: 'absolute',
    top: '43%',
    left: 60,
    fontSize: 54,
    color: colors.slate700,
    opacity: 0.18,
    letterSpacing: 4,
    fontWeight: 'bold',
  },

  // ============================================================
  // PAGE 1 — HERO SOMBRE
  // ============================================================
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  heroBrand: {
    fontSize: 9,
    color: colors.gold,
    letterSpacing: 3.5,
    fontWeight: 'bold',
  },
  heroBrandSub: {
    fontSize: 7.5,
    color: colors.slate400,
    letterSpacing: 1.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  heroPassportId: {
    fontSize: 7.5,
    color: colors.slate400,
    letterSpacing: 1.5,
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  heroEyebrow: {
    fontSize: 8.5,
    color: colors.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  heroName: {
    fontSize: 38,
    fontFamily: 'Playfair',
    fontWeight: 'bold',
    color: colors.white,
    lineHeight: 1.1,
    marginBottom: 6,
  },
  heroSubline: {
    fontSize: 11,
    color: colors.slate300,
    marginTop: 2,
  },

  heroScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 36,
  },
  heroScoreLeft: {
    width: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroScoreRight: {
    flex: 1,
    paddingLeft: 28,
  },
  heroScoreLabel: {
    fontSize: 8.5,
    color: colors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  heroScoreValue: {
    fontSize: 90,
    fontFamily: 'Playfair',
    fontWeight: 'bold',
    color: colors.gold,
    lineHeight: 1,
    letterSpacing: -2,
  },
  heroScoreUnit: {
    fontSize: 24,
    color: colors.slate400,
    fontFamily: 'Playfair',
    marginLeft: 6,
  },
  heroGradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  heroGradePillText: {
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 1.5,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  heroMicroStatsRow: {
    flexDirection: 'row',
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.25)',
  },
  heroMicroStat: {
    flex: 1,
    paddingRight: 14,
  },
  heroMicroStatLabel: {
    fontSize: 7.5,
    color: colors.slate400,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroMicroStatValue: {
    fontSize: 11,
    color: colors.white,
    fontWeight: 'bold',
  },
  heroMicroStatCheck: {
    fontSize: 9,
    color: colors.gold,
    marginRight: 4,
  },

  heroBottomRow: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.2)',
  },
  heroTagline: {
    fontFamily: 'Playfair',
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.goldSoft,
    flex: 1,
  },
  heroVerifyLink: {
    fontSize: 9,
    color: colors.gold,
    textDecoration: 'underline',
    letterSpacing: 0.5,
  },

  // ============================================================
  // PAGES CLAIRES (2, 3, 4) — Banque privée
  // ============================================================
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 20,
  },
  brandSmall: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.seal,
    letterSpacing: 1.5,
  },
  brandSmallSub: {
    fontSize: 7,
    color: colors.slate,
    letterSpacing: 1.2,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  pageHeaderRight: {
    alignItems: 'flex-end',
  },
  pageHeaderPassportId: {
    fontSize: 7.5,
    color: colors.slate,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pageHeaderState: {
    fontSize: 8,
    color: colors.gold,
    fontWeight: 'bold',
    marginTop: 3,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  footerText: {
    fontSize: 7,
    color: colors.slate,
  },
  footerBrand: {
    fontSize: 7,
    color: colors.goldDeep,
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Section primitives
  sectionDivider: {
    width: 24,
    height: 2,
    backgroundColor: colors.gold,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
    color: colors.slate900,
  },
  sectionEyebrow: {
    fontSize: 8,
    color: colors.gold,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionHeading: {
    fontSize: 18,
    fontFamily: 'Playfair',
    fontWeight: 'bold',
    color: colors.slate900,
    marginBottom: 14,
  },

  // KPI tile
  kpiTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.white,
    minHeight: 80,
  },
  kpiLabel: {
    fontSize: 8,
    color: colors.slate500,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  kpiValue: {
    fontSize: 18,
    fontFamily: 'Playfair',
    fontWeight: 'bold',
    color: colors.slate900,
  },
  kpiSub: {
    fontSize: 8,
    color: colors.slate500,
    marginTop: 6,
    lineHeight: 1.4,
  },
  kpiBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: colors.emeraldVeryLight,
  },
  kpiBadgeText: {
    fontSize: 7,
    color: colors.emerald600,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  // Reassurance pillars (page 2)
  reassuranceRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  reassuranceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.white,
    marginRight: 10,
  },
  reassuranceCardLast: {
    marginRight: 0,
  },
  reassuranceIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  reassuranceIconText: {
    fontSize: 12,
    color: colors.goldDeep,
    fontWeight: 'bold',
  },
  reassuranceTitle: {
    fontSize: 11,
    fontFamily: 'Playfair',
    fontWeight: 'bold',
    color: colors.slate900,
    marginBottom: 6,
  },
  reassuranceBody: {
    fontSize: 8.5,
    color: colors.slate700,
    lineHeight: 1.5,
  },

  // Verdict banner
  verdictBanner: {
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
    backgroundColor: colors.goldFaint,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    padding: 14,
    marginBottom: 22,
  },
  verdictEyebrow: {
    fontSize: 7.5,
    color: colors.goldDeep,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  verdictText: {
    fontSize: 10,
    color: colors.slate900,
    lineHeight: 1.45,
  },
  verdictBullet: {
    fontSize: 9,
    color: colors.slate700,
    marginTop: 5,
    lineHeight: 1.4,
  },

  // Pillar bars
  pillarBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pillarBarLabel: {
    width: 110,
    fontSize: 9.5,
    color: colors.slate900,
    fontWeight: 'bold',
  },
  pillarBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.slate100,
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  pillarBarFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: colors.emerald,
    borderRadius: 4,
  },
  pillarBarScore: {
    width: 56,
    fontSize: 9,
    color: colors.slate700,
    textAlign: 'right',
    fontWeight: 'bold',
  },

  // KPI grid (page 3)
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  kpiCol: {
    width: '50%',
    paddingRight: 6,
    paddingBottom: 10,
  },
  kpiColAlt: {
    width: '50%',
    paddingLeft: 6,
    paddingBottom: 10,
  },

  // Effort rate bar
  effortBarTrack: {
    height: 6,
    backgroundColor: colors.slate100,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  effortBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // Documents coverage matrix
  table: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 18,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    backgroundColor: colors.white,
  },
  tableHeader: {
    backgroundColor: colors.soft,
  },
  tableCell: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    fontSize: 8.5,
    color: colors.slate900,
  },
  tableCellHeader: {
    fontWeight: 'bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.slate500,
  },
  colBlock: { width: '38%' },
  colStatus: { width: '22%' },
  colCount: { width: '10%', textAlign: 'center' },
  colDate: { width: '20%' },

  // Timeline
  timelineWrap: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.white,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  timelineMarker: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginTop: 4,
    marginRight: 10,
  },
  timelineTitle: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: colors.slate900,
    marginBottom: 2,
  },
  timelineMeta: {
    fontSize: 7.5,
    color: colors.slate500,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timelineText: {
    fontSize: 8.5,
    lineHeight: 1.45,
    color: colors.slate700,
  },

  // ============================================================
  // PAGE 4 — CTA conversion
  // ============================================================
  ctaHero: {
    backgroundColor: colors.soft,
    borderLeftWidth: 6,
    borderLeftColor: colors.gold,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    padding: 26,
    marginBottom: 22,
  },
  ctaEyebrow: {
    fontSize: 8.5,
    color: colors.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ctaTitle: {
    fontSize: 24,
    fontFamily: 'Playfair',
    fontWeight: 'bold',
    color: colors.slate900,
    lineHeight: 1.15,
    marginBottom: 12,
  },
  ctaBody: {
    fontSize: 10.5,
    color: colors.slate700,
    lineHeight: 1.5,
    marginBottom: 16,
  },
  ctaPrimary: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignSelf: 'flex-start',
  },
  ctaPrimaryText: {
    color: colors.slate900,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  ctaSubline: {
    fontSize: 8.5,
    color: colors.slate500,
    marginTop: 10,
    fontStyle: 'italic',
  },
  ctaSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  ctaSecondaryLeft: {
    flex: 1,
    paddingRight: 14,
  },
  ctaSecondary: {
    borderWidth: 1.5,
    borderColor: colors.goldDeep,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  ctaSecondaryText: {
    color: colors.goldDeep,
    fontSize: 10.5,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  qrBlock: {
    width: 130,
    alignItems: 'center',
  },
  qrBox: {
    width: 100,
    height: 100,
    padding: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 8,
    marginBottom: 6,
  },
  qrImage: { width: 88, height: 88 },
  qrCaption: {
    fontSize: 7.5,
    color: colors.slate500,
    textAlign: 'center',
    lineHeight: 1.3,
  },

  // Trust footer block (page 4)
  trustBanner: {
    backgroundColor: colors.goldFaint,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustCheck: {
    fontSize: 11,
    color: colors.goldDeep,
    fontWeight: 'bold',
    marginRight: 4,
  },
  trustText: {
    fontSize: 9,
    color: colors.slate900,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  trustLegal: {
    fontSize: 7.5,
    color: colors.slate700,
    textAlign: 'center',
    lineHeight: 1.4,
    marginTop: 6,
    fontStyle: 'italic',
  },
});

// ============================================================================
// HELPERS
// ============================================================================
function getEffortRateColor(rate: number | null): string {
  if (rate == null) return colors.slate500;
  if (rate < 33) return colors.emerald;
  if (rate < 40) return colors.gold;
  return colors.red;
}

function getTimelineColor(status: string): string {
  if (status === 'success' || status === 'sealed') return colors.emerald;
  if (status === 'warning') return colors.gold;
  if (status === 'error') return colors.red;
  return colors.blue;
}

function shouldShowWatermark(state: string): boolean {
  return state === 'draft' || state === 'review';
}

function formatScore(value: number): string {
  return String(Math.max(0, Math.min(100, Math.round(value))));
}

// ============================================================================
// SUB-COMPONENT — Sceau circulaire SVG (statique, 100% vectoriel)
// ============================================================================
function SealSvgPdf({ size = 150 }: { size?: number }): React.ReactElement {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const middleR = size * 0.38;
  const innerR = size * 0.30;
  const ticksCount = 24;

  // Petites encoches radiales (effet "tampon de notaire")
  const ticks: React.ReactElement[] = [];
  for (let i = 0; i < ticksCount; i++) {
    const angle = (i * 360) / ticksCount;
    const rad = (angle * Math.PI) / 180;
    const x1 = cx + Math.cos(rad) * outerR;
    const y1 = cy + Math.sin(rad) * outerR;
    const x2 = cx + Math.cos(rad) * (outerR - 4);
    const y2 = cy + Math.sin(rad) * (outerR - 4);
    ticks.push(
      <SvgPath
        key={`tick-${i}`}
        d={`M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`}
        stroke={colors.gold}
        strokeWidth={1}
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={cx} cy={cy} r={outerR} fill="none" stroke={colors.gold} strokeWidth={1} />
      <G>{ticks}</G>
      <Circle cx={cx} cy={cy} r={middleR} fill="none" stroke={colors.gold} strokeWidth={2.5} />
      <Circle cx={cx} cy={cy} r={innerR} fill={colors.gold} />
      <Circle cx={cx} cy={cy} r={innerR} fill="none" stroke={colors.slate900} strokeWidth={1} />
    </Svg>
  );
}

// ============================================================================
// SUB-COMPONENT — Bouton CTA cliquable
// ============================================================================
function CtaButton({
  href,
  variant,
  label,
}: {
  href: string | null;
  variant: 'primary' | 'secondary';
  label: string;
}): React.ReactElement | null {
  if (!href) return null;
  const containerStyle = variant === 'primary' ? styles.ctaPrimary : styles.ctaSecondary;
  const textStyle = variant === 'primary' ? styles.ctaPrimaryText : styles.ctaSecondaryText;
  return (
    <Link src={href} style={{ textDecoration: 'none' }}>
      <View style={containerStyle}>
        <Text style={textStyle}>{label}</Text>
      </View>
    </Link>
  );
}

// ============================================================================
// SUB-COMPONENT — KPI Tile
// ============================================================================
function KpiTile({
  label,
  value,
  sub,
  badge,
  extra,
}: {
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  extra?: React.ReactNode;
}): React.ReactElement {
  return (
    <View style={styles.kpiTile}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {badge ? (
        <View style={styles.kpiBadge}>
          <Text style={styles.kpiBadgeText}>{badge}</Text>
        </View>
      ) : null}
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
      {extra}
    </View>
  );
}

// ============================================================================
// SUB-COMPONENT — Pillar bar (horizontal)
// ============================================================================
function PillarBar({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}): React.ReactElement {
  const ratio = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
  const fillColor =
    ratio >= 0.85 ? colors.emerald : ratio >= 0.6 ? colors.gold : colors.red;
  return (
    <View style={styles.pillarBarRow}>
      <Text style={styles.pillarBarLabel}>{label}</Text>
      <View style={styles.pillarBarTrack}>
        <View
          style={[
            styles.pillarBarFill,
            { width: `${ratio * 100}%`, backgroundColor: fillColor },
          ]}
        />
      </View>
      <Text style={styles.pillarBarScore}>
        {score}/{max}
      </Text>
    </View>
  );
}

// ============================================================================
// SUB-COMPONENT — Hero micro stat
// ============================================================================
function HeroMicroStat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  return (
    <View style={styles.heroMicroStat}>
      <Text style={styles.heroMicroStatLabel}>
        <Text style={styles.heroMicroStatCheck}>✓ </Text>
        {label}
      </Text>
      <Text style={styles.heroMicroStatValue}>{value}</Text>
    </View>
  );
}

// ============================================================================
// SUB-COMPONENT — Page header / footer (pages claires)
// ============================================================================
function PageHeaderLight({ data }: { data: PassportViewModel }): React.ReactElement {
  return (
    <View style={styles.pageHeader}>
      <View>
        <Text style={styles.brandSmall}>PATRIMOTRUST</Text>
        <Text style={styles.brandSmallSub}>Passeport Locatif certifié</Text>
      </View>
      <View style={styles.pageHeaderRight}>
        <Text style={styles.pageHeaderPassportId}>N° {data.metrics.passportId}</Text>
        <Text style={styles.pageHeaderState}>{data.stateLabel}</Text>
      </View>
    </View>
  );
}

function PageFooterLight({
  data,
  page,
  total,
}: {
  data: PassportViewModel;
  page: number;
  total: number;
}): React.ReactElement {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Validité {data.metrics.validUntil || '—'} · Page {page}/{total}
      </Text>
      <Text style={styles.footerBrand}>{MARKETING.domain.toUpperCase()}</Text>
    </View>
  );
}

// ============================================================================
// PAGE 1 — HERO SOMBRE
// ============================================================================
function HeroPage({ data }: { data: PassportViewModel }): React.ReactElement {
  const score = formatScore(data.score);
  const showWatermark = shouldShowWatermark(data.state);

  return (
    <Page size="A4" style={styles.pageDark}>
      {showWatermark ? (
        <Text style={styles.watermarkDark}>{data.stateMeta.watermark}</Text>
      ) : null}

      <View style={styles.pageInner}>
        {/* Top brand row */}
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroBrand}>PATRIMOTRUST</Text>
            <Text style={styles.heroBrandSub}>{MARKETING.brandTagline}</Text>
          </View>
          <Text style={styles.heroPassportId}>
            Passeport{'\n'}N° {data.metrics.passportId}
          </Text>
        </View>

        {/* Eyebrow + name + subline */}
        <Text style={styles.heroEyebrow}>{MARKETING.eyebrow}</Text>
        <Text style={styles.heroName}>{data.hero.fullName}</Text>
        <Text style={styles.heroSubline}>
          {[
            data.hero.profession,
            data.hero.region,
            data.hero.propertyName ? `Bien ${data.hero.propertyName}` : null,
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>

        {/* Score + Seal */}
        <View style={styles.heroScoreRow}>
          <View style={styles.heroScoreLeft}>
            <SealSvgPdf size={150} />
          </View>
          <View style={styles.heroScoreRight}>
            <Text style={styles.heroScoreLabel}>Indice de Résilience</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={styles.heroScoreValue}>{score}</Text>
              <Text style={styles.heroScoreUnit}> /100</Text>
            </View>
            <View style={styles.heroGradePill}>
              <Text style={styles.heroGradePillText}>{data.hero.gradeLabel}</Text>
            </View>
          </View>
        </View>

        {/* Micro stats row */}
        <View style={styles.heroMicroStatsRow}>
          <HeroMicroStat
            label="Identité"
            value={data.hero.identityVerified ? 'Didit certifiée' : 'À confirmer'}
          />
          <HeroMicroStat
            label="Revenus"
            value={data.solvency.exactMonthlyIncomeLabel || 'À confirmer'}
          />
          <HeroMicroStat
            label="Audit forensic"
            value={
              data.documentCoverage.counts.rejectedDocuments === 0
                ? 'Aucun rejet'
                : `${data.documentCoverage.counts.rejectedDocuments} pièce(s) rejetée(s)`
            }
          />
        </View>

        {/* Bottom tagline + verify link */}
        <View style={styles.heroBottomRow}>
          <Text style={styles.heroTagline}>{MARKETING.heroTagline}</Text>
          {data.marketing?.verifyUrl ? (
            <Link src={data.marketing.verifyUrl} style={{ textDecoration: 'none' }}>
              <Text style={styles.heroVerifyLink}>Vérifier en ligne →</Text>
            </Link>
          ) : null}
        </View>
      </View>
    </Page>
  );
}

// ============================================================================
// PAGE 2 — RÉASSURANCE
// ============================================================================
function ReassurancePage({ data }: { data: PassportViewModel }): React.ReactElement {
  const showWatermark = shouldShowWatermark(data.state);
  return (
    <Page size="A4" style={styles.pageLight}>
      {showWatermark ? <Text style={styles.watermark}>{data.stateMeta.watermark}</Text> : null}
      <PageHeaderLight data={data} />

      <Text style={styles.sectionEyebrow}>Pourquoi nous faire confiance</Text>
      <Text style={styles.sectionHeading}>{MARKETING.reassuranceHeader}</Text>

      <View style={styles.reassuranceRow}>
        {MARKETING.pillars.map((p, idx) => (
          <View
            key={p.id}
            style={[
              styles.reassuranceCard,
              idx === MARKETING.pillars.length - 1 ? styles.reassuranceCardLast : {},
            ]}
          >
            <View style={styles.reassuranceIcon}>
              <Text style={styles.reassuranceIconText}>{idx + 1}</Text>
            </View>
            <Text style={styles.reassuranceTitle}>{p.title}</Text>
            <Text style={styles.reassuranceBody}>{p.body}</Text>
          </View>
        ))}
      </View>

      <View style={styles.verdictBanner}>
        <Text style={styles.verdictEyebrow}>{MARKETING.verdictHeader}</Text>
        <Text style={styles.verdictText}>{data.summary}</Text>
        {(data.readinessReasons.length > 0 ? data.readinessReasons : data.warnings)
          .slice(0, 2)
          .map((reason) => (
            <Text key={reason} style={styles.verdictBullet}>
              ·  {reason}
            </Text>
          ))}
      </View>

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>{MARKETING.pillarsHeader}</Text>
      <View>
        {data.pillars.map((p) => (
          <PillarBar key={p.id} label={p.label} score={p.score} max={p.max} />
        ))}
      </View>

      <PageFooterLight data={data} page={2} total={4} />
    </Page>
  );
}

// ============================================================================
// PAGE 3 — PROFIL FINANCIER + DOCUMENTS + TIMELINE
// ============================================================================
function FinancePage({ data }: { data: PassportViewModel }): React.ReactElement {
  const showWatermark = shouldShowWatermark(data.state);
  const effortRate = data.solvency.effortRate;
  const effortColor = getEffortRateColor(effortRate);
  const remainingIncome =
    data.solvency.exactMonthlyIncome > 0 && data.solvency.rentAmount > 0
      ? Math.max(0, data.solvency.exactMonthlyIncome - data.solvency.rentAmount)
      : null;
  const remainingLabel = remainingIncome
    ? new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(remainingIncome)
    : '—';

  return (
    <Page size="A4" style={styles.pageLight}>
      {showWatermark ? <Text style={styles.watermark}>{data.stateMeta.watermark}</Text> : null}
      <PageHeaderLight data={data} />

      <Text style={styles.sectionEyebrow}>Profil & garantie</Text>
      <Text style={styles.sectionHeading}>{MARKETING.financeHeader}</Text>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCol}>
          <KpiTile
            label="Revenus mensuels nets"
            value={data.solvency.exactMonthlyIncomeLabel || 'À confirmer'}
            badge={data.solvency.certifiedIncome ? 'Certifiés' : undefined}
            sub={
              data.solvency.certifiedIncome
                ? 'Sur la base de 3 bulletins de salaire (moyenne)'
                : 'Revenus déclarés en attente de pièce justificative'
            }
          />
        </View>
        <View style={styles.kpiColAlt}>
          <KpiTile
            label="Taux d'effort"
            value={data.solvency.effortRateLabel || '—'}
            sub={
              effortRate == null
                ? 'Loyer cible non renseigné'
                : effortRate < 33
                ? 'Zone confortable (< 33%)'
                : effortRate < 40
                ? 'À surveiller (33-40%)'
                : 'Élevé (> 40%)'
            }
            extra={
              effortRate != null ? (
                <View style={styles.effortBarTrack}>
                  <View
                    style={[
                      styles.effortBarFill,
                      {
                        width: `${Math.min(100, effortRate)}%`,
                        backgroundColor: effortColor,
                      },
                    ]}
                  />
                </View>
              ) : undefined
            }
          />
        </View>
        <View style={styles.kpiCol}>
          <KpiTile
            label="Reste à vivre"
            value={remainingLabel}
            sub={
              remainingIncome
                ? remainingIncome >= 1500
                  ? 'Confortable (≥ 1 500 €)'
                  : remainingIncome >= 800
                  ? 'Suffisant (≥ 800 €)'
                  : 'À surveiller'
                : 'Calcul impossible (loyer ou revenus manquants)'
            }
          />
        </View>
        <View style={styles.kpiColAlt}>
          <KpiTile
            label="Garantie"
            value={data.guarantee.label}
            sub={data.guarantee.summary}
            badge={data.guarantee.satisfied ? data.guarantee.shareBadge : undefined}
          />
        </View>
      </View>

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>{MARKETING.documentsHeader}</Text>
      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCell, styles.tableCellHeader, styles.colBlock]}>Bloc</Text>
          <Text style={[styles.tableCell, styles.tableCellHeader, styles.colStatus]}>État</Text>
          <Text style={[styles.tableCell, styles.tableCellHeader, styles.colCount]}>Cert.</Text>
          <Text style={[styles.tableCell, styles.tableCellHeader, styles.colCount]}>Revue</Text>
          <Text style={[styles.tableCell, styles.tableCellHeader, styles.colCount]}>Rej.</Text>
          <Text style={[styles.tableCell, styles.tableCellHeader, styles.colDate]}>Dernière</Text>
        </View>
        {data.documentCoverage.blocks.map((block, idx) => (
          <View
            key={block.id}
            style={[
              styles.tableRow,
              idx === data.documentCoverage.blocks.length - 1 ? { borderBottomWidth: 0 } : {},
            ]}
          >
            <Text style={[styles.tableCell, styles.colBlock]}>{block.label}</Text>
            <Text style={[styles.tableCell, styles.colStatus]}>{block.status}</Text>
            <Text style={[styles.tableCell, styles.colCount]}>{block.certifiedCount}</Text>
            <Text style={[styles.tableCell, styles.colCount]}>{block.reviewCount}</Text>
            <Text style={[styles.tableCell, styles.colCount]}>{block.rejectedCount}</Text>
            <Text style={[styles.tableCell, styles.colDate]}>{block.latestDocumentAt || '—'}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionTitle}>{MARKETING.timelineHeader}</Text>
      <View style={styles.timelineWrap}>
        {data.auditTimeline.map((event, idx) => (
          <View
            key={event.id}
            style={[
              styles.timelineItem,
              idx === data.auditTimeline.length - 1
                ? { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 }
                : {},
            ]}
          >
            <View
              style={[styles.timelineMarker, { backgroundColor: getTimelineColor(event.status) }]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.timelineTitle}>{event.title}</Text>
              <Text style={styles.timelineMeta}>{event.time || 'Horodatage non disponible'}</Text>
              <Text style={styles.timelineText}>{event.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <PageFooterLight data={data} page={3} total={4} />
    </Page>
  );
}

// ============================================================================
// PAGE 4 — CTA conversion owner
// ============================================================================
function CtaPage({
  data,
  qrCodeDataUrl,
}: {
  data: PassportViewModel;
  qrCodeDataUrl: string;
}): React.ReactElement {
  const ownerSignupUrl = data.marketing?.ownerSignupUrl || null;
  const verifyUrl = data.marketing?.verifyUrl || data.shareUrl || null;

  return (
    <Page size="A4" style={styles.pageLight}>
      <PageHeaderLight data={data} />

      <Text style={styles.sectionEyebrow}>Vous êtes propriétaire ?</Text>
      <Text style={styles.sectionHeading}>Centralisez vos candidatures sur PatrimoTrust</Text>

      <View style={styles.ctaHero}>
        <Text style={styles.ctaEyebrow}>{MARKETING.ownerCta.eyebrow}</Text>
        <Text style={styles.ctaTitle}>{MARKETING.ownerCta.title}</Text>
        <Text style={styles.ctaBody}>{MARKETING.ownerCta.body}</Text>
        <CtaButton
          href={ownerSignupUrl}
          variant="primary"
          label={`${MARKETING.ownerCta.primary}  →`}
        />
        <Text style={styles.ctaSubline}>{MARKETING.ownerCta.subline}</Text>
      </View>

      <View style={styles.ctaSecondaryRow}>
        <View style={styles.ctaSecondaryLeft}>
          <CtaButton href={verifyUrl} variant="secondary" label={MARKETING.ownerCta.secondary} />
        </View>
        <View style={styles.qrBlock}>
          <View style={styles.qrBox}>
            <Image src={qrCodeDataUrl} style={styles.qrImage} />
          </View>
          <Text style={styles.qrCaption}>Scanner pour ouvrir la version interactive</Text>
        </View>
      </View>

      <View style={styles.trustBanner}>
        <View style={styles.trustRow}>
          {MARKETING.trust.map((item) => (
            <View key={item} style={styles.trustItem}>
              <Text style={styles.trustCheck}>✓</Text>
              <Text style={styles.trustText}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.trustLegal}>{MARKETING.legal}</Text>
      </View>

      <PageFooterLight data={data} page={4} total={4} />
    </Page>
  );
}

// ============================================================================
// MAIN DOCUMENT
// ============================================================================
export function PassportPDFDocument({
  data,
  qrCodeDataUrl,
}: {
  data: PassportViewModel;
  qrCodeDataUrl: string;
}): React.ReactElement {
  return (
    <Document
      title={`Passeport Locatif — ${data.hero.fullName}`}
      subject="Passeport Locatif certifié PatrimoTrust"
      author="PatrimoTrust"
      creator="PatrimoTrust"
      producer="PatrimoTrust"
      keywords="passeport locatif, audit forensic, dossier locataire, certifié"
    >
      <HeroPage data={data} />
      <ReassurancePage data={data} />
      <FinancePage data={data} />
      <CtaPage data={data} qrCodeDataUrl={qrCodeDataUrl} />
    </Document>
  );
}
