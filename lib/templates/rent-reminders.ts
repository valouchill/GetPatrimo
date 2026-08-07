/**
 * Façade typée des templates de relance.
 * Implémentation partagée : src/templates/rentReminders.js (CommonJS), afin que
 * le cron Node pur et la route Next appliquent EXACTEMENT la même politique.
 */

 
const shared = require('@/src/templates/rentReminders');

export const REMINDER_TEMPLATES = shared.REMINDER_TEMPLATES as Record<
  'friendly' | 'formal' | 'formal_notice' | 'critical_alert',
  { subject: string; delay: number; body: string }
>;

export type ReminderType = keyof typeof REMINDER_TEMPLATES;

export function fillReminderTemplate(
  type: ReminderType,
  vars: {
    prenom: string;
    nom: string;
    adresse: string;
    mois: string;
    montant: string;
    jours_retard: string;
    date_rappel?: string;
  },
): { subject: string; body: string } {
  return shared.fillReminderTemplate(type, vars);
}
