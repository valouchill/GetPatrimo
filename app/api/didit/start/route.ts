import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getDiditConfig(issuer: string) {
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Impossible de récupérer la configuration Didit.');
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  const issuer = process.env.DIDIT_ISSUER_URL;
  const clientId = process.env.DIDIT_CLIENT_ID;
  const redirectUri = process.env.DIDIT_REDIRECT_URI || `${request.nextUrl.origin}/api/didit/callback`;

  if (!issuer || !clientId) {
    return NextResponse.json({ error: 'Configuration Didit manquante.' }, { status: 500 });
  }

  const config = await getDiditConfig(issuer);
  const state = base64UrlEncode(crypto.randomBytes(16));
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(crypto.createHash('sha256').update(codeVerifier).digest());
  const returnUrl = request.nextUrl.searchParams.get('return') || request.nextUrl.origin;

  const authUrl = new URL(config.authorization_endpoint);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile birthdate');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('didit_state', state, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
  response.cookies.set('didit_verifier', codeVerifier, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
  response.cookies.set('didit_return', returnUrl, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });
  return response;
}
