// Loading a plan file over work already recorded here asks first (F-023).
//
// A plan file that passed its checks used to replace this browser's answers,
// deferrals and Cleanup items at once, then jump to the Plan with nothing said.
// An older file loaded by mistake undid the newer work in silence. Where this
// browser holds recorded work for the tenant, the page now says what the file
// holds and asks; where it holds none, there is nothing to lose, and the file
// loads straight away. Either way the Plan opens saying which file it loaded.
import { app } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { isCleanupCheckpoint } from '../../roadmap/cleanupDone.ts'
import type { PlanDecisions } from '../../roadmap/decisions.ts'
import { absoluteDate } from '../format.ts'

type LoadWords = { loadConfirm: string; loadHolds: { decisions: string; deferred: string; cleanup: string }; loadHoldsNone: string; loaded: string }
const W = app.export as unknown as LoadWords

/** What a plan record holds that a person recorded: answered decisions, deferred steps, Cleanup items marked done. */
export type Holds = { decisions: number; deferred: number; cleanup: number }

export function holdsOf(record: Pick<PlanDecisions, 'skips' | 'checkpoints'> & { stepDecisions?: Record<string, unknown> } | null | undefined): Holds {
  if (!record) return { decisions: 0, deferred: 0, cleanup: 0 }
  return {
    decisions: Object.keys(record.stepDecisions ?? {}).length,
    deferred: Object.keys(record.skips ?? {}).length,
    cleanup: (record.checkpoints ?? []).filter(isCleanupCheckpoint).length,
  }
}

/** Whether loading a file over this record would replace anything a person recorded. */
export function asksBeforeLoading(current: Parameters<typeof holdsOf>[0]): boolean {
  const h = holdsOf(current)
  return h.decisions + h.deferred + h.cleanup > 0
}

/** The confirm's sentence: the file's saved day, what it holds, and whose record it replaces. */
export function loadConfirmText(args: { savedAt: string; holds: Holds; tenant: string }): string {
  const { holds } = args
  const parts = (['decisions', 'deferred', 'cleanup'] as const).filter((k) => holds[k] > 0).map((k) => fillText(W.loadHolds[k], { n: holds[k] }))
  return fillText(W.loadConfirm, { date: absoluteDate(args.savedAt), holds: parts.length > 0 ? listWords(parts) : W.loadHoldsNone, tenant: args.tenant })
}

/** The Plan's line once the file is loaded. */
export function loadedText(savedAt: string): string {
  return fillText(W.loaded, { date: absoluteDate(savedAt) })
}

const listWords = (parts: string[]): string => (parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)
