/**
 * NextAuth configuration — ticket E01-09.
 *
 * Web uses the session cookie. Mobile gets a JWT from a custom route built in
 * E02; the JWT session strategy here is what makes both possible.
 */
import type { Role } from '@prisma/client'
import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { cache } from 'react'
import { LoginSchema } from '@pitchup/shared'
import { prisma } from '@/lib/prisma'
import {
  RecipientThrottledError,
  checkPassword,
  loginSucceeded,
  sendEmailVerification,
} from '@/lib/auth/service'
import { accountForGoogleEmail } from '@/lib/auth/google'
import { env } from '@/lib/env'

/**
 * Too many failed sign-ins for this address (#188). Reaches the login form
 * as `result.code`, so it can say so instead of "wrong password".
 */
class LoginThrottled extends CredentialsSignin {
  code = 'rate_limited'
}

/**
 * A page asks for the session several times (the top bar, the page, a
 * panel); React's `cache` makes that one database read per request. Outside
 * a server render (API routes) it simply calls through.
 */
const sessionFreshness = cache((id: string) =>
  prisma.user.findUnique({
    where: { id },
    select: { passwordChangedAt: true, deletedAt: true, suspendedAt: true },
  })
)

export const { handlers, signIn, signOut, auth } = NextAuth({
  // No adapter: sessions are JWTs and accounts are ours. Google sign-in
  // matches an existing account by email (see the signIn callback) instead
  // of keeping Auth.js's own User/Account tables.

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
      // One line, no stack, so a run of throttled sign-ins stays visible.
      if (error instanceof LoginThrottled) {
        console.warn('[auth] Sign-in refused: too many failed attempts for one address')
        return
      }
      if (error.name === 'CredentialsSignin' || error instanceof CredentialsSignin) return
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

        // Timing-safe, and limited per address together with the mobile login.
        const check = await checkPassword(email, password)
        if (check.throttled) throw new LoginThrottled()
        const { user } = check

        // One null for both "no such user" and "wrong password": NextAuth
        // turns it into the same CredentialsSignin error. PRD §6.6.
        if (!user) return null

        // Deleted, or suspended by an admin (E15).
        if (user.deletedAt || user.suspendedAt) return null

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

        loginSucceeded(email)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      },
    }),

    // E02-07: shown only when the Web OAuth client is configured.
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })]
      : []),
  ],

  callbacks: {
    /**
     * Google opens only a confirmed, active account with the same address;
     * the portal's accounts are made by registering. Anything else returns
     * to the login page with a reason it can show.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true
      if (!profile?.email || profile.email_verified !== true) return '/login?error=GoogleNoAccount'
      const user = await accountForGoogleEmail(profile.email)
      return user ? true : '/login?error=GoogleNoAccount'
    },

    async jwt({ token, user, account }) {
      if (user && account?.provider === 'google') {
        // `user` is Google's profile; the session must carry our account.
        const ours = await accountForGoogleEmail(user.email ?? '')
        if (!ours) return null
        token.id = ours.id
        token.role = ours.role
        token.authAt = Date.now()
        return token
      }
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
      // One indexed lookup by primary key, once per request however many
      // components ask for the session (see sessionFreshness below).
      const current = await sessionFreshness(token.id as string)
      // A suspension (E15) ends the session at once, like a deletion.
      if (!current || current.deletedAt || current.suspendedAt) return null
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
