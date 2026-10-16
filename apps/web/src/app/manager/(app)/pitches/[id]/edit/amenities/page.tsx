import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { AmenitiesForm } from '@/components/pitch-editor/AmenitiesForm'

export const metadata: Metadata = { title: 'Amenities | PitchUp' }

/** Pitch editor, Amenities tab — E10. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id)
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="text-lg font-semibold text-neutral-900">
        Amenities
      </h2>
      <AmenitiesForm pitchId={pitch.id} amenities={pitch.amenities} />
    </section>
  )
}
