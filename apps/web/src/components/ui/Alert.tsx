import type { ReactNode } from 'react'

interface AlertProps {
  tone?: 'error' | 'success'
  children: ReactNode
}

export function Alert({ tone = 'error', children }: AlertProps) {
  const isError = tone === 'error'
  return (
    <div
      // assertive for errors: a failed sign-in should interrupt, not wait
      // for the user to finish what they are doing.
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`flex items-start gap-2 rounded-sm p-2 text-sm ${
        isError ? 'bg-error-50 text-error-500' : 'bg-success-50 text-primary-700'
      }`}
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        {isError ? (
          <>
            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
          </>
        ) : (
          <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <span>{children}</span>
    </div>
  )
}
