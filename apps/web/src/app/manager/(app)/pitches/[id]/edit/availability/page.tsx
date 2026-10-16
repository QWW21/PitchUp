import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { AvailabilityForm } from '@/components/pitch-editor/AvailabilityForm'

export const metadata: Metadata = { title: 'Availability | PitchUp' }

/** Pitch editor, Availability tab — E10. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id)
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="text-lg font-semibold text-neutral-900">
        Availability
      </h2>
      <AvailabilityForm pitch={pitch} />
    </section>
  )
}
