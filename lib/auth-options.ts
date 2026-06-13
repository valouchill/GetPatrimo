import CredentialsProvider from 'next-auth/providers/credentials';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import bcrypt from 'bcryptjs';
import { verifyUserTotp } from '@/lib/totp-verify';

import clientPromise from '@/lib/mongodb-client';
import { connectDiditDb } from '@/app/api/didit/db';

 
const User = require('@/models/User');

const isE2ETestMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';

const providers: any[] = [
  CredentialsProvider({
    id: 'magic-fast',
    name: 'OTP Passwordless',
    credentials: {
      email: { label: 'Email', type: 'email' },
      token: { label: 'Token', type: 'text' },
      totpCode: { label: 'Code 2FA', type: 'text' },
      impersonatorEmail: { label: 'ImpersonatorEmail', type: 'text' },
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

        // Sécurité : un compte suspendu ne peut jamais ouvrir de session.
        if (user.suspended) return null;

        // Sécurité (pentest auth-1) : l'impersonation est dérivée du MARQUEUR SERVEUR
        // `magicSignInImpersonatorId`, posé exclusivement par la route admin impersonate —
        // JAMAIS du champ client `impersonatorEmail` (qui pouvait sauter la 2FA avec un
        // simple magic token de login-password). On valide l'impersonateur depuis ce champ.
        let impersonatedBy: string | null = null;
        let isImpersonation = false;
        if (user.magicSignInImpersonatorId) {
          const impersonator = await User.findById(user.magicSignInImpersonatorId).select('role email').lean();
          // L'impersonateur DOIT être superadmin, et la cible ne doit pas être admin/superadmin.
          if (!impersonator || impersonator.role !== 'superadmin' || user.role === 'admin' || user.role === 'superadmin') {
            // Marqueur incohérent : on le purge et on refuse.
            await User.findByIdAndUpdate(user._id, {
              $unset: { magicSignInToken: 1, magicSignInExpiresAt: 1, magicSignInImpersonatorId: 1 },
            });
            return null;
          }
          isImpersonation = true;
          impersonatedBy = impersonator.email;
        }

        // Sécurité (revue V1 — S10) : 2e facteur imposé si la 2FA est activée. Le saut n'est
        // autorisé que pour une vraie impersonation superadmin (prouvée serveur ci-dessus).
        // Désactivable en urgence via TOTP_ENFORCEMENT_ENABLED=false (sans redeploy).
        if (
          process.env.TOTP_ENFORCEMENT_ENABLED !== 'false' &&
          !isImpersonation &&
          user.totpEnabled &&
          user.totpSecret
        ) {
          const okTotp = await verifyUserTotp(user, (credentials as { totpCode?: string }).totpCode);
          if (!okTotp) {
            // Anti-brute-force (audit passe-5) : /api/auth/callback/credentials n'est pas
            // rate-limité et le magic token reste valide jusqu'à expiration → un code TOTP
            // (6 chiffres) était brute-forçable. On borne les essais PAR magic token : au-delà
            // de MAX_TOTP_ATTEMPTS, on INVALIDE le token (l'utilisateur doit redemander un code).
            const MAX_TOTP_ATTEMPTS = 5;
            const after = await User.findByIdAndUpdate(
              user._id,
              { $inc: { magicTotpAttempts: 1 } },
              { new: true },
            ).select('magicTotpAttempts').lean();
            if (((after && after.magicTotpAttempts) || 0) >= MAX_TOTP_ATTEMPTS) {
              await User.findByIdAndUpdate(user._id, {
                $unset: {
                  magicSignInToken: 1,
                  magicSignInExpiresAt: 1,
                  magicSignInImpersonatorId: 1,
                  magicTotpAttempts: 1,
                },
              });
            }
            return null;
          }
        }

        // Consommation du token (+ marqueur d'impersonation + compteur TOTP) — usage unique.
        await User.findByIdAndUpdate(user._id, {
          $unset: {
            magicSignInToken: 1,
            magicSignInExpiresAt: 1,
            magicSignInImpersonatorId: 1,
            magicTotpAttempts: 1,
          },
        });

        return {
          id: String(user._id),
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
          totpEnabled: Boolean(user.totpEnabled),
          ...(impersonatedBy ? { impersonatedBy } : {}),
        } as any;
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
  // MongoDBAdapter désactivé : avec strategy='jwt' + CredentialsProvider,
  // l'adapter cause un hang en production (le MongoClient initialisé au build
  // ne se reconnecte pas avec l'URI runtime). Les sessions JWT ne nécessitent
  // pas d'adapter — les users sont gérés via mongoose dans authorize().
  // adapter: MongoDBAdapter(clientPromise),
  providers,
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      // Bootstrap ADMIN_EMAILS → auto-promotion superadmin au 1er login
      const parseAdminEmails = () =>
        String(process.env.ADMIN_EMAILS || '')
          .split(',')
          .map((v) => v.trim().toLowerCase())
          .filter(Boolean);

      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.totpEnabled = user.totpEnabled || false;
        if ((user as any).impersonatedBy) {
          token.impersonatedBy = (user as any).impersonatedBy;
        }

        try {
          await connectDiditDb();
          const adminEmails = parseAdminEmails();
          const userEmail = String(user.email || '').toLowerCase();

          // Auto-promotion superadmin si email whitelisté
          if (userEmail && adminEmails.includes(userEmail)) {
            const current = await User.findById(user.id).select('role').lean();
            if (current && current.role !== 'superadmin') {
              await User.updateOne(
                { _id: user.id },
                { $set: { role: 'superadmin', adminPromotedAt: new Date() } }
              );
              token.role = 'superadmin';
            } else {
              token.role = current?.role || 'superadmin';
            }
          } else {
            const dbUser = await User.findById(user.id).select('role suspended').lean();
            if (dbUser?.suspended) {
              // Bloque le login pour compte suspendu
              return null;
            }
            token.role = dbUser?.role || 'owner';
          }
        } catch (err) {
          console.error('[auth-options] jwt bootstrap error:', err);
          token.role = 'owner';
        }
      } else if (token?.id) {
        // Refresh du rôle à chaque request — propagation promotion/suspension dans les 24h
        try {
          await connectDiditDb();
          const dbUser = await User.findById(token.id).select('role suspended').lean();
          if (!dbUser || dbUser.suspended) {
            return null; // force logout
          }
          token.role = dbUser.role || 'owner';
        } catch (err) {
          console.error('[auth-options] jwt refresh error:', err);
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token?.id ?? token?.sub;
        session.user.totpEnabled = token?.totpEnabled || false;
        session.user.role = token?.role || 'owner';
        if (token?.impersonatedBy) {
          session.user.impersonatedBy = token.impersonatedBy;
        }
      }
      return session;
    },
    async signIn() {
      return true;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 heures — application financière, session courte obligatoire
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
  // En cas d'erreur de déchiffrement JWT (changement de secret), NextAuth
  // crée automatiquement un nouveau token vide plutôt que de bloquer.
  logger: {
    error(code: string, metadata: unknown) {
      // Ignore les erreurs JWT_SESSION_ERROR (cookie ancien → nouveau secret)
      if (code === 'JWT_SESSION_ERROR') return;
      console.error(`[next-auth][${code}]`, metadata);
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
