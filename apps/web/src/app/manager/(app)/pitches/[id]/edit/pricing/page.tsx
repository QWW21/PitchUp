import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { getT } from '@/i18n/server'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { PricingForm } from '@/components/pitch-editor/PricingForm'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('editor.titles.pricing') }
}

/** Pitch editor, Pricing tab — E10. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id)
  const t = await getT()
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="text-lg font-semibold text-neutral-900">
        {t('editor.tabs.pricing')}
      </h2>
      <PricingForm pitch={pitch} />
    </section>
  )
}
