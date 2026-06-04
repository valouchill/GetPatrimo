import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import { withErrorHandler } from '@/lib/with-error-handler';

 
const User = require('@/models/User');

/**
 * GET /api/user/unsubscribe
 * Landing page for email unsubscribe — redirects to a simple confirmation page.
 * Accepts optional ?category=reminders|marketing (defaults to all).
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    // Not logged in — show a simple HTML page asking to log in first
    return new NextResponse(
      `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Désinscription — PatrimoTrust</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f4f4f5;margin:0;}
.card{background:#fff;border-radius:12px;padding:40px;max-width:480px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1);}
a{color:#1E40AF;text-decoration:none;font-weight:600;}</style></head>
<body><div class="card">
<h1 style="font-size:20px;margin-bottom:16px;">Gérer vos préférences email</h1>
<p style="color:#6b7280;">Connectez-vous pour modifier vos préférences de notification.</p>
<p style="margin-top:24px;"><a href="/auth/login">Se connecter</a></p>
</div></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  await connectDiditDb();
  const category = request.nextUrl.searchParams.get('category');

  const update: Record<string, boolean> = {};
  if (category === 'reminders') {
    update['emailPreferences.reminders'] = false;
  } else if (category === 'marketing') {
    update['emailPreferences.marketing'] = false;
  } else {
    update['emailPreferences.reminders'] = false;
    update['emailPreferences.marketing'] = false;
  }

  await User.updateOne(
    { email: (session.user as { email: string }).email },
    { $set: update }
  );

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Désinscription confirmée — PatrimoTrust</title>
<style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f4f4f5;margin:0;}
.card{background:#fff;border-radius:12px;padding:40px;max-width:480px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1);}
.check{font-size:48px;margin-bottom:16px;}
a{color:#1E40AF;text-decoration:none;font-weight:600;}</style></head>
<body><div class="card">
<div class="check">✓</div>
<h1 style="font-size:20px;margin-bottom:16px;">Désinscription confirmée</h1>
<p style="color:#6b7280;">Vous ne recevrez plus ${category ? `les emails de type « ${category} »` : 'de notifications par email'}.</p>
<p style="color:#6b7280;margin-top:12px;">Vous pouvez réactiver les notifications depuis votre <a href="/dashboard/owner/profile">profil</a>.</p>
</div></body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
});

/**
 * PATCH /api/user/unsubscribe
 * API endpoint to update email preferences programmatically.
 */
export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const session = await getServerSession(authOptions as Record<string, unknown>);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json();
  const { reminders, marketing } = body;

  await connectDiditDb();

  const update: Record<string, boolean> = {};
  if (typeof reminders === 'boolean') update['emailPreferences.reminders'] = reminders;
  if (typeof marketing === 'boolean') update['emailPreferences.marketing'] = marketing;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucune préférence à modifier' }, { status: 400 });
  }

  await User.updateOne(
    { email: (session.user as { email: string }).email },
    { $set: update }
  );

  return NextResponse.json({ success: true });
});
