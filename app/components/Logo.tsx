/**
 * Maison Patrimo — logo typographique moderne (wordmark sans-serif).
 *
 * Registre « Apple / fintech » : Inter, épuré, avec un contraste de graisse
 * subtil (« Maison » fin / « Patrimo » gras) pour ancrer le nom distinctif.
 * Plus de pictogramme : le logo EST le nom. Source unique pour toute l'app.
 * - `variant` : 'light' (émeraude profond sur fond clair, défaut) | 'dark'
 *   (blanc sur fond sombre / émeraude / navy).
 * - La taille se règle via `className` (text-lg, text-xl, text-2xl…).
 */
const SANS = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";

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
      className={`whitespace-nowrap tracking-tight select-none ${color} ${className}`}
      style={{ fontFamily: SANS }}
    >
      <span className="font-normal">Maison</span> <span className="font-bold">Patrimo</span>
    </span>
  );
};
