/**
 * Maison Patrimo — Logo officiel (sceau monogramme + typographie « Family Office »).
 *
 * Charte « Banque Privée » : Émeraude Profond (#064E3B) + Or Brossé (#F59E0B).
 * - Le sceau seul (bouclier + monogramme M/P) sert de favicon : public/icon.svg.
 * - Pas de variantes `dark:` : l'app n'a pas de dark mode configuré (Tailwind les
 *   activerait via prefers-color-scheme et rendrait le wordmark illisible sur fond clair).
 * - `showText=false` → sceau seul. Le wordmark est sur deux lignes (« MAISON » / « Patrimo »).
 */
export const Logo = ({
  className = 'h-10',
  showText = true,
}: {
  className?: string;
  showText?: boolean;
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* L'Écusson Monogramme (Le Sceau d'Autorité) */}
      <svg
        viewBox="0 0 100 100"
        className="h-full w-auto drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Bouclier « Maison » — Émeraude Profond */}
        <path d="M50 10 L85 22 V50 C85 75 50 92 50 92 C50 92 15 75 15 50 V22 Z" fill="#064E3B" />
        {/* Liseré Or intérieur (luxe & précision) */}
        <path
          d="M50 16 L79 26 V49 C79 70 50 84 50 84 C50 84 21 70 21 49 V26 Z"
          stroke="#F59E0B"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
        {/* Monogramme « M » — Or Brossé */}
        <path
          d="M32 62 V36 L50 50 L68 36 V62"
          stroke="#F59E0B"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Boucle « P » à droite du « M » */}
        <path
          d="M68 36 H74 C78 36 81 39 81 43 C81 47 78 50 74 50 H68"
          stroke="#F59E0B"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Point de certification IA */}
        <circle cx="50" cy="74" r="3.5" fill="#F59E0B" />
      </svg>

      {/* Typographie « Family Office » — deux lignes */}
      {showText && (
        <div className="flex flex-col justify-center select-none">
          <span className="text-[0.65rem] font-semibold tracking-[0.35em] text-slate-500 uppercase leading-none mb-0.5 ml-0.5">
            Maison
          </span>
          <span className="text-2xl font-bold tracking-tight text-emerald-950 leading-none">
            Patrimo
          </span>
        </div>
      )}
    </div>
  );
};
