import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb-client';
import { connectDiditDb } from '@/app/api/didit/db';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const User = require('@/models/User');

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    /* ── OTP Passwordless (via magicSignInToken) ── */
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
            magicSignInToken: credentials.token,
            magicSignInExpiresAt: { $gt: new Date() },
          });
          if (!user) return null;
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
  ],
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
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
};

const handler = NextAuth(authOptions as any);

export { handler as GET, handler as POST };
