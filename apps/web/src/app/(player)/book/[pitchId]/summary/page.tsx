import { Suspense } from 'react'
import { SummaryStep } from '@/components/booking/SummaryStep'

export default function SummaryPage() {
  return (
    <Suspense>
      <SummaryStep />
    </Suspense>
  )
}
