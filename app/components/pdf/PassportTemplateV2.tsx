/**
 * <PassportTemplateV2> — Template React du Passeport Locatif (Rapport d'Audit).
 *
 * Refonte "Banque Privée / Rapport d'Audit" : document structuré en 2 parties.
 *   • PAGE 1 — Rapport Exécutif :
 *       Header → BLOC 1 Mot du Locataire → BLOC 2 Synthèse Exécutive (Candidat |
 *       Caution) → BLOC 3 Indice de Résilience & IA → BLOC 4 Audit Forensic.
 *   • PAGE 2 — Annexe Documentaire :
 *       "Annexe : Pièces Justificatives (Accès Sécurisé)" — liens regroupés par
 *       catégorie (Identité & Domicile / Ressources / Garant), libellés propres.
 *
 * La liste des pièces ne figure JAMAIS sur la page 1 (elle vit en annexe).
 *
 * Pipeline de génération :
 *   <PassportTemplateV2 {...props} /> → renderToStaticMarkup() = HTML
 *     → wrapAsHtmlDocument(markup) → WeasyPrint subprocess → PDF A4 multi-pages.
 *
 * Note : pas de Tailwind (WeasyPrint ne résout pas les classes utilitaires).
 * Tout en attributs `style` ou via la stylesheet inline {@link PASSPORT_V2_CSS}.
 */

import * as React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Lien legacy (conservé pour compat d'API ; le rendu utilise `annexeSections`). */
export interface PassportV2SmartLink {
  id?: string;
  type?: string;
  label: string;
  href: string;
}

/** Un lien de pièce justificative (annexe), au libellé propre. */
export interface PassportV2AnnexeLink {
  /** Libellé propre du document (type métier, jamais le nom de fichier brut). */
  label: string;
  /** URL absolue d'accès sécurisé (UTM-taggée). */
  href: string;
}

/** Une section catégorisée de l'annexe documentaire. */
export interface PassportV2AnnexeSection {
  /** Titre de section (ex: "Identité & Domicile"). */
  title: string;
  links: PassportV2AnnexeLink[];
}

export interface PassportTemplateV2Props {
  /** Identifiant lisible du passeport (ex: "PT-2026-8942A") */
  passportId: string;
  /** Date de génération formatée (ex: "27/05/2026") */
  generatedAt: string;

  /** Identité candidat */
  candidate: {
    initials: string;
    fullName: string;
    profession: string;
    employer?: string | null;
    seniority?: string | null;
  };

  /** BLOC 1 — Mot du locataire (présentation libre, optionnel). */
  presentationText?: string | null;

  /** Score + grade */
  score: number;
  gradeLabel: string;
  /** Niveau institutionnel "carte premium" (PLATINUM/GOLD/SILVER/ALERTE). */
  metalLevel?: 'PLATINUM' | 'GOLD' | 'SILVER' | 'ALERTE';

  /** BLOC 2 gauche — Le Candidat (toutes valeurs formatées en strings). */
  financials: {
    monthlyIncomeLabel: string;
    taxIncomeLabel?: string | null;
    stabilityLabel?: string | null;
    maxRentLabel: string;
  };

  /** BLOC 2 droite — La Caution / Garant. */
  guarantor: {
    hasGuarantor: boolean;
    typeLabel: string;
    name?: string | null;
    incomeLabel?: string | null;
    statusLabel?: string | null;
  };

  /** BLOC 3 — Avis textuel de l'IA (HTML, italique, sans CTA). */
  aiVerdictHtml: string;

  /** BLOC 4 — Checks forensic 2 colonnes (legacy V1). */
  forensicChecks: {
    left: string[];
    right: string[];
  };

  /**
   * BLOC 4 (optionnel) — Trust-List enrichie (analyse neuro-symbolique).
   * Si fournie ET non vide, REMPLACE le rendu legacy `forensicChecks`.
   * Source : Application.aiAuditV2.ai.forensicAudit
   */
  forensicAudit?: Array<{
    checkName: string;
    status: 'VERIFIED' | 'WARNING' | 'ALERT';
    details: string;
  }>;

  /** PAGE 2 — Annexe documentaire (liens regroupés par catégorie). */
  annexeSections: PassportV2AnnexeSection[];

  /** URL d'inscription owner (UTM-taggée) — CTA d'acquisition (fin d'annexe). */
  signupUrl: string;

  /** Domaine pour le footer (ex: "maisonpatrimo.com") */
  brandDomain: string;
}

// ─── CSS Stylesheet (inline pour WeasyPrint) ─────────────────────────────────
// Charte stricte : Émeraude (#064e3b/#047857), Or brossé (#d97706/#f59e0b),
// Gris Ardoise (#0f172a/#334155/#475569/#64748b). Beaucoup de whitespace.

export const PASSPORT_V2_CSS = `
@page {
  size: A4;
  margin: 14mm 15mm;
  background-color: #ffffff;
  @bottom-left {
    content: var(--footer-left, "Maison Patrimo © 2026 • Document Confidentiel et Infalsifiable");
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 7.5pt;
    color: #94a3b8;
  }
  @bottom-right {
    content: var(--footer-right, "");
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 7.5pt;
    color: #94a3b8;
  }
}
body {
  margin: 0;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #1e293b;
  font-size: 9pt;
  line-height: 1.45;
}
h1, h2, h3 { font-family: Georgia, serif; color: #064e3b; margin-top: 0; }
.w-full { width: 100%; }
.table-layout { width: 100%; border-collapse: collapse; }

/* ── Header ─────────────────────────────────────────────────────────────── */
.header { border-bottom: 2px solid #d97706; padding-bottom: 10px; margin-bottom: 20px; }
.brand-lockup { display: inline-block; }
.brand-seal { display: inline-block; vertical-align: middle; }
.brand-wordmark { display: inline-block; vertical-align: middle; margin-left: 11px; }
.brand-maison { display: block; font-size: 7pt; letter-spacing: 3.5px; text-transform: uppercase; color: #475569; font-weight: 600; line-height: 1; margin-bottom: 2px; }
.brand-patrimo { display: block; font-size: 21pt; font-weight: bold; color: #064e3b; font-family: Georgia, serif; line-height: 0.85; letter-spacing: -0.3px; }
.brand-patrimo--sm { font-size: 14pt; }
.document-title { font-size: 8.5pt; color: #475569; text-transform: uppercase; letter-spacing: 2px; font-weight: 600; margin-top: 2px; }
.header-meta { font-size: 8pt; color: #64748b; line-height: 1.6; }
.header-candidate { font-size: 11pt; font-family: Georgia, serif; color: #064e3b; font-weight: bold; }

/* ── Sections ──────────────────────────────────────────────────────────── */
.section-title { font-size: 12pt; border-left: 3px solid #d97706; padding-left: 10px; margin: 0 0 12px 0; font-weight: bold; color: #064e3b; font-family: Georgia, serif; }
.card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
.block-spacer { height: 22px; }

/* ── BLOC 1 — Mot du locataire (citation) ──────────────────────────────── */
.presentation-quote {
  background-color: #f8fafc;
  border-left: 4px solid #047857;
  border-radius: 0 8px 8px 0;
  padding: 13px 18px;
  color: #334155;
  font-style: italic;
  font-size: 9.5pt;
  line-height: 1.6;
}
.presentation-quote .quote-label {
  display: block;
  font-style: normal;
  font-size: 7pt;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #047857;
  font-weight: bold;
  margin-bottom: 5px;
}
.presentation-quote .quote-glyph { font-family: Georgia, serif; color: #047857; font-style: normal; }

/* ── BLOC 2 — Synthèse Exécutive (2 colonnes) ──────────────────────────── */
.synthese-table { width: 100%; border-collapse: collapse; }
.synthese-table td { vertical-align: top; }
.col-header { font-family: Georgia, serif; font-size: 9.5pt; font-weight: bold; color: #047857; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.synthese-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 13px; min-height: 118px; }
.identity-line { margin-bottom: 8px; }
.avatar-box {
  width: 38px; height: 38px;
  background: linear-gradient(135deg, #064e3b, #047857);
  color: #ffffff; border-radius: 50%;
  text-align: center; line-height: 38px;
  font-size: 12pt; font-weight: bold; font-family: Georgia, serif;
}
.identity-name { font-family: Georgia, serif; font-size: 12pt; color: #064e3b; font-weight: bold; line-height: 1.1; }
.identity-sub { font-size: 8pt; color: #64748b; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 8.5pt; }
.data-table tr:last-child td { border-bottom: none; }
.data-label { color: #64748b; width: 52%; }
.data-value { font-weight: 600; color: #1e293b; text-align: right; }
.data-value.accent { color: #047857; }
.no-guarantor { color: #94a3b8; font-style: italic; font-size: 9pt; text-align: center; padding: 28px 8px; }

/* ── BLOC 3 — Indice de Résilience & IA ────────────────────────────────── */
.score-box { background-color: #064e3b; color: #ffffff; padding: 14px 10px; border-radius: 8px; text-align: center; }
.score-box .score-eyebrow { font-size: 7pt; text-transform: uppercase; color: #a7f3d0; font-weight: bold; letter-spacing: 1px; }
.score-value { font-size: 34pt; font-weight: bold; font-family: Georgia, serif; color: #f59e0b; margin: 2px 0; line-height: 1; }
.score-value .score-sub { font-size: 13pt; color: #a7f3d0; }
.grade-badge { background-color: #f59e0b; color: #064e3b; font-weight: bold; font-size: 11pt; padding: 2px 12px; border-radius: 15px; display: inline-block; }
.metal-badge { font-weight: bold; font-size: 11pt; padding: 3px 14px; border-radius: 15px; display: inline-block; letter-spacing: 2px; text-transform: uppercase; }
.metal-platinum { background: #0f172a; color: #f59e0b; border: 1px solid #f59e0b; }
.metal-gold { background-color: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
.metal-silver { background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
.metal-alerte { background-color: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
.ai-verdict-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
.ai-verdict-label { font-size: 8pt; font-weight: bold; color: #064e3b; margin-bottom: 6px; }
.ai-verdict { color: #334155; font-size: 9.5pt; line-height: 1.6; }
.ai-verdict em { font-style: italic; color: #1e293b; }

/* ── BLOC 4 — Audit Forensic ───────────────────────────────────────────── */
.forensic-audit-table { width: 100%; border-collapse: collapse; }
.forensic-audit-table tr.forensic-row { border-bottom: 1px solid #f1f5f9; }
.forensic-audit-table tr.forensic-row:last-child { border-bottom: none; }
.forensic-symbol { width: 24px; padding: 6px 4px 6px 0; vertical-align: top; font-weight: bold; font-size: 11pt; text-align: center; }
.forensic-content { padding: 6px 8px; vertical-align: top; }
.forensic-name { font-size: 8.5pt; font-weight: bold; color: #0f172a; margin-bottom: 1px; }
.forensic-details { font-size: 7.5pt; color: #475569; line-height: 1.3; }
.forensic-status { width: 60px; padding: 6px 0 6px 4px; vertical-align: middle; font-size: 6.5pt; font-weight: bold; text-align: right; letter-spacing: 1px; }
.forensic-row.forensic-verified .forensic-symbol, .forensic-row.forensic-verified .forensic-status { color: #059669; }
.forensic-row.forensic-warning .forensic-symbol, .forensic-row.forensic-warning .forensic-status { color: #d97706; }
.forensic-row.forensic-alert .forensic-symbol, .forensic-row.forensic-alert .forensic-status { color: #dc2626; }
.check-item { padding: 3px 0; font-size: 8pt; }
.check-icon { color: #059669; font-weight: bold; margin-right: 5px; }

/* ── PAGE 2 — Annexe documentaire ──────────────────────────────────────── */
.page-break { page-break-before: always; }
.annexe-intro { font-size: 8.5pt; color: #475569; line-height: 1.5; margin: 0 0 18px 0; }
.annexe-section { margin-bottom: 18px; }
.annexe-section-title { font-family: Georgia, serif; font-size: 10pt; font-weight: bold; color: #064e3b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 8px; }
.annexe-row { width: 100%; border-collapse: collapse; }
.annexe-row td { padding: 7px 0; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.annexe-doc-type { font-size: 9pt; font-weight: 600; color: #334155; }
.annexe-link { color: #047857; font-size: 8.5pt; font-weight: bold; text-decoration: none; white-space: nowrap; }
.annexe-empty { font-size: 8pt; color: #94a3b8; font-style: italic; padding: 4px 0; }

/* ── CTA acquisition (fin d'annexe) ────────────────────────────────────── */
.marketing-banner {
  background: linear-gradient(135deg, #064e3b 0%, #022c22 100%);
  color: #ffffff; border-radius: 8px; padding: 16px;
  margin-top: 24px; border-top: 3px solid #f59e0b;
}
.marketing-title { font-family: Georgia, serif; font-size: 12pt; color: #f59e0b; margin-bottom: 4px; font-weight: bold; }
.marketing-text { font-size: 8.5pt; color: #e2e8f0; margin-bottom: 10px; line-height: 1.4; }
.marketing-button { background-color: #f59e0b; color: #064e3b; font-weight: bold; font-size: 9pt; padding: 8px 16px; border-radius: 6px; text-decoration: none; display: inline-block; }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Avis IA legacy (avec CTA pièces). Conservé pour compat d'API ; le rendu
 * exécutif utilise {@link buildAiVerdict} (verdict italique seul).
 */
export function buildAiComment(score: number): string {
  return buildAiVerdict(score);
}

/**
 * Avis textuel de l'IA selon le score — verdict en italique, SANS CTA.
 * Retourne du HTML (balises em) pour dangerouslySetInnerHTML. Contenu encodé
 * côté serveur (pas d'input utilisateur ici) → safe.
 */
export function buildAiVerdict(score: number): string {
  const safe = Math.max(0, Math.min(100, Math.round(score || 0)));
  if (safe >= 85) {
    return (
      `<em>« Dossier d'excellence. L'intégrité des revenus et de l'identité ` +
      `est totale. Risque de défaut historiquement nul. »</em>`
    );
  }
  if (safe >= 60) {
    return (
      `<em>« Dossier solide. Les flux de revenus sont cohérents et la garantie ` +
      `est correcte. Quelques points secondaires restent à examiner. »</em>`
    );
  }
  return (
    `<em>« Vigilance requise. Des incohérences ont été détectées dans le dossier. ` +
    `Une vérification manuelle approfondie est recommandée. »</em>`
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function PassportTemplateV2({
  passportId,
  generatedAt,
  candidate,
  presentationText,
  score,
  gradeLabel,
  metalLevel,
  financials,
  guarantor,
  aiVerdictHtml,
  forensicChecks,
  forensicAudit,
  annexeSections,
  signupUrl,
  brandDomain,
}: PassportTemplateV2Props): React.ReactElement {
  const safeScore = Math.max(0, Math.min(100, Math.round(score || 0)));
  const useV2Audit = Array.isArray(forensicAudit) && forensicAudit.length > 0;
  const presentation = (presentationText || '').trim();
  const sections = Array.isArray(annexeSections) ? annexeSections : [];

  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <title>Passeport Locatif Certifié — Maison Patrimo</title>
        <style dangerouslySetInnerHTML={{ __html: PASSPORT_V2_CSS }} />
      </head>
      <body
        style={{
          ['--footer-left' as string]: `"MAISON PATRIMO · ${brandDomain} © 2026 • Document Confidentiel et Infalsifiable"`,
          ['--footer-right' as string]: `"ID: ${passportId}"`,
        }}
      >
        {/* ═══════════ PAGE 1 — RAPPORT EXÉCUTIF ═══════════ */}

        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="header">
          <table className="w-full">
            <tbody>
              <tr>
                <td>
                  <span className="brand-lockup">
                    <svg className="brand-seal" width="44" height="44" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M50 10 L85 22 V50 C85 75 50 92 50 92 C50 92 15 75 15 50 V22 Z" fill="#064E3B" />
                      <path d="M50 16 L79 26 V49 C79 70 50 84 50 84 C50 84 21 70 21 49 V26 Z" stroke="#F59E0B" strokeWidth="1.5" strokeOpacity="0.4" />
                      <path d="M32 62 V36 L50 50 L68 36 V62" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M68 36 H74 C78 36 81 39 81 43 C81 47 78 50 74 50 H68" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="50" cy="74" r="3.5" fill="#F59E0B" />
                    </svg>
                    <span className="brand-wordmark">
                      <span className="brand-maison">Maison</span>
                      <span className="brand-patrimo">Patrimo</span>
                    </span>
                  </span>
                  <div className="document-title" style={{ marginTop: '9px' }}>Passeport Locatif Certifié</div>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'top' }}>
                  <div className="header-candidate">{candidate.fullName}</div>
                  <div className="header-meta">
                    Généré le {generatedAt}
                    <br />
                    Réf. {passportId}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── BLOC 1 — Le Mot du Locataire ───────────────────────── */}
        {presentation ? (
          <>
            <div className="presentation-quote">
              <span className="quote-label">Le Mot du Locataire</span>
              <span className="quote-glyph">«&nbsp;</span>
              {presentation}
              <span className="quote-glyph">&nbsp;»</span>
            </div>
            <div className="block-spacer" />
          </>
        ) : null}

        {/* ─── BLOC 2 — Synthèse Exécutive ────────────────────────── */}
        <div className="section-title">Synthèse Exécutive</div>
        <table className="synthese-table">
          <tbody>
            <tr>
              {/* Colonne gauche — Le Candidat */}
              <td style={{ width: '48%' }}>
                <div className="col-header">Le Candidat</div>
                <div className="synthese-card">
                  <table className="w-full identity-line">
                    <tbody>
                      <tr>
                        <td style={{ width: '46px' }}>
                          <div className="avatar-box">{candidate.initials}</div>
                        </td>
                        <td>
                          <div className="identity-name">{candidate.fullName}</div>
                          <div className="identity-sub">{candidate.profession}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <table className="data-table">
                    <tbody>
                      <tr>
                        <td className="data-label">Statut professionnel</td>
                        <td className="data-value">{candidate.profession}</td>
                      </tr>
                      {candidate.employer ? (
                        <tr>
                          <td className="data-label">Employeur</td>
                          <td className="data-value">{candidate.employer}</td>
                        </tr>
                      ) : null}
                      <tr>
                        <td className="data-label">Revenus nets mensuels</td>
                        <td className="data-value accent">{financials.monthlyIncomeLabel}</td>
                      </tr>
                      <tr>
                        <td className="data-label">Loyer Max Conseillé CC</td>
                        <td className="data-value">{financials.maxRentLabel}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
              <td style={{ width: '4%' }} />
              {/* Colonne droite — La Caution / Garant */}
              <td style={{ width: '48%' }}>
                <div className="col-header">La Caution / Garant</div>
                <div className="synthese-card">
                  {guarantor.hasGuarantor ? (
                    <table className="data-table">
                      <tbody>
                        {guarantor.name ? (
                          <tr>
                            <td className="data-label">Garant</td>
                            <td className="data-value">{guarantor.name}</td>
                          </tr>
                        ) : null}
                        <tr>
                          <td className="data-label">Type de garantie</td>
                          <td className="data-value accent">{guarantor.typeLabel}</td>
                        </tr>
                        {guarantor.statusLabel ? (
                          <tr>
                            <td className="data-label">Statut</td>
                            <td className="data-value">{guarantor.statusLabel}</td>
                          </tr>
                        ) : null}
                        <tr>
                          <td className="data-label">Revenus nets du garant</td>
                          <td className="data-value">{guarantor.incomeLabel || 'Non communiqués'}</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div className="no-guarantor">Aucun garant déclaré</div>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="block-spacer" />

        {/* ─── BLOC 3 — Indice de Résilience & Analyse IA ─────────── */}
        <div className="section-title">Indice de Résilience &amp; Analyse IA</div>
        <table className="synthese-table">
          <tbody>
            <tr>
              <td style={{ width: '32%' }}>
                <div className="score-box">
                  <div className="score-eyebrow">Indice de Résilience</div>
                  <div className="score-value">
                    {safeScore}
                    <span className="score-sub">/100</span>
                  </div>
                  {metalLevel ? (
                    <div className={`metal-badge metal-${metalLevel.toLowerCase()}`}>
                      {metalLevel === 'PLATINUM' ? '★ ' : ''}
                      {metalLevel}
                    </div>
                  ) : (
                    <div className="grade-badge">{gradeLabel}</div>
                  )}
                </div>
              </td>
              <td style={{ width: '4%' }} />
              <td style={{ width: '64%' }}>
                <div className="ai-verdict-card">
                  <div className="ai-verdict-label">🎯 Avis de l&apos;Intelligence Artificielle</div>
                  <div className="ai-verdict" dangerouslySetInnerHTML={{ __html: aiVerdictHtml }} />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="block-spacer" />

        {/* ─── BLOC 4 — Audit Technique & Forensic ────────────────── */}
        <div className="section-title">Audit Technique &amp; Forensic (Anti-Fraude)</div>
        <div className="card">
          {useV2Audit ? (
            <table className="forensic-audit-table">
              <tbody>
                {forensicAudit!.map((item, idx) => {
                  const symbol =
                    item.status === 'VERIFIED' ? '✓' : item.status === 'WARNING' ? '⚠' : '✕';
                  return (
                    <tr key={`audit-${idx}`} className={`forensic-row forensic-${item.status.toLowerCase()}`}>
                      <td className="forensic-symbol">{symbol}</td>
                      <td className="forensic-content">
                        <div className="forensic-name">{item.checkName}</div>
                        <div className="forensic-details">{item.details}</div>
                      </td>
                      <td className="forensic-status">{item.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <tbody>
                <tr>
                  <td style={{ width: '50%', paddingRight: '10px', borderRight: '1px solid #e2e8f0' }}>
                    {forensicChecks.left.map((check, idx) => (
                      <div className="check-item" key={`left-${idx}`}>
                        <span className="check-icon">✓</span> {check}
                      </div>
                    ))}
                  </td>
                  <td style={{ width: '50%', paddingLeft: '10px' }}>
                    {forensicChecks.right.map((check, idx) => (
                      <div className="check-item" key={`right-${idx}`}>
                        <span className="check-icon">✓</span> {check}
                      </div>
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* ═══════════ PAGE 2 — ANNEXE DOCUMENTAIRE ═══════════ */}
        <div className="page-break" />
        <div className="header">
          <table className="w-full">
            <tbody>
              <tr>
                <td>
                  <span className="brand-lockup">
                    <svg className="brand-seal" width="26" height="26" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M50 10 L85 22 V50 C85 75 50 92 50 92 C50 92 15 75 15 50 V22 Z" fill="#064E3B" />
                      <path d="M50 16 L79 26 V49 C79 70 50 84 50 84 C50 84 21 70 21 49 V26 Z" stroke="#F59E0B" strokeWidth="1.5" strokeOpacity="0.4" />
                      <path d="M32 62 V36 L50 50 L68 36 V62" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M68 36 H74 C78 36 81 39 81 43 C81 47 78 50 74 50 H68" stroke="#F59E0B" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="50" cy="74" r="3.5" fill="#F59E0B" />
                    </svg>
                    <span className="brand-wordmark">
                      <span className="brand-maison">Maison</span>
                      <span className="brand-patrimo brand-patrimo--sm">Patrimo</span>
                    </span>
                  </span>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                  <span className="header-meta">{candidate.fullName} — Réf. {passportId}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="section-title">Annexe : Pièces Justificatives (Accès Sécurisé)</div>
        <p className="annexe-intro">
          Pour protéger les données du candidat, les pièces justificatives sont scellées et
          horodatées. Chaque lien ci-dessous ouvre l&apos;original avec filigrane dans un espace
          sécurisé, sans téléchargement local. L&apos;accès est tracé et révocable.
        </p>

        {sections.map((section, sIdx) => (
          <div className="annexe-section" key={`section-${sIdx}`}>
            <div className="annexe-section-title">{section.title}</div>
            {section.links.length > 0 ? (
              <table className="annexe-row">
                <tbody>
                  {section.links.map((link, lIdx) => (
                    <tr key={`link-${sIdx}-${lIdx}`}>
                      <td>
                        <span className="annexe-doc-type">{link.label}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <a href={link.href} className="annexe-link">
                          [ Ouvrir le document sécurisé ]
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="annexe-empty">Aucune pièce dans cette catégorie.</div>
            )}
          </div>
        ))}

        {/* ─── CTA acquisition propriétaire (fin d'annexe) ────────── */}
        <div className="marketing-banner">
          <table className="w-full">
            <tbody>
              <tr>
                <td style={{ width: '70%', paddingRight: '15px' }}>
                  <div className="marketing-title">Propriétaires : Ne laissez pas passer ce dossier.</div>
                  <div className="marketing-text">
                    Connectez-vous pour consulter les pièces, ajouter ce candidat à votre sélection,
                    générer le bail pré-rempli loi ALUR en 3 clics et accéder au coffre-fort numérique.
                  </div>
                </td>
                <td style={{ width: '30%', textAlign: 'right', verticalAlign: 'middle' }}>
                  <a href={signupUrl} className="marketing-button">
                    Créer mon compte
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  );
}

// ─── Helper : enveloppe HTML5 doctype ────────────────────────────────────────

/**
 * Wrap le markup React (rendu via renderToStaticMarkup) dans un
 * document HTML5 complet pour WeasyPrint.
 */
export function wrapAsHtmlDocument(markup: string): string {
  return `<!DOCTYPE html>\n${markup}`;
}
