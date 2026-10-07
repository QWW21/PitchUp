/**
 * Environment variable validation — ticket E01-05.
 *
 * Imported by the root layout so a missing or malformed variable fails at
 * process startup with a list of what is wrong, rather than at the moment a
 * user first hits the feature that needs it.
 *
 * Server variables are unreadable from client components: @t3-oss/env-nextjs
 * throws on access rather than silently returning undefined.
 */
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

/**
 * Integrations are not wired up until later epics (Stripe in E05, Cloudinary
 * in E01-10, Resend/Twilio/FCM in E13). Their variables are optional for now
 * so that `pnpm dev` runs on a fresh clone with only a database configured.
 * Each becomes required in the epic that introduces it.
 */
const optionalUntilIntegrated = <T extends z.ZodTypeAny>(schema: T) => schema.optional()

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    NEXTAUTH_SECRET: z.string().min(32, 'Must be at least 32 characters'),
    NEXTAUTH_URL: z.string().url().optional(),

    // E05 — payments
    STRIPE_SECRET_KEY: optionalUntilIntegrated(z.string().startsWith('sk_')),
    STRIPE_WEBHOOK_SECRET: optionalUntilIntegrated(z.string().startsWith('whsec_')),

    // E01-10 — image uploads
    CLOUDINARY_API_KEY: optionalUntilIntegrated(z.string().min(1)),
    CLOUDINARY_API_SECRET: optionalUntilIntegrated(z.string().min(1)),

    // E13 — notifications
    RESEND_API_KEY: optionalUntilIntegrated(z.string().startsWith('re_')),
    TWILIO_ACCOUNT_SID: optionalUntilIntegrated(z.string().startsWith('AC')),
    TWILIO_AUTH_TOKEN: optionalUntilIntegrated(z.string().min(1)),
    TWILIO_PHONE_NUMBER: optionalUntilIntegrated(
      z.string().regex(/^\+\d{8,15}$/, 'Must be E.164, e.g. +40712345678')
    ),
    FCM_SERVER_KEY: optionalUntilIntegrated(z.string().min(1)),

    ADMIN_PASSWORD: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: optionalUntilIntegrated(z.string().min(1)),
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: optionalUntilIntegrated(z.string().min(1)),
  },

  /**
   * Next.js inlines process.env.NEXT_PUBLIC_* at build time only for literal
   * property accesses, so every variable has to be spelled out here.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    FCM_SERVER_KEY: process.env.FCM_SERVER_KEY,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  },

  /** Lets `next build` and CI run without a full secret set. */
  skipValidation: process.env.SKIP_ENV_VALIDATION === '1',

  /** Treat "" the same as unset, so a blank line in .env is not a value. */
  emptyStringAsUndefined: true,
})
