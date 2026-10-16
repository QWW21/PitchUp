/**
 * Push through Firebase Cloud Messaging — E13-02, using FCM's HTTP v1 API
 * directly rather than the firebase-admin SDK: one signed request for an
 * access token, one request per phone. Without FIREBASE_* set (no Firebase
 * project yet) nothing is sent and nothing fails.
 *
 * The access token comes from a service account: a JWT signed with its
 * private key (RS256) is exchanged at Google's token endpoint for an hour's
 * token, cached until shortly before it expires.
 */
import 'server-only'
import { createSign } from 'node:crypto'
import { env } from '@/lib/env'

export const isPushConfigured = (): boolean =>
  !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY)

const base64url = (input: string | Buffer) =>
  Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

let cached: { token: string; expiresAt: number } | null = null

async function accessToken(now = Date.now()): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > now) return cached.token
  const iat = Math.floor(now / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: env.FIREBASE_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    })
  )
  // Private keys pasted into an env var usually arrive with literal "\n".
  const key = (env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n')
  const signature = base64url(createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }),
  })
  const body = (await res.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
  } | null
  if (!res.ok || !body?.access_token) throw new Error(`Firebase auth failed (${res.status})`)
  cached = { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 }
  return body.access_token
}

export interface PushMessage {
  title: string
  body: string
  /** FCM data values must be strings. */
  data: Record<string, string>
}

/** Sends to each phone; returns how many got it and the tokens to forget. */
export async function sendPush(
  tokens: { id: string; token: string }[],
  message: PushMessage
): Promise<{ sent: number; stale: string[] }> {
  if (!isPushConfigured() || !tokens.length) return { sent: 0, stale: [] }
  const auth = await accessToken()
  const url = `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`
  let sent = 0
  const stale: string[] = []
  for (const t of tokens) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: t.token,
          notification: { title: message.title, body: message.body },
          data: message.data,
        },
      }),
    })
    if (res.ok) {
      sent++
      continue
    }
    const error = (await res.json().catch(() => null)) as {
      error?: { status?: string; details?: { errorCode?: string }[] }
    } | null
    const code = error?.error?.details?.find(d => d.errorCode)?.errorCode ?? error?.error?.status
    // The app was uninstalled or the token is malformed: forget it.
    if (res.status === 404 || code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
      stale.push(t.id)
    } else {
      console.error(`[push] send failed (${res.status} ${code ?? ''})`)
    }
  }
  return { sent, stale }
}

/** For tests: forget the cached access token. */
export const resetPushTokenCache = () => {
  cached = null
}
