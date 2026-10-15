import type { APIRequestContext } from '@playwright/test'

export interface Envelope<T> {
  status: number
  data: T | null
  error: { code: string; message: string; details?: unknown } | null
  headers: Record<string, string>
  ms: number
}

async function call<T>(
  request: APIRequestContext,
  method: 'get' | 'post' | 'put' | 'delete',
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<Envelope<T>> {
  const started = Date.now()
  const res = await request[method](`/api/v1${path}`, {
    ...(body !== undefined ? { data: body } : {}),
    ...(headers ? { headers } : {}),
  })
  const json = await res.json().catch(() => ({ data: null, error: null }))
  return {
    status: res.status(),
    data: json.data ?? null,
    error: json.error ?? null,
    headers: res.headers(),
    ms: Date.now() - started,
  }
}

export const get = <T>(r: APIRequestContext, path: string, headers?: Record<string, string>) =>
  call<T>(r, 'get', path, undefined, headers)

export const post = <T>(
  r: APIRequestContext,
  path: string,
  body: unknown,
  headers?: Record<string, string>
) => call<T>(r, 'post', path, body, headers)

export const put = <T>(r: APIRequestContext, path: string, body: unknown) =>
  call<T>(r, 'put', path, body)

/** DELETE, with a body where the endpoint needs one (DELETE /profile). */
export const del = <T>(r: APIRequestContext, path: string, body?: unknown) =>
  call<T>(r, 'delete', path, body)
