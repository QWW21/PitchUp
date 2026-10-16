/**
 * Uploading an image from the browser: ask our API for a signature, then
 * send the file straight to Cloudinary. Review photos (E06), profile photos
 * (E08) and company logos (E09) use it. Returns the image's https URL.
 */
export async function uploadToCloudinary(
  context: 'REVIEW' | 'USER' | 'COMPANY',
  ownerId: string,
  file: File
): Promise<string> {
  const signRes = await fetch('/api/v1/upload/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context, ownerId, contentType: file.type, sizeBytes: file.size }),
  })
  const sign = (await signRes.json().catch(() => null))?.data
  if (!signRes.ok || !sign) throw new Error('Photo upload failed')
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', sign.apiKey)
  form.append('timestamp', String(sign.timestamp))
  form.append('signature', sign.signature)
  form.append('folder', sign.folder)
  const up = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  })
  const body = await up.json().catch(() => null)
  if (!up.ok || !body?.secure_url) throw new Error('Photo upload failed')
  return body.secure_url as string
}
