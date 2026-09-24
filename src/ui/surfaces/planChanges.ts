// The Plan across a change (the owner's walk of step 1.1, 2026-09-23). Pure, so
// the page's behaviour around a Save or a scan is testable without a browser.
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { list } from '../../copy/statements.ts'

/**
 * The plan on screen. While the plan recomputes for the snapshot already on
 * screen (a step's Save, a setting, the groups read again for a new decision)
 * the fresh plan is null for a moment; the page keeps the plan it last computed
 * for that same snapshot, so it updates in place: no Loading, no jump to the
 * top, and the open step stays open. A new snapshot is another plan and loads.
 */
export function heldPlan<T>(fresh: T | null, held: { snapshot: unknown; plan: T } | null, snapshot: unknown): T | null {
  if (fresh !== null) return fresh
  return held !== null && snapshot !== null && held.snapshot === snapshot ? held.plan : null
}

/** A board row as the change line reads it: its id, the title it shows and its lane. */
export type ChangeRow = { readonly id: string; readonly title: string; readonly lane: string }

type ChangeWords = { line: string; completed: string; added: string; removed: string; more: string }
const words = (): ChangeWords => (pages.plan as unknown as { changes: ChangeWords }).changes

/** At most three titles, then how many more. */
function named(titles: readonly string[]): string {
  if (titles.length <= 3) return list([...titles])
  return fillText(words().more, { steps: titles.slice(0, 3).join(', '), n: titles.length - 3 })
}

/**
 * What changed between two plans of the same tenant, as one short line: the
 * steps that reached Completed, the steps added and the steps removed, each by
 * the title its row shows. Null when none of the three happened.
 */
export function planChangeLine(before: readonly ChangeRow[], after: readonly ChangeRow[]): string | null {
  const was = new Map(before.map((r) => [r.id, r]))
  const now = new Set(after.map((r) => r.id))
  const completed = after.filter((r) => r.lane === 'Completed' && was.has(r.id) && was.get(r.id)?.lane !== 'Completed').map((r) => r.title)
  const added = after.filter((r) => !was.has(r.id)).map((r) => r.title)
  const removed = before.filter((r) => !now.has(r.id)).map((r) => r.title)
  const W = words()
  const parts = [
    ...(completed.length > 0 ? [fillText(W.completed, { steps: named(completed) })] : []),
    ...(added.length > 0 ? [fillText(W.added, { n: added.length, steps: named(added) })] : []),
    ...(removed.length > 0 ? [fillText(W.removed, { n: removed.length, steps: named(removed) })] : []),
  ]
  return parts.length === 0 ? null : fillText(W.line, { changes: parts.join(' · ') })
}

/**
 * The board as the Plan last drew it for one tenant: its rows, the cause that
 * drew them (a snapshot, a visit to the page, a change the person made), and
 * the rows on screen when that cause began.
 */
export type Seen = { tenantId: string; cause: string; base: readonly ChangeRow[] | null; rows: readonly ChangeRow[] }

/**
 * The line after the plan is drawn again. A new cause (another snapshot, another
 * visit, a Save) starts from the rows on screen when it began, so the line says
 * what that one change did and replaces the line before it; the plan settling
 * under the same cause (the groups read again, a recovery sign-in recorded) is
 * still that change. The first plan drawn for a tenant has nothing before it.
 */
export function observePlan(seen: Seen | null, tenantId: string, cause: string, rows: readonly ChangeRow[]): { seen: Seen; line: string | null } {
  if (seen === null || seen.tenantId !== tenantId) return { seen: { tenantId, cause, base: null, rows }, line: null }
  const base = seen.cause === cause ? seen.base : seen.rows
  return { seen: { tenantId, cause, base, rows }, line: base === null ? null : planChangeLine(base, rows) }
}
