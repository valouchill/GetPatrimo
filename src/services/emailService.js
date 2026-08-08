// Service d'envoi d'emails via Brevo SMTP
const nodemailer = require('nodemailer');
const { BREVO_USER, BREVO_PASS, MAIL_FROM } = require('../config/app');

let transporter = null;

// Initialisation du transporteur SMTP
if (BREVO_USER && BREVO_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user: BREVO_USER, pass: BREVO_PASS }
  });

  transporter.verify()
    .then(() => console.log("✅ SMTP Brevo OK"))
    .catch((error) => console.error("⚠️ SMTP verify fail:", error?.message));
} else {
  console.warn("⚠️ BREVO_USER/BREVO_PASS manquant: emails désactivés");
}

/**
 * Vérifie si le service email est configuré
 * @returns {boolean}
 */
function isEmailConfigured() {
  return transporter !== null;
}

/**
 * Envoie un email
 * @param {Object} options - Options de l'email
 * @param {string} options.to - Destinataire
 * @param {string} options.subject - Sujet
 * @param {string} [options.text] - Corps texte
 * @param {string} [options.html] - Corps HTML
 * @param {Array} [options.attachments] - Pièces jointes
 * @returns {Promise<void>}
 */
/** Erreurs SMTP transitoires : il vaut la peine de réessayer. */
function isTransientSmtpError(error) {
  const code = String(error?.code || '');
  const status = Number(error?.responseCode || 0);
  return (
    ['ETIMEDOUT', 'ECONNRESET', 'ECONNECTION', 'ESOCKET', 'EAI_AGAIN', 'ECONNREFUSED'].includes(code)
    // 4xx SMTP = refus temporaire (quota, greylisting) ; 5xx = définitif.
    || (status >= 400 && status < 500)
  );
}

const MAX_SEND_ATTEMPTS = 3;

/**
 * Envoi d'email avec RETRY sur erreur transitoire (backoff 400 ms, 1,2 s).
 *
 * Les emails de ce produit sont porteurs d'obligations : relance d'impayé,
 * lien de signature, quittance. Un greylisting ou une coupure réseau d'une
 * seconde faisait perdre l'envoi définitivement — parfois sans même que
 * l'appelant le sache (certains sites l'attrapaient en silence).
 */
async function sendEmail({ to, subject, text, html, attachments }) {
  if (!transporter) {
    throw new Error("Email non configuré (BREVO_USER/BREVO_PASS)");
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt += 1) {
    try {
      await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html, attachments });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_SEND_ATTEMPTS || !isTransientSmtpError(error)) break;
      console.warn(`Envoi email : échec transitoire (tentative ${attempt}/${MAX_SEND_ATTEMPTS})`, error?.code || error?.message);
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt * attempt));
    }
  }
  console.error("Erreur envoi email:", lastError);
  throw lastError;
}

module.exports = {
  isEmailConfigured,
  sendEmail,
  _internals: { isTransientSmtpError, MAX_SEND_ATTEMPTS },
};
