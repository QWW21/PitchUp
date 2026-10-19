import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { listPitches } from '@/lib/manager/pitches'
import { PitchTable } from '@/components/manager/PitchTable'

export const metadata: Metadata = { title: 'Pitches | PitchUp' }

/** The manager's pitches — E10-06 (UIUX_SPEC §14.1). */
export default async function PitchesPage() {
  const { company } = await requireActiveManager()
  return (
    <>
      <h1 className="sr-only">Pitches</h1>
      <PitchTable pitches={await listPitches(company.id)} />
    </>
  )
}
