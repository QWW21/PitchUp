/**
 * NextAuth configuration — ticket E01-09.
 *
 * Web uses the session cookie. Mobile gets a JWT from a custom route built in
 * E02; the JWT session strategy here is what makes both possible.
 */
import type { Role } from '@prisma/client'
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { AUTH, LoginSchema } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import { RecipientThrottledError, sendEmailVerification } from '@/lib/auth/service'

/**
 * A bcrypt hash of a throwaway value, compared against when no user matched.
 *
 * Without this, "unknown email" returns in microseconds while "wrong password"
 * takes the ~250ms bcrypt costs, and the difference tells an attacker which
 * emails are registered. PRD §6.6.
 */
const DUMMY_HASH = bcrypt.hashSync('invalid-password-placeholder', AUTH.BCRYPT_COST)

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),

  /**
   * Auth.js trusts the request's Host header automatically only in
   * development and on Vercel. Anywhere else — `next start`, a container
   * behind a reverse proxy — every auth route fails with UntrustedHost and
   * sign-in is impossible. The app is always served behind a host we
   * control, and NEXTAUTH_URL pins the canonical URL where it is set.
   */
  trustHost: true,

  /**
   * A wrong password is an expected outcome, but Auth.js logs it as an
   * error with a full stack trace, which buries real failures in the log.
   */
  logger: {
    error(error) {
      if (error.name === 'CredentialsSignin') return
      console.error(`[auth][error] ${error.name}:`, error)
    },
  },

  /** Required for the Credentials provider, and what mobile needs. */
  session: { strategy: 'jwt' },

  providers: [
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },

      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        })

        // Always run a comparison so the response time does not reveal
        // whether the email exists.
        const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)

        // One null for both "no such user" and "wrong password": NextAuth
        // turns it into the same CredentialsSignin error. PRD §6.6.
        if (!user || !passwordMatches) return null

        if (user.deletedAt) return null

        if (!user.emailVerified) {
          // Same rule as the mobile login (loginWithPassword): a distinct
          // "not verified" answer would reveal that the address has an
          // account, so it fails like a wrong password and a fresh code goes
          // to the inbox. A throttled or failed send must not change the answer.
          await sendEmailVerification(user.id, user.email).catch((caught: unknown) => {
            if (!(caught instanceof RecipientThrottledError)) {
              console.error('[auth] Could not re-send a verification code:', caught)
            }
          })
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
        // Our own timestamp in ms rather than the JWT's `iat`, which is in
        // whole seconds and would reject a sign-in made in the same second
        // as the reset.
        token.authAt = Date.now()
        return token
      }

      // The session is a stateless cookie, so a password reset cannot delete
      // it. Instead every check compares when this session began with when
      // the password last changed; returning null signs the browser out.
      // One indexed lookup by primary key per session read.
      const current = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { passwordChangedAt: true, deletedAt: true },
      })
      if (!current || current.deletedAt) return null
      const authAt = typeof token.authAt === 'number' ? token.authAt : 0
      if (current.passwordChangedAt && current.passwordChangedAt.getTime() > authAt) return null
      return token
    },

    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as Role
      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
})
