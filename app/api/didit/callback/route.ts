import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

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
  const clientSecret = process.env.DIDIT_CLIENT_SECRET;
  const redirectUri = process.env.DIDIT_REDIRECT_URI || `${request.nextUrl.origin}/api/didit/callback`;
  const jwtSecret = process.env.JWT_SECRET;

  if (!issuer || !clientId || !jwtSecret) {
    return NextResponse.json({ error: 'Configuration Didit/serveur manquante.' }, { status: 500 });
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const storedState = request.cookies.get('didit_state')?.value;
  const verifier = request.cookies.get('didit_verifier')?.value;
  const returnUrl = request.cookies.get('didit_return')?.value || '/';

  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return NextResponse.redirect(new URL('/apply/invalid', request.nextUrl.origin));
  }

  const config = await getDiditConfig(issuer);

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });

  if (clientSecret) {
    tokenBody.set('client_secret', clientSecret);
  }

  const tokenRes = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    return NextResponse.json({ error: err.error_description || 'Erreur token Didit.' }, { status: 500 });
  }

  const tokenData = await tokenRes.json();
  const userInfoRes = await fetch(config.userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userInfoRes.ok) {
    return NextResponse.json({ error: 'Impossible de récupérer les données Didit.' }, { status: 500 });
  }

  const claims = await userInfoRes.json();
  const payload = {
    firstName: claims.given_name || claims.firstName || claims.firstname || '',
    lastName: claims.family_name || claims.lastName || claims.lastname || '',
    birthDate: claims.birthdate || claims.birth_date || '',
    humanVerified: Boolean(claims.human_verified || claims.didit_human_verified || claims.verified),
  };

  const token = jwt.sign(payload, jwtSecret, { expiresIn: '2h' });
  const redirect = NextResponse.redirect(returnUrl);
  redirect.cookies.set('didit_verified', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7200 });
  redirect.cookies.delete('didit_state');
  redirect.cookies.delete('didit_verifier');
  redirect.cookies.delete('didit_return');
  return redirect;
}
