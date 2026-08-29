// A term explained where it appears (scheduling-and-onboarding.md §3.2):
// dotted underline, one sentence on hover or tap, no glossary page.
// Definitions live in src/copy/definitions.ts (TERM).
import type { ReactNode } from 'react'
import { TERM } from '../../copy/definitions.ts'
import { InfoTip } from './InfoTip.tsx'

export function Term({ id, children }: { id: keyof typeof TERM | string; children?: ReactNode }) {
  const def = TERM[id]
  if (!def) return <>{children}</>
  return (
    <span className="term">
      <span className="term-word">{children ?? def.title}</span>
      <InfoTip title={def.title} text={def.text} />
    </span>
  )
}
