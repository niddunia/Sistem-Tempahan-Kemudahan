/**
 * NextAuth configuration for Sistem e-Tempahan PLTT-JTM
 * Credentials provider backed by Prisma; passwords verified via scrypt.
 * Adds account lockout after 5 failed attempts (security hardening).
 */
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { recordAudit } from '@/lib/audit';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 min

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8h session
  jwt: { maxAge: 8 * 60 * 60 },
  pages: { signIn: '/' }, // single-page app handles login in a modal
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'E-mel', type: 'email' },
        password: { label: 'Kata Laluan', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const ip =
          (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
          (req?.headers?.['x-real-ip'] as string) ||
          'unknown';
        const ua = (req?.headers?.['user-agent'] as string) || 'unknown';

        const user = await db.user.findUnique({ where: { email } });
        if (!user) {
          await recordAudit({
            module: 'AUTH',
            action: 'LOGIN_FAILED_USER_NOT_FOUND',
            details: { email },
            ipAddress: ip,
            userAgent: ua,
            severity: 'WARNING',
          });
          return null;
        }

        // Account status check
        if (user.status === 'SUSPENDED') {
          await recordAudit({
            userId: user.id,
            module: 'AUTH',
            action: 'LOGIN_FAILED_SUSPENDED',
            ipAddress: ip,
            userAgent: ua,
            severity: 'WARNING',
          });
          return null;
        }

        // Account lockout check
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordAudit({
            userId: user.id,
            module: 'AUTH',
            action: 'LOGIN_FAILED_LOCKED',
            ipAddress: ip,
            userAgent: ua,
            severity: 'WARNING',
          });
          return null;
        }

        const ok = await verifyPassword(credentials.password, user.passwordHash);
        if (!ok) {
          const attempts = user.failedLoginAttempts + 1;
          const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil: shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
            },
          });
          await recordAudit({
            userId: user.id,
            module: 'AUTH',
            action: 'LOGIN_FAILED_BAD_PASSWORD',
            details: { attempts, locked: shouldLock },
            ipAddress: ip,
            userAgent: ua,
            severity: shouldLock ? 'CRITICAL' : 'WARNING',
          });
          return null;
        }

        // Successful login — reset counters
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
            lastLoginIp: ip,
          },
        });
        await recordAudit({
          userId: user.id,
          module: 'AUTH',
          action: 'LOGIN_SUCCESS',
          ipAddress: ip,
          userAgent: ua,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department ?? '',
        } as unknown as { id: string; email: string; name: string; role: string; department: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
        token.department = (user as { department: string }).department;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { department?: string }).department = token.department as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'pltt-jtm-etempahan-secret-dev-only',
};
