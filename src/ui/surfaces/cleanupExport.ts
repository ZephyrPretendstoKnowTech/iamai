// A Cleanup row as words (E3, E4): the content entry behind it, the values its
// lines fill (a noted policy carries its note), its date column, and the
// export view the calendar, the prompt pack and the bundle read, so what they
// say is what the row says on screen (CleanupStep.tsx renders the same).
//
// Pure: no DOM, no network. Runs in Node tests and in the browser.
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import type { CleanupExport } from '../../roadmap/types.ts'
import type { LaneView } from './stepContract.ts'
import { app, cleanup as cleanupContent, pages, schedulingWords } from '../../content/content.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { emergencyVerificationTasksOf } from './emergencyVerificationTasks.ts'

export type { CleanupExport }
export type CleanupEntry = { title: string; learn?: { url: string } | null; why: string; whatToDo: string[]; doneWhen: string[] }

/** Shared by the live drill and the existing printable/exported plan. */
export const EMERGENCY_RECOVERY_PROCEDURE = [
  'Preserve any working administrator session and credentials. Stop further broad authentication or Conditional Access changes.',
  'Try the prepared emergency account with its intended credential in the documented recovery environment, and verify the tenant and account identity.',
  'If another authorized administrator or an existing properly permissioned delegated partner can access the tenant, use that established route.',
  'With sufficient access, inspect the actual failed sign-in and identify the responsible policy or authentication-method setting. Correct only the observed setting; do not disable all Conditional Access or remove all MFA.',
  'Without working administrative access, use [Microsoft business support](https://support.microsoft.com/contactus/) or the applicable authorized partner-support route. Prepare the tenant and domain, UTC error time, error and correlation details, and the known recent change. Never send passwords, Temporary Access Passes, tokens, PINs, or private keys.',
  'After recovery, scan again and repeat the applicable emergency-access verification before resuming restrictive work.',
] as const

const A = app.plan

/** The content entry behind a Cleanup row, or null when content.cleanup lacks it. */
export function cleanupEntry(kind: string): CleanupEntry | null {
  return ((cleanupContent as Record<string, CleanupEntry>)[kind] ?? null)
}

/** The values a Cleanup row's lines fill: its lists and the tenant's naming shape. */
export function cleanupVars(phase: CleanupPhase, row: CleanupPhase['rows'][number]): Record<string, unknown> {
  return { ...row.lists, ...(phase.convention ? { convention: phase.convention } : {}) }
}

/** The day a Cleanup row was marked done, as the board prints a day: the one reading of `row.done` as a date, which "done <date>" and a finished row's compact line both show. */
const doneDay = (done: string): string => absoluteDate(done.slice(0, 10))

/**
 * The row's date column: the day it was marked done, else its planned day — and
 * while the plan cannot finish (`undated`, derive/finish.ts heldRequired), where
 * the plan expects it (`estimate`, roadmap/forecast.ts planForecast) as an
 * estimate: Cleanup follows the last enforcement, and its planned day comes
 * after work that is held, so that day is not one the plan can promise.
 */
export function cleanupWhen(row: CleanupPhase['rows'][number], undated = false, completed = false, readyReview = false, estimate: string | null = null): string {
  // Never blank (owner, 2026-09-11), and a date on every open row (owner, 2026-09-23); the placeholder only where no board estimated it.
  return row.done ? fillText(A.cleanupDoneRow, { date: doneDay(row.done) }) : completed ? schedulingWords.done : undated && readyReview ? schedulingWords.reviewNow : undated ? (estimate !== null ? fillText(schedulingWords.estimate, { date: absoluteDate(estimate) }) : (pages.plan as unknown as { when: { afterPrerequisites: string } }).when.afterPrerequisites) : absoluteDate(row.day.slice(0, 10))
}

/** Recorded checks remain evidence, never a substitute for current completion. */
export function cleanupEvidenceLines(phase: CleanupPhase, row: CleanupPhase['rows'][number]): string[] {
  const record = row.record
  if (!record) return []
  const names = row.lists.emergencyAccounts ?? row.lists.emergencyAccountUpns ?? []
  const account = (id: string): string => {
    const index = phase.accountIds.indexOf(id)
    const name = index >= 0 && names.length === phase.accountIds.length ? names[index] : null
    return name && name !== id ? `${name} (${id})` : id
  }
  const policy = (id: string): string => {
    const name = phase.policyOptions?.find(p => p.id === id)?.name ?? record.policyNames?.[id]
    return name && name !== id ? `${name} (${id})` : id
  }
  const state = row.verification ?? (row.done ? 'current' : 'historical')
  return [
    `Evidence status: ${state}`,
    row.verificationReason,
    `Test date: ${record.date.slice(0, 10)}${record.timeZone ? ` (${record.timeZone})` : ''}`,
    `Saved: ${record.at}`,
    `Recorded outcome: ${record.consolidationDecision === 'retain-both' ? 'Retain Both' : record.outcome === 'passed' ? 'Passed' : record.outcome === 'failed' ? 'Failed' : 'Not recorded'}`,
    record.accountIds?.length ? `Accounts: ${record.accountIds.map(account).join(', ')}` : null,
    record.workflow ? `Workflow: ${record.workflow}` : null,
    record.recipient ? `Alert recipient: ${record.recipient}` : null,
    ...Object.entries(record.signInAtByAccount ?? {}).map(([id, at]) => `Recorded sign-in: ${account(id)} — ${at}`),
    record.retainedPolicyIds?.length ? `Policies retained: ${record.retainedPolicyIds.map(policy).join(', ')}` : null,
    record.rationale ? `Reason: ${record.rationale}` : null,
    ...(record.namingChanges ?? []).map(p => `Name review: ${p.from} → ${p.to} (ID: ${p.id})`),
    typeof record.toolingVerified === 'boolean' ? `Name-based tooling checked: ${record.toolingVerified ? 'Yes' : 'No'}` : null,
    record.replacementPolicyId ? `Retained policy: ${policy(record.replacementPolicyId)}` : null,
    record.retiredPolicyIds?.length ? `Retired policies: ${record.retiredPolicyIds.map(policy).join(', ')}` : null,
    typeof record.coverageVerified === 'boolean' ? `Replacement coverage confirmed by administrator: ${record.coverageVerified ? 'Yes' : 'No'}` : null,
    record.reference ? `Change record: ${record.reference}` : null,
  ].filter((line): line is string => typeof line === 'string' && line.length > 0)
}

/**
 * The board's reading of the Cleanup rows, for an export: whether the plan can
 * finish (`undated`: derive/finish.ts planFinish held) and each row's lane
 * (by its board id, `cleanup-<kind>`). The Plan's CleanupRow reads the same two
 * facts for its When column.
 */
export type CleanupBoardRead = { undated: boolean; laneOf: (id: string) => LaneView | null }

/**
 * The row's When column from the board's lane for it: the one mapping of a lane
 * to cleanupWhen's flags, read by the Plan's CleanupRow and by every export
 * (cleanupWhenOnBoard), so the screen and a file cannot say two Whens.
 *
 * `compact` is the Plan's one-line finished row (planBoard.ts drawsCompact): it
 * shows the day a Completed row was marked done, as a date, and nothing where
 * none was recorded or the row was deferred — never a word in a date's place,
 * as a step's compact line does (finishedDayOf).
 */
export function cleanupWhenOf(row: CleanupPhase['rows'][number], undated: boolean, lane: LaneView | null, compact = false): string {
  const completed = lane?.lane === 'Completed'
  if (compact) return completed && row.done ? doneDay(row.done) : ''
  return cleanupWhen(row, undated, completed, lane?.lane === 'Ready' && lane.substatus === 'Review', lane && !lane.alone ? (lane.estimate ?? null) : null)
}

/** The row's When column on the board, from its reading (the Plan's CleanupRow reads cleanupWhenOf too). */
export function cleanupWhenOnBoard(row: CleanupPhase['rows'][number], read: CleanupBoardRead | null): string {
  return cleanupWhenOf(row, read?.undated ?? false, read?.laneOf(`cleanup-${row.kind}`) ?? null)
}

/** The row as the screen says it, for an export (a line with a hole is dropped, as on screen). */
export function cleanupExportView(phase: CleanupPhase, row: CleanupPhase['rows'][number], read: CleanupBoardRead | null = null): CleanupExport | null {
  const entry = cleanupEntry(row.kind)
  if (!entry) return null
  const ex = cleanupVars(phase, row)
  const whole = (line: string): boolean => missingVars(line, ex).length === 0
  // The drill's task steps carry the screen's inline bold (StepSections renders
  // it); an export is plain words, so the markers go, as stepExport.ts drops
  // them from the emergency preparation steps.
  const whatToDo = row.kind === 'drill'
    ? [...emergencyVerificationTasksOf(phase).tasks.flatMap(task => [`${task.title}${task.targetUpn ? ` — ${task.targetUpn}` : ''}`, ...task.steps]), 'Emergency recovery procedure', ...EMERGENCY_RECOVERY_PROCEDURE].map(line => line.replace(/\*\*/g, ''))
    : entry.whatToDo.filter(whole).map((l) => fillText(l, ex))
  return { kind: row.kind, day: row.day, done: row.done, title: entry.title, when: cleanupWhenOnBoard(row, read), undated: read?.undated ?? false, manualEvidence: cleanupEvidenceLines(phase, row), why: fillText(entry.why, ex), whatToDo, doneWhen: entry.doneWhen.filter(whole).map((l) => fillText(l, ex)) }
}

/**
 * Every Cleanup row as words, in render order; none when the phase has nothing
 * to say. `read` is the board's reading (stepExport.ts exportCleanupViewsOf
 * builds it for the Export page); without one a row reads its planned day.
 */
export function cleanupExportViews(phase: CleanupPhase | null | undefined, read: CleanupBoardRead | null = null): CleanupExport[] {
  if (!phase) return []
  return phase.rows.map((r) => cleanupExportView(phase, r, read)).filter((v): v is CleanupExport => v !== null)
}
