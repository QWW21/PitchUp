import { redirect } from 'next/navigation'

type Props = { params: Promise<{ pitchId: string }> }

/** /book/:pitchId starts at step 1. */
export default async function BookingStart({ params }: Props) {
  redirect(`/book/${(await params).pitchId}/date`)
}
