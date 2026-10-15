/**
 * Built-in test payments — E05. Used when Stripe keys are not set, so the
 * whole booking flow can be exercised (and tested in CI) without an account.
 * Nothing is charged: the client finishes a test payment with
 * POST /api/v1/payments/test/confirm, choosing success or a declined card,
 * which runs the same code the Stripe webhook runs.
 */
import 'server-only'
import type { PaymentProvider } from './types'

export const testProvider: PaymentProvider = {
  name: 'test',
  async createPayment({ bookingId }) {
    return { id: `test_pi_${bookingId}`, clientSecret: null }
  },
  async paymentState() {
    // Resolved only through the test confirm endpoint.
    return { status: 'pending' }
  },
  async cancelPayment() {},
  async cardDetails() {
    return null
  },
  async refund(paymentId) {
    return { refundId: paymentId.replace('test_pi_', 'test_re_') }
  },
}
