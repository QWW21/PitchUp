/**
 * Stripe integration without a Stripe account — E05. The SDK is replaced by a
 * fake for the calls that would reach Stripe; webhook signatures are checked
 * with the real SDK, which verifies them offline.
 */
import Stripe from 'stripe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SECRET = 'whsec_unit_test_secret'

const prismaMock = vi.hoisted(() => ({
  user: { findUniqueOrThrow: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  stripeWebhookEvent: { findUnique: vi.fn(), create: vi.fn() },
  company: { updateMany: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const events = vi.hoisted(() => ({
  confirmPaid: vi.fn(),
  markPaymentFailed: vi.fn(),
  recordRefund: vi.fn(),
}))
vi.mock('@/lib/bookings/payment-events', () => events)

async function load() {
  vi.resetModules()
  vi.stubEnv('SKIP_ENV_VALIDATION', '')
  vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/x')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unit')
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET)
  vi.stubEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'pk_test_unit')
  return import('./stripe')
}

function fakeStripe() {
  return {
    paymentIntents: {
      create: vi.fn(async () => ({ id: 'pi_1', client_secret: 'pi_1_secret' })),
      retrieve: vi.fn(),
      cancel: vi.fn(async () => ({})),
    },
    refunds: { create: vi.fn(async () => ({ id: 're_1' })) },
    customers: { create: vi.fn(async () => ({ id: 'cus_1' })) },
    paymentMethods: {
      list: vi.fn(async () => ({
        data: [
          { id: 'pm_mine', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 } },
        ],
      })),
      detach: vi.fn(async () => ({})),
    },
    setupIntents: { create: vi.fn(async () => ({ client_secret: 'seti_secret' })) },
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('stripe provider', { timeout: 20_000 }, () => {
  let sdk: ReturnType<typeof fakeStripe>
  let mod: Awaited<ReturnType<typeof load>>

  beforeEach(async () => {
    mod = await load()
    sdk = fakeStripe()
    mod.setStripeClientForTests(sdk as unknown as Stripe)
  })

  it('charges in bani, in RON, tagged with the booking, at most once per booking', async () => {
    const created = await mod.stripeProvider.createPayment({
      bookingId: 'bk_1',
      userId: 'u_1',
      amountRon: 240.5,
      description: 'Teren 1',
      customerId: 'cus_1',
      paymentMethodId: 'pm_mine',
    })
    expect(created).toEqual({ id: 'pi_1', clientSecret: 'pi_1_secret' })
    expect(sdk.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 24050,
        currency: 'ron',
        customer: 'cus_1',
        payment_method: 'pm_mine',
        metadata: { bookingId: 'bk_1', userId: 'u_1' },
      }),
      { idempotencyKey: 'booking-bk_1' }
    )
  })

  it.each([
    [
      { status: 'succeeded', amount: 24000 },
      { status: 'succeeded', amountRon: 240 },
    ],
    [{ status: 'canceled' }, { status: 'failed', message: 'Payment cancelled' }],
    [
      {
        status: 'requires_payment_method',
        last_payment_error: { message: 'Your card was declined.' },
      },
      { status: 'failed', message: 'Your card was declined.' },
    ],
    [{ status: 'requires_payment_method' }, { status: 'pending' }],
    [{ status: 'processing' }, { status: 'pending' }],
  ])('reads %o as %o', async (intent, state) => {
    sdk.paymentIntents.retrieve.mockResolvedValue(intent)
    expect(await mod.stripeProvider.paymentState('pi_1')).toEqual(state)
  })

  it('refunds in bani', async () => {
    expect(await mod.stripeProvider.refund('pi_1', 120)).toEqual({ refundId: 're_1' })
    expect(sdk.refunds.create).toHaveBeenCalledWith({ payment_intent: 'pi_1', amount: 12000 })
  })

  it('creates a Stripe customer once and remembers it', async () => {
    prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({
      email: 'ion@example.ro',
      name: 'Ion',
      stripeCustomerId: null,
    })
    expect(await mod.getOrCreateCustomer('u_1')).toBe('cus_1')
    expect(sdk.customers.create).toHaveBeenCalledWith(
      { email: 'ion@example.ro', name: 'Ion', metadata: { userId: 'u_1' } },
      { idempotencyKey: 'customer-u_1' }
    )
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u_1' },
      data: { stripeCustomerId: 'cus_1' },
    })

    prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({ stripeCustomerId: 'cus_1' })
    expect(await mod.getOrCreateCustomer('u_1')).toBe('cus_1')
    expect(sdk.customers.create).toHaveBeenCalledTimes(1)
  })

  it("never detaches another customer's card", async () => {
    expect(await mod.detachCard('cus_1', 'pm_someone_else')).toBe(false)
    expect(sdk.paymentMethods.detach).not.toHaveBeenCalled()
    expect(await mod.detachCard('cus_1', 'pm_mine')).toBe(true)
    expect(sdk.paymentMethods.detach).toHaveBeenCalledWith('pm_mine')
  })
})

describe('webhook', { timeout: 20_000 }, () => {
  const signed = (event: object, secret = SECRET) => {
    const payload = JSON.stringify(event)
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret })
    return new Request('http://localhost/api/v1/payments/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': header },
      body: payload,
    })
  }
  const event = (type: string, object: object, id = 'evt_1') => ({
    id,
    object: 'event',
    type,
    data: { object },
  })

  async function route() {
    await load()
    return import('@/app/api/v1/payments/webhook/route')
  }

  beforeEach(() => {
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValue(null)
    prismaMock.stripeWebhookEvent.create.mockResolvedValue({})
  })

  it('rejects a body that was not signed with our secret', async () => {
    const { POST } = await route()
    const forged = signed(event('payment_intent.succeeded', {}), 'whsec_someone_else')
    expect((await POST(forged as never)).status).toBe(400)
    expect(events.confirmPaid).not.toHaveBeenCalled()
  })

  it('confirms the booking on payment_intent.succeeded, once', async () => {
    const { POST } = await route()
    const intent = { id: 'pi_9', object: 'payment_intent', metadata: { bookingId: 'bk_9' } }
    const res = await POST(signed(event('payment_intent.succeeded', intent)) as never)
    expect(res.status).toBe(200)
    expect(events.confirmPaid).toHaveBeenCalledWith('bk_9', 'pi_9')
    expect(prismaMock.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt_1', type: 'payment_intent.succeeded' },
    })

    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValue({ id: 'evt_1' })
    const again = await POST(signed(event('payment_intent.succeeded', intent)) as never)
    expect(await again.json()).toEqual({ received: true, duplicate: true })
    expect(events.confirmPaid).toHaveBeenCalledTimes(1)
  })

  it('cancels on a failed payment with Stripe’s message', async () => {
    const { POST } = await route()
    await POST(
      signed(
        event('payment_intent.payment_failed', {
          id: 'pi_9',
          metadata: { bookingId: 'bk_9' },
          last_payment_error: { message: 'Your card has insufficient funds.' },
        })
      ) as never
    )
    expect(events.markPaymentFailed).toHaveBeenCalledWith(
      'bk_9',
      'Your card has insufficient funds.'
    )
  })

  it('records refunds and mirrors Connect account flags', async () => {
    const { POST } = await route()
    await POST(
      signed(
        event('charge.refunded', {
          payment_intent: 'pi_9',
          amount_refunded: 12000,
          refunds: { data: [{ id: 're_9' }] },
        })
      ) as never
    )
    expect(events.recordRefund).toHaveBeenCalledWith('pi_9', 120, 're_9')

    await POST(
      signed(
        event(
          'account.updated',
          { id: 'acct_1', charges_enabled: true, payouts_enabled: false },
          'evt_2'
        )
      ) as never
    )
    expect(prismaMock.company.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: 'acct_1' },
      data: { stripeChargesEnabled: true, stripePayoutsEnabled: false },
    })
  })

  it('answers 500 when handling fails, so Stripe retries, and does not mark the event done', async () => {
    const { POST } = await route()
    events.confirmPaid.mockRejectedValueOnce(new Error('database down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await POST(
      signed(
        event('payment_intent.succeeded', { id: 'pi_9', metadata: { bookingId: 'bk_9' } })
      ) as never
    )
    expect(res.status).toBe(500)
    expect(prismaMock.stripeWebhookEvent.create).not.toHaveBeenCalled()
  })
})
