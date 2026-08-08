import { NextRequest, NextResponse } from 'next/server';

import { connectDiditDb } from '@/app/api/didit/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/server-logger';

const Lease = require('@/models/Lease');
const Property = require('@/models/Property');
const LeaseSignature = require('@/models/LeaseSignature');
const {
  resolveSignatureByToken,
  sendSignatureOtp,
  verifySignatureOtp,
  recordSignature,
  finalizeSignedPdf,
} = require('@/src/services/leaseSignatureService');

/**
 * Parcours PUBLIC de signature (aucune session requise — le token EST le secret).
 *
 *  GET  /api/public/sign/[token]         → contexte du bail à signer
 *  POST /api/public/sign/[token] { action } :
 *      - 'send-otp'  → envoie le code de consentement par email
 *      - 'verify'    → { code } valide le code
 *      - 'sign'      → { signatureImage } appose la signature
 *
 * Le token brut n'est jamais stocké (seul son SHA-256 l'est), il est à usage
 * personnel, expire à 7 jours, et un nouveau token est émis pour le signataire
 * suivant de la file.
 */

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'unknown';
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const ip = clientIp(request);
    if (!checkRateLimit(`sign-get:${ip}`, { windowMs: 60_000, max: 30 }).allowed) {
      return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
    }
    const { token } = await ctx.params;
    await connectDiditDb();

    const signature = await resolveSignatureByToken(token);
    if (!signature) {
      // Distinguer « lien expiré » (hash connu, date dépassée) de « lien
      // invalide » : le recours affiché au signataire n'est pas le même.
      const { _internals } = require('@/src/services/leaseSignatureService');
      const expired = await LeaseSignature.exists({ tokenHash: _internals.sha256(String(token || '')) });
      return NextResponse.json(
        { error: expired ? 'Ce lien a expiré.' : 'Lien invalide.', reason: expired ? 'expired' : 'invalid' },
        { status: 404 },
      );
    }
    if (signature.status === 'SIGNED') {
      // `complete` pilote le bouton de téléchargement de l'écran de succès.
      const signedLease = await Lease.findById(signature.lease).select('signedPdfPath').lean();
      return NextResponse.json({
        alreadySigned: true,
        complete: Boolean(signedLease?.signedPdfPath),
      });
    }

    const lease = await Lease.findById(signature.lease)
      .select('tenantFirstName tenantLastName rentAmount chargesAmount depositAmount startDate durationMonths leaseType propertyType property generatedDocuments')
      .lean();
    if (!lease) return NextResponse.json({ error: 'Bail introuvable.' }, { status: 404 });

    const property = lease.property
      ? await Property.findById(lease.property).select('address name').lean()
      : null;

    if (signature.status === 'PENDING') {
      signature.status = 'VIEWED';
      signature.viewedAt = new Date();
      await signature.save();
    }

    const docs = Array.isArray(lease.generatedDocuments) ? lease.generatedDocuments : [];
    const leaseDoc = docs.find((d: any) => d.kind === 'LEASE') || docs[0];

    // Avancement global, ANONYMISÉ : rôles et statuts seulement — le signataire
    // voit où en est la campagne sans exposer les emails des autres parties.
    const allSignatures = await LeaseSignature.find({ lease: signature.lease })
      .select('role status order')
      .sort({ order: 1 })
      .lean();
    const parties = allSignatures.map((s: any) => ({
      role: s.role,
      signed: s.status === 'SIGNED',
      you: String(s._id) === String(signature._id),
    }));

    return NextResponse.json({
      parties,
      signer: {
        fullName: signature.fullName,
        email: signature.email,
        role: signature.role,
        otpVerified: Boolean(signature.otpVerifiedAt),
      },
      lease: {
        tenantName: [lease.tenantFirstName, lease.tenantLastName].filter(Boolean).join(' '),
        address: property?.address || property?.name || '',
        rentAmount: lease.rentAmount,
        chargesAmount: lease.chargesAmount,
        depositAmount: lease.depositAmount,
        startDate: lease.startDate,
        durationMonths: lease.durationMonths,
        leaseType: lease.leaseType,
        // URL de lecture du bail (route publique dédiée, token requis)
        documentUrl: leaseDoc ? `/api/public/sign/${encodeURIComponent(token)}/document` : null,
      },
    });
  } catch (e) {
    logger.error('[public-sign] GET', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const ip = clientIp(request);
    if (!checkRateLimit(`sign-post:${ip}`, { windowMs: 60_000, max: 20 }).allowed) {
      return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
    }
    const { token } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '');

    await connectDiditDb();
    const signature = await resolveSignatureByToken(token);
    if (!signature) return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 404 });
    if (signature.status === 'SIGNED') {
      return NextResponse.json({ error: 'Document déjà signé.' }, { status: 409 });
    }

    if (action === 'send-otp') {
      await sendSignatureOtp(signature);
      return NextResponse.json({ success: true, sentTo: signature.email });
    }

    if (action === 'verify') {
      const ok = await verifySignatureOtp(signature, body?.code);
      if (!ok) {
        return NextResponse.json({ error: 'Code invalide ou expiré.' }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'sign') {
      const image = String(body?.signatureImage || '');
      if (!image.startsWith('data:image/')) {
        return NextResponse.json({ error: 'Signature manuscrite manquante.' }, { status: 400 });
      }
      if (!signature.otpVerifiedAt) {
        return NextResponse.json({ error: 'Code de confirmation non validé.' }, { status: 400 });
      }
      const result = await recordSignature(signature, {
        signatureImage: image,
        ip,
        userAgent: request.headers.get('user-agent') || '',
      });
      // Toutes les signatures recueillies → PDF final (bail + certificat d'audit).
      if (result.complete) {
        await finalizeSignedPdf(String(signature.lease)).catch((e: unknown) =>
          logger.error('[public-sign] finalize', { error: e instanceof Error ? e.message : e }),
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (e) {
    logger.error('[public-sign] POST', { error: e instanceof Error ? e.message : e });
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
