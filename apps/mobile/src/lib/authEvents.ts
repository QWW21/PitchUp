/**
 * Lets the API client tell the app a session has ended without importing
 * navigation, which would be a circular dependency.
 */
type Listener = () => void

const listeners = new Set<Listener>()

export const authEvents = {
  /** Returns an unsubscribe function, so a component can clean up on unmount. */
  onUnauthorized(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  emitUnauthorized(): void {
    for (const listener of listeners) listener()
  },
}
