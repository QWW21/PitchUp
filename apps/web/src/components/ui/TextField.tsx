'use client'

import { useId, useState, type InputHTMLAttributes } from 'react'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  /**
   * Field-level error. Announced to screen readers when it appears.
   *
   * Explicitly allows undefined because the workspace sets
   * exactOptionalPropertyTypes, which otherwise rejects passing a value
   * that may be undefined.
   */
  error?: string | undefined
  /** Renders a show/hide toggle and starts masked. */
  revealable?: boolean
}

export function TextField({
  label,
  error,
  revealable = false,
  type = 'text',
  className = '',
  ...props
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [revealed, setRevealed] = useState(false)

  const inputType = revealable ? (revealed ? 'text' : 'password') : type

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-neutral-900">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={inputType}
          // Points screen readers at the error text below, so it is read out
          // rather than only seen.
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`h-12 w-full rounded-md border bg-white px-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
            error
              ? 'border-error-500 focus:ring-error-500'
              : 'border-neutral-200 focus:border-primary-600 focus:ring-primary-600'
          } ${revealable ? 'pr-12' : ''}`}
          {...props}
        />

        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed(v => !v)}
            // tabIndex -1 keeps the tab order email -> password -> submit,
            // which the ticket asks for; the toggle is still clickable.
            tabIndex={-1}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-neutral-400 hover:text-neutral-700"
          >
            {revealed ? (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>

      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-error-500">
          {error}
        </p>
      )}
    </div>
  )
}
