// The automatic log (prompt 30 §3): derived entirely from scans, never from
// user input. Append-only, capped at the most recent 500 entries plus a
// rolled-up summary of anything older. Stored in the plan file. Pure.
import { LOG } from '../copy/next.ts'
import { absoluteDate } from '../copy/dates.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Checkpoint } from './plan.ts'
import { changesSince } from './tracking.ts'
import type { Step } from './types.ts'

export type LogEntry = {
  at: string
  what: string
  kind: 'scan' | 'policy' | 'step' | 'object' | 'readiness' | 'drill' | 'baseline'
  stepId: string | null
  detectedBy: 'tag' | 'fingerprint' | 'scan' | 'checkpoint'
  planned: boolean
  /** The scan that recorded it. */
  scanAt: string
}

export type ActivityLog = {
  entries: LogEntry[]
  /** Anything older than the cap, as one line. */
  rolledUp: { count: number; from: string; to: string } | null
}

export const LOG_CAP = 500

export function emptyLog(): ActivityLog {
  return { entries: [], rolledUp: null }
}

/**
 * The entries one scan adds: the scan itself, every policy change since the
 * last checkpoint, every step transition whose history entry is from this
 * scan, objects a step needed that now exist, readiness milestones, the
 * break-glass drill, and a baseline update.
 */
export function entriesForScan(args: {
  snapshot: TenantSnapshot
  steps: Step[]
  previous: Checkpoint | null
  planId: string
  baselinePin: string | null
  previousBaselinePin: string | null
  scanAt: string
  /** Step transitions recorded after this moment belong to this scan (null: all of them). */
  since?: string | null
}): LogEntry[] {
  const { snapshot, steps, previous, planId, scanAt } = args
  const out: LogEntry[] = []
  const policies = (snapshot.config.caPolicies?.rows ?? []).length
  out.push({ at: scanAt, what: LOG.entry.scan(snapshot.users.length, policies), kind: 'scan', stepId: null, detectedBy: 'scan', planned: true, scanAt })

  // Policy changes against the last checkpoint, each tied to the step that owns the policy when one does.
  const byPolicy = new Map(steps.filter((s) => s.tracking?.policyId).map((s) => [s.tracking!.policyId, s]))
  for (const c of changesSince(snapshot, previous, steps, planId)) {
    const step = [...byPolicy.entries()].find(([, s]) => c.text.endsWith(s.tracking!.policyName))?.[1] ?? null
    const detectedBy = step ? step.tracking!.matchedBy : 'checkpoint'
    const kind = c.kind === 'admins' || c.kind === 'breakGlass' || c.kind === 'group' ? (c.kind === 'breakGlass' ? 'drill' : 'readiness') : 'policy'
    out.push({ at: c.at ?? scanAt, what: c.text, kind, stepId: step?.id ?? null, detectedBy, planned: c.planned, scanAt })
  }

  // Step transitions recorded by this scan.
  for (const s of steps) {
    for (const h of s.history) {
      if (args.since && h.at < args.since) continue
      const what = h.to === 'done' ? LOG.entry.stepDone(s.plainTitle || s.title) : h.to === 'in-report-only' ? LOG.entry.stepReportOnly(s.plainTitle || s.title) : h.to === 'ready' && h.from === 'done' ? LOG.entry.stepReopened(s.plainTitle || s.title, h.note ?? '') : null
      if (!what) continue
      out.push({ at: h.at, what, kind: 'step', stepId: s.id, detectedBy: s.tracking?.matchedBy ?? 'scan', planned: h.to !== 'ready', scanAt })
    }
    if (s.kind === 'prerequisite' && s.status === 'done' && s.history.some((h) => (!args.since || h.at >= args.since) && h.to === 'done')) {
      out.push({ at: scanAt, what: LOG.entry.objectCreated(s.plainTitle || s.title), kind: 'object', stepId: s.id, detectedBy: 'scan', planned: true, scanAt })
    }
  }

  // Readiness milestones against the last checkpoint.
  if (previous) {
    const before = previous.mfaStateCounts as Record<string, number>
    const nowNone = snapshot.registrationDetails.filter((r) => !r.isMfaCapable).length
    const beforeNone = before?.none ?? null
    if (beforeNone !== null && nowNone < beforeNone) out.push({ at: scanAt, what: LOG.entry.readinessMethod(beforeNone - nowNone), kind: 'readiness', stepId: null, detectedBy: 'checkpoint', planned: true, scanAt })
  }
  if (args.baselinePin && args.previousBaselinePin && args.baselinePin !== args.previousBaselinePin) {
    out.push({ at: scanAt, what: LOG.entry.baseline(args.baselinePin.slice(0, 7)), kind: 'baseline', stepId: null, detectedBy: 'scan', planned: true, scanAt })
  }
  return out
}

/** Append, dedupe on (at, what), cap at 500 with a roll-up of the rest. */
export function appendLog(log: ActivityLog, entries: LogEntry[]): ActivityLog {
  // The same fact is never listed twice: a step transition is one entry whatever the clock said.
  const key = (e: LogEntry) => (e.kind === 'step' || e.kind === 'object' ? `${e.stepId}|${e.what}` : `${e.at}|${e.what}`)
  const seen = new Set(log.entries.map(key))
  const fresh: LogEntry[] = []
  for (const e of entries) {
    if (seen.has(key(e))) continue
    seen.add(key(e))
    fresh.push(e)
  }
  const all = [...log.entries, ...fresh].sort((a, b) => a.at.localeCompare(b.at))
  if (all.length <= LOG_CAP) return { entries: all, rolledUp: log.rolledUp }
  const dropped = all.slice(0, all.length - LOG_CAP)
  const kept = all.slice(-LOG_CAP)
  const from = log.rolledUp?.from ?? dropped[0].at
  const to = dropped[dropped.length - 1].at
  return { entries: kept, rolledUp: { count: (log.rolledUp?.count ?? 0) + dropped.length, from, to } }
}

export function rolledUpSentence(log: ActivityLog): string | null {
  return log.rolledUp ? LOG.rolledUp(log.rolledUp.count, absoluteDate(log.rolledUp.from), absoluteDate(log.rolledUp.to)) : null
}

/** Newest first, optionally only what the plan itself did. */
export function logView(log: ActivityLog, filter: 'all' | 'mine'): LogEntry[] {
  const rows = [...log.entries].reverse()
  return filter === 'mine' ? rows.filter((e) => e.planned && e.kind !== 'scan') : rows
}

export function logCsvRows(entries: LogEntry[]): (string | number)[][] {
  return entries.map((e) => [e.at, e.what, e.stepId ?? '', LOG.detected[e.detectedBy], e.planned ? LOG.planned : LOG.unplanned])
}

export function logMarkdown(entries: LogEntry[], title: string): string {
  const lines = [`# ${title}`, '', `| ${LOG.columns.when} | ${LOG.columns.what} | ${LOG.columns.step} | ${LOG.columns.detected} | ${LOG.columns.planned} |`, '| --- | --- | --- | --- | --- |']
  for (const e of entries) lines.push(`| ${absoluteDate(e.at)} | ${e.what.replace(/\|/g, '\\|')} | ${e.stepId ?? ''} | ${LOG.detected[e.detectedBy]} | ${e.planned ? LOG.planned : LOG.unplanned} |`)
  return lines.join('\n')
}
