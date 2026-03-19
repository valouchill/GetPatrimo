import React from 'react';
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    backgroundColor: '#FAFAF8',
    color: '#0F172A',
    fontSize: 10,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.2,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 11,
    lineHeight: 1.5,
    color: '#475569',
    marginBottom: 24,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 18,
    marginBottom: 18,
  },
  heroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  statLabel: {
    fontSize: 8,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 11,
    fontWeight: 700,
    color: '#0F172A',
  },
  section: {
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  sectionText: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#475569',
  },
  checklistCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  checklistHeader: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 11,
    fontWeight: 700,
  },
  checklistRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    minHeight: 34,
  },
  checklistCellWide: {
    flex: 2.1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  checklistCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  checklistCellLast: {
    flex: 1.3,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  checklistText: {
    fontSize: 9,
    color: '#334155',
  },
  footer: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    padding: 14,
  },
  footerTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#78350F',
    marginBottom: 6,
  },
  footerText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: '#92400E',
  },
});

const ROOM_LINES = [
  'Entree',
  'Sejour',
  'Cuisine',
  'Chambre 1',
  'Chambre 2',
  'Salle de bain',
  'WC',
  'Annexes',
];

export function MoveInInventoryPDFDocument({
  propertyAddress,
  rentLabel,
  chargesLabel,
  generatedAtLabel,
}: {
  propertyAddress: string;
  rentLabel: string;
  chargesLabel: string;
  generatedAtLabel: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>PatrimoTrust · Etat des lieux</Text>
        <Text style={styles.title}>Etat des lieux d'entree</Text>
        <Text style={styles.subtitle}>
          Modele vierge premium pour la remise des cles, la constatation de l'etat du logement
          et la constitution d'un dossier d'entree clair, complet et opposable.
        </Text>

        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Adresse du bien</Text>
              <Text style={styles.statValue}>{propertyAddress || 'Bien non renseigne'}</Text>
            </View>
          </View>
          <View style={[styles.heroRow, { marginTop: 12 }]}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Loyer hors charges</Text>
              <Text style={styles.statValue}>{rentLabel}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Charges</Text>
              <Text style={styles.statValue}>{chargesLabel}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Date de generation</Text>
              <Text style={styles.statValue}>{generatedAtLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cadre de visite</Text>
          <Text style={styles.sectionText}>
            Renseigner l'identite du bailleur, du locataire, la date, l'heure, le nombre de cles
            remises et les observations generales avant le detail piece par piece.
          </Text>
        </View>

        <View style={styles.checklistCard}>
          <Text style={styles.checklistHeader}>Constat par zone</Text>
          <View style={styles.checklistRow}>
            <View style={styles.checklistCellWide}><Text style={styles.checklistText}>Zone</Text></View>
            <View style={styles.checklistCell}><Text style={styles.checklistText}>Sols</Text></View>
            <View style={styles.checklistCell}><Text style={styles.checklistText}>Murs</Text></View>
            <View style={styles.checklistCell}><Text style={styles.checklistText}>Equipements</Text></View>
            <View style={styles.checklistCellLast}><Text style={styles.checklistText}>Observations</Text></View>
          </View>
          {ROOM_LINES.map((room) => (
            <View key={room} style={styles.checklistRow}>
              <View style={styles.checklistCellWide}><Text style={styles.checklistText}>{room}</Text></View>
              <View style={styles.checklistCell}><Text style={styles.checklistText}>................................</Text></View>
              <View style={styles.checklistCell}><Text style={styles.checklistText}>................................</Text></View>
              <View style={styles.checklistCell}><Text style={styles.checklistText}>................................</Text></View>
              <View style={styles.checklistCellLast}><Text style={styles.checklistText}>....................................................................</Text></View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Bon usage du modele</Text>
          <Text style={styles.footerText}>
            Ajouter des photos datees, faire signer chaque page si necessaire, et conserver le PDF
            final dans le coffre-fort du bien avec le bail et, le cas echeant, l'acte de caution.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
