import type { ReactNode } from 'react'

// A 7px dot in the status colour followed by the word, in ink-2 (prompt 47
// Part 1). The only place --ok, --wait, --stop and --idle are used. Carries
// the `chip` class so the UI inventory measures it where the contracts list
// status words under `chips`; nothing about it is a pill.
export type StatusTone = 'ok' | 'wait' | 'stop' | 'idle'

export function Status({ tone, title, children }: { tone: StatusTone; title?: string; children: ReactNode }) {
  return (
    <span className={`chip status status-${tone}`} title={title}>
      {children}
    </span>
  )
}
