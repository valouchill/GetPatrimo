/**
 * /dashboard/owner/lease — route héritée.
 *
 * Elle servait une page de préparation de bail alimentée par des DONNÉES DÉMO
 * codées en dur (noms d'apparence réelle), accessible en production à toute
 * personne connectée. Le module réel existe désormais :
 * `/dashboard/owner/contracts` liste les baux à préparer et mène au wizard
 * `/properties/[id]/contract` (pré-remplissage depuis le dossier vérifié +
 * signature électronique). On redirige au lieu d'afficher du faux.
 */

import { redirect } from 'next/navigation';

export default function OwnerLeasePreparationPage(): never {
  redirect('/dashboard/owner/contracts');
}
