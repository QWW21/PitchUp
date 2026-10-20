import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { getT } from '@/i18n/server'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { BasicInfoForm } from '@/components/pitch-editor/BasicInfoForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('editor.titles.basic-info') }
}

/** Pitch editor, Basic info tab — E10. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id)
  const t = await getT()
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="text-lg font-semibold text-neutral-900">
        {t('editor.tabs.basic-info')}
      </h2>
      <BasicInfoForm pitch={pitch} />
    </section>
  )
}
