import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

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

  const protectedRoutes = ['/dashboard/tenant', '/dashboard/owner'];
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
