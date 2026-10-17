import { Suspense } from 'react'
import { SummaryStep } from '@/components/booking/SummaryAndPay'

export default function SummaryPage() {
  return (
    <Suspense>
      <SummaryStep />
    </Suspense>
  )
}
