import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { formatDateLong } from '@pitchup/shared'
import { auth } from '@/auth'
import { listOpenDisputes } from '@/lib/admin/disputes'
import { DisputeDecision } from '@/components/admin/DisputeDecision'

export const metadata: Metadata = { title: 'Disputes | PitchUp' }

/** Open no-show disputes — E12-04 (the full admin panel is E15). */
export default async function DisputesPage() {
  // The layout checks too, but layouts and pages render in parallel.
  const session = await auth()
  if (session?.user.role !== 'ADMIN') return null
  const disputes = await listOpenDisputes()
  return (
    <>
      <h1 className="text-2xl font-bold text-neutral-900">No-show disputes</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {disputes.length === 0
          ? 'Nothing to decide.'
          : `${disputes.length} ${disputes.length === 1 ? 'dispute waits' : 'disputes wait'} for a decision.`}
      </p>
      {disputes.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-xl bg-white px-6 py-12 text-center shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-neutral-300" aria-hidden="true" />
          <p className="mt-3 font-semibold text-neutral-900">All caught up</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {disputes.map(d => (
            <li key={d.bookingId}>
              <article
                aria-labelledby={`d-${d.bookingId}`}
                className="rounded-xl bg-white p-5 shadow-sm"
              >
                <h2 id={`d-${d.bookingId}`} className="text-lg font-semibold text-neutral-900">
                  {d.player.name} at {d.venue}
                </h2>
                <p className="text-sm text-neutral-700">
                  {d.pitch} · {formatDateLong(d.date)}, {d.startTime}–{d.endTime} · {d.reference}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="font-medium text-neutral-900">The venue says</dt>
                    <dd className="text-neutral-700">{d.managerReason ?? 'No reason given.'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-neutral-900">The player says</dt>
                    <dd className="text-neutral-700">{d.disputeText ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-neutral-900">The venue kept</dt>
                    <dd className="text-neutral-700">{d.keptAmount} RON</dd>
                  </div>
                </dl>
                <DisputeDecision bookingId={d.bookingId} />
              </article>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
