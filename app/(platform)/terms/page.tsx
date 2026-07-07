import Link from 'next/link';

export const metadata = {
  title: 'Conditions générales d\'utilisation — Maison Patrimo',
};

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Conditions générales d&apos;utilisation</h1>

      <p className="text-sm text-slate-500 mb-8">
        Les présentes conditions générales d&apos;utilisation (ci-après « CGU ») régissent l&apos;accès
        et l&apos;utilisation de la plateforme Maison Patrimo, éditée par Maison Patrimo SAS.
      </p>

      <section className="space-y-8 text-slate-700 leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Objet</h2>
          <p>
            Maison Patrimo est une plateforme de gestion locative en ligne permettant aux propriétaires
            bailleurs de gérer leurs biens immobiliers, leurs baux, leurs locataires et les documents
            associés. Les présentes CGU définissent les droits et obligations des utilisateurs dans le
            cadre de l&apos;utilisation du service.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Acceptation des CGU</h2>
          <p>
            L&apos;inscription sur la plateforme implique l&apos;acceptation pleine et entière des
            présentes CGU. L&apos;utilisateur reconnaît en avoir pris connaissance et s&apos;engage à les
            respecter. Maison Patrimo SAS se réserve le droit de modifier les CGU à tout moment.
            L&apos;utilisateur sera informé de toute modification par email ou notification dans
            l&apos;application.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Accès au service</h2>
          <p>
            L&apos;accès à la plateforme nécessite la création d&apos;un compte utilisateur avec une
            adresse email valide. L&apos;utilisateur est responsable de la confidentialité de ses
            identifiants de connexion et de toute activité réalisée depuis son compte.
          </p>
          <p className="mt-2">
            Maison Patrimo SAS se réserve le droit de suspendre ou supprimer un compte en cas de
            non-respect des présentes CGU, sans préjudice de tout dommage et intérêt.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Description du service</h2>
          <p>La plateforme propose notamment les fonctionnalités suivantes :</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Gestion de biens immobiliers et de leurs diagnostics techniques</li>
            <li>Création et gestion de baux conformes à la loi ALUR</li>
            <li>Suivi des loyers, quittances et relances de paiement</li>
            <li>États des lieux d&apos;entrée et de sortie</li>
            <li>Vérification d&apos;identité des candidats locataires</li>
            <li>Scoring de dossiers de candidature</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Obligations de l&apos;utilisateur</h2>
          <p>L&apos;utilisateur s&apos;engage à :</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Fournir des informations exactes et à jour lors de son inscription et de l&apos;utilisation du service</li>
            <li>Utiliser la plateforme conformément à la législation en vigueur, notamment la loi n° 89-462 du 6 juillet 1989, la loi ALUR et la loi ÉLAN</li>
            <li>Ne pas demander aux candidats locataires des documents interdits par le décret n° 2015-1437</li>
            <li>Respecter les plafonds de dépôt de garantie (1 mois de loyer hors charges pour les locations vides, 2 mois pour les meublées)</li>
            <li>Ne pas utiliser la plateforme à des fins discriminatoires au sens de la loi n° 2008-496</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Responsabilité</h2>
          <p>
            Maison Patrimo SAS met à disposition un outil de gestion et ne se substitue pas au
            propriétaire bailleur dans ses obligations légales. L&apos;utilisateur reste seul
            responsable du respect de la réglementation applicable à ses baux et à la gestion de ses
            biens.
          </p>
          <p className="mt-2">
            Maison Patrimo SAS ne saurait être tenue responsable des dommages directs ou indirects
            résultant de l&apos;utilisation ou de l&apos;impossibilité d&apos;utiliser le service,
            notamment en cas d&apos;interruption, de dysfonctionnement ou de perte de données.
          </p>
          <p className="mt-2">
            <strong>6.2 — Analyses assistées par intelligence artificielle.</strong> Les indicateurs
            produits par le service (extraction de données, contrôles de cohérence documentaire,
            signaux d&apos;alerte, scores) sont générés par des traitements automatisés et présentent un
            caractère strictement <strong>indicatif</strong>. Ils constituent une aide à la décision :
            ils ne produisent aucune décision automatique et ne dispensent pas l&apos;utilisateur
            bailleur d&apos;une vérification humaine des pièces. La décision de retenir ou non une
            candidature relève exclusivement de l&apos;utilisateur bailleur (art. 22 RGPD). Toute
            personne concernée peut contester un résultat d&apos;analyse et obtenir un réexamen humain
            dans les conditions décrites par la Politique de Confidentialité.
          </p>
          <p className="mt-2">
            <strong>6.3 — Solvabilité et comportement du locataire.</strong> Le service repose sur les
            pièces communiquées par le candidat à un instant donné et sur des traitements automatisés.
            Maison Patrimo SAS est tenue à une <strong>obligation de moyens</strong>, et non de résultat :
            elle ne garantit ni l&apos;authenticité ou l&apos;exhaustivité des documents fournis par des
            tiers, ni le <strong>comportement futur du locataire</strong>, en particulier sa solvabilité,
            le paiement effectif des loyers et charges, ou l&apos;absence de dégradations. En conséquence,
            Maison Patrimo SAS ne saurait être tenue responsable des impayés de loyer, retards de paiement,
            dégradations ou de tout préjudice survenant postérieurement à l&apos;analyse ou à la conclusion
            du bail. Le choix de retenir un candidat, ainsi que la souscription de garanties (dépôt de
            garantie, caution solidaire, garantie Visale, assurance contre les loyers impayés), relèvent
            de la seule appréciation du bailleur, qui demeure libre de procéder à ses propres vérifications.
          </p>
          <p className="mt-2">
            Cette limitation s&apos;applique dans les limites permises par la loi : elle ne couvre pas la
            faute lourde ou dolosive de Maison Patrimo SAS, ne prive pas l&apos;obligation essentielle du
            service de sa substance (art. 1170 du Code civil) et ne saurait, à l&apos;égard d&apos;un
            utilisateur non-professionnel, créer un déséquilibre significatif au sens de l&apos;article
            L.212-1 du Code de la consommation. La réparation éventuelle est limitée aux dommages directs
            et prévisibles (art. 1231-1 et 1231-3 du Code civil).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble des éléments composant la plateforme (logiciel, interface, textes, images,
            logos) sont protégés par le droit de la propriété intellectuelle. Toute reproduction ou
            utilisation non autorisée est interdite.
          </p>
          <p className="mt-2">
            Les documents générés par la plateforme (baux, quittances, états des lieux) appartiennent
            à l&apos;utilisateur qui les a créés.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">8. Protection des données personnelles</h2>
          <p>
            Le traitement des données personnelles est régi par notre{' '}
            <Link href="/privacy" className="text-cobalt hover:underline">
              Politique de confidentialité
            </Link>,
            conforme au RGPD et à la Loi Informatique et Libertés.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">9. Résiliation</h2>
          <p>
            L&apos;utilisateur peut résilier son compte à tout moment depuis les paramètres de son
            profil. La résiliation entraîne la suppression des données personnelles dans les délais
            prévus par notre politique de confidentialité, sous réserve des obligations légales de
            conservation.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">10. Droit applicable et juridiction</h2>
          <p>
            Les présentes CGU sont régies par le droit français. Tout litige relatif à
            l&apos;interprétation ou l&apos;exécution des présentes CGU sera soumis aux juridictions
            françaises compétentes. L&apos;utilisateur consommateur peut saisir, à son choix, l&apos;une
            des juridictions territorialement compétentes en vertu du Code de procédure civile ou la
            juridiction du lieu où il demeurait au moment de la conclusion du contrat (art. R631-3 du
            Code de la consommation).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">11. Médiation</h2>
          <p>
            Conformément aux articles L.611-1 et suivants du Code de la consommation, en cas de litige
            non résolu, l&apos;utilisateur consommateur peut recourir gratuitement au service de
            médiation, après réclamation écrite préalable au service client. Le médiateur compétent
            est : [MÉDIATEUR À DÉSIGNER — nom, adresse et site internet].
          </p>
          <p className="mt-2">
            L&apos;utilisateur peut également recourir à la plateforme européenne de règlement en ligne
            des litiges :{' '}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-cobalt hover:underline"
            >
              https://ec.europa.eu/consumers/odr
            </a>.
          </p>
        </div>
      </section>

      <div className="mt-12 pt-6 border-t border-slate-200 text-sm text-slate-500">
        Dernière mise à jour : avril 2026
      </div>
    </div>
  );
}
