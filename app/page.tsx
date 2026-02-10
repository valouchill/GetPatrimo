"use client";

import { motion } from "framer-motion";
import { Search, Check, Shield, Clock, HeartHandshake } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col font-sans">
      {/* Navigation */}
      <nav className="fixed w-full z-50 px-6 py-4 flex justify-between items-center bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="font-serif text-2xl font-bold text-navy">GetPatrimo</div>
        <div className="flex gap-4">
          <Link href="/login.html" className="px-4 py-2 text-navy hover:text-navy/80 font-medium transition-colors">
            Se connecter
          </Link>
          <Link href="/register.html" className="px-6 py-2 bg-navy text-white rounded-full hover:bg-navy/90 transition-colors font-medium">
            Créer un compte
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 lg:h-screen lg:pt-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Image (Mobile: Top) */}
        <div className="lg:w-1/2 h-64 lg:h-full relative bg-slate-200 order-first lg:order-first">
          <Image 
            src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2053&auto=format&fit=crop"
            alt="Architecture minimaliste"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-navy/10" />
        </div>

        {/* Right: Content */}
        <div className="lg:w-1/2 flex flex-col justify-center px-8 lg:px-20 py-12 lg:py-0 bg-white">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-4xl lg:text-6xl text-navy leading-tight mb-8"
          >
            Votre patrimoine mérite une gestion d'exception.
          </motion.h1>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="w-full max-w-md"
          >
             <label className="block text-sm font-medium text-slate-500 mb-2">
               Commencez par importer votre annonce
             </label>
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Collez un lien LeBonCoin ou SeLoger..." 
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:border-navy focus:ring-1 focus:ring-navy outline-none shadow-sm transition-all"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-navy transition-colors" />
              <button className="absolute right-2 top-2 bottom-2 px-4 bg-emerald text-white rounded-lg font-medium hover:bg-emerald/90 transition-colors">
                Analyser
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pack Recrutement Banner */}
      <section className="bg-navy py-12 text-white">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="font-serif text-2xl mb-2">Pack Recrutement</h2>
            <p className="text-slate-300">Trouvez le locataire idéal sans effort. Multidiffusion, tri des dossiers, et vérification d'identité.</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-serif">49€</span>
            <button className="px-6 py-3 bg-white text-navy rounded-lg font-medium hover:bg-slate-100 transition-colors">
              Découvrir
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-serif text-3xl text-center text-navy mb-16">Nos offres de gestion</h2>
          
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Essentiel */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-serif text-xl text-navy mb-4">Essentiel</h3>
              <div className="text-3xl font-bold text-navy mb-6">9,99€<span className="text-base font-normal text-slate-400">/mois</span></div>
              <ul className="space-y-4 mb-8 text-slate-600">
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Quittances automatiques</li>
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Révision des loyers</li>
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Coffre-fort numérique</li>
              </ul>
              <button className="w-full py-3 border border-navy text-navy rounded-lg font-medium hover:bg-navy/5 transition-colors">
                Choisir Essentiel
              </button>
            </div>

            {/* Sérénité (Featured) */}
            <div className="bg-white p-8 rounded-2xl border-2 border-emerald shadow-lg relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald text-white px-4 py-1 rounded-full text-sm font-medium">
                Recommandé
              </div>
              <h3 className="font-serif text-xl text-navy mb-4">Sérénité</h3>
              <div className="text-3xl font-bold text-navy mb-6">14,99€<span className="text-base font-normal text-slate-400">/mois</span></div>
              <ul className="space-y-4 mb-8 text-slate-600">
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Tout du pack Essentiel</li>
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Relances automatiques</li>
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Assistance juridique</li>
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Déclaration fiscale pré-remplie</li>
              </ul>
              <button className="w-full py-3 bg-emerald text-white rounded-lg font-medium hover:bg-emerald/90 transition-colors shadow-lg shadow-emerald/20">
                Choisir Sérénité
              </button>
            </div>

            {/* Prestige */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-serif text-xl text-navy mb-4">Prestige</h3>
              <div className="text-3xl font-bold text-navy mb-6">29,99€<span className="text-base font-normal text-slate-400">/mois</span></div>
              <ul className="space-y-4 mb-8 text-slate-600">
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Tout du pack Sérénité</li>
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Gestion des impayés</li>
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Conciergerie 24/7</li>
                <li className="flex gap-3"><Check className="w-5 h-5 text-emerald" /> Garantie Loyers Impayés</li>
              </ul>
              <button className="w-full py-3 border border-navy text-navy rounded-lg font-medium hover:bg-navy/5 transition-colors">
                Choisir Prestige
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Reassurance Banner */}
      <section className="bg-white py-16 border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-8 text-center">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-emerald/10 text-emerald rounded-full flex items-center justify-center mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-navy mb-2">30 jours offerts</h3>
            <p className="text-slate-500 text-sm">Testez gratuitement toutes les fonctionnalités sans engagement.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-emerald/10 text-emerald rounded-full flex items-center justify-center mb-4">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-navy mb-2">Sans engagement</h3>
            <p className="text-slate-500 text-sm">Vous êtes libre de partir quand vous le souhaitez, sans frais.</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-emerald/10 text-emerald rounded-full flex items-center justify-center mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-navy mb-2">Sécurité maximale</h3>
            <p className="text-slate-500 text-sm">Vos données et celles de vos locataires sont chiffrées et protégées.</p>
          </div>
        </div>
      </section>

      {/* Footer (Simplified) */}
      <footer className="bg-navy py-12 text-slate-400 text-center text-sm">
        <p>© {new Date().getFullYear()} GetPatrimo. Tous droits réservés.</p>
      </footer>
    </main>
  );
}
