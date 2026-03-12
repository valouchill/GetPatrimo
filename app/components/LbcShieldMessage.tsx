'use client';

import { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface LbcShieldMessageProps {
  privilegeCode: string;
}

function buildMessage(code: string): string {
  return `Bonjour,

Face au très grand nombre de demandes pour ce bien, j'ai mandaté le protocole PatrimoTrust pour sécuriser la collecte et l'audit des dossiers.

Pourriez-vous certifier votre profil en 3 minutes sur leur portail ?

Rendez-vous sur le site : getpatrimo . fr / acces (sans les espaces)
Et saisissez mon Code Privilège : ❖ ${code} ❖

Votre dossier sera chiffré et je serai notifié immédiatement de votre score. Merci d'avance.`;
}

export default function LbcShieldMessage({ privilegeCode }: LbcShieldMessageProps) {
  const [copied, setCopied] = useState(false);
  const message = buildMessage(privilegeCode);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [message]);

  return (
    <div className="relative bg-slate-50 rounded-xl p-6 border border-slate-200">
      {/* Bouton Copier — haut droite */}
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-4 right-4 flex items-center gap-1.5 bg-white shadow-sm border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 text-emerald-600" />
            <span className="text-emerald-600">Copié !</span>
          </>
        ) : (
          <>
            <Copy className="w-3 h-3" />
            Copier
          </>
        )}
      </button>

      <pre className="font-mono text-sm text-slate-600 whitespace-pre-wrap leading-relaxed pr-20">
        {message}
      </pre>
    </div>
  );
}
