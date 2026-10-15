import { Suspense } from 'react'
import { TeamsStep } from '@/components/booking/TeamsStep'

export default function TeamsPage() {
  return (
    <Suspense>
      <TeamsStep />
    </Suspense>
  )
}
