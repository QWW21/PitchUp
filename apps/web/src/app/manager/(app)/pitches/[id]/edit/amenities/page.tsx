import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { getT } from '@/i18n/server'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { AmenitiesForm } from '@/components/pitch-editor/AmenitiesForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('editor.titles.amenities') }
}

/** Pitch editor, Amenities tab — E10. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id)
  const t = await getT()
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="text-lg font-semibold text-neutral-900">
        {t('editor.tabs.amenities')}
      </h2>
      <AmenitiesForm pitchId={pitch.id} amenities={pitch.amenities} />
    </section>
  )
}
