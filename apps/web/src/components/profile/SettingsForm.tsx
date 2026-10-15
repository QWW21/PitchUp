'use client'

/**
 * Account settings — E08-08. Name, phone and city, checked with the same
 * schema as the API; the photo uploads to Cloudinary when it is set up.
 * Email is shown but cannot be changed. Saves only what changed.
 */
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CITY_NAMES, UpdateProfileSchema, type Profile } from '@pitchup/shared'
import { Alert } from '@/components/ui/Alert'
import { TextField } from '@/components/ui/TextField'
import { send } from '@/lib/http'
import { uploadToCloudinary } from '@/lib/upload-client'
import { Avatar } from './Avatar'

type Field = 'name' | 'phone' | 'city'

export function SettingsForm({
  profile,
  photosEnabled,
}: {
  profile: Profile
  photosEnabled: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [city, setCity] = useState(profile.city ?? '')
  const [avatar, setAvatar] = useState(profile.avatarUrl)
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const changes = {
    ...(name.trim() !== profile.name ? { name } : {}),
    ...(phone.trim() !== profile.phone ? { phone: phone.trim() } : {}),
    ...(city && city !== profile.city ? { city } : {}),
    ...(avatar !== profile.avatarUrl ? { avatarUrl: avatar } : {}),
  }
  const changed = Object.keys(changes).length > 0

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      setAvatar(await uploadToCloudinary('USER', profile.id, file))
    } catch (caught) {
      setError((caught as Error).message)
    }
    setUploading(false)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaved(false)
    setError(null)
    const parsed = UpdateProfileSchema.safeParse(changes)
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as Field | undefined
        if (key && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      await send('/api/v1/profile', 'PUT', parsed.data)
      setSaved(true)
      router.refresh()
    } catch (caught) {
      setError((caught as Error).message)
    }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-5 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <Avatar name={name || profile.name} url={avatar} />
        <div className="space-y-1 text-sm">
          {photosEnabled ? (
            <label className="inline-block cursor-pointer rounded-md border border-neutral-200 px-3 py-1.5 font-medium text-neutral-900 focus-within:ring-2 focus-within:ring-primary-600 hover:bg-neutral-50">
              {uploading ? 'Uploading…' : avatar ? 'Change photo' : 'Add a photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={e => void pickPhoto(e.target.files?.[0])}
              />
            </label>
          ) : (
            <p className="text-neutral-500">Photo uploads are not set up yet.</p>
          )}
          {avatar && (
            <button
              type="button"
              onClick={() => setAvatar(null)}
              className="block font-medium text-error-600 hover:underline"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <TextField
        label="Full name"
        value={name}
        onChange={e => setName(e.target.value)}
        error={errors.name}
        autoComplete="name"
      />
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-900">Email</p>
        <p className="text-base text-neutral-700">{profile.email}</p>
        <p className="mt-1 text-sm text-neutral-500">Email cannot be changed.</p>
      </div>
      <div>
        <TextField
          label="Phone"
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          error={errors.phone}
          autoComplete="tel"
        />
        {!profile.phoneVerified && (
          <p className="mt-1 text-sm text-neutral-500">Not verified yet.</p>
        )}
        {changes.phone && (
          <p className="mt-1 text-sm text-neutral-500">A new number has to be verified again.</p>
        )}
      </div>
      <div>
        <label htmlFor="city" className="mb-1.5 block text-sm font-medium text-neutral-900">
          City
        </label>
        <select
          id="city"
          value={city}
          onChange={e => setCity(e.target.value)}
          className="h-12 w-full rounded-md border border-neutral-200 bg-white px-3 text-base"
        >
          {!profile.city && <option value="">Choose a city</option>}
          {CITY_NAMES.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && <Alert>{error}</Alert>}
      {saved && (
        <p role="status" className="rounded-md bg-primary-50 p-3 text-sm text-primary-700">
          Your changes are saved.
        </p>
      )}
      <button
        type="submit"
        disabled={!changed || busy || uploading}
        className="h-12 w-full rounded-md bg-primary-600 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  )
}
