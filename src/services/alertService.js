// Service de génération de rapports de fraude pour les propriétaires (GetPatrimo)

/**
 * Détermine le niveau de gravité d'une alerte de fraude
 * @param {Object} alert - Alerte de fraude
 * @returns {string} - 'suspicion', 'probable', 'averee'
 */
function determineSeverityLevel(alert) {
  const code = String(alert.code || '').toUpperCase();
  
  // Fraude avérée (preuves techniques claires)
  if (code.includes('RETOUCHING_SUSPICION') || 
      code.includes('MRZ_INVALID') ||
      code.includes('MATH_INCONSISTENCY') ||
      code.includes('CUMUL_INCONSISTENCY')) {
    return 'averee';
  }
  
  // Fraude probable (incohérences multiples)
  if (code.includes('NAME_MISMATCH') ||
      code.includes('FISCAL_INCONSISTENCY') ||
      code.includes('SIRET_INVALID') ||
      code.includes('LOW_REMAINING_INCOME') && alert.type === 'critical') {
    return 'probable';
  }
  
  // Suspicion (anomalies mineures)
  return 'suspicion';
}

/**
 * Génère un rapport de fraude lisible pour un propriétaire
 * @param {Object} analysisResults - Résultats de l'analyse IA
 * @param {Object} candidature - Document candidature
 * @param {Object} property - Document bien immobilier
 * @returns {Object} - Rapport structuré avec niveau de gravité et détails
 */
function generateFraudReport(analysisResults, candidature, property) {
  const {
    scoring = null,
    consistencyCheck = null,
    payslipAudits = [],
    extractedData = null
  } = analysisResults;

  const report = {
    severity: 'suspicion', // Par défaut
    level: 'suspicion', // suspicion, probable, averee
    title: '',
    summary: '',
    details: [],
    technicalAlerts: [],
    candidateMessage: 'Votre dossier n\'a pas pu être certifié en raison d\'incohérences documentaires.'
  };

  // Collecte toutes les alertes
  const allAlerts = [];
  
  if (scoring && scoring.alerts) {
    allAlerts.push(...scoring.alerts);
  }
  
  if (consistencyCheck && consistencyCheck.messages) {
    consistencyCheck.messages.forEach(msg => {
      allAlerts.push({
        code: msg.type === 'critical' ? 'CRITICAL_INCONSISTENCY' : 'WARNING',
        type: msg.type,
        message: msg.message,
        title: msg.title
      });
    });
  }
  
  payslipAudits.forEach(audit => {
    if (audit.alerts) {
      allAlerts.push(...audit.alerts);
    }
  });

  // Détermine le niveau de gravité le plus élevé
  let maxSeverity = 'suspicion';
  for (const alert of allAlerts) {
    const severity = determineSeverityLevel(alert);
    if (severity === 'averee') {
      maxSeverity = 'averee';
      break;
    } else if (severity === 'probable' && maxSeverity !== 'averee') {
      maxSeverity = 'probable';
    }
  }

  report.level = maxSeverity;
  report.technicalAlerts = allAlerts;

  // Génère le titre et le résumé selon le niveau
  const candidateName = `${candidature?.firstName || ''} ${candidature?.lastName || ''}`.trim() || 'Candidat';
  const propertyName = property?.name || 'Bien';
  const propertyAddress = property?.address || [property?.addressLine, property?.zipCode, property?.city].filter(Boolean).join(', ') || '';

  if (maxSeverity === 'averee') {
    report.severity = 'averee';
    report.title = `🚨 Fraude Avérée - ${candidateName}`;
    report.summary = `Des preuves techniques claires indiquent que les documents fournis par ${candidateName} ont été modifiés ou sont incohérents. Ce dossier ne doit PAS être accepté.`;
    
    report.details.push({
      category: 'Fraude Documentaire',
      items: allAlerts
        .filter(a => determineSeverityLevel(a) === 'averee')
        .map(a => ({
          label: a.title || a.code,
          description: a.message,
          critical: true
        }))
    });
  } else if (maxSeverity === 'probable') {
    report.severity = 'probable';
    report.title = `⚠️ Fraude Probable - ${candidateName}`;
    report.summary = `Plusieurs incohérences significatives ont été détectées dans le dossier de ${candidateName}. Une vérification manuelle approfondie est recommandée avant toute décision.`;
    
    report.details.push({
      category: 'Incohérences Multiples',
      items: allAlerts
        .filter(a => determineSeverityLevel(a) === 'probable')
        .map(a => ({
          label: a.title || a.code,
          description: a.message,
          critical: false
        }))
    });
  } else {
    report.severity = 'suspicion';
    report.title = `🔍 Suspicion de Fraude - ${candidateName}`;
    report.summary = `Des anomalies mineures ont été détectées dans le dossier de ${candidateName}. Une vérification supplémentaire est recommandée.`;
    
    report.details.push({
      category: 'Anomalies Détectées',
      items: allAlerts
        .filter(a => determineSeverityLevel(a) === 'suspicion')
        .map(a => ({
          label: a.title || a.code,
          description: a.message,
          critical: false
        }))
    });
  }

  // Ajoute les informations contextuelles
  report.context = {
    candidateName,
    candidateEmail: candidature?.email || '',
    propertyName,
    propertyAddress,
    submissionDate: candidature?.createdAt || new Date(),
    score: scoring?.total || 0,
    grade: scoring?.grade || 'E'
  };

  return report;
}

/**
 * Génère le HTML de l'email de notification de fraude
 * @param {Object} report - Rapport de fraude généré
 * @returns {string} - HTML de l'email
 */
function generateFraudEmailHTML(report) {
  const severityColors = {
    averee: '#EF4444', // Rouge alerte
    probable: '#F59E0B', // Orange
    suspicion: '#3B82F6' // Bleu
  };

  const severityLabels = {
    averee: 'Fraude Avérée',
    probable: 'Fraude Probable',
    suspicion: 'Suspicion de Fraude'
  };

  const color = severityColors[report.level] || '#3B82F6';
  const label = severityLabels[report.level] || 'Suspicion';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerte Fraude - GetPatrimo</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#F8FAFC;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC;padding:20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#0F172A;padding:24px;text-align:center;">
              <h1 style="margin:0;color:#FFFFFF;font-size:24px;font-weight:700;">GetPatrimo</h1>
              <p style="margin:8px 0 0;color:#94A3B8;font-size:14px;">Détection de fraude documentaire</p>
            </td>
          </tr>
          
          <!-- Alert Badge -->
          <tr>
            <td style="padding:24px;text-align:center;background-color:${color};">
              <div style="display:inline-block;background-color:#FFFFFF;padding:12px 24px;border-radius:6px;">
                <span style="font-size:32px;display:block;margin-bottom:8px;">${report.level === 'averee' ? '🚨' : report.level === 'probable' ? '⚠️' : '🔍'}</span>
                <strong style="color:${color};font-size:18px;font-weight:700;">${label}</strong>
              </div>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td style="padding:24px 24px 0;">
              <h2 style="margin:0;color:#0F172A;font-size:20px;font-weight:700;">${report.title}</h2>
            </td>
          </tr>
          
          <!-- Summary -->
          <tr>
            <td style="padding:16px 24px;">
              <p style="margin:0;color:#64748B;font-size:14px;line-height:1.6;">${report.summary}</p>
            </td>
          </tr>
          
          <!-- Context Info -->
          <tr>
            <td style="padding:16px 24px;background-color:#F1F5F9;">
              <table width="100%" cellpadding="8" cellspacing="0">
                <tr>
                  <td style="color:#64748B;font-size:12px;width:40%;">Candidat :</td>
                  <td style="color:#0F172A;font-size:14px;font-weight:600;">${report.context.candidateName}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-size:12px;">Email :</td>
                  <td style="color:#0F172A;font-size:14px;">${report.context.candidateEmail}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-size:12px;">Bien :</td>
                  <td style="color:#0F172A;font-size:14px;">${report.context.propertyName}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-size:12px;">Adresse :</td>
                  <td style="color:#0F172A;font-size:14px;">${report.context.propertyAddress}</td>
                </tr>
                <tr>
                  <td style="color:#64748B;font-size:12px;">Score :</td>
                  <td style="color:#0F172A;font-size:14px;font-weight:700;">${report.context.score}/100 (${report.context.grade})</td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Details -->
          ${report.details.map(detail => `
          <tr>
            <td style="padding:24px;">
              <h3 style="margin:0 0 16px;color:#0F172A;font-size:16px;font-weight:700;border-bottom:2px solid #E2E8F0;padding-bottom:8px;">${detail.category}</h3>
              <ul style="margin:0;padding-left:20px;color:#64748B;font-size:14px;line-height:1.8;">
                ${detail.items.map(item => `
                  <li style="margin-bottom:12px;">
                    <strong style="color:${item.critical ? '#EF4444' : '#0F172A'};display:block;margin-bottom:4px;">${item.label}</strong>
                    <span style="color:#64748B;">${item.description}</span>
                  </li>
                `).join('')}
              </ul>
            </td>
          </tr>
          `).join('')}
          
          <!-- Footer -->
          <tr>
            <td style="padding:24px;background-color:#F1F5F9;border-top:1px solid #E2E8F0;text-align:center;">
              <p style="margin:0;color:#64748B;font-size:12px;">Cet email a été généré automatiquement par GetPatrimo</p>
              <p style="margin:8px 0 0;color:#64748B;font-size:12px;">Pour toute question, connectez-vous à votre tableau de bord.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Génère le texte brut de l'email (fallback)
 * @param {Object} report - Rapport de fraude généré
 * @returns {string} - Texte brut de l'email
 */
function generateFraudEmailText(report) {
  return `
ALERTE FRAUDE - GetPatrimo
${'='.repeat(50)}

${report.title}

${report.summary}

Informations :
- Candidat : ${report.context.candidateName}
- Email : ${report.context.candidateEmail}
- Bien : ${report.context.propertyName}
- Adresse : ${report.context.propertyAddress}
- Score : ${report.context.score}/100 (${report.context.grade})

Détails :
${report.details.map(d => `
${d.category} :
${d.items.map(i => `  - ${i.label}: ${i.description}`).join('\n')}
`).join('\n')}

---
Cet email a été généré automatiquement par GetPatrimo
  `.trim();
}

module.exports = {
  generateFraudReport,
  generateFraudEmailHTML,
  generateFraudEmailText,
  determineSeverityLevel
};
