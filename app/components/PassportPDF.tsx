'use client';

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

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
}

const colors = {
  ink: '#0F172A',
  slate: '#475569',
  line: '#CBD5E1',
  soft: '#F8FAFC',
  emerald: '#0F766E',
  emeraldSoft: '#CCFBF1',
  amber: '#B45309',
  amberSoft: '#FEF3C7',
  blue: '#1D4ED8',
  blueSoft: '#DBEAFE',
  seal: '#111827',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    position: 'relative',
    paddingTop: 34,
    paddingBottom: 30,
    paddingHorizontal: 34,
    backgroundColor: colors.white,
    fontFamily: 'Helvetica',
    color: colors.ink,
    fontSize: 10,
  },
  watermark: {
    position: 'absolute',
    top: '43%',
    left: 58,
    fontSize: 54,
    color: '#E2E8F0',
    opacity: 0.45,
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 18,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.seal,
    letterSpacing: 1.2,
  },
  brandSubtitle: {
    fontSize: 8,
    color: colors.slate,
    marginTop: 3,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.soft,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  titleRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  heroPanel: {
    flex: 1.35,
    backgroundColor: colors.soft,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  scorePanel: {
    flex: 0.9,
    backgroundColor: colors.seal,
    borderRadius: 18,
    padding: 18,
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    color: colors.slate,
    marginBottom: 8,
  },
  candidateName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.ink,
    marginBottom: 6,
  },
  candidateMeta: {
    fontSize: 10,
    color: colors.slate,
    marginBottom: 3,
  },
  summary: {
    fontSize: 10,
    lineHeight: 1.45,
    color: colors.ink,
    marginTop: 12,
  },
  scoreLabel: {
    fontSize: 8,
    color: '#CBD5E1',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  scoreValue: {
    fontSize: 40,
    color: colors.white,
    fontWeight: 'bold',
    marginTop: 6,
  },
  gradeValue: {
    fontSize: 15,
    color: '#FDE68A',
    fontWeight: 'bold',
    marginTop: 6,
  },
  scoreHint: {
    fontSize: 9,
    color: '#CBD5E1',
    lineHeight: 1.4,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.7,
    marginBottom: 10,
    textTransform: 'uppercase',
    color: colors.seal,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.white,
  },
  statLabel: {
    fontSize: 8,
    color: colors.slate,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.ink,
  },
  statSubvalue: {
    fontSize: 8,
    color: colors.slate,
    marginTop: 4,
    lineHeight: 1.35,
  },
  split: {
    flexDirection: 'row',
    gap: 14,
  },
  half: {
    flex: 1,
  },
  banner: {
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
  },
  bannerTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  bannerText: {
    fontSize: 9,
    lineHeight: 1.45,
  },
  list: {
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 5,
  },
  bullet: {
    width: 10,
    fontSize: 10,
    color: colors.ink,
  },
  listText: {
    flex: 1,
    fontSize: 9,
    color: colors.ink,
    lineHeight: 1.45,
  },
  pillarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pillarCard: {
    width: '48%',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.soft,
  },
  pillarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  pillarLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.ink,
  },
  pillarStatus: {
    fontSize: 8,
    color: colors.slate,
    textTransform: 'uppercase',
  },
  pillarScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.ink,
  },
  pillarSummary: {
    fontSize: 8,
    color: colors.slate,
    marginTop: 6,
    lineHeight: 1.4,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.white,
  },
  tableHeader: {
    backgroundColor: colors.soft,
  },
  tableCell: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    fontSize: 8,
    color: colors.ink,
  },
  colBlock: {
    width: '34%',
  },
  colStatus: {
    width: '18%',
  },
  colCount: {
    width: '14%',
    textAlign: 'center',
  },
  colDate: {
    width: '20%',
  },
  colNote: {
    width: '14%',
  },
  timelineCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.white,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  timelineMarker: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 4,
  },
  timelineTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.ink,
    marginBottom: 3,
  },
  timelineMeta: {
    fontSize: 8,
    color: colors.slate,
    marginBottom: 4,
  },
  timelineText: {
    fontSize: 8,
    lineHeight: 1.45,
    color: colors.ink,
  },
  qrPanel: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.soft,
  },
  qrBox: {
    width: 128,
    height: 128,
    borderRadius: 12,
    backgroundColor: colors.white,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 108,
    height: 108,
  },
  qrText: {
    fontSize: 8,
    color: colors.slate,
    textAlign: 'center',
    lineHeight: 1.4,
  },
  qrUrl: {
    marginTop: 8,
    fontSize: 8,
    color: colors.ink,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 34,
    right: 34,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 7,
    color: colors.slate,
  },
});

function getStatusColors(state: string) {
  if (state === 'sealed' || state === 'ready') {
    return { backgroundColor: colors.emeraldSoft, borderColor: '#5EEAD4', textColor: colors.emerald };
  }
  if (state === 'review') {
    return { backgroundColor: colors.blueSoft, borderColor: '#93C5FD', textColor: colors.blue };
  }
  return { backgroundColor: colors.amberSoft, borderColor: '#FCD34D', textColor: colors.amber };
}

function getTimelineColor(status: string) {
  if (status === 'success' || status === 'sealed') return colors.emerald;
  if (status === 'warning') return colors.amber;
  return colors.blue;
}

function renderHeader(data: PassportViewModel) {
  const statusColors = getStatusColors(data.state);
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brandTitle}>PatrimoTrust Passport</Text>
        <Text style={styles.brandSubtitle}>Synthese de candidature locative certifiee</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColors.backgroundColor, borderColor: statusColors.borderColor }]}>
        <Text style={[styles.statusBadgeText, { color: statusColors.textColor }]}>{data.stateLabel}</Text>
      </View>
    </View>
  );
}

function renderFooter(data: PassportViewModel, pageNumber: number) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Passeport ID {data.metrics.passportId}</Text>
      <Text style={styles.footerText}>PatrimoTrust - page {pageNumber} / 3</Text>
    </View>
  );
}

export function PassportPDFDocument({
  data,
  qrCodeDataUrl,
}: {
  data: PassportViewModel;
  qrCodeDataUrl: string;
}): React.ReactElement {
  const statusColors = getStatusColors(data.state);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>{data.stateMeta.watermark}</Text>
        {renderHeader(data)}

        <View style={styles.titleRow}>
          <View style={styles.heroPanel}>
            <Text style={styles.eyebrow}>Passeport locataire</Text>
            <Text style={styles.candidateName}>{data.hero.fullName}</Text>
            <Text style={styles.candidateMeta}>{data.hero.profession} - {data.hero.region}</Text>
            <Text style={styles.candidateMeta}>Garantie: {data.guarantee.label}</Text>
            <Text style={styles.summary}>{data.summary}</Text>
          </View>

          <View style={styles.scorePanel}>
            <View>
              <Text style={styles.scoreLabel}>Score global</Text>
              <Text style={styles.scoreValue}>{data.score}/100</Text>
              <Text style={styles.gradeValue}>{data.hero.gradeLabel}</Text>
            </View>
            <Text style={styles.scoreHint}>
              {data.shareEnabled
                ? 'Ce passeport peut etre consulte en ligne et telecharge en PDF.'
                : 'Ce passeport reste accessible au candidat, mais n est pas encore ouvert au partage externe.'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Synthese executive</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Revenus mensuels</Text>
              <Text style={styles.statValue}>{data.solvency.exactMonthlyIncomeLabel || 'A confirmer'}</Text>
              <Text style={styles.statSubvalue}>Revenus certifies: {data.solvency.certifiedIncome ? 'oui' : 'non'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Loyer cible</Text>
              <Text style={styles.statValue}>{data.solvency.rentAmountLabel || 'Non renseigne'}</Text>
              <Text style={styles.statSubvalue}>
                Taux d effort: {data.solvency.effortRateLabel || 'Non calcule'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Garantie</Text>
              <Text style={styles.statValue}>{data.guarantee.label}</Text>
              <Text style={styles.statSubvalue}>{data.guarantee.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.split}>
          <View style={styles.half}>
            <View style={[styles.banner, { backgroundColor: statusColors.backgroundColor, borderColor: statusColors.borderColor }]}>
              <Text style={[styles.bannerTitle, { color: statusColors.textColor }]}>Etat du passeport</Text>
              <Text style={[styles.bannerText, { color: colors.ink }]}>{data.summary}</Text>
            </View>
          </View>
          <View style={styles.half}>
            <View style={[styles.banner, { backgroundColor: colors.soft, borderColor: colors.line }]}>
              <Text style={[styles.bannerTitle, { color: colors.seal }]}>Checklist decisive</Text>
              <View style={styles.list}>
                {(data.readinessReasons.length > 0 ? data.readinessReasons : data.warnings.slice(0, 3)).map((item) => (
                  <View key={item} style={styles.listItem}>
                    <Text style={styles.bullet}>-</Text>
                    <Text style={styles.listText}>{item}</Text>
                  </View>
                ))}
                {data.readinessReasons.length === 0 && data.warnings.length === 0 && (
                  <View style={styles.listItem}>
                    <Text style={styles.bullet}>-</Text>
                    <Text style={styles.listText}>Aucune incoherence critique detectee a ce stade.</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Informations de certification</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Passeport ID</Text>
              <Text style={styles.statValue}>{data.metrics.passportId}</Text>
              <Text style={styles.statSubvalue}>Genere le {data.metrics.generatedAt || 'aujourd hui'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Validite indicative</Text>
              <Text style={styles.statValue}>{data.metrics.validUntil || 'A confirmer'}</Text>
              <Text style={styles.statSubvalue}>Sous reserve de modification documentaire</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Partage</Text>
              <Text style={styles.statValue}>{data.shareEnabled ? 'Autorise' : 'Interne uniquement'}</Text>
              <Text style={styles.statSubvalue}>{data.nextAction || 'Passeport synchronise avec les surfaces web.'}</Text>
            </View>
          </View>
        </View>

        {renderFooter(data, 1)}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>{data.stateMeta.watermark}</Text>
        {renderHeader(data)}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Les 4 piliers du dossier</Text>
          <View style={styles.pillarGrid}>
            {data.pillars.map((pillar) => (
              <View key={pillar.id} style={styles.pillarCard}>
                <View style={styles.pillarTop}>
                  <Text style={styles.pillarLabel}>{pillar.label}</Text>
                  <Text style={styles.pillarStatus}>{pillar.verified ? 'couvre' : pillar.status}</Text>
                </View>
                <Text style={styles.pillarScore}>{pillar.score}/{pillar.max}</Text>
                <Text style={styles.pillarSummary}>{pillar.summary}</Text>
                <Text style={styles.pillarSummary}>
                  Certifiees: {pillar.certifiedCount} | En revue: {pillar.reviewCount} | Rejetees: {pillar.rejectedCount}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.split}>
          <View style={styles.half}>
            <Text style={styles.sectionTitle}>Garantie</Text>
            <View style={styles.timelineCard}>
              <Text style={styles.timelineTitle}>{data.guarantee.label}</Text>
              <Text style={styles.timelineMeta}>{data.guarantee.status}</Text>
              <Text style={styles.timelineText}>{data.guarantee.summary}</Text>
              <Text style={[styles.timelineText, { marginTop: 8 }]}>
                Exigence dossier: {data.guarantee.requirement}
              </Text>
              {data.guarantee.guarantors.length > 0 && (
                <View style={styles.list}>
                  {data.guarantee.guarantors.map((guarantor) => (
                    <View key={guarantor.label} style={styles.listItem}>
                      <Text style={styles.bullet}>-</Text>
                      <Text style={styles.listText}>
                        {guarantor.label}: {guarantor.profile}, score {guarantor.score}/30, statut {guarantor.status}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          <View style={styles.half}>
            <Text style={styles.sectionTitle}>Couverture documentaire</Text>
            <View style={styles.timelineCard}>
              <Text style={styles.timelineText}>
                Pieces analysees: {data.documentCoverage.counts.totalDocuments}
              </Text>
              <Text style={styles.timelineText}>
                Certifiees: {data.documentCoverage.counts.certifiedDocuments}
              </Text>
              <Text style={styles.timelineText}>
                En revue: {data.documentCoverage.counts.reviewDocuments}
              </Text>
              <Text style={styles.timelineText}>
                Rejetees ou illegibles: {data.documentCoverage.counts.rejectedDocuments}
              </Text>
              <Text style={[styles.timelineText, { marginTop: 8 }]}>
                Consultations: {data.metrics.viewCount} | Partages: {data.metrics.shareCount}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Matrice des preuves</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableCell, styles.colBlock]}>Bloc</Text>
              <Text style={[styles.tableCell, styles.colStatus]}>Etat</Text>
              <Text style={[styles.tableCell, styles.colCount]}>Cert.</Text>
              <Text style={[styles.tableCell, styles.colCount]}>Revue</Text>
              <Text style={[styles.tableCell, styles.colDate]}>Derniere piece</Text>
            </View>
            {data.documentCoverage.blocks.map((block, index) => (
              <View
                key={block.id}
                style={[
                  styles.tableRow,
                  index === data.documentCoverage.blocks.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                <Text style={[styles.tableCell, styles.colBlock]}>{block.label}</Text>
                <Text style={[styles.tableCell, styles.colStatus]}>{block.status}</Text>
                <Text style={[styles.tableCell, styles.colCount]}>{block.certifiedCount}</Text>
                <Text style={[styles.tableCell, styles.colCount]}>{block.reviewCount}</Text>
                <Text style={[styles.tableCell, styles.colDate]}>{block.latestDocumentAt || '-'}</Text>
              </View>
            ))}
          </View>
        </View>

        {renderFooter(data, 2)}
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>{data.stateMeta.watermark}</Text>
        {renderHeader(data)}

        <View style={styles.split}>
          <View style={[styles.half, { flex: 1.25 }]}>
            <Text style={styles.sectionTitle}>Journal d audit</Text>
            <View style={styles.timelineCard}>
              {data.auditTimeline.map((event, index) => (
                <View
                  key={event.id}
                style={[
                  styles.timelineItem,
                  index === data.auditTimeline.length - 1 ? { borderBottomWidth: 0, marginBottom: 0, paddingBottom: 0 } : {},
                ]}
              >
                  <View style={[styles.timelineMarker, { backgroundColor: getTimelineColor(event.status) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>{event.title}</Text>
                    <Text style={styles.timelineMeta}>{event.time || 'Horodatage non disponible'}</Text>
                    <Text style={styles.timelineText}>{event.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.half}>
            <Text style={styles.sectionTitle}>Lien de verification</Text>
            <View style={styles.qrPanel}>
              <View style={styles.qrBox}>
                <Image src={qrCodeDataUrl} style={styles.qrImage} />
              </View>
              <Text style={styles.qrText}>
                Scannez pour ouvrir la version web du passeport et verifier l etat le plus recent du dossier.
              </Text>
              <Text style={styles.qrUrl}>{data.shareEnabled ? data.shareUrl : data.previewUrl}</Text>
            </View>

            <View style={[styles.banner, { marginTop: 16, backgroundColor: colors.soft, borderColor: colors.line }]}>
              <Text style={[styles.bannerTitle, { color: colors.seal }]}>Mentions</Text>
              <Text style={styles.bannerText}>
                Ce document synthese ne contient aucune piece brute ni coordonnee sensible. Toute modification documentaire
                ou toute nouvelle analyse peut faire evoluer son etat.
              </Text>
              <Text style={[styles.bannerText, { marginTop: 8 }]}>
                Date de certification: {data.metrics.certificationDate || 'En cours'}
              </Text>
              <Text style={styles.bannerText}>Identite verifiee: {data.hero.identityVerified ? 'oui' : 'non'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Note finale</Text>
          <View style={[styles.banner, { backgroundColor: statusColors.backgroundColor, borderColor: statusColors.borderColor }]}>
            <Text style={[styles.bannerText, { color: colors.ink }]}>
              Etat actuel: {data.stateLabel}. {data.summary}
            </Text>
          </View>
        </View>

        {renderFooter(data, 3)}
      </Page>
    </Document>
  );
}
