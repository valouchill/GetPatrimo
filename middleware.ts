import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isEnabled, type FeatureKey } from './lib/features';

const SENSITIVE_API_PREFIXES = [
  '/api/passport/',
  '/api/payments/',
  '/api/guarantor/',
  '/api/owner/',
  '/api/documents/',
  '/api/auth/',
  '/api/scoring/',
  '/api/didit/',
];

// V1 — routes pages bloquées si la feature associée est désactivée.
// L'utilisateur est redirigé vers le dashboard avec un flag.
const V1_BLOCKED_PAGE_ROUTES: { prefix: string | RegExp; feature: FeatureKey }[] = [
  { prefix: '/dashboard/owner/edl', feature: 'EDL' },
  { prefix: /^\/dashboard\/owner\/property\/[^/]+\/rent-receipts/, feature: 'RECEIPTS' },
  // Sécurité (audit passe-5) : la page gestion des loyers (/payments) n'avait PAS de gate alors
  // que MANAGEMENT est OFF en V1 → tout le module loyers (suivi, révision IRL, régularisation,
  // quittances) restait atteignable. Bloquée comme les autres modules V2.
  { prefix: /^\/payments(\/|$)/, feature: 'MANAGEMENT' },
];

// V1 — routes API bloquées (renvoient 404 si la feature est off).
const V1_BLOCKED_API_ROUTES: { prefix: string; feature: FeatureKey }[] = [
  { prefix: '/api/receipts', feature: 'RECEIPTS' },
  { prefix: '/api/inspections', feature: 'EDL' },
  // Sécurité (audit passe-5) : l'API gestion des loyers n'était PAS gatée (oubli) alors que le
  // module est V2 (MANAGEMENT off). Neutralise d'un coup les findings paiements (révision IRL
  // sans table INSEE, quittance/export, régularisation, relances) tant que MANAGEMENT est off.
  // NB : distinct de /api/billing (paywall Stripe V1) qui reste actif.
  { prefix: '/api/payments', feature: 'MANAGEMENT' },
];

function matchesBlocked(pathname: string, prefix: string | RegExp): boolean {
  if (typeof prefix === 'string') return pathname.startsWith(prefix);
  return prefix.test(pathname);
}

function applySecurityHeaders(response: NextResponse, pathname: string): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Empêcher la mise en cache des données sensibles par les navigateurs/CDN/proxies
  if (SENSITIVE_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // V1 — bloquer les routes pages des features désactivées
  for (const { prefix, feature } of V1_BLOCKED_PAGE_ROUTES) {
    if (matchesBlocked(pathname, prefix) && !isEnabled(feature)) {
      const url = new URL('/dashboard/owner', request.url);
      url.searchParams.set('v1', 'hidden');
      return applySecurityHeaders(NextResponse.redirect(url), pathname);
    }
  }

  // V1 — bloquer les routes API des features désactivées (404)
  for (const { prefix, feature } of V1_BLOCKED_API_ROUTES) {
    if (pathname.startsWith(prefix) && !isEnabled(feature)) {
      return applySecurityHeaders(
        NextResponse.json({ error: 'Not available' }, { status: 404 }),
        pathname
      );
    }
  }

  // '/properties' : le wizard bail y vit — il n'était protégé QUE par le gate LEASES
  // (retiré à l'activation du module) → route explicitement authentifiée.
  const protectedRoutes = ['/dashboard/tenant', '/dashboard/owner', '/dashboard/admin', '/properties'];
  const authRoutes = ['/auth/login', '/auth/signin', '/auth/verify-request', '/auth/register'];

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Sécurité (pentest injection-2) : les routes /api/owner-tunnel/* sont des proxys LLM
  // (GPT-4o) qui étaient accessibles SANS authentification → abus de coût / proxy gratuit.
  // Le funnel concierge est déjà réservé aux connectés → aucune régression UX.
  if (!token && pathname.startsWith('/api/owner-tunnel/')) {
    return applySecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), pathname);
  }

  if (token && isAuthRoute) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard/owner', request.url)), pathname);
  }

  if (!token && isProtectedRoute) {
    const signInUrl = new URL('/auth/login', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return applySecurityHeaders(NextResponse.redirect(signInUrl), pathname);
  }

  return applySecurityHeaders(NextResponse.next(), pathname);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
