import { Suspense } from 'react'
import { TimeStep } from '@/components/booking/TimeStep'

export default function TimePage() {
  return (
    <Suspense>
      <TimeStep />
    </Suspense>
  )
}
