/**
 * Four-segment password strength meter.
 *
 * Deliberately rough. A meter cannot know whether a password has been
 * breached or is the user's dog's name, so it is feedback, not a gate —
 * the actual requirements are enforced by the shared Zod schema.
 */
export function scorePassword(password: string): number {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1
  return Math.min(score, 4)
}

const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const
const COLOURS = ['', 'bg-error-500', 'bg-warning-500', 'bg-accent-500', 'bg-primary-600'] as const

export function PasswordStrength({ password }: { password: string }) {
  const score = scorePassword(password)
  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map(segment => (
          <span
            key={segment}
            className={`h-1 flex-1 rounded-full transition-colors ${
              segment <= score ? COLOURS[score] : 'bg-neutral-200'
            }`}
          />
        ))}
      </div>
      {/* polite, not assertive: this updates on every keystroke and would
          otherwise talk over the user as they type. */}
      <p className="mt-1 text-xs text-neutral-500" aria-live="polite">
        Password strength: {LABELS[score]}
      </p>
    </div>
  )
}
