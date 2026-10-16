import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ApiException } from '@/lib/api/errors'
import { requireActiveManager } from '@/lib/manager/access'
import { loadPitchForEditor } from '@/lib/manager/editor'
import { PitchEditorShell } from '@/components/pitch-editor/PitchEditorShell'

/** The pitch editor's frame — E10-07 (UIUX_SPEC §14.2): breadcrumb, title, tabs. */
export default async function PitchEditorLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const [{ id }, { company }] = await Promise.all([params, requireActiveManager()])
  const pitch = await loadPitchForEditor(company.id, id).catch(caught => {
    if (caught instanceof ApiException && caught.code === 'NOT_FOUND') notFound()
    throw caught
  })
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-neutral-500">
        <Link href="/manager/pitches" className="hover:underline">
          Pitches
        </Link>{' '}
        / <span className="text-neutral-700">{pitch.name}</span>
      </nav>
      <h1 className="mt-1 text-2xl font-bold text-neutral-900">Edit {pitch.name}</h1>
      <PitchEditorShell pitchId={pitch.id}>{children}</PitchEditorShell>
    </>
  )
}
