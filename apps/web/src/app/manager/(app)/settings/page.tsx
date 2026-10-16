import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { bookingSettingsOf } from '@/lib/manager/venue'
import { BookingSettingsForm } from '@/components/manager/BookingSettingsForm'
import { PaymentSettingsForm } from '@/components/manager/PaymentSettingsForm'

export const metadata: Metadata = { title: 'Settings | PitchUp' }

/** How bookings are confirmed and refunded (C-10, C-13), and how players pay (C-8). */
export default async function SettingsPage() {
  const { company } = await requireActiveManager()
  return (
    <>
      <BookingSettingsForm initial={bookingSettingsOf(company)} />
      <PaymentSettingsForm
        initial={{ paymentMode: company.paymentMode, depositPercent: company.depositPercent }}
      />
    </>
  )
}
