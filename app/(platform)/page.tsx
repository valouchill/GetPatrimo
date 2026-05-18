'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import Link from 'next/link';
import {
  Shield,
  Eye,
  FileCheck,
  Sparkles,
  CheckCircle2,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  Euro,
  Star,
  ChevronDown,
  BellRing,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import HeroFastTrack from '@/app/components/HeroFastTrack';
import { isEnabled } from '@/lib/features';

/* ─── Compteur animé ─────────────────────────────────────── */
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(ease * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, target]);

  return (
    <span ref={ref}>
      {count.toLocaleString('fr-FR')}
      {suffix}
    </span>
  );
}

/* ─── FAQ data ───────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: 'PatrimoTrust remplace-t-il une agence immobilière\u00a0?',
    a: "Non. PatrimoTrust automatise la partie la plus pénible — et la plus risquée — du métier d'agent\u00a0: l'audit des dossiers et la détection de fraude. Vous gardez le contrôle de la sélection et de la relation locataire. Pas de commission, pas de mandat, pas de dépendance.",
  },
  {
    q: 'Combien co\u00fbte PatrimoTrust\u00a0?',
    a: "Pendant la phase de lancement, PatrimoTrust est entièrement gratuit. Vous accédez à l'Audit Forensic complet, à l'Indice de Résilience et au Passeport Locatif PDF sans frais. Aucun engagement, aucun abonnement.",
  },
  {
    q: 'Comment PatrimoTrust vérifie-t-il les fiches de paie\u00a0?',
    a: "Nous utilisons Didit™, une technologie d'analyse de métadonnées et de biométrie faciale qui détecte les documents falsifiés, altérés ou générés par IA. Le candidat soumet ses documents depuis son téléphone\u00a0; notre IA les analyse en moins de 5\u00a0minutes et émet un verdict de certification.",
  },
  {
    q: "Qu'est-ce que le Passeport Locatif\u00a0?",
    a: "C'est le document PDF certifié et partageable du locataire. Il rassemble son Indice de Résilience, son Grade et la synthèse de son Audit Forensic. Vous le téléchargez en un clic depuis l'espace candidat — pratique pour confirmer un choix ou archiver le dossier.",
  },
  {
    q: 'Que se passe-t-il si je ne trouve pas de locataire\u00a0?',
    a: "Vous ne payez rien. Il n'y a aucun abonnement et aucun frais de dossier. Votre espace propriétaire reste actif aussi longtemps que vous en avez besoin, gratuitement.",
  },
  {
    q: 'Mes données et celles de mes candidats sont-elles sécurisées\u00a0?',
    a: "Absolument. PatrimoTrust est conforme RGPD. Les documents des candidats sont chiffrés, stockés dans un coffre-fort sécurisé (jamais partagés par e-mail), et accessibles uniquement par vous et le candidat concerné. Nous ne vendons et ne partageons aucune donnée.",
  },
  {
    q: "Puis-je utiliser PatrimoTrust en parallèle d'une agence\u00a0?",
    a: "Oui. PatrimoTrust est un outil complémentaire de tout dispositif existant. Vous pouvez l'utiliser uniquement pour certifier les dossiers de vos candidats, même si vous gérez la mise en relation par ailleurs.",
  },
];

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' } as const,
  transition: { duration: 0.4 },
};

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const scrollToHero = () => {
    document.getElementById('hero-fast-track')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">

      {/* ══════════════════════════════════════════
          1. HERO
      ══════════════════════════════════════════ */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-amber-500 text-sm font-semibold tracking-wider uppercase mb-4"
          >
            Zéro dossier falsifié. Zéro impayé.
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
            Fini les dossiers falsifiés et le tri chronophage. PatrimoTrust audite vos candidats par IA, certifie leurs revenus et vous remet un Indice de Résilience pour décider en 30\u00a0secondes.
          </motion.p>

          <HeroFastTrack id="hero-fast-track" />

          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Gratuit pour commencer
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-500" />
              Conforme ALUR &amp; RGPD
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-500" />
              Prêt en 2 minutes
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              +47 propriétaires inscrits cette semaine **
            </span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. BARRE DE PREUVE SOCIALE
      ══════════════════════════════════════════ */}
      <section className="border-y border-slate-100 bg-white py-10">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            <motion.div {...fadeInUp} className="flex flex-col items-center text-center px-8">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-4xl font-bold text-slate-900 tabular-nums">
                  <AnimatedCounter target={2847} />
                </span>
              </div>
              <p className="text-sm text-slate-500">propriétaires protégés **</p>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ duration: 0.4, delay: 0.08 }} className="flex flex-col items-center text-center px-8 pt-8 md:pt-0">
              <span className="text-4xl font-bold text-slate-900 mb-1">&lt;&nbsp;48h</span>
              <p className="text-sm text-slate-500">pour trouver un locataire Grade S **</p>
            </motion.div>

            <motion.div {...fadeInUp} transition={{ duration: 0.4, delay: 0.16 }} className="flex flex-col items-center text-center px-8 pt-8 md:pt-0">
              <span className="text-4xl font-bold text-slate-900 mb-1">0</span>
              <p className="text-sm text-slate-500">impayé déclaré sur les dossiers certifiés *</p>
            </motion.div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">* Parmi les dossiers certifiés PatrimoTrust à date. ** Données internes, avril 2026.</p>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. BANDEAU TECHNOLOGIES
      ══════════════════════════════════════════ */}
      <section className="border-b border-slate-100 bg-gradient-to-r from-amber-50/30 via-white to-amber-50/30 py-8">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs text-slate-400 uppercase tracking-wide mb-4">Certifié &amp; intégré avec</p>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {['Didit™', 'OpenSign', 'Stripe', 'OpenAI', 'Brevo'].map((tech) => (
              <span key={tech} className="text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. SECTION DOULEUR / SCÉNARIO CAUCHEMAR
      ══════════════════════════════════════════ */}
      <section className="bg-slate-900 text-white py-20 md:py-28 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-start gap-12 lg:gap-20">
          {/* Colonne gauche — Pain points */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex-1"
          >
            <p className="text-amber-400 text-sm font-semibold tracking-wider uppercase mb-4">Le scénario habituel</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-white mb-10 leading-tight"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Vous avez déjà vécu l&apos;un de ces moments&nbsp;?
            </h2>

            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <TrendingDown className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">&ldquo;Un dossier complet… et 3 mois de loyers impayés.&rdquo;</p>
                  <p className="text-slate-400 text-sm leading-relaxed">Il avait tout fourni. Les fiches de paie semblaient parfaites. Trois mois plus tard, votre syndic vous confirmait que tout était fabriqué.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <BellRing className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">&ldquo;Votre numéro visible sur LeBonCoin pendant des semaines.&rdquo;</p>
                  <p className="text-slate-400 text-sm leading-relaxed">Des dizaines d&apos;appels. Des candidats non qualifiés. Votre vie privée exposée à quiconque voulait parcourir l&apos;annonce.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1 w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">&ldquo;Un bail signé à la main que personne ne comprend vraiment.&rdquo;</p>
                  <p className="text-slate-400 text-sm leading-relaxed">Et si une clause n&apos;est pas conforme à la loi de 2026, c&apos;est vous qui en payez les conséquences.</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Colonne droite — Feed de notifications */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 w-full"
          >
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 space-y-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                Sans PatrimoTrust
              </p>

              {[
                { color: 'bg-rose-500', text: 'Alerte — loyer de novembre non reçu', time: 'il y a 3j' },
                { color: 'bg-rose-500', text: 'LeBonCoin — 14 appels manqués', time: "aujourd'hui" },
                { color: 'bg-amber-400', text: "Votre bail 2019 n'est plus conforme ALUR", time: 'il y a 1 sem.' },
              ].map((notif, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${notif.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{notif.text}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{notif.time}</p>
                  </div>
                </div>
              ))}

              <div className="border-t border-white/10 pt-4 flex items-center gap-3 bg-emerald-500/10 rounded-xl px-4 py-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-emerald-300 text-sm font-semibold">Avec PatrimoTrust</p>
                  <p className="text-emerald-400/70 text-xs">0 alerte de ce type</p>
                </div>
              </div>
            </div>

            <p className="text-slate-400 text-sm text-center mt-6 italic">
              PatrimoTrust a été conçu pour que vous ne revivez plus jamais ces scénarios.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. COMMENT ÇA MARCHE  (id="features")
      ══════════════════════════════════════════ */}
      <section id="features" className="bg-slate-50 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-500 text-sm font-semibold tracking-wider uppercase mb-3">En 2 minutes chrono</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-slate-900"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Votre espace propriétaire, sans formulaire interminable.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: 1, icon: MapPin, title: "Saisissez l'adresse", desc: "Nous géolocalisons votre bien et créons votre coffre-fort sécurisé en quelques secondes." },
              { step: 2, icon: Euro, title: 'Loyer & surface', desc: "Ces données alimentent le ratio loyer/revenus appliqué par l'IA à chaque candidat." },
              { step: 3, icon: Shield, title: 'Recevez vos candidats', desc: 'Partagez votre Sésame PatrimoTrust. Les dossiers arrivent déjà vérifiés biométriquement.' },
              { step: 4, icon: FileCheck, title: 'Sélectionnez en 30 secondes', desc: 'Indice de Résilience, Grade S et Audit Forensic\u00a0: décidez en toute confiance, sans piège.' },
            ].map(({ step, icon: Icon, title, desc }, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="absolute top-4 right-4 text-5xl font-black text-amber-100 leading-none select-none">{step}</span>
                <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-4 text-amber-500">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              type="button"
              onClick={scrollToHero}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all"
            >
              Créer mon espace en 2 minutes
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. LES 3 PILIERS
      ══════════════════════════════════════════ */}
      <section className="py-20 md:py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-amber-500 text-sm font-semibold tracking-wider uppercase mb-3">Votre arsenal anti-risque</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-slate-900"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Trois certitudes là où les autres laissent le hasard décider.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Eye, title: 'Audit anti-fraude IA', desc: "Nous analysons les métadonnées de chaque fiche de paie et vérifions l'identité des candidats par biométrie. Zéro fraude tolérée." },
              { icon: Shield, title: 'Le bouclier LeBonCoin', desc: 'Ne donnez plus vos coordonnées. Fournissez votre "Sésame PatrimoTrust" aux candidats pour qu\'ils déposent leur dossier dans votre coffre-fort.' },
              { icon: FileCheck, title: 'Le Passeport Locatif', desc: "Chaque candidat repart avec un PDF certifié, partageable, contenant son Indice de Résilience et son Audit Forensic. Téléchargez-le d'un clic." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white/60 backdrop-blur-md rounded-3xl p-8 border border-white hover:shadow-xl transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mb-6 text-amber-500">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-serif text-xl text-slate-800 mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. PREUVE — MOCKUP GRADE S
      ══════════════════════════════════════════ */}
      <section className="bg-slate-900 text-white py-20 md:py-24 px-6 overflow-hidden">
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
                  <Shield className="w-8 h-8 text-amber-400" />
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

      {/* ══════════════════════════════════════════
          8. TÉMOIGNAGES
      ══════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-500 text-sm font-semibold tracking-wider uppercase mb-3">Ils ont fait confiance à PatrimoTrust</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-slate-900"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Ce que nos propriétaires disent.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                initials: 'MD',
                color: 'bg-emerald-500',
                name: 'Marie-Dominique L.',
                location: 'Propriétaire · Paris 11e',
                quote: "J'avais eu un locataire indélicat il y a deux ans. Avec PatrimoTrust, j'ai reçu 12 dossiers en 4 jours. J'ai choisi le Grade S en 20 minutes — sans la moindre hésitation.",
                badge: 'Locataire choisi en 24h',
                badgeClass: 'bg-emerald-50 text-emerald-700',
              },
              {
                initials: 'TB',
                color: 'bg-amber-500',
                name: 'Thomas B.',
                location: 'Investisseur · Lyon, 3 biens',
                quote: "Je gère 3 appartements seul, sans agence. La certif biométrique de PatrimoTrust m'a évité une fraude évidente sur la dernière sélection. L'IA voit ce que je ne voyais pas.",
                badge: '3 biens gérés',
                badgeClass: 'bg-slate-100 text-slate-700',
              },
              {
                initials: 'SC',
                color: 'bg-amber-500',
                name: 'Sophie C.',
                location: 'Propriétaire · Bordeaux',
                quote: "Ce que j'aimais avant c'était de voir les candidats en vrai. Mais l'Indice de Résilience m'a donné plus d'informations en 30 secondes que 3 visites. C'est bluffant.",
                badge: "Zéro impayé depuis l'inscription",
                badgeClass: 'bg-emerald-50 text-emerald-700',
              },
            ].map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-slate-50 rounded-2xl p-7 border border-slate-100 flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-full ${t.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.location}</p>
                  </div>
                </div>

                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>

                <p className="text-slate-600 text-sm leading-relaxed flex-1 mb-5">&ldquo;{t.quote}&rdquo;</p>

                <span className={`inline-block self-start text-xs font-semibold px-3 py-1 rounded-full ${t.badgeClass}`}>
                  {t.badge}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          9. PRICING  (id="pricing")
          V1 — affiché uniquement si OWNER_PAYWALL activé
      ══════════════════════════════════════════ */}
      {isEnabled('OWNER_PAYWALL') && (
      <section id="pricing" className="bg-slate-50 py-20 md:py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-500 text-sm font-semibold tracking-wider uppercase mb-3">Tarification transparente</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Gratuit pour commencer. Payant uniquement quand vous trouvez.
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Zéro abonnement. Zéro engagement. Vous payez une seule fois, au moment de la signature.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Tier Gratuit */}
            <motion.div
              {...fadeInUp}
              className="bg-white rounded-2xl p-8 border border-slate-200 flex flex-col"
            >
              <h3 className="font-bold text-slate-900 text-xl mb-1">Coffre-Fort Propriétaire</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-black text-slate-900">0&nbsp;€</span>
                <span className="text-slate-500 text-sm">/ mois</span>
              </div>
              <p className="text-slate-500 text-sm mb-6">Pour commencer à recevoir vos candidats.</p>

              <ul className="space-y-3 mb-8 flex-1">
                {[
                  'Espace propriétaire sécurisé',
                  'Sésame PatrimoTrust (lien unique)',
                  'Réception des dossiers certifiés IA',
                  "Aperçu du Grade et de l'Indice de Résilience",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={scrollToHero}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors"
              >
                Créer mon espace gratuit →
              </button>
            </motion.div>

            {/* Tier Payant */}
            <motion.div
              {...fadeInUp}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="bg-white rounded-2xl p-8 border-2 border-amber-500 flex flex-col relative shadow-xl shadow-amber-500/10"
            >
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                Le plus choisi
              </span>
              <h3 className="font-bold text-slate-900 text-xl mb-1">Mise en Location Sécurisée</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-black text-slate-900">89&nbsp;€</span>
                <span className="text-slate-500 text-sm">/ bien</span>
              </div>
              <p className="text-amber-600 text-xs font-medium mb-6">Paiement unique au moment de sélectionner un locataire.</p>

              <ul className="space-y-3 mb-4 flex-1">
                {[
                  'Tout ce qui est inclus dans Gratuit',
                  'Audit complet des dossiers (données cachées)',
                  'Bail conforme 2026 généré automatiquement',
                  'Signature électronique via OpenSign',
                  "Module état des lieux d'entrée",
                  'Garantie de conformité ALUR',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="text-slate-400 text-xs mb-6">
                Soit 89&nbsp;€ pour un locataire sur 3 ans = <strong className="text-slate-600">2,50&nbsp;€/mois</strong>. Moins qu&apos;un café pour protéger votre patrimoine.
              </p>

              <button
                type="button"
                onClick={scrollToHero}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-colors"
              >
                Commencer gratuitement →
              </button>
            </motion.div>
          </div>

          {/* Bandeau urgence */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 flex items-center gap-3">
            <span className="text-xl shrink-0">⏰</span>
            <p className="text-amber-800 text-sm">
              <strong>Offre de lancement</strong> — 312 propriétaires sur 500 ont déjà rejoint PatrimoTrust ce mois-ci. Places à tarif préférentiel limitées.
            </p>
          </div>
        </div>
      </section>
      )}

      {/* V1 — Section "Gratuit pendant la phase de lancement" (en remplacement du pricing) */}
      {!isEnabled('OWNER_PAYWALL') && (
        <section id="pricing" className="bg-slate-50 py-20 md:py-28 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-amber-500 text-sm font-semibold tracking-wider uppercase mb-3">Phase de lancement</p>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
              Entièrement gratuit pendant le lancement.
            </h2>
            <p className="text-slate-500 text-lg mb-10">
              Audit Forensic illimité, Indice de Résilience, Passeport Locatif PDF. Aucun abonnement, aucun frais caché.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              {[
                { icon: Shield, label: 'Audit Forensic illimité' },
                { icon: Sparkles, label: 'Indice de Résilience certifié' },
                { icon: FileCheck, label: 'Passeport Locatif PDF' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="bg-white border border-slate-200 rounded-2xl px-5 py-6 flex flex-col items-center gap-3">
                  <Icon className="w-6 h-6 text-emerald-500" />
                  <p className="font-semibold text-slate-900 text-sm">{label}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={scrollToHero}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all"
            >
              Créer mon espace gratuit
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          10. FAQ / OBJECTIONS
      ══════════════════════════════════════════ */}
      <section className="bg-white py-20 md:py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-amber-500 text-sm font-semibold tracking-wider uppercase mb-3">Questions fréquentes</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-slate-900"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Tout ce que vous voulez savoir.
            </h2>
          </div>

          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="border border-slate-100 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="font-semibold text-slate-900 text-sm">{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-slate-600 text-sm leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          11. CTA FINAL — formulaire inline
      ══════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-start gap-12 lg:gap-20">
          {/* Colonne gauche — Copy */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex-1"
          >
            <p className="text-amber-400 text-sm font-semibold tracking-wider uppercase mb-4">Dernier appel</p>
            <h2
              className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Votre prochain locataire attend d&apos;être certifié.
            </h2>
            <p className="text-slate-300 text-lg mb-8 leading-relaxed">
              Créez votre espace propriétaire en 2 minutes. Recevez vos premiers dossiers certifiés sous 48h.
            </p>

            <div className="space-y-3">
              {['Sans abonnement', 'Conforme ALUR & RGPD', 'Support français inclus'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Colonne droite — Formulaire inline */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 w-full"
          >
            <HeroFastTrack id="cta-fast-track" />
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════ */}
      <footer className="bg-white border-t border-slate-200 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} PatrimoTrust™ · GetPatrimo. Tous droits réservés.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/auth/login" className="text-slate-500 hover:text-slate-900 transition-colors">
              Connexion
            </Link>
            <Link href="/fast-track" className="text-slate-500 hover:text-slate-900 transition-colors">
              Formulaire Éclair
            </Link>
            <a href="#pricing" className="text-slate-500 hover:text-slate-900 transition-colors">
              Tarifs
            </a>
            <Link href="/mentions-legales" className="text-slate-500 hover:text-slate-900 transition-colors">
              Mentions légales
            </Link>
            <Link href="/privacy" className="text-slate-500 hover:text-slate-900 transition-colors">
              Confidentialité
            </Link>
            <Link href="/terms" className="text-slate-500 hover:text-slate-900 transition-colors">
              CGU
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
