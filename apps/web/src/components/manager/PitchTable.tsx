'use client'

/**
 * The pitch list — E10-06 (UIUX_SPEC §14.1): cover photo, name, surface,
 * size, status switch, today's bookings, rating, and edit/delete. Sorts by
 * name, rating or today's bookings in the browser (a venue has few pitches).
 */
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { ChevronDown, ChevronUp, ImageOff, Pencil, Plus, Star, Trash2, Trophy } from 'lucide-react'
import {
  SIZE_LABELS,
  SURFACE_COLORS,
  SURFACE_LABELS,
  deriveTier,
  type ManagerPitchRow,
} from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'

type SortKey = 'name' | 'rating' | 'today'

export function PitchTable({ pitches: initial }: { pitches: ManagerPitchRow[] }) {
  const router = useRouter()
  const [pitches, setPitches] = useState(initial)
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'name', asc: true })
  const [message, setMessage] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ManagerPitchRow | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  const sorted = [...pitches].sort((a, b) => {
    const dir = sort.asc ? 1 : -1
    if (sort.key === 'name') return a.name.localeCompare(b.name) * dir
    if (sort.key === 'rating') return ((a.avgRating ?? -1) - (b.avgRating ?? -1)) * dir
    return (a.bookingsToday - b.bookingsToday) * dir
  })
  const sortBy = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === 'name' }))

  const add = async () => {
    setAdding(true)
    setMessage(null)
    try {
      const pitch = await send<{ id: string }>('/api/v1/pitches', 'POST', {
        name: 'New pitch',
        surfaceType: 'ARTIFICIAL_GRASS',
        size: 'FIVE_A_SIDE',
      })
      router.push(`/manager/pitches/${pitch.id}/edit/basic-info`)
    } catch (caught) {
      setMessage((caught as Error).message)
      setAdding(false)
    }
  }

  const toggle = async (p: ManagerPitchRow) => {
    setMessage(null)
    if (!p.isActive && p.photoCount === 0) {
      setMessage(`Add at least one photo to ${p.name} before activating it.`)
      return
    }
    const set = (isActive: boolean) =>
      setPitches(list => list.map(x => (x.id === p.id ? { ...x, isActive } : x)))
    set(!p.isActive)
    try {
      await send(`/api/v1/pitches/${p.id}/status`, 'PATCH', { isActive: !p.isActive })
    } catch (caught) {
      set(p.isActive)
      setMessage((caught as Error).message)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await send(`/api/v1/pitches/${deleting.id}`, 'DELETE')
      setPitches(list => list.filter(x => x.id !== deleting.id))
      dialog.current?.close()
      router.refresh()
    } catch (caught) {
      setMessage((caught as Error).message)
      dialog.current?.close()
    }
  }

  const addButton = (
    <button
      type="button"
      onClick={add}
      disabled={adding}
      className="inline-flex h-10 items-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {adding ? 'Adding…' : 'Add pitch'}
    </button>
  )

  if (!pitches.length) {
    return (
      <div className="flex flex-col items-center rounded-xl bg-white px-6 py-16 text-center shadow-sm">
        <Trophy className="h-16 w-16 text-primary-600" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-semibold text-neutral-900">No pitches yet</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Add your first pitch to start taking bookings.
        </p>
        <div className="mt-6">{addButton}</div>
        {message && (
          <div className="mt-4 w-full max-w-md">
            <Alert>{message}</Alert>
          </div>
        )}
      </div>
    )
  }

  const header = (key: SortKey, label: string, className = '') => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.asc ? 'ascending' : 'descending') : 'none'}
      className={`px-4 py-3 ${className}`}
    >
      <button
        type="button"
        onClick={() => sortBy(key)}
        className="inline-flex items-center gap-1 uppercase hover:text-neutral-900"
      >
        {label}
        {sort.key === key &&
          (sort.asc ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ))}
      </button>
    </th>
  )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          {pitches.length} {pitches.length === 1 ? 'pitch' : 'pitches'} ·{' '}
          {pitches.filter(p => p.isActive).length} active
        </p>
        {addButton}
      </div>
      {message && (
        <div className="mb-4">
          <Alert>{message}</Alert>
        </div>
      )}
      <div className="relative overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-neutral-50 text-xs font-medium uppercase text-neutral-500">
            <tr>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Photo</span>
              </th>
              {header('name', 'Name')}
              <th scope="col" className="px-4 py-3">
                Surface
              </th>
              <th scope="col" className="px-4 py-3">
                Size
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Min. tier
              </th>
              {header('today', "Today's bookings", 'text-center')}
              {header('rating', 'Rating')}
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sorted.map(p => {
              const surface = SURFACE_COLORS[p.surfaceType]
              const edit = `/manager/pitches/${p.id}/edit/basic-info`
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    {p.coverPhotoUrl ? (
                      <img
                        src={p.coverPhotoUrl}
                        alt=""
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-md bg-neutral-100">
                        <ImageOff className="h-5 w-5 text-neutral-400" aria-hidden="true" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={edit} className="font-medium text-neutral-900 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ background: surface.background, color: surface.text }}
                    >
                      {SURFACE_LABELS[p.surfaceType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{SIZE_LABELS[p.size]}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.isActive}
                        aria-label={`${p.name} active`}
                        onClick={() => void toggle(p)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${p.isActive ? 'bg-primary-600' : 'bg-neutral-300'}`}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${p.isActive ? 'translate-x-5' : ''}`}
                        />
                      </button>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.isActive ? 'bg-success-50 text-primary-700' : 'bg-neutral-100 text-neutral-500'}`}
                      >
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {p.minTrustScore > 0 ? (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium">
                        {deriveTier(p.minTrustScore)}+
                      </span>
                    ) : (
                      <span aria-label="Anyone">–</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-900">{p.bookingsToday}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {p.avgRating === null ? (
                      '–'
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Star
                          className="h-3 w-3 fill-accent-500 text-accent-500"
                          aria-hidden="true"
                        />
                        {p.avgRating.toFixed(1)}{' '}
                        <span className="text-neutral-500">({p.reviewCount})</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex justify-end gap-1">
                      <Link
                        href={edit}
                        aria-label={`Edit ${p.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-700 hover:bg-neutral-100"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => {
                          setDeleting(p)
                          dialog.current?.showModal()
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-error-600 hover:bg-error-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="delete-pitch-heading"
        className="w-[min(28rem,calc(100%-2rem))] rounded-xl p-6 shadow-xl backdrop:bg-black/40"
        onClick={e => e.target === dialog.current && dialog.current?.close()}
      >
        <h2 id="delete-pitch-heading" className="text-lg font-semibold text-neutral-900">
          Delete {deleting?.name}?
        </h2>
        <p className="mt-2 text-sm text-neutral-700">
          {deleting?.upcomingBookings
            ? `This pitch has ${deleting.upcomingBookings} upcoming booking${deleting.upcomingBookings === 1 ? '' : 's'}. Cancel them first.`
            : 'Players will no longer see it. This cannot be undone.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="h-10 rounded-md px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
          >
            Cancel
          </button>
          {!deleting?.upcomingBookings && (
            <button
              type="button"
              onClick={() => void confirmDelete()}
              className="h-10 rounded-md bg-error-600 px-4 text-sm font-semibold text-white hover:opacity-90"
            >
              Delete pitch
            </button>
          )}
        </div>
      </dialog>
    </>
  )
}
