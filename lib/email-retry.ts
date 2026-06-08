import { logger } from '@/lib/server-logger';

type MailSender = { sendMail(options: Record<string, unknown>): Promise<unknown> };

/**
 * Envoie un email avec un retry sur échec transitoire (réseau / SMTP Brevo).
 * Ne lève jamais — renvoie `true` si l'email est parti, `false` après échec des tentatives.
 *
 * Évite qu'une invitation (garant, colocataire…) soit silencieusement perdue sur un simple
 * blip de Brevo, ce qui bloquait le dossier sans alerte (audit V1 — A1).
 */
export async function sendMailWithRetry(
  transporter: MailSender,
  mailOptions: Record<string, unknown>,
  opts: { attempts?: number; label?: string } = {},
): Promise<boolean> {
  const attempts = Math.max(1, opts.attempts ?? 2);
  for (let i = 1; i <= attempts; i++) {
    try {
      await transporter.sendMail(mailOptions);
      return true;
    } catch (err) {
      if (i < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * i)); // backoff linéaire
      } else {
        logger.error(`[email] échec d'envoi après ${attempts} tentatives${opts.label ? ` (${opts.label})` : ''}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  return false;
}
