'use client'

/**
 * The last resort when the root layout itself fails: reports the error to
 * Sentry and offers a reload. It replaces the whole document, so it carries
 * its own <html> and plain styles.
 */
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ro">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 32, textAlign: 'center' }}>
        <h1>Ceva nu a mers bine · Something went wrong</h1>
        <p>Am fost anunțați și ne uităm. · We have been told and are looking into it.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reîncarcă · Reload
        </button>
      </body>
    </html>
  )
}
