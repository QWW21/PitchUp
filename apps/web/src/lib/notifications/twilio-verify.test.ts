/**
 * Phone codes through Twilio Verify — #163. The Twilio SDK is faked; what is
 * checked is how its answers map to ours.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const verifications = { create: vi.fn() }
const verificationChecks = { create: vi.fn() }
const services = vi.fn(() => ({ verifications, verificationChecks }))
vi.mock('twilio', () => ({ default: () => ({ verify: { v2: { services } } }) }))

async function load(serviceSid = 'VA0000000000000000000000000000test') {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '')
  vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/x')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC0000000000000000000000000000test')
  vi.stubEnv('TWILIO_AUTH_TOKEN', 'token')
  vi.stubEnv('TWILIO_VERIFY_SERVICE_SID', serviceSid)
  return import('./twilio-provider')
}

const twilioError = (code: number) => Object.assign(new Error('twilio'), { code })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('Twilio Verify', () => {
  it('is on only with a Verify service', async () => {
    expect((await load()).isTwilioVerifyConfigured()).toBe(true)
    expect((await load('')).isTwilioVerifyConfigured()).toBe(false)
  })

  it('starts an SMS verification on the configured service', async () => {
    const { twilioVerify } = await load()
    verifications.create.mockResolvedValue({ status: 'pending' })
    await twilioVerify.start('+40711111111')
    expect(services).toHaveBeenCalledWith('VA0000000000000000000000000000test')
    expect(verifications.create).toHaveBeenCalledWith({ to: '+40711111111', channel: 'sms' })
  })

  it('maps each answer to ours', async () => {
    const { twilioVerify } = await load()
    verificationChecks.create.mockResolvedValueOnce({ status: 'approved' })
    expect(await twilioVerify.check('+40711111111', '123456')).toBe('APPROVED')
    verificationChecks.create.mockResolvedValueOnce({ status: 'pending' })
    expect(await twilioVerify.check('+40711111111', '000000')).toBe('WRONG_CODE')
    verificationChecks.create.mockRejectedValueOnce(twilioError(20404))
    expect(await twilioVerify.check('+40711111111', '000000')).toBe('EXPIRED')
    verificationChecks.create.mockRejectedValueOnce(twilioError(60202))
    expect(await twilioVerify.check('+40711111111', '000000')).toBe('TOO_MANY_ATTEMPTS')
  })

  it('hides any other Twilio failure behind a plain error', async () => {
    const { twilioVerify, SmsDeliveryError } = await load()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    verifications.create.mockRejectedValueOnce(twilioError(60200))
    await expect(twilioVerify.start('+40711111111')).rejects.toBeInstanceOf(SmsDeliveryError)
    verificationChecks.create.mockRejectedValueOnce(twilioError(500))
    await expect(twilioVerify.check('+40711111111', '1')).rejects.toBeInstanceOf(SmsDeliveryError)
  })
})
