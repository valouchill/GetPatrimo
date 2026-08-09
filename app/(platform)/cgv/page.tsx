import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';
import { MEDIATOR } from '@/lib/legal/company';
import Link from 'next/link';

export const metadata = {
  title: 'Conditions générales de vente — Maison Patrimo',
};

/**
 * CGV — alignées sur le modèle commercial courant (packs one-time par bien,
 * plafond dur, rachat = cumul ; cf. lib/billing/tiers.ts et docs/BILLING.md).
 * Restent à renseigner avant la mise en vente : l'identité complète de
 * l'éditeur (lib/legal/company.ts → COMPANY) et le médiateur de la consommation
 * (lib/legal/company.ts → MEDIATOR, adhésion à un organisme agréé requise).
 * Relecture par un avocat recommandée avant go-live.
 */
export default function CGV() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Conditions générales de vente</h1>

      <p className="text-sm text-slate-500 mb-8">
        Les présentes conditions générales de vente (ci-après « CGV ») régissent la vente des services
        payants de la plateforme Maison Patrimo, éditée par la société identifiée dans les{' '}
        <Link href="/mentions-legales" className="text-cobalt hover:underline">mentions légales</Link>.
        Elles complètent les{' '}
        <Link href="/terms" className="text-cobalt hover:underline">CGU</Link> et la{' '}
        <Link href="/privacy" className="text-cobalt hover:underline">politique de confidentialité</Link>.
      </p>

      <section className="space-y-8 text-slate-700 leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Objet</h2>
          <p>
            Les présentes CGV définissent les conditions de vente des offres payantes proposées par
            Maison Patrimo : services numériques d&apos;audit de dossiers de candidature locative
            (analyse documentaire et détection d&apos;incohérences assistées par IA, indice de
            solvabilité indicatif), de comparaison des candidatures reçues pour un logement, et
            services associés (Passeport Locatif). Toute commande d&apos;une offre payante implique
            l&apos;acceptation sans réserve des présentes CGV, matérialisée lors de la commande.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Offres et prix</h2>
          <p>
            Les services sont commercialisés sous forme d&apos;<strong>offres à paiement unique</strong>
            {' '}(sans reconduction), achetées <strong>par logement</strong> — auxquelles s&apos;ajoute
            l&apos;abonnement facultatif « Gestion locative » décrit à l&apos;article 2 bis :
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>
              <strong>Gratuit</strong> — 0 € : réception et centralisation des candidatures, pré-tri
              automatique (score et grade), démonstration sur dossier exemple, et{' '}
              <strong>1 audit forensic offert</strong> par compte. Sans carte bancaire.
            </li>
            <li>
              <strong>Essentiel</strong> — <strong>19,90 € TTC</strong> par logement : déblocage de la
              comparaison détaillée de toutes les candidatures du logement (identité, coordonnées et
              pièces des candidats) + <strong>3 audits forensic</strong>.
            </li>
            <li>
              <strong>Pro</strong> — <strong>39,90 € TTC</strong> par logement : déblocage de la
              comparaison détaillée + <strong>10 audits forensic</strong> + Passeport Locatif PDF.
            </li>
            <li>
              <strong>Pro max</strong> — <strong>59,90 € TTC</strong> par logement : déblocage de la
              comparaison détaillée + <strong>20 audits forensic</strong> + support prioritaire.
            </li>
          </ul>
          <p className="mt-2">
            Les prix sont indiqués en euros <strong>toutes taxes comprises</strong>. Le taux de TVA
            applicable et, le cas échéant, la mention « TVA non applicable, art. 293 B du CGI »
            (franchise en base) figurent sur la facture émise à chaque commande. Chaque offre payante ouvre un quota d&apos;audits attaché au logement
            concerné. Le quota constitue un <strong>plafond</strong> : aucune facturation à l&apos;usage
            n&apos;est appliquée au-delà. En cas de nouvel achat sur un logement disposant déjà d&apos;une
            offre, <strong>les audits non consommés se cumulent</strong> avec ceux du nouveau pack et le
            niveau d&apos;offre le plus élevé est conservé. Les audits ne sont pas limités dans le temps
            et restent utilisables tant que le compte est actif. La ré-analyse d&apos;un dossier déjà
            audité ne consomme pas de crédit supplémentaire, et l&apos;audit d&apos;essai gratuit ne
            réduit pas le quota acheté.
          </p>
          <p className="mt-2">
            Maison Patrimo se réserve le droit de modifier ses prix à tout moment ; l&apos;offre
            applicable est celle en vigueur au moment de la commande, telle qu&apos;affichée sur la page
            de commande.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            2 bis. Abonnement « Gestion locative » (offre facultative)
          </h2>
          <p>
            En complément des offres à paiement unique, l&apos;utilisateur peut souscrire un
            abonnement <strong>« Gestion locative » au prix de 4,99 € TTC par mois et par
            logement</strong> (toutes taxes comprises). Il donne accès aux modules de
            gestion : génération et signature électronique du contrat de bail, suivi des loyers,
            quittances et relances automatiques, états des lieux d&apos;entrée et de sortie.
          </p>
          <p className="mt-2">
            <strong>Durée et reconduction.</strong> L&apos;abonnement est conclu pour une durée
            d&apos;un mois, <strong>reconduit tacitement</strong> chaque mois par prélèvement
            automatique via Stripe, tant qu&apos;il n&apos;est pas résilié.
          </p>
          <p className="mt-2">
            <strong>Résiliation.</strong> L&apos;utilisateur peut résilier <strong>à tout moment,
            sans frais ni préavis</strong>, directement depuis son espace client (fonctionnalité de
            résiliation en ligne, art. L215-1-1 du Code de la consommation) ou par simple email à
            contact@maisonpatrimo.com. La résiliation prend effet à la fin de la période mensuelle
            en cours, déjà réglée ; aucun remboursement au prorata n&apos;est dû. Les documents déjà
            générés (baux signés, quittances, états des lieux) restent accessibles et téléchargeables.
            <strong> Les crédits d&apos;audit achetés séparément ne sont jamais affectés par la
            résiliation de l&apos;abonnement.</strong>
          </p>
          <p className="mt-2">
            <strong>Rétractation.</strong> Le consommateur dispose de quatorze (14) jours pour se
            rétracter de la souscription (art. L221-18) ; s&apos;il a demandé l&apos;exécution
            immédiate du service, il est redevable du montant correspondant au service fourni
            jusqu&apos;à sa décision de se rétracter (art. L221-25).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Commande et paiement</h2>
          <p>
            Le paiement s&apos;effectue en ligne, en une fois, de manière sécurisée via notre prestataire
            de paiement Stripe. Le paiement est exigible immédiatement à la commande. Aucune donnée
            bancaire n&apos;est conservée par Maison Patrimo. La confirmation de commande et le
            justificatif de paiement sont adressés par email ; l&apos;historique des paiements est
            accessible depuis le compte (portail de facturation).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Fourniture du service</h2>
          <p>
            Après validation du paiement, le service (déblocage de la comparaison et quota
            d&apos;audits) est <strong>activé immédiatement</strong> sur le compte de
            l&apos;utilisateur. En validant sa commande, l&apos;utilisateur{' '}
            <strong>demande expressément l&apos;exécution immédiate du service</strong>, avant
            l&apos;expiration du délai de rétractation.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Droit de rétractation</h2>
          <p>
            Conformément aux articles L221-18 et suivants du Code de la consommation, le consommateur
            dispose en principe d&apos;un délai de quatorze (14) jours à compter de la conclusion du
            contrat pour exercer son droit de rétractation. Toutefois, en application de
            l&apos;article L221-28 1°, ce droit ne peut plus être exercé pour un service{' '}
            <strong>pleinement exécuté avant la fin du délai</strong> lorsque l&apos;exécution a commencé
            avec l&apos;accord préalable exprès du consommateur et renoncement exprès à son droit de
            rétractation — accord et renoncement matérialisés au moment du paiement (le service étant
            activé immédiatement, cf. article 4).
          </p>
          <p className="mt-2">
            Si le service n&apos;a pas été pleinement exécuté (notamment lorsqu&apos;aucun audit du pack
            n&apos;a été consommé), le consommateur peut exercer son droit de rétractation dans le délai
            de 14 jours en écrivant à{' '}
            <a href="mailto:contact@maisonpatrimo.com" className="text-cobalt hover:underline">
              contact@maisonpatrimo.com
            </a>{' '}
            (ou au moyen du formulaire ci-dessous). Le remboursement intervient dans les 14 jours de la
            demande, déduction faite, le cas échéant, d&apos;un montant proportionnel au service déjà
            fourni jusqu&apos;à la communication de la décision de se rétracter (art. L221-25).
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-slate-900">Formulaire type de rétractation</p>
            <p className="mt-1">
              (Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous
              rétracter du contrat.)
            </p>
            <p className="mt-2">
              À l&apos;attention de Maison Patrimo — contact@maisonpatrimo.com : je vous notifie par la
              présente ma rétractation du contrat portant sur la prestation de services ci-dessous :
              <br />— Commandé le : … / Offre : … / Logement concerné : …
              <br />— Nom et adresse email du consommateur : …
              <br />— Date : …
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Garanties et réclamations</h2>
          <p>
            Maison Patrimo est tenue de la garantie légale de conformité applicable aux services
            numériques (articles L224-25-12 et suivants du Code de la consommation) et des garanties
            légales de droit commun. Pour toute réclamation, l&apos;utilisateur peut contacter le
            service client à l&apos;adresse{' '}
            <a href="mailto:contact@maisonpatrimo.com" className="text-cobalt hover:underline">
              contact@maisonpatrimo.com
            </a>
            . Une réponse est apportée dans un délai raisonnable.
          </p>
          <p className="mt-2">
            <strong>Limitation de responsabilité.</strong> Le service constitue une aide à la décision
            (obligation de moyens) : Maison Patrimo ne garantit pas la solvabilité du locataire ni le
            paiement effectif des loyers. Sa responsabilité ne saurait être engagée au titre des impayés,
            retards de paiement ou dégradations imputables au locataire postérieurement à l&apos;analyse,
            dans les conditions de l&apos;article 6 des{' '}
            <Link href="/terms" className="text-cobalt hover:underline">CGU</Link> et dans les limites de
            la loi (art. 1231-1, 1231-3 et 1170 du Code civil ; art. L212-1 du Code de la consommation
            pour les utilisateurs non-professionnels).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Médiation de la consommation</h2>
          <p>
            Conformément aux articles L611-1 et suivants du Code de la consommation, tout consommateur a
            le droit de recourir gratuitement à un médiateur de la consommation en vue de la résolution
            amiable d&apos;un litige, après avoir adressé une réclamation écrite au service client restée
            infructueuse. {MEDIATOR ? (
              <>Le médiateur compétent est : <strong>{MEDIATOR.name}</strong>, {MEDIATOR.address} —{' '}
              <a href={MEDIATOR.website} className="text-cobalt hover:underline" rel="noopener noreferrer" target="_blank">{MEDIATOR.website}</a>.</>
            ) : (
              <>La désignation de notre médiateur de la consommation est en cours ; ses coordonnées
              seront publiées ici et communiquées sur simple demande à contact@maisonpatrimo.com.</>
            )} Le consommateur peut également utiliser la plateforme européenne de
            règlement en ligne des litiges :{' '}
            <a
              href="https://ec.europa.eu/consumers/odr"
              className="text-cobalt hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              ec.europa.eu/consumers/odr
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Données personnelles</h2>
          <p>
            Le traitement des données personnelles dans le cadre des commandes est décrit dans notre{' '}
            <Link href="/privacy" className="text-cobalt hover:underline">politique de confidentialité</Link>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">9. Droit applicable et litiges</h2>
          <p>
            Les présentes CGV sont soumises au droit français. En cas de litige et à défaut de résolution
            amiable (réclamation puis médiation, cf. article 7), le consommateur peut saisir, à son
            choix, l&apos;une des juridictions territorialement compétentes en vertu du Code de procédure
            civile, ou la juridiction du lieu où il demeurait au moment de la conclusion du contrat
            (art. R631-3 du Code de la consommation). Pour les utilisateurs professionnels, compétence
            exclusive est attribuée au tribunal des activités économiques du siège de l&apos;éditeur.
          </p>
        </div>
      </section>

      <p className="text-xs text-slate-400 mt-12">
        Version du {formatLegalDate(LEGAL_VERSIONS.cgv.date)}. Voir aussi les{' '}
        <Link href="/terms" className="text-cobalt hover:underline">CGU</Link> et les{' '}
        <Link href="/mentions-legales" className="text-cobalt hover:underline">mentions légales</Link>.
      </p>
    </div>
  );
}
