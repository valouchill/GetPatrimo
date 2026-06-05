/**
 * Templates de relance pour les loyers impayés.
 * Variables : {prenom}, {nom}, {adresse}, {mois}, {montant}, {jours_retard}
 */

export const REMINDER_TEMPLATES = {
  friendly: {
    subject: 'Rappel — Loyer de {mois}',
    delay: 5, // J+5
    body: `Bonjour {prenom},

Sauf erreur de notre part, nous n'avons pas encore reçu le règlement de votre loyer pour le mois de {mois}, d'un montant de {montant}, pour le bien situé au {adresse}.

Si votre paiement a déjà été effectué, veuillez ne pas tenir compte de ce rappel.

Dans le cas contraire, nous vous remercions de bien vouloir procéder au règlement dans les meilleurs délais.

Cordialement,
Votre bailleur — via getpatrimo`,
  },

  formal: {
    subject: 'Relance — Loyer impayé de {mois}',
    delay: 15, // J+15
    body: `Bonjour {prenom},

Malgré notre rappel du {date_rappel}, nous constatons que votre loyer de {mois} d'un montant de {montant} pour le bien situé au {adresse} reste impayé.

Le retard est actuellement de {jours_retard} jours.

Nous vous demandons de régulariser cette situation dans un délai de 8 jours à compter de la réception de ce message.

À défaut, nous serons contraints d'engager les démarches prévues au contrat de bail.

Cordialement,
Votre bailleur — via getpatrimo`,
  },

  formal_notice: {
    subject: 'Mise en demeure — Loyer impayé de {mois}',
    delay: 30, // J+30
    body: `Bonjour {prenom} {nom},

Par la présente, nous vous mettons en demeure de régler la somme de {montant} correspondant à votre loyer de {mois} pour le bien situé au {adresse}.

Ce montant est impayé depuis {jours_retard} jours malgré nos relances précédentes.

Conformément aux dispositions de votre bail et à la législation en vigueur, nous vous accordons un dernier délai de 8 jours pour procéder au règlement intégral.

À défaut de paiement dans ce délai, nous nous réservons le droit d'engager toute procédure judiciaire utile, notamment la mise en œuvre de la clause résolutoire du bail.

Nous vous recommandons vivement de prendre contact avec nous pour trouver une solution amiable.

Ce courrier vaut mise en demeure au sens de l'article 1231-5 du Code civil.

Cordialement,
Votre bailleur — via getpatrimo`,
  },

  critical_alert: {
    subject: 'ALERTE — Impayé critique ({jours_retard} jours)',
    delay: 45, // J+45
    // This is sent to the OWNER, not the tenant
    body: `Alerte impayé critique

Le loyer de {prenom} {nom} pour le bien au {adresse} est impayé depuis {jours_retard} jours (montant : {montant}).

Relances effectuées :
- Rappel amiable (J+5)
- Relance formelle (J+15)
- Mise en demeure (J+30)

Actions recommandées :
1. Contacter directement le locataire
2. Proposer un échéancier de paiement
3. Consulter un avocat spécialisé
4. Signaler à la CAF si le locataire est allocataire
5. Engager une procédure de résiliation du bail si nécessaire

getpatrimo — Alerte automatique`,
  },
} as const;

export type ReminderType = keyof typeof REMINDER_TEMPLATES;

/**
 * Fill a reminder template with actual values.
 */
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
  }
): { subject: string; body: string } {
  const template = REMINDER_TEMPLATES[type];
  let subject: string = template.subject;
  let body: string = template.body;

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    subject = subject.replace(regex, value);
    body = body.replace(regex, value);
  }

  return { subject, body };
}
