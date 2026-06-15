import Link from 'next/link';

export const metadata = {
  title: 'Conditions générales de vente — Maison Patrimo',
};

/**
 * CGV — trame à compléter par l'équipe juridique. Les passages [À COMPLÉTER]
 * doivent être remplis (SIRET, médiateur, etc.) avant la mise en vente live.
 */
export default function CGV() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Conditions générales de vente</h1>

      <p className="text-sm text-slate-500 mb-8">
        Les présentes conditions générales de vente (ci-après « CGV ») régissent la vente des services
        payants de la plateforme Maison Patrimo, éditée par Maison Patrimo SAS [À COMPLÉTER : SIRET, RCS,
        siège social]. Elles complètent les{' '}
        <Link href="/terms" className="text-cobalt hover:underline">CGU</Link> et la{' '}
        <Link href="/privacy" className="text-cobalt hover:underline">politique de confidentialité</Link>.
      </p>

      <section className="space-y-8 text-slate-700 leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Objet</h2>
          <p>
            Les présentes CGV définissent les conditions de vente des offres payantes proposées par
            Maison Patrimo (analyse IA des dossiers locataires, génération du Passeport Locatif et
            services associés). Toute commande d&apos;une offre payante implique l&apos;acceptation
            sans réserve des présentes CGV.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Offres et prix</h2>
          <p>
            Les services sont commercialisés sous forme d&apos;<strong>offres à paiement unique</strong>
            {' '}(sans abonnement), par bien immobilier :
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Essentiel</strong> — [À COMPLÉTER : prix TTC et contenu]</li>
            <li><strong>Pro</strong> — 39,90 € TTC par logement [À COMPLÉTER : préciser le contenu exact].</li>
            <li><strong>Pro max</strong> — 59,90 € TTC par logement [À COMPLÉTER].</li>
          </ul>
          <p className="mt-2">
            Les prix sont indiqués en euros toutes taxes comprises. Maison Patrimo SAS se réserve le droit
            de modifier ses prix à tout moment ; l&apos;offre applicable est celle en vigueur au moment de
            la commande.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Commande et paiement</h2>
          <p>
            Le paiement s&apos;effectue en ligne, de manière sécurisée, via notre prestataire de paiement
            Stripe. Le paiement est exigible immédiatement à la commande. Aucune donnée bancaire
            n&apos;est conservée par Maison Patrimo. La commande est confirmée par email.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Fourniture du service</h2>
          <p>
            Après validation du paiement, le service (quota d&apos;analyses IA) est{' '}
            <strong>activé immédiatement</strong> sur le compte de l&apos;utilisateur. La fourniture du
            service débute donc dès la commande, avec l&apos;accord exprès de l&apos;utilisateur.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Droit de rétractation</h2>
          <p>
            Conformément aux articles L221-18 et suivants du Code de la consommation, le consommateur
            dispose en principe d&apos;un délai de quatorze (14) jours pour exercer son droit de
            rétractation. Toutefois, en application de l&apos;article L221-28, ce droit ne peut être
            exercé pour les services <strong>pleinement exécutés avant la fin du délai</strong> lorsque
            l&apos;exécution a commencé avec l&apos;accord exprès du consommateur et renoncement exprès à
            son droit de rétractation. [À COMPLÉTER : modalités exactes, formulaire de rétractation type.]
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Garanties et réclamations</h2>
          <p>
            Maison Patrimo est tenue des garanties légales de conformité et des vices cachés. Pour toute
            réclamation, l&apos;utilisateur peut contacter le service client à l&apos;adresse [À COMPLÉTER :
            email de contact]. En cas de litige non résolu, l&apos;utilisateur peut recourir gratuitement
            au médiateur de la consommation [À COMPLÉTER : coordonnées du médiateur].
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Données personnelles</h2>
          <p>
            Le traitement des données personnelles dans le cadre des commandes est décrit dans notre{' '}
            <Link href="/privacy" className="text-cobalt hover:underline">politique de confidentialité</Link>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Droit applicable et litiges</h2>
          <p>
            Les présentes CGV sont soumises au droit français. En cas de litige, et à défaut de
            résolution amiable, les tribunaux français seront seuls compétents [À COMPLÉTER : juridiction
            compétente].
          </p>
        </div>
      </section>

      <p className="text-xs text-slate-400 mt-12">
        Document à valeur contractuelle — version en cours de finalisation juridique.
        Voir aussi les <Link href="/terms" className="text-cobalt hover:underline">CGU</Link>.
      </p>
    </div>
  );
}
