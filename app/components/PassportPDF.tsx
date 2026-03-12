'use client';

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';

// Types
interface PassportData {
  // Identité
  firstName: string;
  lastName: string;
  birthDate?: string;
  photoUrl?: string;
  identityVerified: boolean;
  identityVerifiedAt?: string;
  
  // Score & Grade
  score: number;
  grade: 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'SOUVERAIN';
  
  // Solvabilité
  monthlyIncome?: number;
  rentAmount?: number;
  effortRate?: number; // Taux d'effort en %
  
  // Garantie
  guarantorType?: 'NONE' | 'PHYSICAL' | 'VISALE' | 'CAUTIONEO';
  guarantorStatus?: 'PENDING' | 'CERTIFIED' | 'AUDITED';
  
  // Piliers
  pillars: {
    identity: { score: number; verified: boolean };
    domicile: { score: number; verified: boolean };
    activity: { score: number; verified: boolean };
    resources: { score: number; verified: boolean };
  };
  
  // Méta
  certificationDate: string;
  passportId: string;
  qrCodeDataUrl: string;
  verificationUrl: string;
}

// Couleurs du thème
const colors = {
  primary: '#059669', // Emerald 600
  primaryDark: '#047857', // Emerald 700
  gold: '#D4AF37',
  goldDark: '#B8860B',
  darkBg: '#1A1A2E',
  white: '#FFFFFF',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray400: '#9CA3AF',
  gray600: '#4B5563',
  gray800: '#1F2937',
  success: '#10B981',
  warning: '#F59E0B',
};

// Styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: colors.white,
    padding: 40,
    fontFamily: 'Helvetica',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.gray200,
  },
  logo: {
    flexDirection: 'column',
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 1,
  },
  logoSubtext: {
    fontSize: 9,
    color: colors.gray600,
    marginTop: 2,
  },
  sealContainer: {
    alignItems: 'flex-end',
  },
  gradeBox: {
    backgroundColor: colors.darkBg,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginBottom: 4,
  },
  gradeText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  certDate: {
    fontSize: 8,
    color: colors.gray600,
    textAlign: 'right',
  },
  
  // Title
  title: {
    textAlign: 'center',
    marginBottom: 30,
  },
  titleMain: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.gray800,
    letterSpacing: 3,
    marginBottom: 4,
  },
  titleSub: {
    fontSize: 10,
    color: colors.gray600,
    letterSpacing: 1,
  },
  
  // Identity Block
  identitySection: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  photoContainer: {
    width: 80,
    height: 100,
    backgroundColor: colors.gray200,
    borderRadius: 4,
    marginRight: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  photoPlaceholder: {
    fontSize: 28,
    color: colors.gray400,
  },
  photo: {
    width: 80,
    height: 100,
    objectFit: 'cover',
  },
  identityInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fullName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.gray800,
    marginBottom: 6,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  verifiedIcon: {
    width: 14,
    height: 14,
    backgroundColor: colors.success,
    borderRadius: 7,
    marginRight: 6,
  },
  verifiedText: {
    fontSize: 10,
    color: colors.success,
    fontWeight: 'bold',
  },
  birthDateText: {
    fontSize: 9,
    color: colors.gray600,
  },
  
  // Dashboard Solvabilité
  dashboardSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.gray800,
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dashboardCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 6,
    padding: 14,
  },
  dashboardLabel: {
    fontSize: 8,
    color: colors.gray600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dashboardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.gray800,
  },
  dashboardSubvalue: {
    fontSize: 8,
    color: colors.gray400,
    marginTop: 2,
  },
  
  // Piliers
  pillarsSection: {
    marginBottom: 24,
  },
  pillarsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pillarCard: {
    width: '23%',
    backgroundColor: colors.gray100,
    borderRadius: 6,
    padding: 12,
    alignItems: 'center',
  },
  pillarIcon: {
    fontSize: 18,
    marginBottom: 6,
  },
  pillarLabel: {
    fontSize: 8,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 4,
  },
  pillarStatus: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  pillarVerified: {
    color: colors.success,
  },
  pillarPending: {
    color: colors.warning,
  },
  
  // QR Code Central
  qrSection: {
    alignItems: 'center',
    backgroundColor: colors.darkBg,
    borderRadius: 8,
    padding: 24,
    marginBottom: 24,
  },
  qrContainer: {
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  qrImage: {
    width: 120,
    height: 120,
  },
  qrText: {
    fontSize: 9,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 1.4,
    maxWidth: 300,
  },
  qrUrl: {
    fontSize: 8,
    color: colors.gold,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  footerText: {
    fontSize: 7,
    color: colors.gray400,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  footerSignature: {
    fontSize: 8,
    color: colors.gray600,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: 'bold',
  },
});

// Helpers
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getGradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    'SOUVERAIN': 'GRADE S — SOUVERAIN',
    'A': 'GRADE A — EXCELLENCE',
    'B': 'GRADE B — CONFIANCE',
    'C': 'GRADE C — SOLIDE',
    'D': 'GRADE D — STANDARD',
    'E': 'GRADE E — À COMPLÉTER',
    'F': 'GRADE F — EN COURS',
  };
  return labels[grade] || `GRADE ${grade}`;
}

function getGuarantorLabel(type?: string, status?: string): string {
  if (!type || type === 'NONE') return 'Aucune';
  const types: Record<string, string> = {
    'PHYSICAL': 'Garant Physique',
    'VISALE': 'Garantie Visale',
    'CAUTIONEO': 'Garantie Cautioneo',
  };
  const statusLabels: Record<string, string> = {
    'CERTIFIED': '✓ Certifié',
    'AUDITED': '✓ Audité',
    'PENDING': 'En attente',
  };
  return `${types[type] || type} ${status ? statusLabels[status] || '' : ''}`;
}

// Component - Retourne un Document React-PDF
export function PassportPDFDocument({ data }: { data: PassportData }): React.ReactElement {
  const gradeColors = {
    'SOUVERAIN': colors.gold,
    'A': colors.primary,
    'B': '#3B82F6',
    'C': '#8B5CF6',
    'D': colors.warning,
    'E': '#F97316',
    'F': colors.gray400,
  };
  
  const gradeColor = gradeColors[data.grade] || colors.gray400;
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header avec Logo et Sceau */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>PatrimoTrust™</Text>
            <Text style={styles.logoSubtext}>Standard de Confiance Immobilier</Text>
          </View>
          <View style={styles.sealContainer}>
            <View style={[styles.gradeBox, { backgroundColor: data.grade === 'SOUVERAIN' ? colors.gold : colors.darkBg }]}>
              <Text style={[styles.gradeText, { color: data.grade === 'SOUVERAIN' ? colors.darkBg : gradeColor }]}>
                {getGradeLabel(data.grade)}
              </Text>
            </View>
            <Text style={styles.certDate}>Certifié le {data.certificationDate}</Text>
          </View>
        </View>
        
        {/* Titre */}
        <View style={styles.title}>
          <Text style={styles.titleMain}>PASSEPORT SOUVERAIN</Text>
          <Text style={styles.titleSub}>Rapport d'Audit de Solvabilité</Text>
        </View>
        
        {/* Bloc Identité */}
        <View style={styles.identitySection}>
          <View style={styles.photoContainer}>
            {data.photoUrl ? (
              <Image src={data.photoUrl} style={styles.photo} />
            ) : (
              <Text style={styles.photoPlaceholder}>👤</Text>
            )}
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.fullName}>{data.firstName} {data.lastName}</Text>
            {data.identityVerified && (
              <View style={styles.verifiedBadge}>
                <View style={styles.verifiedIcon} />
                <Text style={styles.verifiedText}>IDENTITÉ VÉRIFIÉE</Text>
              </View>
            )}
            {data.birthDate && (
              <Text style={styles.birthDateText}>Né(e) le {data.birthDate}</Text>
            )}
          </View>
        </View>
        
        {/* Dashboard Solvabilité */}
        <View style={styles.dashboardSection}>
          <Text style={styles.sectionTitle}>Dashboard de Solvabilité</Text>
          <View style={styles.dashboardGrid}>
            <View style={styles.dashboardCard}>
              <Text style={styles.dashboardLabel}>Revenu Mensuel Net Certifié</Text>
              <Text style={styles.dashboardValue}>
                {data.monthlyIncome ? formatCurrency(data.monthlyIncome) : '—'}
              </Text>
              <Text style={styles.dashboardSubvalue}>Source vérifiée par IA</Text>
            </View>
            <View style={styles.dashboardCard}>
              <Text style={styles.dashboardLabel}>Taux d'Effort Calculé</Text>
              <Text style={[styles.dashboardValue, { color: (data.effortRate || 0) <= 33 ? colors.success : colors.warning }]}>
                {data.effortRate ? `${data.effortRate.toFixed(1)}%` : '—'}
              </Text>
              <Text style={styles.dashboardSubvalue}>
                {(data.effortRate || 0) <= 33 ? 'Ratio sain (≤33%)' : 'Ratio élevé (>33%)'}
              </Text>
            </View>
            <View style={styles.dashboardCard}>
              <Text style={styles.dashboardLabel}>Type de Garantie</Text>
              <Text style={styles.dashboardValue}>
                {getGuarantorLabel(data.guarantorType, data.guarantorStatus)}
              </Text>
            </View>
            <View style={styles.dashboardCard}>
              <Text style={styles.dashboardLabel}>Score PatrimoTrust™</Text>
              <Text style={[styles.dashboardValue, { color: gradeColor }]}>
                {data.score}/100
              </Text>
              <Text style={styles.dashboardSubvalue}>{getGradeLabel(data.grade)}</Text>
            </View>
          </View>
        </View>
        
        {/* 4 Piliers Administratifs */}
        <View style={styles.pillarsSection}>
          <Text style={styles.sectionTitle}>Synthèse des 4 Piliers Administratifs</Text>
          <View style={styles.pillarsGrid}>
            <View style={styles.pillarCard}>
              <Text style={styles.pillarIcon}>🪪</Text>
              <Text style={styles.pillarLabel}>IDENTITÉ</Text>
              <Text style={[styles.pillarStatus, data.pillars.identity.verified ? styles.pillarVerified : styles.pillarPending]}>
                {data.pillars.identity.verified ? '✓ Vérifié' : 'En attente'}
              </Text>
            </View>
            <View style={styles.pillarCard}>
              <Text style={styles.pillarIcon}>🏠</Text>
              <Text style={styles.pillarLabel}>DOMICILE</Text>
              <Text style={[styles.pillarStatus, data.pillars.domicile.verified ? styles.pillarVerified : styles.pillarPending]}>
                {data.pillars.domicile.verified ? '✓ Vérifié' : 'En attente'}
              </Text>
            </View>
            <View style={styles.pillarCard}>
              <Text style={styles.pillarIcon}>💼</Text>
              <Text style={styles.pillarLabel}>ACTIVITÉ</Text>
              <Text style={[styles.pillarStatus, data.pillars.activity.verified ? styles.pillarVerified : styles.pillarPending]}>
                {data.pillars.activity.verified ? '✓ Vérifié' : 'En attente'}
              </Text>
            </View>
            <View style={styles.pillarCard}>
              <Text style={styles.pillarIcon}>💰</Text>
              <Text style={styles.pillarLabel}>RESSOURCES</Text>
              <Text style={[styles.pillarStatus, data.pillars.resources.verified ? styles.pillarVerified : styles.pillarPending]}>
                {data.pillars.resources.verified ? '✓ Vérifié' : 'En attente'}
              </Text>
            </View>
          </View>
        </View>
        
        {/* QR Code Central */}
        <View style={styles.qrSection}>
          <View style={styles.qrContainer}>
            {data.qrCodeDataUrl && (
              <Image src={data.qrCodeDataUrl} style={styles.qrImage} />
            )}
          </View>
          <Text style={styles.qrText}>
            Scannez ce QR code pour accéder aux pièces justificatives originales{'\n'}
            et vérifier l'intégrité de ce dossier en temps réel.
          </Text>
          <Text style={styles.qrUrl}>{data.verificationUrl}</Text>
        </View>
        
        {/* Footer Légal */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ce dossier a été audité par l'IA PatrimoTrust™. Les informations présentées ont été vérifiées{'\n'}
            par recoupement algorithmique et certification d'identité biométrique. Conforme Loi Alur.
          </Text>
          <Text style={styles.footerSignature}>
            Signature numérique ID : #{data.passportId}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export type { PassportData };
