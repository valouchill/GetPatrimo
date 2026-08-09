#!/usr/bin/env node
/**
 * Annonce d'ouverture aux inscrits de la liste d'attente « Gestion locative ».
 *
 * Ces personnes ont explicitement demandé à être prévenues au lancement — et le
 * lancement a eu lieu. Sans ce script, la seule base d'acheteurs pré-qualifiés
 * du produit n'était jamais recontactée (les leads n'avaient aucun consommateur).
 *
 * Sécurité d'usage :
 *  - DRY-RUN PAR DÉFAUT : rien n'est envoyé sans `--send` explicite ;
 *  - idempotent : un lead déjà notifié (`notifiedAt`) est toujours ignoré ;
 *  - lien de désinscription dans chaque email (RGPD art. 21).
 *
 * Usage :
 *   node scripts/notify-waitlist-launch.js            # aperçu (n'envoie rien)
 *   node scripts/notify-waitlist-launch.js --send     # envoi réel
 */

const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const CAMPAIGN = 'management_launch_2026';
const SOURCE_PATTERN = /waitlist/i;

async function main() {
  const send = process.argv.includes('--send');
  const mongoose = require('mongoose');

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('MONGO_URI manquant dans l\'environnement.');
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);

  const Lead = require('../models/Lead');
  const { sendEmail, isEmailConfigured } = require('../src/services/emailService');

  const baseUrl = (process.env.NEXTAUTH_URL || 'https://maisonpatrimo.com').replace(/\/$/, '');

  const leads = await Lead.find({ source: SOURCE_PATTERN, notifiedAt: null }).lean();
  console.log(`${leads.length} inscrit(s) à prévenir (campagne ${CAMPAIGN}).`);

  if (!send) {
    leads.forEach((l) => console.log(`  [aperçu] ${l.email} (inscrit le ${new Date(l.createdAt).toLocaleDateString('fr-FR')})`));
    console.log('\nAperçu uniquement — relancez avec --send pour envoyer réellement.');
    await mongoose.disconnect();
    return;
  }

  if (!isEmailConfigured()) {
    console.error('SMTP non configuré — envoi annulé.');
    process.exit(1);
  }

  let sent = 0;
  for (const lead of leads) {
    const html = `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:20px;margin:0 0 4px;">Maison Patrimo</h1>
  <p style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;margin:0 0 20px;">Gestion locative</p>
  <p style="font-size:15px;line-height:1.7;">Bonjour,</p>
  <p style="font-size:15px;line-height:1.7;">Vous nous aviez demandé d'être prévenu(e) au lancement de la
  <strong>gestion locative</strong>. C'est fait — elle est disponible dès aujourd'hui :</p>
  <ul style="font-size:15px;line-height:1.8;padding-left:20px;">
    <li>Bail pré-rempli depuis le dossier vérifié, <strong>signé en ligne</strong></li>
    <li>Quittances envoyées automatiquement, relances d'impayés</li>
    <li>États des lieux photo, retenues sur dépôt calculées</li>
  </ul>
  <p style="font-size:15px;line-height:1.7;"><strong>4,99 € par mois et par logement</strong>, sans engagement,
  résiliable en un clic.</p>
  <p style="text-align:center;margin:28px 0;">
    <a href="${baseUrl}/auth/register?role=owner" style="background:#064e3b;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block;">
      Activer la gestion locative
    </a>
  </p>
  <p style="font-size:11px;color:#94a3b8;text-align:center;">
    Vous recevez cet email car vous vous êtes inscrit(e) à la liste d'attente.
    <a href="${baseUrl}/api/user/unsubscribe" style="color:#94a3b8;">Se désinscrire</a>
  </p>
</div>`;

    try {
      await sendEmail({
        to: lead.email,
        subject: '🎉 La gestion locative est disponible — Maison Patrimo',
        html,
        text: `La gestion locative est disponible : bail signé en ligne, quittances automatiques, états des lieux. 4,99 €/mois par logement, sans engagement. ${baseUrl}/auth/register?role=owner`,
      });
      // Marqué APRÈS l'envoi réussi : un échec sera retenté au prochain passage.
      await Lead.updateOne(
        { _id: lead._id },
        { $set: { notifiedAt: new Date(), notifiedCampaign: CAMPAIGN } },
      );
      sent += 1;
      console.log(`  ✓ ${lead.email}`);
    } catch (err) {
      console.error(`  ✗ ${lead.email} — ${err?.message || err}`);
    }
  }

  console.log(`\n${sent}/${leads.length} email(s) envoyé(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
