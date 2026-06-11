/**
 * POST /api/tenant/contest — Contestation d'un résultat d'analyse automatisée
 * (art. 22 RGPD — AIPD M11 : réexamen humain TRACÉ).
 *
 * Auth : session candidat requise. La contestation est enregistrée en base
 * (traçabilité) puis notifiée par email au DPO (DPO_EMAIL, sinon boîte MAIL_FROM).
 * L'échec d'email n'invalide pas la contestation (déjà tracée en base).
 */
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { connectDiditDb } from '@/app/api/didit/db';
import Application from '@/models/Application';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/server-logger';

const Contestation = require('@/models/Contestation');

export async function POST(request: NextRequest) {
  try {
    const session: any = await getServerSession(authOptions as any);
    const email = session?.user?.email?.toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Connexion requise pour contester une analyse.' }, { status: 401 });
    }
    if (!checkRateLimit(`contest:${email}`, { windowMs: 3_600_000, max: 5 }).allowed) {
      return NextResponse.json({ error: 'Trop de demandes. Réessayez dans une heure.' }, { status: 429 });
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const message = String((body as { message?: unknown }).message || '').trim();
    if (message.length < 10 || message.length > 2000) {
      return NextResponse.json({ error: 'Décrivez le problème (10 à 2000 caractères).' }, { status: 400 });
    }

    await connectDiditDb();

    // Rattacher au dossier : celui fourni (s'il appartient bien au candidat), sinon le plus récent.
    let applicationId: string | null = null;
    const rawAppId = String((body as { applicationId?: unknown }).applicationId || '');
    if (rawAppId && mongoose.isValidObjectId(rawAppId)) {
      const app = await Application.findOne({ _id: rawAppId, userEmail: email }).select('_id').lean();
      if (!app) {
        return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 });
      }
      applicationId = String((app as { _id: unknown })._id);
    } else {
      const latest = await Application.findOne({ userEmail: email })
        .sort({ updatedAt: -1 }).select('_id').lean();
      if (latest) applicationId = String((latest as { _id: unknown })._id);
    }

    const contestation = await Contestation.create({
      application: applicationId,
      userEmail: email,
      message,
      status: 'NEW',
    });

    await notifyDpo(email, message, String(contestation._id), applicationId);

    return NextResponse.json({
      success: true,
      reference: String(contestation._id),
      info: 'Votre contestation est enregistrée. Un réexamen humain sera effectué sous un mois maximum.',
    });
  } catch (error) {
    logger.error('POST /api/tenant/contest', { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: 'Erreur lors de l\'enregistrement de la contestation.' }, { status: 500 });
  }
}

/** Notifie le DPO — best effort : la contestation est déjà tracée en base. */
async function notifyDpo(userEmail: string, message: string, reference: string, applicationId: string | null) {
  try {
    const BREVO_USER = process.env.BREVO_USER;
    const BREVO_PASS = process.env.BREVO_PASS;
    if (!BREVO_USER || !BREVO_PASS) return;

    // Destinataire : DPO_EMAIL dédié, sinon la boîte du MAIL_FROM.
    const mailFrom = process.env.MAIL_FROM || '';
    const fromAddress = /<([^>]+)>/.exec(mailFrom)?.[1] || mailFrom.trim() || 'no-reply@doc2loc.com';
    const dpoEmail = process.env.DPO_EMAIL || fromAddress;

    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: BREVO_USER, pass: BREVO_PASS },
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM || `"Maison Patrimo" <${fromAddress}>`,
      to: dpoEmail,
      subject: `[Art. 22] Contestation d'analyse — réf. ${reference}`,
      text: `Nouvelle contestation d'un résultat d'analyse automatisée (réexamen humain requis sous 1 mois).\n\nRéférence : ${reference}\nCandidat : ${userEmail}\nDossier : ${applicationId || 'non rattaché'}\n\nMessage :\n${message}\n\nTraitement : dashboard admin → contestations (ou API /api/admin/contestations).`,
    });
  } catch (err) {
    logger.warn('Contestation : notification DPO échouée (contestation tracée en base)', {
      error: err instanceof Error ? err.message : err,
    });
  }
}
