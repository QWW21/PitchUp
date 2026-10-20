import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { listPitches } from '@/lib/manager/pitches'
import { PitchTable } from '@/components/manager/PitchTable'
import { getT } from '@/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('mVenue.pitches.title') }
}

/** The manager's pitches — E10-06 (UIUX_SPEC §14.1). */
export default async function PitchesPage() {
  const { company } = await requireActiveManager()
  const t = await getT()
  return (
    <>
      <h1 className="sr-only">{t('mVenue.pitches.heading')}</h1>
      <PitchTable pitches={await listPitches(company.id)} />
    </>
  )
}
