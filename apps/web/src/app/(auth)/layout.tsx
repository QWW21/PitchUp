import type { ReactNode } from 'react'

/** Auth pages render without the dashboard chrome. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>
}
