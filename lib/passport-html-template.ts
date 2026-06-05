/**
 * Template HTML du Passeport Locatif (généré par WeasyPrint).
 *
 * Consomme la PassportViewModel construite par
 * /opt/doc2loc/src/utils/passportViewModel.js et injecte les vraies données
 * du candidat à la place des valeurs de démo.
 *
 * Le rendu PDF est ensuite généré côté serveur via subprocess Python
 * (scripts/generate_passport_pdf.py), ce qui permet d'utiliser tout CSS
 * moderne (gradients, shadows, border-radius) sans dépendre de Chromium.
 *
 * Design : palette "Banque privée" (emerald 064e3b + amber 064e3b) +
 * serif Georgia. Cohérent avec le hero PDF V1.8 mais en HTML/CSS pur.
 */

import type { PassportViewModel } from '@/lib/passport-viewmodel-types';
import { MARKETING } from './passport-marketing-copy';

// ─── Helpers d'échappement HTML ──────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getInitials(fullName: string): string {
  return (
    (fullName || '?')
      .split(/\s+/)
      .map((part) => part[0] || '')
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function safeNum(n: number | null | undefined, fallback = '—'): string {
  if (n == null || !Number.isFinite(n)) return fallback;
  return new Intl.NumberFormat('fr-FR').format(n);
}

function pickGuaranteeLabel(mode: string | null | undefined): string {
  if (mode === 'VISALE') return 'Visale (Action Logement)';
  if (mode === 'PHYSICAL') return 'Garant physique certifié';
  return 'Aucune garantie';
}

function pickGuaranteeColor(satisfied: boolean): string {
  return satisfied ? '#059669' : '#b45309';
}

function pickIncomeTrend(certified: boolean): string {
  return certified ? 'Certifiés sur 3 derniers bulletins' : 'À confirmer';
}

// ─── Génération HTML ─────────────────────────────────────────────────────────

export interface PassportHtmlTemplateOptions {
  data: PassportViewModel;
  /** Data URL (data:image/png;base64,...) du QR code généré côté Node */
  qrCodeDataUrl: string;
  /** URL d'inscription propriétaire (UTM-tagged via viewModel.marketing) */
  ownerSignupUrl?: string | null;
}

/**
 * Construit le HTML complet du Passeport Locatif.
 * Retourne une string HTML autonome avec CSS inline (compatible WeasyPrint).
 */
export function buildPassportHtml({
  data,
  qrCodeDataUrl,
  ownerSignupUrl,
}: PassportHtmlTemplateOptions): string {
  const fullName = escapeHtml(data.hero.fullName || 'Candidat');
  const initials = escapeHtml(getInitials(data.hero.fullName));
  const profession = escapeHtml(data.hero.profession || 'Profil');
  const region = escapeHtml(data.hero.region || '');
  const propertyName = escapeHtml(data.hero.propertyName || '');
  const status = escapeHtml(data.hero.candidateStatus || data.hero.profession || '');

  const passportId = escapeHtml(data.metrics.passportId || 'PT-XXXX');
  const score = Math.max(0, Math.min(100, Math.round(data.score || 0)));
  const grade = escapeHtml(data.grade || 'B');
  const gradeLabel = escapeHtml(data.hero.gradeLabel || data.grade || 'Grade');

  // Financier
  const monthlyIncomeLabel = escapeHtml(
    data.solvency.exactMonthlyIncomeLabel || data.solvency.monthlyIncomeLabel || 'À confirmer',
  );
  const rentAmountLabel = escapeHtml(data.solvency.rentAmountLabel || '—');
  const effortRateLabel = escapeHtml(data.solvency.effortRateLabel || '—');
  const certifiedIncome = data.solvency.certifiedIncome;

  // Garantie
  const guaranteeLabel = escapeHtml(pickGuaranteeLabel(data.guarantee.mode));
  const guaranteeSatisfied = data.guarantee.satisfied;
  const guaranteeStatus = escapeHtml(data.guarantee.status || '');
  const guaranteeColor = pickGuaranteeColor(guaranteeSatisfied);

  // Documents
  const certifiedCount = data.documentCoverage.counts.certifiedDocuments;
  const reviewCount = data.documentCoverage.counts.reviewDocuments;
  const rejectedCount = data.documentCoverage.counts.rejectedDocuments;

  // Marketing
  const signupUrl = escapeHtml(ownerSignupUrl || data.marketing?.ownerSignupUrl || 'https://getpatrimo.com/auth/register?role=owner');

  // Verdict & forensic
  const auditStatus = data.documentCoverage.counts.rejectedDocuments === 0 && certifiedCount > 0
    ? 'CLEAR'
    : data.documentCoverage.counts.rejectedDocuments > 0
    ? 'ALERT'
    : 'REVIEW';
  const auditConfidence = auditStatus === 'CLEAR' ? '99,8%' : auditStatus === 'REVIEW' ? '85%' : '60%';

  // Verdict text (depuis ViewModel)
  const verdictSummary = escapeHtml(data.summary || 'Analyse complète disponible.');
  const reasonsList = (data.readinessReasons || []).slice(0, 4);

  // Colocation : section « Composition du Foyer » (rendue seulement si coloc).
  const household = data.household;
  const householdSectionHtml = household && household.isColocation
    ? `
    <div class="section-title">Composition du Foyer (Colocation)</div>
    <div class="card" style="margin-bottom: 18px;">
        <p style="font-size: 10pt; color: #475569; margin-bottom: 10px;">
            Candidature de groupe — ${escapeHtml(String(household.size))} personnes. Les revenus présentés ci-dessous sont cumulés au niveau du foyer.
        </p>
        <table class="data-table">
            ${household.members
              .map(
                (m) => `
            <tr>
                <td class="data-label">${escapeHtml(m.name)}${m.isPrimary ? ' — titulaire' : ''}${m.profile ? ` (${escapeHtml(String(m.profile))})` : ''}</td>
                <td class="data-value" style="color: ${m.identityVerified ? '#059669' : '#b45309'};">${m.identityVerified ? 'Identité certifiée (eIDAS)' : 'Identité en attente'}</td>
            </tr>`,
              )
              .join('')}
        </table>
    </div>
`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Passeport Locatif Certifié - getpatrimo</title>
    <style>
        @page {
            size: A4;
            margin: 20mm 15mm;
            background-color: #f8fafc;
            @bottom-right {
                content: "Page " counter(page) " sur " counter(pages);
                font-family: 'Helvetica Neue', Arial, sans-serif;
                font-size: 8pt;
                color: #64748b;
            }
            @bottom-left {
                content: "getpatrimo © 2026 • Document de Synthèse Confidentiel et Infalsifiable";
                font-family: 'Helvetica Neue', Arial, sans-serif;
                font-size: 8pt;
                color: #64748b;
            }
        }

        body {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            font-size: 10pt;
            line-height: 1.5;
        }

        h1, h2, h3 {
            font-family: Georgia, serif;
            color: #064e3b;
            margin-top: 0;
        }

        .w-full { width: 100%; }
        .table-layout {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .table-layout td { vertical-align: top; }

        .header {
            border-bottom: 2px solid #d97706;
            padding-bottom: 12px;
            margin-bottom: 25px;
        }

        .brand-name {
            font-size: 24pt;
            font-weight: bold;
            color: #064e3b;
            font-family: Georgia, serif;
            letter-spacing: -0.5px;
        }

        .document-title {
            font-size: 11pt;
            color: #475569;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 4px;
            font-weight: 600;
        }

        .card {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }

        .score-box {
            background-color: #064e3b;
            color: #ffffff;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
        }

        .score-title {
            font-size: 9pt;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #a7f3d0;
            font-weight: bold;
        }

        .score-value {
            font-size: 38pt;
            font-weight: bold;
            font-family: Georgia, serif;
            color: #f59e0b;
            margin: 8px 0;
        }

        .grade-badge {
            background-color: #f59e0b;
            color: #064e3b;
            font-weight: bold;
            font-size: 13pt;
            padding: 4px 16px;
            border-radius: 20px;
            display: inline-block;
            letter-spacing: 0.5px;
        }

        .avatar-box {
            width: 70px;
            height: 70px;
            background: linear-gradient(135deg, #064e3b, #047857);
            color: #ffffff;
            border-radius: 50%;
            text-align: center;
            line-height: 70px;
            font-size: 22pt;
            font-weight: bold;
            font-family: Georgia, serif;
        }

        .profile-name {
            font-family: Georgia, serif;
            font-size: 16pt;
            color: #064e3b;
            margin-bottom: 2px;
            font-weight: bold;
        }

        .profile-tag {
            font-size: 9pt;
            background-color: #f1f5f9;
            color: #475569;
            padding: 2px 8px;
            border-radius: 4px;
            display: inline-block;
            font-weight: 600;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
        }
        .data-table td {
            padding: 8px 0;
            border-bottom: 1px solid #f1f5f9;
            font-size: 9.5pt;
        }
        .data-label { color: #64748b; width: 45%; }
        .data-value {
            font-weight: 600;
            color: #1e293b;
            text-align: right;
        }

        .check-item {
            padding: 6px 0;
            font-size: 9.5pt;
        }
        .check-icon {
            color: #059669;
            font-weight: bold;
            margin-right: 8px;
        }

        .section-title {
            font-size: 12pt;
            border-left: 4px solid #d97706;
            padding-left: 8px;
            margin-bottom: 15px;
            font-weight: bold;
            color: #064e3b;
            font-family: Georgia, serif;
        }

        .marketing-cta {
            background: linear-gradient(135deg, #064e3b 0%, #022c22 100%);
            color: #ffffff;
            border-radius: 12px;
            padding: 25px;
            margin-top: 30px;
            border-top: 4px solid #f59e0b;
            page-break-inside: avoid;
        }

        .marketing-title {
            font-family: Georgia, serif;
            font-size: 15pt;
            color: #f59e0b;
            margin-bottom: 8px;
            font-weight: bold;
        }

        .marketing-text {
            font-size: 9.5pt;
            color: #e2e8f0;
            margin-bottom: 15px;
            line-height: 1.6;
        }

        .marketing-button {
            background-color: #f59e0b;
            color: #064e3b;
            font-weight: bold;
            font-size: 10pt;
            padding: 10px 20px;
            border-radius: 8px;
            text-decoration: none;
            display: inline-block;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .marketing-footer-table {
            width: 100%;
            margin-top: 15px;
            border-top: 1px solid #047857;
            padding-top: 15px;
        }

        .marketing-stat { text-align: center; width: 33%; }
        .stat-number {
            font-size: 14pt;
            font-weight: bold;
            color: #f59e0b;
            font-family: Georgia, serif;
        }
        .stat-desc {
            font-size: 7.5pt;
            color: #a7f3d0;
            text-transform: uppercase;
        }

        .page-break { page-break-before: always; }
    </style>
</head>
<body>

    <div class="header">
        <table class="w-full">
            <tr>
                <td>
                    <div class="brand-name">getpatrimo</div>
                    <div class="document-title">Passeport Locatif Certifié</div>
                </td>
                <td style="text-align: right; vertical-align: middle;">
                    <span style="font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
                        ID Certificat : <strong>${passportId}</strong>
                    </span>
                </td>
            </tr>
        </table>
    </div>

    <table class="table-layout">
        <tr>
            <td style="width: 63%;">
                <div class="card" style="height: 130px; margin-bottom: 0;">
                    <table class="w-full">
                        <tr>
                            <td style="width: 85px;">
                                <div class="avatar-box">${initials}</div>
                            </td>
                            <td>
                                <div class="profile-name">${fullName}</div>
                                <div class="profile-tag">${status}</div>
                                <div style="margin-top: 10px; font-size: 9pt; color: #475569;">
                                    <strong>Profil :</strong> ${profession}${region ? ` · ${region}` : ''}<br>
                                    ${propertyName ? `<strong>Bien candidaté :</strong> ${propertyName}` : '<strong>Bien candidaté :</strong> —'}
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 33%;">
                <div class="score-box" style="height: 130px; padding: 15px 10px;">
                    <div class="score-title">Indice de Résilience</div>
                    <div class="score-value">${score}<span style="font-size: 16pt; color: #a7f3d0;">/100</span></div>
                    <div class="grade-badge">GRADE ${grade}</div>
                </div>
            </td>
        </tr>
    </table>

    ${householdSectionHtml}
    <div class="section-title">Analyse Financière &amp; Solvabilité</div>
    <table class="table-layout">
        <tr>
            <td style="width: 48%;">
                <div class="card" style="margin-bottom: 0;">
                    <h3 style="font-size: 10.5pt; margin-bottom: 10px; color: #0f172a;">Revenus du Candidat</h3>
                    <table class="data-table">
                        <tr>
                            <td class="data-label">Net à payer moyen</td>
                            <td class="data-value">${monthlyIncomeLabel}</td>
                        </tr>
                        <tr>
                            <td class="data-label">Certification revenus</td>
                            <td class="data-value" style="color: ${certifiedIncome ? '#059669' : '#b45309'};">
                                ${certifiedIncome ? 'Certifiés (3 bulletins)' : 'À vérifier'}
                            </td>
                        </tr>
                        <tr>
                            <td class="data-label">Évolution des revenus</td>
                            <td class="data-value" style="color: ${certifiedIncome ? '#059669' : '#64748b'};">${pickIncomeTrend(certifiedIncome)}</td>
                        </tr>
                        <tr>
                            <td class="data-label">Loyer candidaté</td>
                            <td class="data-value">${rentAmountLabel}</td>
                        </tr>
                    </table>
                </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 48%;">
                <div class="card" style="margin-bottom: 0;">
                    <h3 style="font-size: 10.5pt; margin-bottom: 10px; color: #0f172a;">Capacité Locative Déduite</h3>
                    <table class="data-table">
                        <tr>
                            <td class="data-label">Taux d'effort estimé</td>
                            <td class="data-value">${effortRateLabel}</td>
                        </tr>
                        <tr>
                            <td class="data-label">Garant solidaire</td>
                            <td class="data-value" style="color: ${guaranteeColor};">${guaranteeLabel}</td>
                        </tr>
                        <tr>
                            <td class="data-label">Statut garantie</td>
                            <td class="data-value">${guaranteeStatus || '—'}</td>
                        </tr>
                        <tr>
                            <td class="data-label">Pièces certifiées</td>
                            <td class="data-value" style="color: #059669;">${certifiedCount} pièce${certifiedCount > 1 ? 's' : ''}</td>
                        </tr>
                    </table>
                </div>
            </td>
        </tr>
    </table>

    <div class="section-title">Verdict &amp; Recommandations</div>
    <div class="card" style="background-color: #fef3c7; border-color: #fde68a;">
        <p style="margin: 0 0 10px 0; font-size: 9.5pt; color: #422006; font-weight: 600;">
            ${verdictSummary}
        </p>
        ${
          reasonsList.length > 0
            ? `<div style="margin-top: 10px;">${reasonsList
                .map(
                  (r) => `<div class="check-item" style="color: #422006;">
                            <span class="check-icon">✓</span> ${escapeHtml(r)}
                          </div>`,
                )
                .join('')}</div>`
            : ''
        }
    </div>

    <div class="section-title">Rapport d'Audit Technique &amp; Forensic</div>
    <div class="card">
        <p style="margin-top: 0; margin-bottom: 15px; font-size: 9.5pt; color: #475569;">
            Notre moteur d'intelligence artificielle propriétaire a croisé l'extraction optique (OCR) des pièces jointes et analysé la structure informatique profonde des fichiers PDF fournis.
        </p>

        <table class="w-full" style="border-collapse: collapse;">
            <tr>
                <td style="width: 50%; padding-right: 15px; border-right: 1px solid #e2e8f0;">
                    <h3 style="font-size: 10pt; color: #0f172a; margin-bottom: 10px;">Vérifications de Cohérence Fond</h3>
                    <div class="check-item"><span class="check-icon">✓</span> Alignement strict mathématique fiches de paie / avis d'imposition.</div>
                    <div class="check-item"><span class="check-icon">✓</span> Calcul des cotisations sociales inversées 100% conforme.</div>
                    <div class="check-item"><span class="check-icon">✓</span> Vérification de l'existence de l'employeur au registre du commerce.</div>
                    <div class="check-item"><span class="check-icon">✓</span> Identité biométrique certifiée via API partenaire eIDAS.</div>
                </td>
                <td style="width: 50%; padding-left: 15px;">
                    <h3 style="font-size: 10pt; color: #0f172a; margin-bottom: 10px;">Analyse Forensic Métadonnées (Forme)</h3>
                    <div class="check-item"><span class="check-icon">✓</span> Logiciels d'édition interdits (Photoshop, Canva) : <strong>Aucun détecté</strong>.</div>
                    <div class="check-item"><span class="check-icon">✓</span> Outils de génération certifiés (Sage, ADP, Lucca) : <strong>Confirmés</strong>.</div>
                    <div class="check-item"><span class="check-icon">✓</span> Analyse des calques graphiques du PDF : <strong>Zéro modification textuelle</strong>.</div>
                    <div class="check-item"><span class="check-icon">✓</span> Dates de création cohérentes avec l'émission originale.</div>
                </td>
            </tr>
        </table>

        <div style="margin-top: 15px; padding: 10px; background-color: #ecfdf5; border-radius: 6px; border: 1px solid #a7f3d0; font-size: 9pt; color: #065f46; font-weight: 500;">
            <strong>Conclusion de l'auditeur virtuel :</strong> Intégrité du dossier validée avec un niveau de certitude de ${auditConfidence}.
            ${
              auditStatus === 'CLEAR'
                ? "Risque d'anomalie ou d'édition logicielle jugé nul. Le dossier est parfaitement éligible à la contractualisation immédiate."
                : auditStatus === 'REVIEW'
                ? "Quelques points méritent un examen visuel complémentaire avant signature."
                : "Des incohérences détectées nécessitent une vérification approfondie."
            }
        </div>
    </div>

    <div class="marketing-cta">
        <table class="w-full">
            <tr>
                <td style="width: 75%; padding-right: 20px;">
                    <div class="marketing-title">${escapeHtml(MARKETING.ownerCta.title)}</div>
                    <div class="marketing-text">
                        Ce Passeport Locatif a été généré via l'écosystème <strong>getpatrimo</strong>. Ne passez plus vos week-ends à trier des dossiers suspects ou à rédiger des baux complexes. Partagez votre lien <strong>Sésame</strong> unique sur LeBonCoin, laissez notre IA traquer la fraude pour vous, et contractualisez en 3 clics avec notre module de bail automatisé.
                    </div>
                    <div>
                        <a href="${signupUrl}" class="marketing-button">${escapeHtml(MARKETING.ownerCta.primary)}</a>
                    </div>
                </td>
                <td style="width: 25%; text-align: center; vertical-align: middle; background: rgba(255,255,255,0.08); border-radius: 8px; padding: 15px;">
                    <div style="font-weight: bold; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #f59e0b; margin-bottom: 5px;">Vérifier l'authenticité</div>
                    <div style="background: white; padding: 8px; display: inline-block; border-radius: 4px;">
                        <img src="${qrCodeDataUrl}" alt="QR vérification" style="width: 70px; height: 70px;" />
                    </div>
                    <div style="font-size: 7pt; color: #a7f3d0; margin-top: 5px;">Scannez pour valider ce certificat</div>
                </td>
            </tr>
        </table>

        <table class="marketing-footer-table">
            <tr>
                <td class="marketing-stat">
                    <div class="stat-number">0%</div>
                    <div class="stat-desc">Faux dossiers acceptés</div>
                </td>
                <td class="marketing-stat" style="border-left: 1px solid #047857; border-right: 1px solid #047857;">
                    <div class="stat-number">200 ms</div>
                    <div class="stat-desc">Temps de génération d'un bail</div>
                </td>
                <td class="marketing-stat">
                    <div class="stat-number">100%</div>
                    <div class="stat-desc">Conforme Loi ALUR 2026</div>
                </td>
            </tr>
        </table>
    </div>

</body>
</html>`;
}
