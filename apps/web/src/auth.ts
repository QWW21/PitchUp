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

/**
 * A bcrypt hash of a throwaway value, compared against when no user matched.
 *
 * Without this, "unknown email" returns in microseconds while "wrong password"
 * takes the ~250ms bcrypt costs, and the difference tells an attacker which
 * emails are registered. PRD §6.6.
 */
const DUMMY_HASH = bcrypt.hashSync('invalid-password-placeholder', AUTH.BCRYPT_COST)

export class EmailNotVerifiedError extends Error {
  static code = 'EMAIL_NOT_VERIFIED'
  code = EmailNotVerifiedError.code
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),

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

        // Thrown rather than returned null: the login form needs to tell the
        // player to check their inbox, which a generic failure cannot do.
        if (!user.emailVerified) throw new EmailNotVerifiedError()

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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = user.role
      }
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
