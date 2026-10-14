'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react'

interface Photo {
  id: string
  url: string
}

/**
 * Main image, thumbnail strip and a fullscreen lightbox. E04-08.
 * Built in place rather than with a gallery library: it needs only a handful
 * of behaviours, and the lightbox takes the keyboard (←, →, Esc).
 */
export function PhotoGallery({ photos, alt }: { photos: Photo[]; alt: string }) {
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const count = photos.length

  const step = useCallback((by: number) => setIndex(i => (i + by + count) % count), [count])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    // The page behind should not scroll under the overlay.
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightbox, step])

  if (count === 0) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl bg-neutral-100">
        <ImageOff className="h-12 w-12 text-neutral-400" aria-hidden="true" />
        <p className="mt-2 text-xs text-neutral-400">No photos available</p>
      </div>
    )
  }

  const current = photos[index]!

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="block w-full overflow-hidden rounded-xl"
          aria-label={`Open photo ${index + 1} of ${count} full screen`}
        >
          <img
            src={current.url}
            alt={`${alt}, photo ${index + 1}`}
            className="aspect-[4/3] w-full bg-neutral-100 object-cover"
          />
        </button>
        <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
          {index + 1} / {count}
        </span>
        {count > 1 && (
          <>
            <ArrowButton side="left" onClick={() => step(-1)} />
            <ArrowButton side="right" onClick={() => step(1)} />
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index}
              className={`shrink-0 overflow-hidden rounded-md ring-2 ring-offset-1 ${
                i === index ? 'ring-primary-600' : 'ring-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={p.url} alt="" className="h-14 w-20 object-cover" />
            </button>
          ))}
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photos"
          className="fixed inset-0 z-50 flex flex-col bg-black"
        >
          <div className="flex items-center justify-between p-4 text-white">
            <span className="text-sm">
              {index + 1} / {count}
            </span>
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center p-4">
            <img
              src={current.url}
              alt={`${alt}, photo ${index + 1}`}
              className="max-h-full max-w-full object-contain"
            />
            {count > 1 && (
              <>
                <ArrowButton side="left" onClick={() => step(-1)} dark />
                <ArrowButton side="right" onClick={() => step(1)} dark />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ArrowButton({
  side,
  onClick,
  dark = false,
}: {
  side: 'left' | 'right'
  onClick: () => void
  dark?: boolean
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full ${
        side === 'left' ? 'left-3' : 'right-3'
      } ${dark ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white/90 text-neutral-900 shadow-sm hover:bg-white'}`}
    >
      <Icon className="h-5 w-5" />
    </button>
  )
}
