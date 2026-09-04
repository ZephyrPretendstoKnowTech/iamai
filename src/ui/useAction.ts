// A button's action (ui/actions.ts) and what it reported: `run` starts one,
// `error` is the message the last one rejected with, rendered beside the
// button that pressed it. Nothing is swallowed: a rejection is on the page
// where it happened, and a success clears the line.
import { useCallback, useState } from 'react'

export function useAction(): { run: (action: Promise<unknown>) => void; error: string | null; busy: boolean } {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useCallback((action: Promise<unknown>): void => {
    setError(null)
    setBusy(true)
    action.then(
      () => setBusy(false),
      (e: unknown) => {
        setBusy(false)
        setError(e instanceof Error ? e.message : String(e))
      },
    )
  }, [])
  return { run, error, busy }
}
