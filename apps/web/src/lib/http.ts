/**
 * Calling our own API from the browser: JSON in, the envelope's `data` out,
 * the server's message as the error.
 */
export async function send<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  if (res.status === 204) return null as T
  const json = await res.json().catch(() => null)
  if (!res.ok || json?.error) {
    throw Object.assign(new Error(json?.error?.message ?? 'Something went wrong. Try again.'), {
      reason: json?.error?.details?.reason as string | undefined,
    })
  }
  return json.data as T
}
