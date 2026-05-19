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
  { prefix: '/dashboard/owner/baux', feature: 'LEASES' },
  { prefix: '/dashboard/owner/edl', feature: 'EDL' },
  { prefix: /^\/dashboard\/owner\/property\/[^/]+\/rent-receipts/, feature: 'RECEIPTS' },
  // Module contrat / bail (route legacy) — bloqué tant que LEASES est off
  { prefix: /^\/properties\/[^/]+\/contract/, feature: 'LEASES' },
];

// V1 — routes API bloquées (renvoient 404 si la feature est off).
const V1_BLOCKED_API_ROUTES: { prefix: string; feature: FeatureKey }[] = [
  { prefix: '/api/leases', feature: 'LEASES' },
  { prefix: '/api/receipts', feature: 'RECEIPTS' },
  { prefix: '/api/inspections', feature: 'EDL' },
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

  const protectedRoutes = ['/dashboard/tenant', '/dashboard/owner', '/dashboard/admin'];
  const authRoutes = ['/auth/login', '/auth/signin', '/auth/verify-request', '/auth/register'];

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

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
