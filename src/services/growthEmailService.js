/**
 * growthEmailService — les boucles email de croissance (fire-and-forget).
 *
 *  1. notifyOwnerNewApplication : email au propriétaire à chaque dossier soumis
 *     (rétention — appelé par la server action submitApplication).
 *  2. runDailyGrowthEmails (cron 08:30, server.js) :
 *     - relance paywall J+2 (essai gratuit épuisé, pas d'offre payante) ;
 *     - relance candidat J+2 (dossier resté DRAFT/IN_PROGRESS).
 *  3. runWeeklyDigest (cron lundi 08:30) : KPIs de la semaine au fondateur.
 *
 * Toutes les fonctions sont fail-safe (jamais d'exception propagée) et bornées
 * (caps par run) — un incident email ne doit jamais toucher le produit.
 */

const nodemailer = require('nodemailer');

const User = require('../../models/User');
const Property = require('../../models/Property');
const Application = require('../../models/Application');
const Lead = require('../../models/Lead');

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_EMAILS_PER_RUN = 50;

function log(level, msg, meta) {
  // console volontaire : le service tourne aussi bien sous server.js (winston
  // redirige stdout) que dans les server actions Next.
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : 'log'](`[growth-email] ${msg}`, meta || '');
}

function getBaseUrl() {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://maisonpatrimo.com').replace(/\/$/, '');
}

function getFounderEmail() {
  const replyTo = process.env.MAIL_REPLY_TO || '';
  return (
    process.env.LEAD_NOTIFY_EMAIL ||
    (/<([^>]+)>/.exec(replyTo) || [])[1] ||
    replyTo.trim() ||
    'contact@maisonpatrimo.com'
  );
}

function buildTransporter() {
  const user = process.env.BREVO_USER;
  const pass = process.env.BREVO_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

async function sendMail(transporter, options) {
  const t = transporter || buildTransporter();
  if (!t) {
    log('error', 'BREVO non configuré — email non envoyé', { subject: options.subject });
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || '"Maison Patrimo" <no-reply@maisonpatrimo.com>',
      replyTo: process.env.MAIL_REPLY_TO || 'contact@maisonpatrimo.com',
      ...options,
    });
    return true;
  } catch (e) {
    log('error', 'envoi échoué', { subject: options.subject, error: e?.message });
    return false;
  }
}

function wrapHtml(title, bodyHtml) {
  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:20px;margin:0 0 4px;">Maison Patrimo</h1>
  <p style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;margin:0 0 20px;">${title}</p>
  ${bodyHtml}
  <p style="font-size:11px;line-height:1.6;color:#94a3b8;margin-top:28px;">
    Vous recevez cet email car vous utilisez Maison Patrimo. Pour ne plus recevoir
    ce type de message, répondez simplement « STOP ».
  </p>
</div>`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. Notification propriétaire : nouveau dossier soumis                      */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Fire-and-forget — appelé après submitApplication. Ne lève jamais.
 * @param {string} applicationId
 */
async function notifyOwnerNewApplication(applicationId) {
  try {
    const app = await Application.findById(applicationId)
      .select('property userEmail profile applyToken')
      .lean();
    if (!app || !app.property) return;

    const property = await Property.findById(app.property).select('user address name').lean();
    if (!property || !property.user) return;
    const owner = await User.findById(property.user).select('email').lean();
    if (!owner?.email) return;

    const candidate =
      [app.profile?.firstName, app.profile?.lastName].filter(Boolean).join(' ') ||
      app.userEmail || 'Un candidat';
    const address = property.address || property.name || 'votre bien';
    const url = `${getBaseUrl()}/dashboard/owner?page=candidatures`;

    await sendMail(null, {
      to: owner.email,
      subject: `📥 Nouveau dossier reçu — ${address}`,
      html: wrapHtml(
        'Nouvelle candidature',
        `
  <p style="font-size:15px;line-height:1.7;"><strong>${candidate}</strong> vient de déposer un dossier
  complet pour <strong>${address}</strong>.</p>
  <p style="font-size:15px;line-height:1.7;">Son pré-tri automatique (score et grade) est déjà calculé
  et le dossier est classé parmi vos candidats.</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${url}" style="background:#064e3b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block;">
      Voir le dossier et le classement
    </a>
  </p>`,
      ),
    });
  } catch (e) {
    log('error', 'notifyOwnerNewApplication', { error: e?.message });
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 2a. Relance paywall J+2                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

async function sendPaywallReminders() {
  const cutoff = new Date(Date.now() - 2 * DAY_MS);
  const users = await User.find({
    freeTrialExhaustedAt: { $ne: null, $lte: cutoff },
    paywallReminderSentAt: null,
    suspended: { $ne: true },
  })
    .select('email')
    .limit(MAX_EMAILS_PER_RUN)
    .lean();

  let sent = 0;
  for (const u of users) {
    // Déjà client (offre payante sur au moins un bien) → jamais de relance.
    const hasPaid = await Property.exists({
      user: u._id,
      $or: [{ managed: true }, { tier: { $exists: true, $nin: ['', 'FREE'] } }],
    });
    // Marqué AVANT l'envoi (jamais de double-envoi, même si l'envoi échoue :
    // on préfère perdre une relance que spammer).
    await User.updateOne({ _id: u._id }, { $set: { paywallReminderSentAt: new Date() } });
    if (hasPaid) continue;

    const ok = await sendMail(null, {
      to: u.email,
      subject: 'Vos candidats vous attendent — audits et comparaison à débloquer',
      html: wrapHtml(
        'Votre essai gratuit',
        `
  <p style="font-size:15px;line-height:1.7;">Votre audit d'essai vous a montré ce que l'analyse
  forensic détecte sur un vrai dossier. Vos autres candidats, eux, restent
  <strong>masqués</strong> : identité, coordonnées et pièces non débloquées.</p>
  <p style="font-size:15px;line-height:1.7;">Débloquez la comparaison complète de tous vos candidats
  + de nouveaux audits <strong>dès 19,90 € (paiement unique, sans abonnement)</strong> — vos crédits
  se cumulent et ne sont jamais perdus.</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${getBaseUrl()}/pricing" style="background:#f59e0b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block;">
      Débloquer mes candidats
    </a>
  </p>
  <p style="font-size:13px;line-height:1.6;color:#64748b;">Une question ? Répondez à cet email,
  c'est le fondateur qui lit.</p>`,
      ),
    });
    if (ok) sent += 1;
  }
  return { candidates: users.length, sent };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 2b. Relance candidat J+2 : dossier incomplet                               */
/* ────────────────────────────────────────────────────────────────────────── */

const CATEGORY_LABELS = {
  IDENTITY: "pièce d'identité",
  INCOME: 'justificatifs de revenus',
  ADDRESS: 'justificatif de domicile',
  GUARANTOR: 'pièces du garant',
};

async function sendIncompleteApplicationReminders() {
  const now = Date.now();
  const apps = await Application.find({
    status: { $in: ['DRAFT', 'IN_PROGRESS'] },
    incompleteReminderSentAt: null,
    updatedAt: { $lte: new Date(now - 2 * DAY_MS), $gte: new Date(now - 30 * DAY_MS) },
    userEmail: { $exists: true, $ne: '' },
    applyToken: { $exists: true, $ne: '' },
  })
    .select('userEmail applyToken documents profile')
    .limit(MAX_EMAILS_PER_RUN)
    .lean();

  let sent = 0;
  for (const app of apps) {
    await Application.updateOne({ _id: app._id }, { $set: { incompleteReminderSentAt: new Date() } });

    const present = new Set((app.documents || []).map((d) => String(d.category || '').toUpperCase()));
    const missing = ['IDENTITY', 'INCOME']
      .filter((c) => !present.has(c))
      .map((c) => CATEGORY_LABELS[c]);
    const missingText = missing.length
      ? `Il manque notamment : <strong>${missing.join(' et ')}</strong>.`
      : 'Quelques pièces restent à finaliser pour que le propriétaire puisse étudier votre dossier.';

    const ok = await sendMail(null, {
      to: app.userEmail,
      subject: 'Votre dossier de location est presque prêt 📋',
      html: wrapHtml(
        'Votre candidature',
        `
  <p style="font-size:15px;line-height:1.7;">Bonjour${app.profile?.firstName ? ' ' + app.profile.firstName : ''},</p>
  <p style="font-size:15px;line-height:1.7;">Votre dossier de candidature est en attente : il n'a pas
  encore été transmis au propriétaire. ${missingText}</p>
  <p style="font-size:15px;line-height:1.7;">Un dossier complet et vérifié passe devant les autres —
  cela prend moins de 5 minutes.</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${getBaseUrl()}/apply/${app.applyToken}" style="background:#064e3b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block;">
      Finaliser mon dossier
    </a>
  </p>`,
      ),
    });
    if (ok) sent += 1;
  }
  return { candidates: apps.length, sent };
}

async function runDailyGrowthEmails() {
  try {
    const paywall = await sendPaywallReminders();
    const incomplete = await sendIncompleteApplicationReminders();
    log('log', 'daily run', { paywall, incomplete });
    return { paywall, incomplete };
  } catch (e) {
    log('error', 'runDailyGrowthEmails', { error: e?.message });
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. Digest hebdomadaire fondateur (lundi)                                   */
/* ────────────────────────────────────────────────────────────────────────── */

async function fetchStripeWeekRevenue(sinceTs) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    const res = await fetch(
      `https://api.stripe.com/v1/charges?created[gte]=${sinceTs}&limit=100`,
      { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const succeeded = (data.data || []).filter((c) => c.status === 'succeeded' && !c.refunded);
    return {
      count: succeeded.length,
      totalEur: succeeded.reduce((s, c) => s + (c.amount || 0), 0) / 100,
      livemode: succeeded[0]?.livemode ?? null,
    };
  } catch {
    return null;
  }
}

async function runWeeklyDigest() {
  try {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const sinceTs = Math.floor(since.getTime() / 1000);

    // Chaque métrique est indépendante et fail-safe.
    const safe = async (p, fallback) => { try { return await p; } catch { return fallback; } };

    const [newOwners, newProps, analyses, trialsExhausted, leads, revenue] = await Promise.all([
      safe(User.countDocuments({ role: 'owner', createdAt: { $gte: since } }), '?'),
      safe(Property.countDocuments({ createdAt: { $gte: since } }), '?'),
      safe(Application.countDocuments({ 'aiAuditV2.cachedAt': { $gte: since } }), '?'),
      safe(User.countDocuments({ freeTrialExhaustedAt: { $gte: since } }), '?'),
      safe(Lead.find({ createdAt: { $gte: since } }).select('source').lean(), []),
      fetchStripeWeekRevenue(sinceTs),
    ]);

    const leadsBySource = {};
    for (const l of leads) leadsBySource[l.source || 'landing'] = (leadsBySource[l.source || 'landing'] || 0) + 1;
    const leadsText = Object.entries(leadsBySource).map(([s, n]) => `${s} : ${n}`).join(' · ') || 'aucun';

    let pilotsText = 'module non disponible';
    try {
      const PilotGrant = require('../../models/PilotGrant');
      const pending = await PilotGrant.countDocuments({ status: 'PENDING' });
      const applied = await PilotGrant.countDocuments({ status: 'APPLIED' });
      pilotsText = `${applied} actif(s) · ${pending} en attente d'activation`;
    } catch { /* modèle absent sur vieux déploiements */ }

    const revenueText = revenue
      ? `${revenue.count} paiement(s) — ${revenue.totalEur.toFixed(2).replace('.', ',')} € ${revenue.livemode === false ? '(⚠️ mode test)' : ''}`
      : 'indisponible';

    const row = (label, value) =>
      `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">${label}</td><td style="padding:8px 12px;font-weight:700;font-size:14px;">${value}</td></tr>`;

    await sendMail(null, {
      to: getFounderEmail(),
      subject: `📊 Maison Patrimo — digest de la semaine (${new Date().toLocaleDateString('fr-FR')})`,
      html: wrapHtml(
        'Digest hebdomadaire',
        `
  <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;">
    ${row('💶 Encaissements Stripe (7 j)', revenueText)}
    ${row('👤 Nouveaux propriétaires', newOwners)}
    ${row('🏠 Nouveaux biens', newProps)}
    ${row('🔍 Audits lancés', analyses)}
    ${row('🔥 Essais gratuits épuisés (prospects chauds)', trialsExhausted)}
    ${row('📥 Leads', leadsText)}
    ${row('🤝 Pilotes B2B', pilotsText)}
  </table>
  <p style="font-size:13px;line-height:1.7;color:#64748b;margin-top:16px;">
    Rituel du lundi : plus grosse fuite du funnel → une action. Canal qui amène des
    payants → doubler. Pilote sans consommation → relancer aujourd'hui.
  </p>
  <p style="text-align:center;margin:20px 0;">
    <a href="${getBaseUrl()}/dashboard/admin" style="background:#064e3b;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:10px;font-weight:600;font-size:13px;display:inline-block;">
      Ouvrir la console admin
    </a>
  </p>`,
      ),
    });
    log('log', 'weekly digest envoyé');
    return true;
  } catch (e) {
    log('error', 'runWeeklyDigest', { error: e?.message });
    return false;
  }
}

module.exports = {
  notifyOwnerNewApplication,
  runDailyGrowthEmails,
  runWeeklyDigest,
};
