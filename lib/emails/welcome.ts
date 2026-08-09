/**
 * Email de bienvenue — envoyé une fois, juste après l'inscription.
 *
 * Aucun message ne partait après la création de compte : le nouvel inscrit
 * arrivait sur un dashboard vide sans savoir quelle est la première action
 * utile, et sans aucune trace de nous dans sa boîte mail.
 *
 * Best-effort : l'échec n'empêche jamais l'inscription — l'accès au compte ne
 * dépend pas de cet email.
 */

const { sendEmail, isEmailConfigured } = require('@/src/services/emailService');

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || 'https://maisonpatrimo.com'
  ).replace(/\/$/, '');
}

/** Première action utile, différente selon le rôle. */
function contentForRole(role: string): {
  subject: string; heading: string; steps: string[]; cta: { label: string; href: string };
} {
  const url = baseUrl();
  if (role === 'tenant') {
    return {
      subject: 'Bienvenue — votre dossier de location, prêt en 10 minutes',
      heading: 'Votre dossier locataire vous suit partout',
      steps: [
        'Réunissez vos pièces (identité, revenus, garant) une seule fois',
        "Faites vérifier votre identité — les bailleurs le voient immédiatement",
        'Partagez votre Passeport Locatif à chaque visite, sans tout renvoyer',
      ],
      cta: { label: 'Compléter mon dossier', href: `${url}/dashboard/tenant` },
    };
  }
  return {
    subject: 'Bienvenue — votre premier bien en 2 minutes',
    heading: 'Choisissez votre locataire en confiance',
    steps: [
      'Créez votre bien et publiez votre lien de candidature',
      'Recevez les dossiers déjà triés et notés automatiquement',
      "Lancez un audit anti-fraude sur vos finalistes — le premier est offert",
    ],
    cta: { label: 'Créer mon premier bien', href: `${url}/dashboard/owner` },
  };
}

export async function sendWelcomeEmail({ email, role }: { email: string; role: string }): Promise<void> {
  if (!isEmailConfigured() || !email) return;
  const { subject, heading, steps, cta } = contentForRole(role);

  await sendEmail({
    to: email,
    subject,
    html: `
<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
  <h1 style="font-size:20px;margin:0 0 4px;">Maison Patrimo</h1>
  <p style="font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#64748b;margin:0 0 20px;">Bienvenue</p>
  <p style="font-size:17px;font-weight:600;line-height:1.5;margin:0 0 12px;">${heading}</p>
  <ol style="font-size:15px;line-height:1.8;padding-left:20px;color:#334155;">
    ${steps.map((s) => `<li>${s}</li>`).join('')}
  </ol>
  <p style="text-align:center;margin:28px 0;">
    <a href="${cta.href}" style="background:#064e3b;color:#fff;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block;">
      ${cta.label}
    </a>
  </p>
  <p style="font-size:12px;line-height:1.6;color:#64748b;">
    Une question ? Répondez simplement à cet email, nous lisons tout.
  </p>
</div>`,
    text: `${heading}\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${cta.label} : ${cta.href}`,
  });
}
