import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';
import { COMPANY, HOST, legalValue } from '@/lib/legal/company';
import Link from 'next/link';

export const metadata = {
  title: 'Politique de confidentialité — Maison Patrimo',
};

export default function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Politique de confidentialité</h1>

      <p className="text-sm text-slate-500 mb-8">
        Conformément au Règlement Général sur la Protection des Données (RGPD — Règlement UE 2016/679)
        et à la loi n° 78-17 du 6 janvier 1978 modifiée (Loi Informatique et Libertés).
      </p>

      <section className="space-y-8 text-slate-700 leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Responsable du traitement</h2>
          <p>
            {legalValue(COMPANY.legalName)}, dont le siège social est situé au{' '}
            {legalValue(COMPANY.headquarters)}, immatriculée au RCS sous le numéro{' '}
            {legalValue(COMPANY.rcs)}.
          </p>
          <p className="mt-2">
            {COMPANY.dpo ? (
              <>
                <strong>Délégué à la protection des données (DPO) :</strong> {COMPANY.dpo.name}<br />
                <strong>Contact :</strong> {COMPANY.dpo.email}
              </>
            ) : (
              <>
                <strong>Contact pour toute question relative à vos données :</strong>{' '}
                dpo@maisonpatrimo.com<br />
                <span className="text-sm text-slate-500">
                  Aucun délégué à la protection des données n&apos;est désigné à ce jour&nbsp;: la
                  désignation n&apos;est pas obligatoire pour notre activité (RGPD art. 37), vos
                  demandes sont traitées directement par le responsable du traitement.
                </span>
              </>
            )}
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Données collectées</h2>
          <p className="mb-3">Nous collectons les catégories de données suivantes :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Données d&apos;identification :</strong> nom, prénom, adresse email, numéro de
              téléphone, adresse postale.
            </li>
            <li>
              <strong>Données relatives au logement :</strong> adresse du bien, surface, loyer, charges,
              diagnostics techniques (DPE, CREP, etc.).
            </li>
            <li>
              <strong>Documents justificatifs :</strong> pièce d&apos;identité, avis d&apos;imposition,
              bulletins de salaire, attestations — conformément au décret n° 2015-1437 (liste limitative
              des documents exigibles).
            </li>
            <li>
              <strong>Données de paiement :</strong> historique des loyers, quittances, relances.
            </li>
            <li>
              <strong>Données techniques :</strong> adresse IP, navigateur, pages consultées (cookies
              strictement nécessaires uniquement, sauf consentement).
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Bases légales et finalités</h2>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 border-b border-slate-200">Finalité</th>
                <th className="text-left px-4 py-2 border-b border-slate-200">Base légale (RGPD art. 6)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2">Gestion des baux et quittances</td>
                <td className="px-4 py-2">Exécution du contrat (art. 6.1.b)</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2">
                  Vérification d&apos;identité (Didit)
                  <span className="block text-xs text-slate-500">
                    Traitement de données biométriques — catégorie particulière (art. 9)
                  </span>
                </td>
                <td className="px-4 py-2">
                  <strong>Consentement explicite</strong> (art. 6.1.a et art. 9.2.a)
                  <span className="block text-xs text-slate-500">
                    Facultatif et révocable : le refus n&apos;empêche pas de candidater,
                    seule la mention « identité vérifiée » n&apos;est pas apposée.
                  </span>
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2">Scoring de dossier locataire</td>
                <td className="px-4 py-2">Intérêt légitime du propriétaire (art. 6.1.f)</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2">Notifications et rappels de paiement</td>
                <td className="px-4 py-2">Exécution du contrat (art. 6.1.b)</td>
              </tr>
              <tr>
                <td className="px-4 py-2">Amélioration du service / statistiques</td>
                <td className="px-4 py-2">Consentement (art. 6.1.a)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Durée de conservation</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Comptes actifs :</strong> données conservées pendant toute la durée de la relation
              contractuelle.
            </li>
            <li>
              <strong>Après résiliation :</strong> 3 ans à compter de la clôture du compte (prescription
              civile).
            </li>
            <li>
              <strong>Documents comptables :</strong> 10 ans (obligation légale, Code de commerce art. L.123-22).
            </li>
            <li>
              <strong>Dossiers candidats non retenus :</strong> anonymisation automatique après 90 jours
              (noms, emails, téléphones, documents supprimés). Seules les données statistiques anonymisées
              sont conservées.
            </li>
            <li>
              <strong>Pièces d&apos;identité des candidats non retenus :</strong> suppression immédiate
              des fichiers (CNI, passeport) dès la sélection d&apos;un candidat par le propriétaire.
            </li>
            <li>
              <strong>Données biométriques et identité vérifiée (Didit) :</strong> les selfies, données
              de liveness et données de comparaison faciale ne sont jamais stockées sur nos serveurs —
              elles restent chez notre prestataire de vérification. L&apos;identité certifiée transmise
              (nom, prénom, date de naissance) est <strong>effacée automatiquement 90 jours</strong> après
              la vérification ; seule la preuve que la vérification a eu lieu (statut, date) est conservée.
              En cas de demande d&apos;effacement, l&apos;identité est supprimée immédiatement.
            </li>
            <li>
              <strong>Leads marketing :</strong> suppression automatique après 3 ans sans interaction.
            </li>
            <li>
              <strong>Tokens d&apos;authentification :</strong> OTP et tokens de connexion expirés sont
              purgés automatiquement toutes les heures.
            </li>
            <li>
              <strong>Données de connexion :</strong> 12 mois (LCEN art. 6-II).
            </li>
          </ul>
          <p className="mt-3 text-sm text-slate-500">
            Les purges automatiques sont exécutées quotidiennement par nos systèmes.
            Vous pouvez exercer votre droit à l&apos;effacement à tout moment depuis votre espace
            personnel (Profil &gt; Données &amp; Confidentialité).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Destinataires des données</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Personnel habilité de Maison Patrimo SAS</li>
            <li>Sous-traitants techniques : hébergement {HOST.legalName} (France), base de données MongoDB hébergée sur ce même serveur, Stripe (paiements), Didit (vérification d&apos;identité), OpenAI et Microsoft Azure (analyse documentaire), Brevo (envoi d&apos;emails)</li>
            <li>Les données ne sont pas transférées hors de l&apos;Union européenne, sauf vers des prestataires disposant de garanties appropriées (clauses contractuelles types, décision d&apos;adéquation)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Vos droits</h2>
          <p className="mb-3">
            Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants :
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Droit d&apos;accès</strong> — obtenir la confirmation que vos données sont traitées et en recevoir une copie</li>
            <li><strong>Droit de rectification</strong> — corriger des données inexactes ou incomplètes</li>
            <li><strong>Droit à l&apos;effacement</strong> — demander la suppression de vos données</li>
            <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré et lisible</li>
            <li><strong>Droit d&apos;opposition</strong> — vous opposer au traitement fondé sur l&apos;intérêt légitime</li>
            <li><strong>Droit à la limitation</strong> — demander la suspension du traitement</li>
            <li><strong>Droit de retirer votre consentement</strong> — à tout moment, sans affecter la licéité du traitement antérieur</li>
          </ul>
          <p className="mt-3">
            Pour exercer vos droits, contactez-nous à{' '}
            <a href="mailto:dpo@maisonpatrimo.com" className="text-cobalt hover:underline">
              dpo@maisonpatrimo.com
            </a>{' '}
            dpo@maisonpatrimo.com ou par courrier au siège social.
          </p>
          <p className="mt-2">
            En cas de désaccord, vous pouvez introduire une réclamation auprès de la{' '}
            <a
              href="https://www.cnil.fr/fr/plaintes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cobalt hover:underline"
            >
              CNIL
            </a>.
          </p>
        </div>

        <div id="cookies">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Cookies</h2>
          <p className="mb-3">
            Conformément à la directive ePrivacy et aux recommandations de la CNIL (délibération n° 2020-091),
            nous utilisons les cookies suivants :
          </p>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2 border-b border-slate-200">Cookie</th>
                <th className="text-left px-4 py-2 border-b border-slate-200">Finalité</th>
                <th className="text-left px-4 py-2 border-b border-slate-200">Durée</th>
                <th className="text-left px-4 py-2 border-b border-slate-200">Type</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2">next-auth.session-token</td>
                <td className="px-4 py-2">Authentification</td>
                <td className="px-4 py-2">Session</td>
                <td className="px-4 py-2">Strictement nécessaire</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-2">next-auth.csrf-token</td>
                <td className="px-4 py-2">Protection CSRF</td>
                <td className="px-4 py-2">Session</td>
                <td className="px-4 py-2">Strictement nécessaire</td>
              </tr>
              <tr>
                <td className="px-4 py-2">cookie-consent</td>
                <td className="px-4 py-2">Mémorisation du choix cookies</td>
                <td className="px-4 py-2">12 mois</td>
                <td className="px-4 py-2">Strictement nécessaire</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3">
            Aucun cookie analytique ou publicitaire n&apos;est déposé sans votre consentement préalable.
            Vous pouvez modifier vos préférences à tout moment via le bandeau de gestion des cookies.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Sécurité</h2>
          <p>
            Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger
            vos données : chiffrement TLS, hachage des mots de passe (bcrypt), contrôle d&apos;accès
            par rôle, journalisation des accès, sauvegardes chiffrées.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">9. Décisions automatisées et profilage (art. 22 RGPD)</h2>
          <p>
            Pour aider le propriétaire à évaluer un dossier de candidature, notre service produit un
            <strong> Indice de Résilience</strong> et une analyse anti-fraude générés en partie par des
            traitements automatisés, dont un modèle d&apos;intelligence artificielle. Ces résultats
            constituent une <strong>aide à la décision</strong> : la sélection finale du locataire est
            prise par le propriétaire, et non de façon entièrement automatisée.
          </p>
          <p className="mt-2">
            Conformément à l&apos;article 22 du RGPD, vous disposez du droit d&apos;obtenir une
            <strong> intervention humaine</strong>, d&apos;exprimer votre point de vue et de contester
            le résultat d&apos;une analyse automatisée vous concernant. Pour exercer ces droits,
            utilisez le{' '}
            <a href="/contestation" className="text-cobalt hover:underline">
              formulaire de contestation
            </a>{' '}
            (réexamen humain tracé, réponse sous un mois) ou contactez notre DPO (coordonnées au point 1).
          </p>
          <p className="mt-2">
            Vous pouvez par ailleurs <strong>supprimer définitivement une ou plusieurs pièces</strong> de
            votre dossier à tout moment, directement depuis votre espace candidat (l&apos;effacement couvre
            la pièce et son fichier sur nos serveurs).
          </p>
        </div>
      </section>

      <div className="mt-12 pt-6 border-t border-slate-200 text-sm text-slate-500">
        Dernière mise à jour : {formatLegalDate(LEGAL_VERSIONS.privacy.date)}
      </div>
    </div>
  );
}
