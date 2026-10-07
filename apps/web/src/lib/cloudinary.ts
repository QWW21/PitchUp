/**
 * Cloudinary integration — ticket E01-10.
 *
 * Server-only. The API secret must never reach a client bundle, so nothing in
 * this module may be imported from a component without 'use server' or an
 * API route between them.
 */
import 'server-only'
import { v2 as cloudinary } from 'cloudinary'
import { env } from '@/lib/env'

/** Upload limits, enforced at the sign endpoint before a signature is issued. */
export const UPLOAD_LIMITS = {
  PITCH_PHOTO_MAX_BYTES: 5 * 1024 * 1024,
  LOGO_MAX_BYTES: 2 * 1024 * 1024,
  AVATAR_MAX_BYTES: 2 * 1024 * 1024,
  REVIEW_PHOTO_MAX_BYTES: 5 * 1024 * 1024,
} as const

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]

/** Upload contexts. The folder shape is fixed here so callers cannot invent paths. */
export const UPLOAD_CONTEXTS = {
  PITCH: { prefix: 'pitchup/pitches', maxBytes: UPLOAD_LIMITS.PITCH_PHOTO_MAX_BYTES },
  COMPANY: { prefix: 'pitchup/companies', maxBytes: UPLOAD_LIMITS.LOGO_MAX_BYTES },
  USER: { prefix: 'pitchup/users', maxBytes: UPLOAD_LIMITS.AVATAR_MAX_BYTES },
  REVIEW: { prefix: 'pitchup/reviews', maxBytes: UPLOAD_LIMITS.REVIEW_PHOTO_MAX_BYTES },
} as const

export type UploadContext = keyof typeof UPLOAD_CONTEXTS

/** Transformation presets. UIUX_SPEC image sizes. */
export const IMAGE_PRESETS = {
  pitch_cover: { width: 800, height: 600, crop: 'fill', format: 'webp', quality: 'auto' },
  pitch_thumb: { width: 80, height: 80, crop: 'fill', format: 'webp', quality: 'auto' },
  pitch_gallery: { width: 1200, height: 800, crop: 'limit', format: 'webp', quality: 'auto' },
  avatar_sm: {
    width: 64,
    height: 64,
    crop: 'fill',
    gravity: 'face',
    format: 'webp',
    quality: 'auto',
  },
  logo: {
    width: 400,
    height: 400,
    crop: 'pad',
    background: 'white',
    format: 'webp',
    quality: 'auto',
  },
} as const

export type ImagePreset = keyof typeof IMAGE_PRESETS

/**
 * True when Cloudinary credentials are present. They are optional until this
 * epic's integrations land, so callers check rather than assume.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  )
}

function configured() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured: set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET'
    )
  }
  // isCloudinaryConfigured() has already proven these are set; the env schema
  // types them optional because they are not required until this epic.
  cloudinary.config({
    cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME as string,
    api_key: env.CLOUDINARY_API_KEY as string,
    api_secret: env.CLOUDINARY_API_SECRET as string,
    secure: true,
  })
  return cloudinary
}

/** Builds the folder for a context, e.g. buildFolder('PITCH', id) → pitchup/pitches/{id}. */
export function buildFolder(context: UploadContext, ownerId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(ownerId)) {
    throw new Error('Invalid owner id for upload folder')
  }
  return `${UPLOAD_CONTEXTS[context].prefix}/${ownerId}`
}

export interface UploadResult {
  url: string
  publicId: string
}

/** Server-side upload. Clients normally use a signature and upload directly. */
export async function uploadImage(
  file: Buffer | string,
  folder: string,
  publicId?: string
): Promise<UploadResult> {
  const client = configured()
  const payload =
    typeof file === 'string' ? file : `data:image/jpeg;base64,${file.toString('base64')}`

  const result = await client.uploader.upload(payload, {
    folder,
    ...(publicId ? { public_id: publicId } : {}),
    resource_type: 'image',
    overwrite: true,
    eager: [IMAGE_PRESETS.pitch_cover],
  })

  return { url: result.secure_url, publicId: result.public_id }
}

export async function deleteImage(publicId: string): Promise<void> {
  const client = configured()
  await client.uploader.destroy(publicId)
}

export interface UploadSignature {
  signature: string
  timestamp: number
  apiKey: string
  cloudName: string
  folder: string
}

/**
 * Signs a direct-to-Cloudinary upload.
 *
 * The client uploads straight to Cloudinary with this signature, so image data
 * never passes through the Next.js server. Only the signature crosses the
 * wire — the API secret stays here.
 */
export function createUploadSignature(folder: string, publicId?: string): UploadSignature {
  const client = configured()
  const timestamp = Math.round(Date.now() / 1000)

  const paramsToSign: Record<string, string | number> = { folder, timestamp }
  if (publicId) paramsToSign.public_id = publicId

  const signature = client.utils.api_sign_request(paramsToSign, env.CLOUDINARY_API_SECRET as string)

  return {
    signature,
    timestamp,
    apiKey: env.CLOUDINARY_API_KEY as string,
    cloudName: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME as string,
    folder,
  }
}

/** Builds a delivery URL for a stored image at one of the presets. */
export function buildImageUrl(publicId: string, preset: ImagePreset): string {
  const client = configured()
  return client.url(publicId, { ...IMAGE_PRESETS[preset], secure: true })
}
