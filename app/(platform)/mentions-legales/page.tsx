import { LEGAL_VERSIONS, formatLegalDate } from '@/lib/legal/versions';
import { COMPANY, HOST, legalValue } from '@/lib/legal/company';
import Link from 'next/link';

export const metadata = {
  title: 'Mentions légales — Maison Patrimo',
};

export default function MentionsLegales() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Mentions légales</h1>

      <p className="text-sm text-slate-500 mb-8">
        Conformément aux dispositions de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans
        l&apos;économie numérique (LCEN), article 6-III.
      </p>

      <section className="space-y-6 text-slate-700 leading-relaxed">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Éditeur du site</h2>
          <ul className="list-none space-y-1">
            <li><strong>Raison sociale :</strong> {legalValue(COMPANY.legalName)}</li>
            <li><strong>Forme juridique :</strong> {legalValue(COMPANY.legalForm)}</li>
            <li><strong>Capital social :</strong> {legalValue(COMPANY.capital)}</li>
            <li><strong>SIRET :</strong> {legalValue(COMPANY.siret)}</li>
            <li><strong>RCS :</strong> {legalValue(COMPANY.rcs)}</li>
            <li><strong>Siège social :</strong> {legalValue(COMPANY.headquarters)}</li>
            <li><strong>Directeur de la publication :</strong> {legalValue(COMPANY.publicationDirector)}</li>
            <li><strong>Email :</strong> {COMPANY.email}</li>
            <li><strong>Téléphone :</strong> {legalValue(COMPANY.phone)}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">2. Hébergeur</h2>
          <ul className="list-none space-y-1">
            <li><strong>Raison sociale :</strong> {HOST.legalName}</li>
            <li><strong>Adresse :</strong> {HOST.address}</li>
            <li><strong>Téléphone :</strong> {HOST.phone}</li>
            <li><strong>Site :</strong> {HOST.website}</li>
          </ul>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Propriété intellectuelle</h2>
          <p>
            L&apos;ensemble du contenu de ce site (textes, images, vidéos, graphismes, logo, icônes,
            sons, logiciels, etc.) est la propriété exclusive de Maison Patrimo SAS ou de ses partenaires,
            et est protégé par les lois françaises et internationales relatives à la propriété
            intellectuelle. Toute reproduction, représentation, modification, publication ou adaptation
            de tout ou partie des éléments du site est interdite sans autorisation écrite préalable.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">4. Données personnelles</h2>
          <p>
            Les informations relatives au traitement de vos données personnelles sont détaillées dans
            notre{' '}
            <Link href="/privacy" className="text-cobalt hover:underline">
              Politique de confidentialité
            </Link>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Cookies</h2>
          <p>
            Le site utilise des cookies strictement nécessaires à son fonctionnement (authentification,
            préférences de session). Pour plus d&apos;informations, consultez notre{' '}
            <Link href="/privacy#cookies" className="text-cobalt hover:underline">
              section Cookies
            </Link>.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">6. Limitation de responsabilité</h2>
          <p>
            Maison Patrimo SAS s&apos;efforce de fournir des informations exactes et à jour sur ce site.
            Toutefois, elle ne peut garantir l&apos;exactitude, la complétude ou l&apos;actualité des
            informations diffusées. L&apos;utilisateur est seul responsable de l&apos;utilisation qu&apos;il
            fait des informations et contenus disponibles sur le site.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">7. Droit applicable</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. Tout litige relatif à
            l&apos;utilisation du site sera soumis à la compétence exclusive des tribunaux français.
          </p>
        </div>
      </section>

      <div className="mt-12 pt-6 border-t border-slate-200 text-sm text-slate-500">
        Dernière mise à jour : {formatLegalDate(LEGAL_VERSIONS.mentions.date)}
      </div>
    </div>
  );
}
