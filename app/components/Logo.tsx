/**
 * Maison Patrimo — Logo officiel (sceau bouclier + wordmark « Family Office »).
 *
 * Charte « Banque Privée » : Émeraude Profond (#064E3B) + Or Brossé (#F59E0B).
 * - Le sceau (bouclier + monogramme « M ») est identique au favicon (app/icon.svg).
 * - `variant` adapte la couleur du wordmark au fond : 'light' (texte sombre sur fond
 *   clair, défaut) ou 'dark' (texte clair sur fond sombre / émeraude / navy).
 * - `showText=false` → sceau seul. Wordmark sur deux lignes (« MAISON » en lettrage
 *   espacé + « Patrimo » en Playfair Display, pour le registre banque privée).
 */
const SERIF = "'Playfair Display', Georgia, serif";

export const Logo = ({
  className = 'h-10',
  showText = true,
  variant = 'light',
}: {
  className?: string;
  showText?: boolean;
  variant?: 'light' | 'dark';
}) => {
  const eyebrow = variant === 'dark' ? 'text-slate-300' : 'text-slate-500';
  const word = variant === 'dark' ? 'text-white' : 'text-emerald-950';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Le Sceau — bouclier émeraude + liseré or + monogramme « M » (= favicon) */}
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Bouclier « Maison » — Émeraude Profond */}
        <path d="M50 9 L86 22 V51 C86 76 50 93 50 93 C50 93 14 76 14 51 V22 Z" fill="#064E3B" />
        {/* Liseré Or intérieur (luxe & précision) */}
        <path
          d="M50 16 L79 27 V50 C79 71 50 85 50 85 C50 85 21 71 21 50 V27 Z"
          stroke="#F59E0B"
          strokeWidth="1.5"
          strokeOpacity="0.55"
        />
        {/* Monogramme « M » — Or Brossé */}
        <path
          d="M33 64 V40 L50 57 L67 40 V64"
          stroke="#F59E0B"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Wordmark « Family Office » — deux lignes */}
      {showText && (
        <div className="flex flex-col justify-center leading-none select-none">
          <span
            className={`text-[0.62rem] font-semibold uppercase tracking-[0.38em] ${eyebrow} mb-1 ml-0.5`}
          >
            Maison
          </span>
          <span
            className={`text-2xl font-bold ${word}`}
            style={{ fontFamily: SERIF, letterSpacing: '-0.01em' }}
          >
            Patrimo
          </span>
        </div>
      )}
    </div>
  );
};
