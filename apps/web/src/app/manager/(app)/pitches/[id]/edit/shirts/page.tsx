import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { ShirtsForm } from '@/components/pitch-editor/ShirtsForm'

export const metadata: Metadata = { title: 'Shirts | PitchUp' }

/** Pitch editor, Shirts tab — E10. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id)
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="text-lg font-semibold text-neutral-900">
        Shirts
      </h2>
      <ShirtsForm pitchId={pitch.id} hasShirts={pitch.hasShirts} inventory={pitch.shirtInventory} />
    </section>
  )
}
