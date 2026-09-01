// The content loader (prompt 51 Part 1, target-state §8.9). Every sentence the
// product shows lives in docs/design/content.json and is imported here at build
// time; the engine fills its variables and never composes a sentence. This
// module is the single import point and the typed accessor; the fill engine
// (fill.ts) and the renderers (render.ts) read from it.
import contentJson from '../../docs/design/content.json' with { type: 'json' }

export type Learn = { cis: string | null; url: string }

/** One entry in the step catalogue; fields absent on a given step are null/undefined. */
export type ContentStep = {
  id: string
  kind: 'blocker' | 'object' | 'check' | 'campaign' | 'policy' | 'ladder'
  title: string
  changeLine?: string | null
  partner?: string | null
  placement?: string | null
  licence?: string | null
  why: string
  learn?: Learn | null
  who?: Record<string, unknown> | null
  decision?: Record<string, unknown> | null
  whatToDo?: Record<string, unknown> | null
  dates?: string | null
  doneWhen?: string[] | null
  ifWrong?: string | null
  lockedOut?: { label: string; steps: string[] } | null
  comms?: Record<string, unknown> | null
  doesntApply?: boolean
  skip?: boolean
  scanControl?: boolean
  more?: Record<string, unknown> | null
  example?: Record<string, unknown> | null
  mergesGoals?: string[]
}

export type ContentFile = {
  $comment: string
  version: number
  shared: Record<string, unknown>
  phases: { first: string; middle: string; last: string; heading: string }
  pages: Record<string, Record<string, unknown>>
  cleanup: Record<string, { title: string; why: string; whatToDo: string[]; doneWhen: string[] }>
  steps: ContentStep[]
}

export const content = contentJson as unknown as ContentFile

/** The shared references usable inside any string, and the per-step catalogue. */
export const shared = content.shared
export const steps = content.steps
export const stepById: Record<string, ContentStep> = Object.fromEntries(steps.map((s) => [s.id, s]))
export const cleanup = content.cleanup
export const phases = content.phases
export const pages = content.pages
