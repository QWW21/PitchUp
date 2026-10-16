import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { PaymentSettingsForm } from '@/components/manager/PaymentSettingsForm'

export const metadata: Metadata = { title: 'Settings | PitchUp' }

/** Settings — for now only how the venue is paid (C-8); E12 adds the rest. */
export default async function SettingsPage() {
  const { company } = await requireActiveManager()
  return (
    <>
      <h1 className="sr-only">Settings</h1>
      <PaymentSettingsForm
        initial={{ paymentMode: company.paymentMode, depositPercent: company.depositPercent }}
      />
    </>
  )
}
