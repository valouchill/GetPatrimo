import { NextRequest, NextResponse } from 'next/server';
import { connectDiditDb } from '@/app/api/didit/db';
import crypto from 'crypto';

const User = require('@/models/User');
const Property = require('@/models/Property');
const Application = require('@/models/Application');

const MAX_ATTEMPTS = 5;

const OtpStore = (() => {
  let model: any = null;
  return async () => {
    if (model) return model;
    const mongoose = await import('mongoose');
    model = mongoose.models.OtpToken;
    if (!model) {
      const schema = new mongoose.Schema({
        email: { type: String, required: true, index: true },
        code: { type: String, required: true },
        expiresAt: { type: Date, required: true, index: { expires: 0 } },
        attempts: { type: Number, default: 0 },
      });
      model = mongoose.model('OtpToken', schema);
    }
    return model;
  };
})();

export async function POST(request: NextRequest) {
  try {
    const { email, otp, propertyData, passportSlug } = await request.json();
    const normalizedEmail = (email || '').trim().toLowerCase();
    const code = (otp || '').trim();

    if (!normalizedEmail || !code || code.length !== 6) {
      return NextResponse.json({ error: 'Code invalide.' }, { status: 400 });
    }

    await connectDiditDb();
    const Token = await OtpStore();

    const tokenDoc = await Token.findOne({
      email: normalizedEmail,
      expiresAt: { $gt: new Date() },
    });

    if (!tokenDoc) {
      return NextResponse.json({ error: 'Code expiré. Veuillez en demander un nouveau.' }, { status: 401 });
    }

    if (tokenDoc.attempts >= MAX_ATTEMPTS) {
      await Token.deleteMany({ email: normalizedEmail });
      return NextResponse.json({ error: 'Trop de tentatives. Veuillez recommencer.' }, { status: 429 });
    }

    if (tokenDoc.code !== code) {
      await Token.findByIdAndUpdate(tokenDoc._id, { $inc: { attempts: 1 } });
      const remaining = MAX_ATTEMPTS - tokenDoc.attempts - 1;
      return NextResponse.json(
        { error: `Code incorrect. ${remaining > 0 ? `${remaining} tentative(s) restante(s).` : 'Dernière tentative.'}` },
        { status: 401 }
      );
    }

    await Token.deleteMany({ email: normalizedEmail });

    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        password: '',
        firstName: '',
        lastName: '',
        plan: 'FREE',
      });
    }

    const userId = user._id;

    if (propertyData?.address) {
      const property = await Property.create({
        user: userId,
        name: (propertyData.address || '').slice(0, 80) || 'Mon bien',
        address: propertyData.address,
        rentAmount: Number(propertyData.rentAmount) || 0,
        chargesAmount: 0,
        surfaceM2: propertyData.surfaceM2 ? Number(propertyData.surfaceM2) : null,
        status: 'AVAILABLE',
      });

      if (passportSlug) {
        await Application.findOneAndUpdate(
          { passportSlug },
          {
            property: property._id,
            status: 'ACCEPTED',
            ownerDecision: 'ACCEPTED',
            viewedByOwnerAt: new Date(),
          }
        );
      }
    }

    const magicToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes
    await User.findByIdAndUpdate(userId, {
      magicSignInToken: magicToken,
      magicSignInExpiresAt: expiresAt,
    });

    return NextResponse.json({
      ok: true,
      email: normalizedEmail,
      token: magicToken,
    });
  } catch (e) {
    console.error('[verify-otp]', e);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
