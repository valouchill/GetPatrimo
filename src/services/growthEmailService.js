/**
 * growthEmailService — les boucles email de croissance (fire-and-forget).
 *
 *  1. notifyOwnerNewApplication : email au propriétaire au PREMIER dossier soumis
 *     (rétention — appelé par la server action submitApplication).
 *  2. runDailyGrowthEmails (cron 08:30, server.js) :
 *     - relance paywall J+2 (essai gratuit épuisé, pas d'offre payante) ;
 *     - relance candidat J+2 (dossier resté DRAFT/IN_PROGRESS/COMPLETE non soumis).
 *  3. runWeeklyDigest (cron lundi 08:30) : KPIs de la semaine au fondateur.
 *
 * Garde-fous (revue 8-angles) :
 *  - SMTP non configuré → le run s'arrête AVANT tout marquage (jamais de
 *    relance « brûlée » sans email parti) ;
 *  - transporteur SMTP unique et poolé par process (pas une connexion/email) ;
 *  - retry ×2 avec backoff sur chaque envoi (pattern lib/email-retry) ;
 *  - toute valeur contrôlée par l'utilisateur est échappée avant interpolation
 *    HTML (anti-phishing dans les emails propriétaires/fondateur) ;
 *  - marquage en base par lot (updateMany) → jamais de double-envoi.
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
  // capte stdout) que dans les server actions Next.
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : 'log'](`[growth-email] ${msg}`, meta || '');
}

/** Échappe toute valeur interpolée dans du HTML d'email (données utilisateur). */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function isSmtpConfigured() {
  return Boolean(process.env.BREVO_USER && process.env.BREVO_PASS);
}

/** Transporteur unique par process (poolé) — jamais une connexion par email. */
let sharedTransporter = null;
function getTransporter() {
  if (!isSmtpConfigured()) return null;
  if (!sharedTransporter) {
    sharedTransporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      pool: true,
      maxConnections: 1,
      auth: { user: process.env.BREVO_USER, pass: process.env.BREVO_PASS },
    });
  }
  return sharedTransporter;
}

/** Envoi avec retry ×2 (backoff linéaire — pattern lib/email-retry). Ne lève jamais. */
async function sendMail(options) {
  const transporter = getTransporter();
  if (!transporter) {
    log('error', 'SMTP non configuré — email non envoyé', { subject: options.subject });
    return false;
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || '"Maison Patrimo" <no-reply@maisonpatrimo.com>',
        replyTo: process.env.MAIL_REPLY_TO || 'contact@maisonpatrimo.com',
        ...options,
      });
      return true;
    } catch (e) {
      if (attempt === 2) {
        log('error', 'envoi échoué après retry', { subject: options.subject, error: e?.message });
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  return false;
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
 * Fire-and-forget — appelé après la PREMIÈRE soumission (submitApplication
 * vérifie submittedAt). Ne lève jamais.
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

    // esc() : prénom/nom et adresse sont des données utilisateur → jamais
    // interpolées brutes dans le HTML (anti-phishing).
    const candidate = esc(
      [app.profile?.firstName, app.profile?.lastName].filter(Boolean).join(' ') ||
        app.userEmail || 'Un candidat',
    );
    const address = esc(property.address || property.name || 'votre bien');
    const url = `${getBaseUrl()}/dashboard/owner?tab=candidatures&utm_source=email&utm_medium=email&utm_campaign=notif-dossier`;

    await sendMail({
      to: owner.email,
      subject: `📥 Nouveau dossier reçu — ${property.address || property.name || 'votre bien'}`,
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
    // B2B : jamais de relance à prix B2C (« dès 19,90 € ») vers un compte pro.
    accountType: { $ne: 'B2B' },
  })
    .select('email')
    .limit(MAX_EMAILS_PER_RUN)
    .lean();
  if (!users.length) return { candidates: 0, sent: 0 };

  const ids = users.map((u) => u._id);
  // Une requête pour tous : déjà clients (offre payante sur ≥1 bien) → exclus.
  const paidOwners = new Set(
    (
      await Property.distinct('user', {
        user: { $in: ids },
        $or: [{ managed: true }, { tier: { $exists: true, $nin: ['', 'FREE'] } }],
      })
    ).map(String),
  );
  // Marquage PAR LOT avant envoi (anti double-envoi). Le garde SMTP en amont
  // (runDailyGrowthEmails) garantit qu'on n'arrive ici qu'avec un transport
  // configuré — un échec individuel résiduel est loggé, jamais re-tenté.
  await User.updateMany({ _id: { $in: ids } }, { $set: { paywallReminderSentAt: new Date() } });

  let sent = 0;
  for (const u of users) {
    if (paidOwners.has(String(u._id))) continue;
    const ok = await sendMail({
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
    <a href="${getBaseUrl()}/pricing?utm_source=email&utm_medium=email&utm_campaign=paywall-j2" style="background:#f59e0b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block;">
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
/* 2b. Relance candidat J+2 : dossier incomplet ou complet non envoyé         */
/* ────────────────────────────────────────────────────────────────────────── */

const CATEGORY_LABELS = {
  IDENTITY: "votre pièce d'identité",
  INCOME: 'vos justificatifs de revenus',
};

async function sendIncompleteApplicationReminders() {
  const now = Date.now();
  // COMPLETE inclus : le segment le plus chaud est le dossier fini mais jamais
  // ENVOYÉ (le candidat n'a pas cliqué « Soumettre » — submittedAt absent).
  const apps = await Application.find({
    status: { $in: ['DRAFT', 'IN_PROGRESS', 'COMPLETE'] },
    submittedAt: null,
    incompleteReminderSentAt: null,
    updatedAt: { $lte: new Date(now - 2 * DAY_MS), $gte: new Date(now - 30 * DAY_MS) },
    userEmail: { $exists: true, $ne: '' },
    applyToken: { $exists: true, $ne: '' },
  })
    .select('userEmail applyToken documents profile status')
    .limit(MAX_EMAILS_PER_RUN)
    .lean();
  if (!apps.length) return { candidates: 0, sent: 0 };

  await Application.updateMany(
    { _id: { $in: apps.map((a) => a._id) } },
    { $set: { incompleteReminderSentAt: new Date() } },
  );

  let sent = 0;
  for (const app of apps) {
    // Pièces du LOCATAIRE uniquement — les pièces du garant (subjectType
    // GUARANTOR/VISALE) ne doivent pas masquer celles qui manquent au candidat.
    const present = new Set(
      (app.documents || [])
        .filter((d) => !d.subjectType || d.subjectType === 'TENANT')
        .map((d) => String(d.category || '').toUpperCase()),
    );
    const missing = Object.keys(CATEGORY_LABELS)
      .filter((c) => !present.has(c))
      .map((c) => CATEGORY_LABELS[c]);

    const isReadyToSend = app.status === 'COMPLETE' && missing.length === 0;
    const bodyLine = isReadyToSend
      ? 'Bonne nouvelle : votre dossier est <strong>complet</strong> — il ne vous reste qu\'à cliquer « Envoyer » pour le transmettre au propriétaire.'
      : missing.length
        ? `Il manque notamment : <strong>${missing.map(esc).join(' et ')}</strong>.`
        : 'Quelques pièces restent à finaliser pour que le propriétaire puisse étudier votre dossier.';

    const ok = await sendMail({
      to: app.userEmail,
      subject: isReadyToSend
        ? 'Votre dossier est prêt — il ne reste qu\'à l\'envoyer ✉️'
        : 'Votre dossier de location est presque prêt 📋',
      html: wrapHtml(
        'Votre candidature',
        `
  <p style="font-size:15px;line-height:1.7;">Bonjour${app.profile?.firstName ? ' ' + esc(app.profile.firstName) : ''},</p>
  <p style="font-size:15px;line-height:1.7;">Votre dossier de candidature n'a pas encore été transmis
  au propriétaire. ${bodyLine}</p>
  <p style="font-size:15px;line-height:1.7;">Un dossier complet et vérifié passe devant les autres —
  cela prend moins de 5 minutes.</p>
  <p style="text-align:center;margin:24px 0;">
    <a href="${getBaseUrl()}/apply/${encodeURIComponent(app.applyToken)}" style="background:#064e3b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:14px;display:inline-block;">
      ${isReadyToSend ? 'Envoyer mon dossier' : 'Finaliser mon dossier'}
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
    // Garde-fou CRITIQUE : sans SMTP, on n'entame RIEN (sinon les marquages
    // « relance envoyée » brûleraient le stock de relances sans aucun email).
    if (!isSmtpConfigured()) {
      log('error', 'BREVO_USER/BREVO_PASS absents — run annulé, aucun marquage effectué');
      return { skipped: 'smtp_unconfigured' };
    }
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
    // EUR livemode uniquement (pas de mélange devises/mode test dans le total).
    const succeeded = (data.data || []).filter(
      (c) => c.status === 'succeeded' && !c.refunded && c.currency === 'eur' && c.livemode !== false,
    );
    return {
      count: succeeded.length,
      totalEur: succeeded.reduce((s, c) => s + (c.amount || 0), 0) / 100,
      truncated: data.has_more === true,
    };
  } catch {
    return null;
  }
}

async function runWeeklyDigest() {
  try {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const sinceTs = Math.floor(since.getTime() / 1000);

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
    // esc() : `source` est fourni par le client du POST /api/public/lead.
    const leadsText = Object.entries(leadsBySource).map(([s, n]) => `${esc(s)} : ${n}`).join(' · ') || 'aucun';

    let pilotsText = 'module non disponible';
    try {
      const PilotGrant = require('../../models/PilotGrant');
      const pending = await PilotGrant.countDocuments({ status: 'PENDING' });
      const applied = await PilotGrant.countDocuments({ status: 'APPLIED' });
      pilotsText = `${applied} actif(s) · ${pending} en attente d'activation`;
    } catch { /* modèle absent sur vieux déploiements */ }

    const revenueText = revenue
      ? `${revenue.count}${revenue.truncated ? '+' : ''} paiement(s) — ${revenue.totalEur.toFixed(2).replace('.', ',')} €${revenue.truncated ? ' (tronqué à 100)' : ''}`
      : 'indisponible';

    const row = (label, value) =>
      `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">${label}</td><td style="padding:8px 12px;font-weight:700;font-size:14px;">${value}</td></tr>`;

    await sendMail({
      to: getFounderEmail(),
      subject: `📊 Maison Patrimo — digest de la semaine (${new Date().toLocaleDateString('fr-FR')})`,
      html: wrapHtml(
        'Digest hebdomadaire',
        `
  <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:12px;">
    ${row('💶 Encaissements Stripe live (7 j, EUR)', revenueText)}
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
