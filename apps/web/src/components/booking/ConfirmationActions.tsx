'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Printer, Share2 } from 'lucide-react'
import { clearDraft } from './draft'

/** Buttons under a confirmed booking. The draft is done with, so it is cleared. */
export function ConfirmationActions({
  pitchId,
  bookingId,
  shareText,
}: {
  pitchId: string
  bookingId: string
  shareText: string
}) {
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    clearDraft(pitchId)
    setCanShare(typeof navigator.share === 'function')
  }, [pitchId])

  return (
    <div className="mt-8 w-full space-y-2 print:hidden">
      <Link
        href={`/my-bookings/${bookingId}`}
        className="flex h-12 w-full items-center justify-center rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700"
      >
        View my booking
      </Link>
      <Link
        href="/discover"
        className="flex h-12 w-full items-center justify-center rounded-md font-semibold text-primary-700 hover:bg-primary-50"
      >
        Back to Discover
      </Link>
      <div className="flex justify-center gap-4 pt-2">
        {canShare && (
          <button
            type="button"
            onClick={() =>
              navigator.share({ title: 'PitchUp booking', text: shareText }).catch(() => {})
            }
            className="flex h-10 items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900"
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            Share
          </button>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex h-10 items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print receipt
        </button>
      </div>
    </div>
  )
}

/** Re-renders the page every two seconds while the payment is still being confirmed. */
export function RefreshWhilePending() {
  const router = useRouter()
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 2000)
    return () => clearInterval(timer)
  }, [router])
  return null
}
