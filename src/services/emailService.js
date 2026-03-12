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
async function sendEmail({ to, subject, text, html, attachments }) {
  if (!transporter) {
    throw new Error("Email non configuré (BREVO_USER/BREVO_PASS)");
  }

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to,
      subject,
      text,
      html,
      attachments
    });
  } catch (error) {
    console.error("Erreur envoi email:", error);
    throw error;
  }
}

module.exports = {
  isEmailConfigured,
  sendEmail
};
