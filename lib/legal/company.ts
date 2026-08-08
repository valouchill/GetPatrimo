/**
 * Identité légale de l'éditeur — SOURCE UNIQUE.
 *
 * Ces informations sont obligatoires (LCEN art. 6-III pour les mentions légales,
 * RGPD art. 13/14 pour le responsable de traitement). Elles étaient auparavant
 * dispersées en 18 placeholders « [À COMPLÉTER] » dans deux pages ; il suffit
 * désormais de remplir CE fichier une seule fois.
 *
 * ⚠️ À RENSEIGNER AVANT TOUTE EXPLOITATION COMMERCIALE. Un champ laissé à `null`
 * s'affiche « en cours d'immatriculation » plutôt qu'un placeholder technique —
 * mais ce n'est PAS conforme : c'est un état d'attente, pas une solution.
 * Les valeurs viennent du Kbis une fois la société immatriculée.
 */

export interface CompanyIdentity {
  legalName: string | null;
  legalForm: string | null;
  capital: string | null;
  siret: string | null;
  rcs: string | null;
  headquarters: string | null;
  publicationDirector: string | null;
  email: string;
  phone: string | null;
  /** Délégué à la protection des données (RGPD art. 37) — null si non désigné. */
  dpo: { name: string; email: string } | null;
}

export const COMPANY: CompanyIdentity = {
  legalName: null,
  legalForm: null,
  capital: null,
  siret: null,
  rcs: null,
  headquarters: null,
  publicationDirector: null,
  email: 'contact@maisonpatrimo.com',
  phone: null,
  dpo: null,
};

/**
 * Médiateur de la consommation (art. L611-1 C. conso) — OBLIGATOIRE pour tout
 * professionnel vendant à des consommateurs. Il faut adhérer à un organisme
 * agréé (ex. CM2C, Medicys, AME Conso) : ~100-500 €/an. Tant que `null`, les
 * CGV l'annoncent comme en cours de désignation.
 */
export const MEDIATOR: { name: string; address: string; website: string } | null = null;

/** Hébergeur — obligation LCEN art. 6-III (identification de l'hébergeur). */
// Hébergeur effectif du serveur de production (vérifié : AS16276 OVH SAS).
export const HOST = {
  legalName: 'OVH SAS',
  address: '2 rue Kellermann, 59100 Roubaix, France',
  phone: '1007 (depuis la France) — +33 9 72 10 10 07',
  website: 'https://www.ovhcloud.com',
};

/** Rendu d'un champ manquant, sans jargon technique côté visiteur. */
export function legalValue(value: string | null): string {
  return value && value.trim() ? value : 'En cours d’immatriculation';
}

/** true si l'identité légale est complète (utilisable en garde-fou de go-live). */
export function isCompanyIdentityComplete(): boolean {
  return Boolean(
    COMPANY.legalName && COMPANY.legalForm && COMPANY.capital
    && COMPANY.siret && COMPANY.rcs && COMPANY.headquarters
    && COMPANY.publicationDirector,
  );
}
