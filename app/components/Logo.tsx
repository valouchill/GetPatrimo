/**
 * Maison Patrimo — logo purement typographique.
 *
 * Plus de pictogramme : le logo EST le nom, posé en Playfair Display (registre
 * « banque privée »). Une seule source de vérité pour toute l'app.
 * - `variant` : 'light' (émeraude profond sur fond clair, défaut) | 'dark'
 *   (blanc sur fond sombre / émeraude / navy).
 * - La taille se règle via `className` (text-lg, text-xl, text-2xl…).
 */
const SERIF = "'Playfair Display', Georgia, serif";

export const Logo = ({
  className = 'text-2xl',
  variant = 'light',
}: {
  className?: string;
  variant?: 'light' | 'dark';
}) => {
  const color = variant === 'dark' ? 'text-white' : 'text-emerald-950';
  return (
    <span
      className={`font-bold tracking-tight whitespace-nowrap select-none ${color} ${className}`}
      style={{ fontFamily: SERIF }}
    >
      Maison Patrimo
    </span>
  );
};
