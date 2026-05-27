/**
 * <PassportTemplateV2> — Template React du Passeport Locatif V2.
 *
 * V2 "Growth Hacking" : one-pager A4 avec Smart Links qui forcent le
 * propriétaire prospect à venir sur la plateforme pour consulter les
 * pièces (et créer son compte → acquisition).
 *
 * Pipeline de génération :
 *   <PassportTemplateV2 {...props} />
 *      → renderToStaticMarkup() = HTML string
 *      → wrapHtmlDocument(markup, css) = HTML complet avec <head>
 *      → WeasyPrint subprocess → PDF A4 one-pager
 *
 * Note : pas de Tailwind ni styled-components (WeasyPrint ne résout pas
 * les classes utilitaires). Tout en attributs `style` ou via la
 * stylesheet inline {@link PASSPORT_V2_CSS}.
 */

import * as React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PassportV2SmartLink {
  /** Type de document (cni, revenus, impots, domicile, garant…) */
  type: 'cni' | 'revenus' | 'impots' | 'domicile' | 'garant' | 'autre';
  /** Label affiché sur le lien (ex: "CNI", "Fiches de paie") */
  label: string;
  /** URL absolue construite côté serveur avec UTM */
  href: string;
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

  /** Score + grade */
  score: number;
  gradeLabel: string;

  /** Métriques financières (toutes formatées en strings) */
  financials: {
    monthlyIncomeLabel: string;
    taxIncomeLabel?: string | null;
    stabilityLabel?: string | null;
    maxRentLabel: string;
    guarantorStatusLabel?: string | null;
    guarantorIncomeLabel?: string | null;
  };

  /** Smart Links — pièces consultables côté plateforme */
  smartLinks: PassportV2SmartLink[];

  /** Avis IA dynamique (généré selon le score) */
  aiCommentHtml: string;

  /** Liste des checks forensic 2 colonnes */
  forensicChecks: {
    left: string[];
    right: string[];
  };

  /** URL d'inscription owner (UTM-taggée) */
  signupUrl: string;

  /** Domaine pour le footer (ex: "doc2loc.com") */
  brandDomain: string;
}

// ─── CSS Stylesheet (inline pour WeasyPrint) ─────────────────────────────────

export const PASSPORT_V2_CSS = `
@page {
  size: A4;
  margin: 12mm 15mm;
  background-color: #f8fafc;
  @bottom-left {
    content: var(--footer-left, "PatrimoTrust © 2026 • Document Confidentiel et Infalsifiable");
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 7.5pt;
    color: #64748b;
  }
  @bottom-right {
    content: var(--footer-right, "");
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 7.5pt;
    color: #64748b;
  }
}
body {
  margin: 0;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #1e293b;
  font-size: 9pt;
  line-height: 1.4;
}
h1, h2, h3 { font-family: Georgia, serif; color: #064e3b; margin-top: 0; }
.w-full { width: 100%; }
.table-layout { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
.table-layout td { vertical-align: top; }
.header { border-bottom: 2px solid #d97706; padding-bottom: 8px; margin-bottom: 15px; }
.brand-name { font-size: 20pt; font-weight: bold; color: #064e3b; font-family: Georgia, serif; }
.document-title { font-size: 9pt; color: #475569; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
.card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.score-box { background-color: #064e3b; color: #ffffff; padding: 15px 10px; border-radius: 8px; text-align: center; }
.score-value { font-size: 32pt; font-weight: bold; font-family: Georgia, serif; color: #f59e0b; margin: 2px 0; line-height: 1; }
.grade-badge { background-color: #f59e0b; color: #064e3b; font-weight: bold; font-size: 11pt; padding: 2px 12px; border-radius: 15px; display: inline-block; }
.avatar-box {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, #064e3b, #047857);
  color: #ffffff;
  border-radius: 50%;
  text-align: center;
  line-height: 50px;
  font-size: 14pt;
  font-weight: bold;
  font-family: Georgia, serif;
}
.profile-name { font-family: Georgia, serif; font-size: 14pt; color: #064e3b; font-weight: bold; margin-bottom: 2px; }
.profile-tag { font-size: 8pt; background-color: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
.data-table { width: 100%; border-collapse: collapse; }
.data-table td { padding: 4px 0; border-bottom: 1px solid #f1f5f9; font-size: 8.5pt; }
.data-label { color: #64748b; width: 55%; }
.data-value { font-weight: 600; color: #1e293b; text-align: right; }
.section-title { font-size: 11pt; border-left: 3px solid #d97706; padding-left: 8px; margin-bottom: 8px; font-weight: bold; color: #064e3b; font-family: Georgia, serif; }
.smart-links-box { background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.ai-comment { color: #92400e; font-size: 9pt; margin-bottom: 10px; line-height: 1.5; }
.ai-comment em { font-style: italic; }
.doc-link {
  display: inline-block;
  background: #ffffff;
  border: 1px solid #d97706;
  color: #d97706;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 8pt;
  font-weight: bold;
  text-decoration: none;
  margin-right: 8px;
  margin-bottom: 4px;
}
.check-item { padding: 3px 0; font-size: 8pt; }
.check-icon { color: #059669; font-weight: bold; margin-right: 5px; }
.marketing-banner {
  background: linear-gradient(135deg, #064e3b 0%, #022c22 100%);
  color: #ffffff;
  border-radius: 8px;
  padding: 15px;
  margin-top: 10px;
  border-top: 3px solid #f59e0b;
}
.marketing-title { font-family: Georgia, serif; font-size: 12pt; color: #f59e0b; margin-bottom: 4px; font-weight: bold; }
.marketing-text { font-size: 8.5pt; color: #e2e8f0; margin-bottom: 10px; line-height: 1.4; }
.marketing-button {
  background-color: #f59e0b;
  color: #064e3b;
  font-weight: bold;
  font-size: 9pt;
  padding: 8px 16px;
  border-radius: 6px;
  text-decoration: none;
  display: inline-block;
}
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Génère un avis IA dynamique selon le score.
 * Retourne du HTML (avec balises strong / em) pour insertion via
 * dangerouslySetInnerHTML. Le contenu est encodé côté serveur — pas
 * d'input utilisateur dans cette fonction (safe).
 */
export function buildAiComment(score: number): string {
  const safe = Math.max(0, Math.min(100, Math.round(score || 0)));
  const ctaPhrase =
    `<strong>Propriétaire :</strong> Pour protéger les données du candidat, ` +
    `les pièces justificatives sont scellées. Cliquez sur les liens ` +
    `ci-dessous pour ouvrir votre espace sécurisé et consulter les ` +
    `originaux avec filigrane.`;

  if (safe >= 85) {
    return (
      `<strong>🎯 Avis de l'Intelligence Artificielle :</strong> ` +
      `<em>"Dossier d'excellence. L'intégrité des revenus et de l'identité ` +
      `est totale. Risque de défaut historiquement nul.”</em> ${ctaPhrase}`
    );
  }
  if (safe >= 60) {
    return (
      `<strong>🎯 Avis de l'Intelligence Artificielle :</strong> ` +
      `<em>"Dossier solide. Les flux de revenus sont cohérents et la ` +
      `garantie est correcte. Quelques points secondaires à examiner.”</em> ${ctaPhrase}`
    );
  }
  return (
    `<strong>⚠️ Avis de l'Intelligence Artificielle :</strong> ` +
    `<em>"Vigilance requise. Des incohérences ont été détectées dans le ` +
    `dossier. Une vérification manuelle approfondie est recommandée.”</em> ${ctaPhrase}`
  );
}

// ─── Composant principal ─────────────────────────────────────────────────────

export function PassportTemplateV2({
  passportId,
  generatedAt,
  candidate,
  score,
  gradeLabel,
  financials,
  smartLinks,
  aiCommentHtml,
  forensicChecks,
  signupUrl,
  brandDomain,
}: PassportTemplateV2Props): React.ReactElement {
  const safeScore = Math.max(0, Math.min(100, Math.round(score || 0)));

  return (
    <html lang="fr">
      <head>
        <meta charSet="UTF-8" />
        <title>Passeport Locatif Certifié — PatrimoTrust</title>
        <style
          // CSS inline + @page rules + variables dynamiques de footer
          // (les `var(--footer-*)` sont définies en attribut style du <body>
          // pour permettre l'injection runtime)
          dangerouslySetInnerHTML={{
            __html: PASSPORT_V2_CSS,
          }}
        />
      </head>
      <body
        style={{
          // CSS variables consommées par les @page bottom-left / bottom-right
          ['--footer-left' as string]: `"${brandDomain.toUpperCase()} © 2026 • Document Confidentiel et Infalsifiable"`,
          ['--footer-right' as string]: `"ID: ${passportId}"`,
        }}
      >
        {/* ─── Header brand ───────────────────────────────────────────── */}
        <div className="header">
          <table className="w-full">
            <tbody>
              <tr>
                <td>
                  <div className="brand-name">PatrimoTrust</div>
                  <div className="document-title">Passeport Locatif Certifié</div>
                </td>
                <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                  <span style={{ fontSize: '8pt', color: '#64748b' }}>
                    Généré le {generatedAt}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── Identité + Score ─────────────────────────────────────── */}
        <table className="table-layout">
          <tbody>
            <tr>
              <td style={{ width: '65%' }}>
                <div className="card" style={{ height: '95px', marginBottom: 0 }}>
                  <table className="w-full">
                    <tbody>
                      <tr>
                        <td style={{ width: '65px' }}>
                          <div className="avatar-box">{candidate.initials}</div>
                        </td>
                        <td>
                          <div className="profile-name">{candidate.fullName}</div>
                          <div className="profile-tag">{candidate.profession}</div>
                          <div
                            style={{
                              marginTop: '6px',
                              fontSize: '8.5pt',
                              color: '#475569',
                            }}
                          >
                            {candidate.employer ? (
                              <>
                                <strong>Employeur :</strong> {candidate.employer}
                                <br />
                              </>
                            ) : null}
                            {candidate.seniority ? (
                              <>
                                <strong>Ancienneté :</strong> {candidate.seniority}
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
              <td style={{ width: '3%' }} />
              <td style={{ width: '32%' }}>
                <div className="score-box" style={{ height: '95px' }}>
                  <div
                    style={{
                      fontSize: '7pt',
                      textTransform: 'uppercase',
                      color: '#a7f3d0',
                      fontWeight: 'bold',
                      letterSpacing: '1px',
                    }}
                  >
                    Indice de Résilience
                  </div>
                  <div className="score-value">
                    {safeScore}
                    <span style={{ fontSize: '14pt', color: '#a7f3d0' }}>/100</span>
                  </div>
                  <div className="grade-badge">{gradeLabel}</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ─── Analyse Financière ────────────────────────────────────── */}
        <div className="section-title">Analyse Financière &amp; Capacité</div>
        <table className="table-layout">
          <tbody>
            <tr>
              <td style={{ width: '48%' }}>
                <div className="card" style={{ marginBottom: 0 }}>
                  <table className="data-table">
                    <tbody>
                      <tr>
                        <td className="data-label">Revenus nets moyens</td>
                        <td className="data-value">{financials.monthlyIncomeLabel}</td>
                      </tr>
                      {financials.taxIncomeLabel ? (
                        <tr>
                          <td className="data-label">Revenu Fiscal (N-1)</td>
                          <td className="data-value">{financials.taxIncomeLabel}</td>
                        </tr>
                      ) : null}
                      {financials.stabilityLabel ? (
                        <tr>
                          <td className="data-label">Stabilité des flux</td>
                          <td className="data-value" style={{ color: '#059669' }}>
                            {financials.stabilityLabel}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </td>
              <td style={{ width: '4%' }} />
              <td style={{ width: '48%' }}>
                <div className="card" style={{ marginBottom: 0 }}>
                  <table className="data-table">
                    <tbody>
                      <tr>
                        <td className="data-label">Loyer Max Conseillé CC</td>
                        <td className="data-value">{financials.maxRentLabel}</td>
                      </tr>
                      {financials.guarantorStatusLabel ? (
                        <tr>
                          <td className="data-label">Garant Solidaire</td>
                          <td className="data-value" style={{ color: '#059669' }}>
                            {financials.guarantorStatusLabel}
                          </td>
                        </tr>
                      ) : null}
                      {financials.guarantorIncomeLabel ? (
                        <tr>
                          <td className="data-label">Couverture Garant</td>
                          <td className="data-value">{financials.guarantorIncomeLabel}</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ─── Smart Links Box (The Hook) ────────────────────────────── */}
        <div className="smart-links-box">
          <div
            className="ai-comment"
            dangerouslySetInnerHTML={{ __html: aiCommentHtml }}
          />
          <div>
            {smartLinks.map((link) => (
              <a key={link.type} href={link.href} className="doc-link">
                🔍 {link.label} (Accès Sécurisé)
              </a>
            ))}
          </div>
        </div>

        {/* ─── Audit Technique & Forensic ────────────────────────────── */}
        <div className="section-title">Audit Technique &amp; Forensic (Anti-Fraude)</div>
        <div className="card">
          <table className="w-full">
            <tbody>
              <tr>
                <td
                  style={{
                    width: '50%',
                    paddingRight: '10px',
                    borderRight: '1px solid #e2e8f0',
                  }}
                >
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
        </div>

        {/* ─── Marketing Banner (Bottom CTA) ─────────────────────────── */}
        <div className="marketing-banner">
          <table className="w-full">
            <tbody>
              <tr>
                <td style={{ width: '70%', paddingRight: '15px' }}>
                  <div className="marketing-title">
                    Propriétaires : Ne laissez pas passer ce dossier.
                  </div>
                  <div className="marketing-text">
                    Connectez-vous pour ajouter ce candidat à votre sélection.
                    Générez le bail pré-rempli loi ALUR en 3 clics et accédez
                    au coffre-fort numérique. Le premier mois est offert pour
                    finaliser cette location.
                  </div>
                </td>
                <td
                  style={{
                    width: '30%',
                    textAlign: 'right',
                    verticalAlign: 'middle',
                  }}
                >
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
