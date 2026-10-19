/**
 * Push over FCM's HTTP v1 API without a Firebase project — E13-02. Google's
 * endpoints are replaced by a fake fetch; the service account's key is a
 * throwaway RSA key, so the JWT is really signed and checked.
 */
import { createVerify, generateKeyPairSync } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

async function load(configured = true) {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '')
  vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/x')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  if (configured) {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'pitchup-test')
    vi.stubEnv('FIREBASE_CLIENT_EMAIL', 'push@pitchup-test.iam.gserviceaccount.com')
    // As it arrives from an env var: one line, literal \n.
    vi.stubEnv('FIREBASE_PRIVATE_KEY', PEM.replace(/\n/g, '\\n'))
  }
  return import('./push')
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('sendPush', () => {
  it('does nothing without a Firebase project', async () => {
    const push = await load(false)
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect(
      await push.sendPush([{ id: 't1', token: 'tok' }], { title: 'a', body: 'b', data: {} })
    ).toEqual({
      sent: 0,
      stale: [],
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('signs a JWT, gets an access token once, sends to each phone and forgets dead ones', async () => {
    const push = await load()
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        const assertion = new URLSearchParams(String(init.body)).get('assertion')!
        const [h, c, s] = assertion.split('.')
        const ok = createVerify('RSA-SHA256')
          .update(`${h}.${c}`)
          .verify(publicKey, Buffer.from(s!.replace(/-/g, '+').replace(/_/g, '/'), 'base64'))
        const claims = JSON.parse(Buffer.from(c!, 'base64').toString())
        expect(ok).toBe(true)
        expect(claims).toMatchObject({
          iss: 'push@pitchup-test.iam.gserviceaccount.com',
          scope: 'https://www.googleapis.com/auth/firebase.messaging',
        })
        return json(200, { access_token: 'ya29.test', expires_in: 3600 })
      }
      const body = JSON.parse(String(init.body))
      expect(url).toBe('https://fcm.googleapis.com/v1/projects/pitchup-test/messages:send')
      expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ya29.test')
      if (body.message.token === 'gone') {
        return json(404, {
          error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] },
        })
      }
      if (body.message.token === 'busy') return json(503, { error: { status: 'UNAVAILABLE' } })
      expect(body.message).toMatchObject({
        notification: { title: 'Booking confirmed', body: 'Teren 1' },
        data: { bookingId: 'b1' },
      })
      return json(200, { name: 'projects/x/messages/1' })
    })
    vi.stubGlobal('fetch', fetch)
    const message = { title: 'Booking confirmed', body: 'Teren 1', data: { bookingId: 'b1' } }
    const tokens = [
      { id: 't1', token: 'phone-1' },
      { id: 't2', token: 'gone' },
      { id: 't3', token: 'busy' },
    ]
    expect(await push.sendPush(tokens, message)).toEqual({ sent: 1, stale: ['t2'] })
    // The access token is reused.
    await push.sendPush([{ id: 't1', token: 'phone-1' }], message)
    expect(
      fetch.mock.calls.filter(c => c[0] === 'https://oauth2.googleapis.com/token')
    ).toHaveLength(1)
  })
})
