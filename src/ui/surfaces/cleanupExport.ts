// A Cleanup row as words (E3, E4): the content entry behind it, the values its
// lines fill (a noted policy carries its note), its date column, and the
// export view the calendar, the prompt pack and the bundle read, so what they
// say is what the row says on screen (CleanupStep.tsx renders the same).
//
// Pure: no DOM, no network. Runs in Node tests and in the browser.
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { app, cleanup as cleanupContent } from '../../content/content.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'

export type CleanupEntry = { title: string; learn?: { url: string } | null; why: string; whatToDo: string[]; doneWhen: string[] }
export type NotAssessedNotes = Record<string, string>
export type CleanupExport = { kind: string; day: string; done: string | null; title: string; why: string; whatToDo: string[]; doneWhen: string[] }

const A = app.plan

/** The content entry behind a Cleanup row, or null when content.cleanup lacks it. */
export function cleanupEntry(kind: string): CleanupEntry | null {
  return ((cleanupContent as Record<string, CleanupEntry>)[kind] ?? null)
}

/** The values a Cleanup row's lines fill: its lists (a noted policy carries its note) and the tenant's naming shape. */
export function cleanupVars(phase: CleanupPhase, row: CleanupPhase['rows'][number], notes: NotAssessedNotes = {}): Record<string, unknown> {
  const lists: Record<string, string[]> = { ...row.lists }
  if (row.kind === 'notAssessed' && Array.isArray(lists.policies)) lists.policies = lists.policies.map((p) => (notes[p] ? fillText(A.notAssessedRow, { policy: p, reason: notes[p] }) : p))
  return { ...lists, ...(phase.convention ? { convention: phase.convention } : {}) }
}

/** The row's date column: the day it was marked done, else its planned day. */
export function cleanupWhen(row: CleanupPhase['rows'][number]): string {
  return row.done ? fillText(A.cleanupDoneRow, { date: absoluteDate(row.done) }) : absoluteDate(row.day)
}

/** The row as the screen says it, for an export (a line with a hole is dropped, as on screen). */
export function cleanupExportView(phase: CleanupPhase, row: CleanupPhase['rows'][number], notes: NotAssessedNotes = {}): CleanupExport | null {
  const entry = cleanupEntry(row.kind)
  if (!entry) return null
  const ex = cleanupVars(phase, row, notes)
  const whole = (line: string): boolean => missingVars(line, ex).length === 0
  return { kind: row.kind, day: row.day, done: row.done, title: entry.title, why: fillText(entry.why, ex), whatToDo: entry.whatToDo.filter(whole).map((l) => fillText(l, ex)), doneWhen: entry.doneWhen.filter(whole).map((l) => fillText(l, ex)) }
}

/** Every Cleanup row as words, in render order; none when the phase has nothing to say. */
export function cleanupExportViews(phase: CleanupPhase | null | undefined, notes: NotAssessedNotes = {}): CleanupExport[] {
  if (!phase) return []
  return phase.rows.map((r) => cleanupExportView(phase, r, notes)).filter((v): v is CleanupExport => v !== null)
}
