import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
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
    secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  });

  if (token && isAuthRoute) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/dashboard/owner', request.url)));
  }

  if (!token && isProtectedRoute) {
    const signInUrl = new URL('/auth/login', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return applySecurityHeaders(NextResponse.redirect(signInUrl));
  }

  return applySecurityHeaders(NextResponse.next());
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
