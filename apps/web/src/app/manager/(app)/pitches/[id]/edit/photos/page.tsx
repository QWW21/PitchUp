import type { Metadata } from 'next'
import { requireActiveManager } from '@/lib/manager/access'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { isCloudinaryConfigured } from '@/lib/cloudinary'
import { PhotoManager } from '@/components/pitch-editor/PhotoManager'

export const metadata: Metadata = { title: 'Photos | PitchUp' }

/** Pitch editor, Photos tab — E10. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id)
  return (
    <section aria-labelledby="tab-heading">
      <h2 id="tab-heading" className="text-lg font-semibold text-neutral-900">
        Photos
      </h2>
      <PhotoManager
        pitchId={pitch.id}
        photos={pitch.photos}
        uploadsEnabled={isCloudinaryConfigured()}
      />
    </section>
  )
}
