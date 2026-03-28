import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import bcrypt from 'bcryptjs';

import clientPromise from '@/lib/mongodb-client';
import { connectDiditDb } from '@/app/api/didit/db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

const isE2ETestMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';

const providers: any[] = [
  CredentialsProvider({
    id: 'magic-fast',
    name: 'OTP Passwordless',
    credentials: {
      email: { label: 'Email', type: 'email' },
      token: { label: 'Token', type: 'text' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.token) return null;
      try {
        await connectDiditDb();
        const user = await User.findOne({
          email: credentials.email.trim().toLowerCase(),
          magicSignInToken: { $exists: true, $ne: '' },
          magicSignInExpiresAt: { $gt: new Date() },
        });
        if (!user) return null;
        const tokenValid = await bcrypt.compare(credentials.token, user.magicSignInToken);
        if (!tokenValid) return null;
        await User.findByIdAndUpdate(user._id, {
          $unset: { magicSignInToken: 1, magicSignInExpiresAt: 1 },
        });
        return {
          id: String(user._id),
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        };
      } catch {
        return null;
      }
    },
  }),
];

if (isE2ETestMode) {
  providers.unshift(
    CredentialsProvider({
      id: 'e2e-local',
      name: 'E2E Local',
      credentials: {
        email: { label: 'Email', type: 'email' },
        persona: { label: 'Persona', type: 'text' },
      },
      async authorize(credentials) {
        const persona = String(credentials?.persona || '').trim().toLowerCase();
        const requestedEmail = String(credentials?.email || '').trim().toLowerCase();
        const fallbackEmail =
          persona === 'owner'
            ? process.env.E2E_OWNER_EMAIL
            : persona === 'tenant'
              ? process.env.E2E_TENANT_EMAIL
              : persona === 'guarantor'
                ? process.env.E2E_GUARANTOR_EMAIL
                : '';
        const email = requestedEmail || String(fallbackEmail || '').trim().toLowerCase();

        if (!email) return null;

        try {
          await connectDiditDb();
          const user = await User.findOne({ email });
          if (!user) return null;
          return {
            id: String(user._id),
            email: user.email,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
          };
        } catch {
          return null;
        }
      },
    })
  );
}

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers,
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token?.id ?? token?.sub;
      }
      return session;
    },
    async signIn() {
      return true;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 jours (réduit de 30j pour limiter l'impact d'un token volé)
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production'
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
};
