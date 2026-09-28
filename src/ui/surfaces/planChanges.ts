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

type ChangeWords = { line: string; completed: string; reopened: string; added: string; removed: string; more: string }
const words = (): ChangeWords => (pages.plan as unknown as { changes: ChangeWords }).changes

/** At most three titles, then how many more; every title where the line is read whole. */
function named(titles: readonly string[], whole = false): string {
  if (whole || titles.length <= 3) return list([...titles])
  return fillText(words().more, { steps: titles.slice(0, 3).join(', '), n: titles.length - 3 })
}

/**
 * What changed between two plans of the same tenant, as one short line: the
 * steps that reached Completed, the steps that left it, the steps added and the
 * steps removed, each by the title its row shows. Null when none happened.
 */
export function planChangeLine(before: readonly ChangeRow[], after: readonly ChangeRow[], whole = false): string | null {
  const was = new Map(before.map((r) => [r.id, r]))
  const now = new Set(after.map((r) => r.id))
  const completed = after.filter((r) => r.lane === 'Completed' && was.has(r.id) && was.get(r.id)?.lane !== 'Completed').map((r) => r.title)
  const reopened = after.filter((r) => r.lane !== 'Completed' && was.get(r.id)?.lane === 'Completed').map((r) => r.title)
  const added = after.filter((r) => !was.has(r.id)).map((r) => r.title)
  const removed = before.filter((r) => !now.has(r.id)).map((r) => r.title)
  const W = words()
  const parts = [
    ...(completed.length > 0 ? [fillText(W.completed, { steps: named(completed, whole) })] : []),
    ...(reopened.length > 0 ? [fillText(W.reopened, { steps: named(reopened, whole) })] : []),
    ...(added.length > 0 ? [fillText(W.added, { n: added.length, steps: named(added, whole) })] : []),
    ...(removed.length > 0 ? [fillText(W.removed, { n: removed.length, steps: named(removed, whole) })] : []),
  ]
  return parts.length === 0 ? null : fillText(W.line, { changes: parts.join(' · ') })
}

/**
 * Where the change line sits (F-028, F-040): at the top of the step the page
 * moved to after a scan or an approval, while that step is open; above the
 * board otherwise. It is one line in one place at a time: above the board it
 * was 590px above an approval's next decision, and a screen above a scanned step.
 */
export function changeLinePlace(lineAt: string | null, open: string | null): 'step' | 'board' {
  return lineAt !== null && lineAt === open ? 'step' : 'board'
}

/**
 * The same line with every title, where the short one cut a list ("and 5
 * more"), for its Show all (F-028); null where it cut none.
 */
export function planChangeWhole(before: readonly ChangeRow[], after: readonly ChangeRow[]): string | null {
  const all = planChangeLine(before, after, true)
  return all !== null && all !== planChangeLine(before, after) ? all : null
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
 *
 * `line` undefined: keep the line on screen. A new cause that has changed
 * nothing yet (a Save before its plan lands, or a Save that changes nothing,
 * such as Done after a chip already saved) must not erase what the change
 * before it did.
 */
export function observePlan(seen: Seen | null, tenantId: string, cause: string, rows: readonly ChangeRow[]): { seen: Seen; line: string | null | undefined; whole: string | null } {
  if (seen === null || seen.tenantId !== tenantId) return { seen: { tenantId, cause, base: null, rows }, line: null, whole: null }
  const base = seen.cause === cause ? seen.base : seen.rows
  const line = base === null ? null : planChangeLine(base, rows)
  // The line whole, where it cut a list (F-028).
  const whole = base === null || line === null ? null : planChangeWhole(base, rows)
  return { seen: { tenantId, cause, base, rows }, line: line === null && seen.cause !== cause ? undefined : line, whole }
}

// A sentence the next Plan visit opens its change line with, once (F-023): a
// plan file just loaded on Export says which one it was, where the plan it
// brought back is on screen.
let notice: string | null = null
/** Leave a line for the next Plan visit to lead with. */
export function noticeForPlan(text: string): void {
  notice = text
}
/** The line left for this Plan visit, if any; read once, then cleared by clearPlanNotice. */
export function peekPlanNotice(): string | null {
  return notice
}
export function clearPlanNotice(): void {
  notice = null
}
