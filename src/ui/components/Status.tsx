import type { ReactNode } from 'react'

// A 7px dot in the status colour followed by the word, in ink-2 (prompt 47
// Part 1). The only place --ok, --wait, --stop and --idle are used. Carries
// the `chip` class so the UI inventory measures it where the contracts list
// status words under `chips`.
//
// `pill` composes it with the shared `.pill` role (task 031): the same dot and
// the same word, inside the rounded outline the approved Plan pack draws for an
// opened step's state badge (`docs/design/approved/plan-step-v1.html` `.badge`).
// The shape is the pill's; the state colour stays here, which is the whole point
// of keeping them apart.
export type StatusTone = 'ok' | 'wait' | 'stop' | 'idle'

export function Status({ tone, title, pill = false, children }: { tone: StatusTone; title?: string; pill?: boolean; children: ReactNode }) {
  return (
    <span className={`chip status status-${tone}${pill ? ' pill' : ''}`} title={title}>
      {children}
    </span>
  )
}
