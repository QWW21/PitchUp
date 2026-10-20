'use client'

/**
 * Photos tab — E10-07. Up to 10; the first is the cover. Drag a photo to
 * reorder it, or use its "Move earlier/later" buttons (the keyboard way).
 * New files are checked here (JPEG, PNG or WebP, at most 5 MB, at least
 * 800×600) before they are uploaded to Cloudinary, several at once.
 */
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, X } from 'lucide-react'
import { PITCH_LIMITS } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { send } from '@/lib/http'
import { uploadImageFile } from '@/lib/upload-client'
import { useT } from '@/i18n/client'
import type { WebT } from '@/i18n/catalog'

type Photo = { id: string; url: string; order: number }
type Upload = { name: string; state: 'uploading' | 'done' | 'failed'; message?: string }

const TYPES = ['image/jpeg', 'image/png', 'image/webp']

function imageSize(file: File, t: WebT): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      reject(new Error(t('editor.photos.unreadable')))
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

async function check(file: File, t: WebT): Promise<string | null> {
  if (!TYPES.includes(file.type)) return t('editor.photos.type')
  if (file.size > PITCH_LIMITS.PHOTO_MAX_BYTES) return t('editor.photos.tooLarge')
  const { width, height } = await imageSize(file, t).catch(() => ({ width: 0, height: 0 }))
  if (width < PITCH_LIMITS.PHOTO_MIN_WIDTH || height < PITCH_LIMITS.PHOTO_MIN_HEIGHT) {
    return t('editor.photos.tooSmall', {
      w: PITCH_LIMITS.PHOTO_MIN_WIDTH,
      h: PITCH_LIMITS.PHOTO_MIN_HEIGHT,
    })
  }
  return null
}

export function PhotoManager({
  pitchId,
  photos: initial,
  uploadsEnabled,
}: {
  pitchId: string
  photos: Photo[]
  uploadsEnabled: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [photos, setPhotos] = useState(initial)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const full = photos.length >= PITCH_LIMITS.MAX_PHOTOS

  const reorder = async (next: Photo[]) => {
    const previous = photos
    setPhotos(next)
    setError(null)
    try {
      setPhotos(
        await send<Photo[]>(`/api/v1/pitches/${pitchId}/photos/reorder`, 'PUT', {
          photoIds: next.map(p => p.id),
        })
      )
      router.refresh()
    } catch (caught) {
      setPhotos(previous)
      setError((caught as Error).message)
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length) return
    const next = [...photos]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item!)
    void reorder(next)
  }

  const remove = async (photo: Photo) => {
    setError(null)
    try {
      setPhotos(await send<Photo[]>(`/api/v1/pitches/${pitchId}/photos/${photo.id}`, 'DELETE'))
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
  }

  const addFiles = async (files: File[]) => {
    setError(null)
    const room = PITCH_LIMITS.MAX_PHOTOS - photos.length
    if (files.length > room) {
      setError(t('editor.photos.onlyMore', { count: room }))
      files = files.slice(0, room)
    }
    const update = (name: string, patch: Partial<Upload>) =>
      setUploads(list => list.map(u => (u.name === name ? { ...u, ...patch } : u)))
    setUploads(files.map(f => ({ name: f.name, state: 'uploading' })))
    await Promise.all(
      files.map(async file => {
        const problem = await check(file, t)
        if (problem) return update(file.name, { state: 'failed', message: problem })
        try {
          const up = await uploadImageFile('PITCH', pitchId, file)
          const photo = await send<Photo>(`/api/v1/pitches/${pitchId}/photos`, 'POST', {
            url: up.url,
            cloudinaryPublicId: up.publicId,
          })
          setPhotos(list => [...list, photo])
          update(file.name, { state: 'done' })
        } catch (caught) {
          update(file.name, { state: 'failed', message: (caught as Error).message })
        }
      })
    )
    router.refresh()
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-700">{t('editor.photos.cover')}</p>
        <span className="text-xs font-medium text-neutral-500">
          {photos.length} / {PITCH_LIMITS.MAX_PHOTOS}
        </span>
      </div>
      {error && <Alert>{error}</Alert>}

      {photos.length > 0 && (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <li
              key={p.id}
              draggable
              onDragStart={() => setDragging(p.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                const from = photos.findIndex(x => x.id === dragging)
                if (from >= 0 && from !== i) move(from, i)
                setDragging(null)
              }}
              className={`relative overflow-hidden rounded-md border border-neutral-200 ${dragging === p.id ? 'opacity-50' : ''}`}
            >
              <img
                src={p.url}
                alt={t('editor.photos.photo', { n: i + 1 })}
                className="h-40 w-full object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute left-2 top-2 cursor-grab rounded bg-white/90 p-1 text-neutral-700"
              >
                <GripVertical className="h-4 w-4" />
              </span>
              <button
                type="button"
                aria-label={t('editor.photos.delete', { n: i + 1 })}
                onClick={() => void remove(p)}
                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-error-600 hover:bg-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white">
                {i === 0 ? t('editor.photos.coverBadge') : i + 1}
              </span>
              <span className="absolute bottom-2 right-2 flex gap-1">
                <button
                  type="button"
                  aria-label={t('editor.photos.earlier', { n: i + 1 })}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="rounded bg-white/90 p-1 text-neutral-700 disabled:hidden"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t('editor.photos.later', { n: i + 1 })}
                  disabled={i === photos.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="rounded bg-white/90 p-1 text-neutral-700 disabled:hidden"
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      {uploadsEnabled ? (
        <div
          onDragOver={e => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault()
              setOver(true)
            }
          }}
          onDragLeave={() => setOver(false)}
          onDrop={e => {
            if (!e.dataTransfer.files.length) return
            e.preventDefault()
            setOver(false)
            if (!full) void addFiles([...e.dataTransfer.files])
          }}
          className={`flex min-h-[100px] flex-col items-center justify-center rounded-md border-2 border-dashed p-4 text-center ${
            over ? 'border-primary-600 bg-primary-50' : 'border-neutral-300'
          } ${full ? 'opacity-50' : ''}`}
        >
          <ImagePlus className="h-6 w-6 text-neutral-400" aria-hidden="true" />
          <p className="mt-1 text-sm text-neutral-500">
            {full ? t('editor.photos.full') : t('editor.photos.drag')}
          </p>
          {!full && (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="mt-1 text-sm font-semibold text-primary-700 underline"
            >
              {t('editor.photos.choose')}
            </button>
          )}
          <p className="mt-1 text-xs text-neutral-500">{t('editor.photos.rules')}</p>
          <input
            ref={input}
            type="file"
            accept={TYPES.join(',')}
            multiple
            hidden
            aria-label={t('editor.photos.add')}
            onChange={e => {
              void addFiles([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </div>
      ) : (
        <p className="rounded-md bg-neutral-100 p-3 text-sm text-neutral-700">
          {t('editor.photos.noUploads')}
        </p>
      )}

      {uploads.length > 0 && (
        <ul aria-live="polite" className="space-y-1 text-sm">
          {uploads.map(u => (
            <li
              key={u.name}
              className={u.state === 'failed' ? 'text-error-600' : 'text-neutral-700'}
            >
              {u.name}:{' '}
              {u.state === 'uploading'
                ? t('editor.photos.uploading')
                : u.state === 'done'
                  ? t('editor.photos.added')
                  : u.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
