/**
 * Templates email HTML pour PatrimoTrust
 *
 * Utilise un layout commun responsive + branded.
 * Chaque template retourne { subject, html, text }.
 */

const APP_NAME = 'PatrimoTrust';
const APP_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://doc2loc.com';
const BRAND_COLOR = '#1E40AF';
const SUPPORT_EMAIL = process.env.MAIL_REPLY_TO || 'contact@doc2loc.com';

// ─── Layout wrapper ─────────────────────────────────────────────
function layout(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:${BRAND_COLOR};padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">${APP_NAME}</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${bodyContent}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-align:center;">
          <p style="margin:4px 0;">${APP_NAME} — Gestion locative intelligente</p>
          <p style="margin:4px 0;">
            <a href="${APP_URL}" style="color:${BRAND_COLOR};text-decoration:none;">${APP_URL}</a>
            &nbsp;|&nbsp;
            <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND_COLOR};text-decoration:none;">Support</a>
          </p>
          <p style="margin:8px 0;color:#9ca3af;font-size:11px;">
            Vous recevez cet email car vous avez un compte sur ${APP_NAME}.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${BRAND_COLOR};border-radius:6px;padding:12px 24px;">
      <a href="${url}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${text}</a>
    </td></tr>
  </table>`;
}

// ─── Templates ──────────────────────────────────────────────────

/**
 * OTP / Magic link pour connexion
 */
function otpLogin(otp, email) {
  const subject = `${APP_NAME} — Votre code de connexion`;
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Votre code de connexion</h2>
    <p style="color:#374151;line-height:1.6;">
      Bonjour,<br>
      Voici votre code de vérification pour vous connecter à ${APP_NAME} :
    </p>
    <div style="background:#f0f4ff;border:2px solid ${BRAND_COLOR};border-radius:8px;padding:16px;text-align:center;margin:24px 0;">
      <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${BRAND_COLOR};">${otp}</span>
    </div>
    <p style="color:#6b7280;font-size:13px;">
      Ce code expire dans <strong>10 minutes</strong>.<br>
      Si vous n'avez pas demandé ce code, ignorez cet email.
    </p>
  `);
  const text = `Votre code de connexion ${APP_NAME} : ${otp}\nCe code expire dans 10 minutes.\nSi vous n'avez pas demandé ce code, ignorez cet email.`;
  return { subject, html, text };
}

/**
 * Invitation candidat à postuler
 */
function candidateInvitation(propertyAddress, applyUrl, ownerName) {
  const subject = `${APP_NAME} — Vous êtes invité(e) à déposer votre dossier`;
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Déposez votre dossier de candidature</h2>
    <p style="color:#374151;line-height:1.6;">
      Bonjour,<br>
      ${ownerName ? `<strong>${ownerName}</strong> vous` : 'Vous êtes'} invite à déposer votre dossier de candidature
      pour le logement situé au :
    </p>
    <div style="background:#f9fafb;border-left:4px solid ${BRAND_COLOR};padding:12px 16px;margin:16px 0;">
      <strong style="color:#111827;">${propertyAddress}</strong>
    </div>
    ${button('Déposer mon dossier', applyUrl)}
    <p style="color:#6b7280;font-size:13px;">
      Votre dossier sera certifié automatiquement par notre IA anti-fraude.
    </p>
  `);
  const text = `Vous êtes invité(e) à déposer votre dossier pour : ${propertyAddress}\nLien : ${applyUrl}`;
  return { subject, html, text };
}

/**
 * Invitation garant
 */
function guarantorInvitation(tenantName, verifyUrl) {
  const subject = `${APP_NAME} — Vérification d'identité garant`;
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Vérification d'identité requise</h2>
    <p style="color:#374151;line-height:1.6;">
      Bonjour,<br>
      <strong>${tenantName}</strong> vous a désigné comme garant pour sa candidature locative.
      Pour valider votre engagement, nous devons vérifier votre identité.
    </p>
    ${button('Vérifier mon identité', verifyUrl)}
    <p style="color:#6b7280;font-size:13px;">
      La vérification prend moins de 2 minutes et utilise Didit, certifié eIDAS.
    </p>
  `);
  const text = `${tenantName} vous a désigné comme garant. Vérifiez votre identité : ${verifyUrl}`;
  return { subject, html, text };
}

/**
 * Notification propriétaire — nouveau dossier reçu
 */
function newApplicationNotification(tenantName, propertyAddress, dashboardUrl) {
  const subject = `${APP_NAME} — Nouveau dossier reçu`;
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Nouveau dossier de candidature</h2>
    <p style="color:#374151;line-height:1.6;">
      Bonjour,<br>
      Un nouveau dossier a été déposé par <strong>${tenantName}</strong>
      pour votre bien situé au <strong>${propertyAddress}</strong>.
    </p>
    ${button('Voir le dossier', dashboardUrl)}
  `);
  const text = `Nouveau dossier de ${tenantName} pour ${propertyAddress}. Voir : ${dashboardUrl}`;
  return { subject, html, text };
}

/**
 * Partage de passeport locataire
 */
function passportShared(tenantName, passportUrl) {
  const subject = `${APP_NAME} — Passeport locataire partagé`;
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">Un passeport locataire vous a été partagé</h2>
    <p style="color:#374151;line-height:1.6;">
      Bonjour,<br>
      <strong>${tenantName}</strong> a partagé son passeport locataire certifié avec vous.
    </p>
    ${button('Consulter le passeport', passportUrl)}
    <p style="color:#6b7280;font-size:13px;">
      Ce passeport contient les informations vérifiées du candidat : identité, revenus, scoring.
    </p>
  `);
  const text = `${tenantName} a partagé son passeport locataire. Voir : ${passportUrl}`;
  return { subject, html, text };
}

module.exports = {
  otpLogin,
  candidateInvitation,
  guarantorInvitation,
  newApplicationNotification,
  passportShared,
};
