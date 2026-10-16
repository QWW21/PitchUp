import { redirect } from 'next/navigation'

/** /manager/pitches/:id/edit opens on the first tab. */
export default async function EditPitch({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/manager/pitches/${id}/edit/basic-info`)
}
