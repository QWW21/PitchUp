/**
 * Where to send someone after signing in — #172.
 *
 * Only a path on this site. `startsWith('/')` alone let `//evil.example`
 * (protocol-relative) and `/\evil.example` (browsers read `\` as `/`) through,
 * turning the login page into an open redirect for phishing links.
 */
export function safeCallbackPath(callbackUrl: string | null, origin: string): string {
  if (!callbackUrl) return '/dashboard'
  try {
    const url = new URL(callbackUrl, origin)
    if (url.origin !== origin) return '/dashboard'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/dashboard'
  }
}
