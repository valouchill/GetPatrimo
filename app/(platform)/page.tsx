'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Shield,
  Eye,
  FileCheck,
  Sparkles,
} from 'lucide-react';
import HeroFastTrack from '@/app/components/HeroFastTrack';

const HERO_ID = 'hero-fast-track';

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);

  const scrollToHero = () => {
    document.getElementById(HERO_ID)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* ——— 1. Hero Header (Accroche + Fast-Track intégré) ——— */}
      <section
        ref={heroRef}
        className="relative pt-16 pb-24 md:pt-24 md:pb-32 px-6"
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-amber-600 text-sm font-medium tracking-wider uppercase mb-4"
          >
            ✨ La nouvelle norme de gestion locative
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="font-serif text-4xl md:text-5xl lg:text-6xl xl:text-7xl text-slate-900 leading-tight tracking-tight mb-6"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Ne laissez plus le hasard choisir vos locataires.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.16 }}
            className="text-slate-500 text-lg md:text-xl max-w-2xl mx-auto mb-2"
          >
            Fini les dossiers falsifiés et le tri chronophage. PatrimoTrust audite vos candidats par IA, certifie leurs revenus et génère votre bail automatiquement.
          </motion.p>

          <HeroFastTrack id={HERO_ID} />
        </div>
      </section>

      {/* ——— 2. Bandeau de Réassurance (Social Proof) ——— */}
      <section className="border-y border-slate-200 bg-white/60 py-4">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-sm text-slate-500 font-medium">
            Analyse forensique IA • Biométrie Didit™ • Chiffrement AES-256 • Conformité RGPD
          </p>
        </div>
      </section>

      {/* ——— 3. Les 3 Piliers (Proposition de valeur) ——— */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4 }}
            className="bg-white/60 backdrop-blur-md rounded-3xl p-8 border border-white hover:shadow-xl transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 text-amber-600">
              <Eye className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl text-slate-900 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
              Audit anti-fraude IA
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Nous analysons les métadonnées de chaque fiche de paie et vérifions l&apos;identité des candidats par biométrie. Zéro fraude tolérée.
            </p>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="bg-white/60 backdrop-blur-md rounded-3xl p-8 border border-white hover:shadow-xl transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 text-emerald-600">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl text-slate-900 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
              Le bouclier LeBonCoin
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Ne donnez plus vos coordonnées. Fournissez votre &quot;Sésame PatrimoTrust&quot; aux candidats pour qu&apos;ils déposent leur dossier dans votre coffre-fort.
            </p>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4, delay: 0.16 }}
            className="bg-white/60 backdrop-blur-md rounded-3xl p-8 border border-white hover:shadow-xl transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 text-amber-600">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl text-slate-900 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
              Le bail instantané
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Dès qu&apos;un dossier Grade S vous séduit, validez-le d&apos;un clic. Le bail conforme aux lois de 2026 est généré et prêt à être signé.
            </p>
          </motion.article>
        </div>
      </section>

      {/* ——— 4. Preuve par l'exemple (Passeport Locataire) ——— */}
      <section className="bg-slate-900 text-white py-24 md:py-32 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex-1"
          >
            <h2 className="font-serif text-3xl md:text-4xl text-white mb-4 leading-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              Le seul dossier que vous aurez envie de lire.
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed">
              Oubliez les PDF illisibles et les mails perdus. Visualisez instantanément la fiabilité financière de vos candidats grâce à l&apos;Indice de Résilience PatrimoTrust.
            </p>
            <div className="mt-8 flex items-center gap-3 text-emerald-400">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Jauge de solvabilité • Sceau S • Avis de l&apos;IA</span>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 flex justify-center lg:justify-end"
          >
            <div className="relative w-full max-w-[280px] aspect-[9/19] rounded-[2.5rem] border-4 border-slate-700 bg-slate-800 shadow-2xl overflow-hidden">
              <div className="absolute inset-4 rounded-[2rem] bg-gradient-to-br from-slate-700 to-slate-800 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                  <span className="text-2xl">🛡️</span>
                </div>
                <p className="text-white font-semibold text-lg">Grade S</p>
                <p className="text-slate-400 text-sm mt-1">Dossier Stratégique</p>
                <div className="mt-6 w-full h-2 bg-slate-600 rounded-full overflow-hidden">
                  <div className="h-full w-[92%] bg-emerald-500 rounded-full" />
                </div>
                <p className="text-slate-400 text-xs mt-2">Indice de Résilience 92%</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ——— 5. Call-to-Action Final (Footer) ——— */}
      <section className="bg-slate-50 py-24 md:py-32 px-6 border-t border-slate-100">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-serif text-3xl md:text-4xl text-slate-900 mb-6" style={{ fontFamily: 'Playfair Display, serif' }}>
            Prêt à déléguer la sécurité de votre patrimoine à l&apos;IA ?
          </h2>
          <button
            type="button"
            onClick={scrollToHero}
            className="inline-flex items-center gap-2 px-10 py-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all text-lg"
          >
            Créer mon espace Propriétaire
            <span className="text-xl">→</span>
          </button>
          <p className="text-slate-500 text-sm mt-4">
            Retour en haut de page pour saisir l&apos;adresse de votre bien.
          </p>
        </div>
      </section>

      <footer className="bg-white border-t border-slate-200 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} PatrimoTrust™ • GetPatrimo. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/auth/login" className="text-slate-500 hover:text-slate-900 transition-colors">
              Connexion
            </Link>
            <Link href="/fast-track" className="text-slate-500 hover:text-slate-900 transition-colors">
              Formulaire Éclair
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
