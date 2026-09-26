// Alert on Emergency Account Sign-ins, Establish Emergency Access's last step
// (owner, 2026-09-25): drawn on the step template, with Microsoft Learn's
// procedure filled with the tenant's own values, and completed by one Mark as
// done in the rail. IAMAI cannot read Azure Monitor alert rules, so nothing a
// scan reads could complete it, and it holds nothing.
//
// Pure: no DOM, no network.
import type { CleanupPhase } from '../../roadmap/cleanupPhase.ts'
import { cleanup as cleanupContent } from '../../content/content.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import type { EmergencyTaskProjection } from './emergencyAccountTasks.ts'
import type { Artifact } from './stepBody.ts'
import type { EmergencySubjectTile } from './emergencyReadiness.ts'
import { followTask } from './emergencyReadiness.ts'

type AlertingWords = { taskTitle: string; cardLabel: string; cardDone: string; markDone: string; whatToDo: string[]; aiInfo: string }
const W = (): AlertingWords => (cleanupContent as unknown as { alerting: AlertingWords }).alerting

const upnOf = (phase: CleanupPhase, id: string): string => phase.accountUpnsById?.[id] ?? id

/**
 * The values its lines fill: the SigninLogs query over the saved emergency
 * accounts' object IDs (Microsoft's own query, one `or` per account), and the
 * first account's sign-in name for the test.
 */
export function alertingVars(phase: CleanupPhase): Record<string, unknown> {
  const ids = phase.accountIds
  if (ids.length === 0) return {}
  return {
    alertQuery: `SigninLogs | where ${ids.map((id) => `UserId == "${id}"`).join(' or ')} | project TimeGenerated, UserPrincipalName, UserId, IPAddress, ResultType, ResultDescription`,
    firstAccountUpn: upnOf(phase, ids[0]),
  }
}

/** The procedure, whole, as its lines: the export and the Implementation Task read these. */
export function alertingSteps(phase: CleanupPhase): string[] {
  const ex = alertingVars(phase)
  return W().whatToDo.filter((l) => missingVars(l, ex).length === 0).map((l) => fillText(l, ex))
}

/** Its one Implementation Task. */
export function alertingTasksOf(phase: CleanupPhase, done: boolean): EmergencyTaskProjection {
  const title = W().taskTitle
  return { tasks: [{ id: 'create-alert-rule', accountId: null, title, targetUpn: null, required: !done, readinessKey: '', evidence: null, actionLabel: title, steps: alertingSteps(phase) }], printAll: true }
}

/** Its channels: the Entra tab, whose procedure is its task, and AI Info. */
export function alertingArtifacts(phase: CleanupPhase): Artifact[] {
  return [
    { id: 'portal', form: 'markdown', lines: [], text: () => '', note: null },
    { id: 'ai', form: 'markdown', lines: [], text: () => alertingAiInfo(phase), note: null },
  ]
}

/** AI Info: the accounts with their object IDs, the query and the procedure, in plain words. */
export function alertingAiInfo(phase: CleanupPhase): string {
  const accounts = phase.accountIds.map((id) => `- ${upnOf(phase, id)}: ${id}`)
  return [
    W().aiInfo,
    accounts.length ? accounts.join('\n') : '',
    alertingSteps(phase).map((l, i) => `${i + 1}. ${l.replace(/\*\*/g, '')}`).join('\n'),
  ].filter((x) => x !== '').join('\n\n')
}

/**
 * Tasks Remaining, as the other Establish Emergency Access steps draw it: the
 * alert rule to create, or, once marked done, the day it was.
 */
export function alertingSubjects(row: CleanupPhase['rows'][number]): EmergencySubjectTile[] {
  const w = W()
  const done = row.done ? fillText(w.cardDone, { date: absoluteDate(row.done.slice(0, 10)) }) : null
  return [{ key: 'alert-rule', accountId: null, heading: w.cardLabel, upn: null, title: done ?? w.taskTitle, instruction: done === null ? followTask(w.taskTitle) : '', completed: [], remainingCount: null, satisfied: done !== null }]
}

/** The rail's control. */
export const alertingMarkDone = (): string => W().markDone
/** The rail's milestone while it is open. */
export const alertingMilestone = (): string => W().taskTitle
