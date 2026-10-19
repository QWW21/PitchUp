import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { BasicInfoForm } from '@/components/pitch-editor/BasicInfoForm'

export const metadata: Metadata = { title: 'Basic info | PitchUp' }

/** Pitch editor, Basic info tab — E10. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id)
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="text-lg font-semibold text-neutral-900">
        Basic info
      </h2>
      <BasicInfoForm pitch={pitch} />
    </section>
  )
}
