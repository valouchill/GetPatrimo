/**
 * getpatrimo — Logo officiel (marque vectorielle + wordmark)
 *
 * Charte « Banque Privée » : Émeraude Profond (#064E3B) + Or Brossé (#F59E0B).
 * - La marque (bouclier + « P ») sert aussi de favicon : public/icon.svg.
 * - Pas de variantes `dark:` : l'app n'a pas de dark mode configuré (Tailwind
 *   appliquerait `dark:` via prefers-color-scheme et rendrait le wordmark
 *   illisible sur fond clair en OS sombre).
 */
export const Logo = ({
  className = 'h-8',
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) => {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Bouclier — Émeraude Profond */}
        <path
          d="M18 22C18 22 50 12 50 12C50 12 82 22 82 22V52C82 71.5 50 88 50 88C50 88 18 71.5 18 52V22Z"
          fill="#064E3B"
        />
        {/* Lettre « P » — blanc */}
        <path
          d="M38 32H58C65.5 32 70 36.5 70 43C70 49.5 65.5 54 58 54H46V74H38V32ZM46 46H56C59 46 61 44.5 61 43C61 41.5 59 40 56 40H46V46Z"
          fill="white"
        />
        {/* Accent — Or Brossé */}
        <path d="M48 54V72H52V66H56V61H52V54H48Z" fill="#F59E0B" />
        <circle cx="50" cy="23" r="3.5" fill="#F59E0B" />
      </svg>

      {showText && (
        <div className="text-xl tracking-tight flex items-center select-none">
          <span className="font-light text-slate-400">get</span>
          <span className="font-bold text-emerald-950 ml-0.5">patrimo</span>
        </div>
      )}
    </div>
  );
};
