import { redirect } from 'next/navigation'

type Props = { searchParams: Promise<{ pitchId?: string; date?: string }> }

/** The E04 placeholder's address, kept so old links still reach the booking flow (E05). */
export default async function OldBookingLink({ searchParams }: Props) {
  const { pitchId, date } = await searchParams
  redirect(pitchId ? `/book/${pitchId}/date${date ? `?date=${date}` : ''}` : '/discover')
}
