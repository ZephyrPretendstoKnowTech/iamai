// The Cleanup phase, dated (target-state §5, §9; prompt 52 Part 3). Cleanup holds
// the hygiene that protects nobody and delays nothing — emergency-account
// sign-in alerting, the emergency access drill, names off the tenant's
// convention, consolidation of the policies this plan superseded, the baseline
// policies not assessed — one row each, present only when it has something to
// say (cleanup.ts decides presence and supplies the lists). This dates it: after
// the last enforcement window, one working day per row, no notice, no rings; the
// header's finish date is the end of the last phase, Cleanup included. A row the
// person marked done carries its date (cleanupDone.ts).
//
// Pure: no DOM, no network. Runs in Node tests and in the worker.
import { cleanupRows } from './cleanup.ts'
import type { CleanupRow } from './cleanup.ts'
import { cleanupBasis, validCompletionDate, latestRecoveryTest, consolidationVerified, replacementPolicyBasis, isLegacyManualDrillRecord } from './cleanupDone.ts'
import { BREAK_GLASS_DRILL_DAYS } from './constants.ts'
import type { CleanupCheckpoint, CleanupDone } from './cleanupDone.ts'
import type { ConfigurationFinding, Step } from './types.ts'
import type { Schedule } from './schedule.ts'
import type { RecoveryCandidateReading } from './cleanupDone.ts'
import { addWorkingDays } from './timing.ts'
import type { TenantRhythm } from './rhythm.ts'
import type { OrganisationReport } from '../coverage/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { proposeName, usable } from './convention.ts'

export type CleanupPhase = {
  /** The first Cleanup day: the working day after the last enforcement window. */
  start: string
  /** The last Cleanup day: one working day per row. */
  end: string
  /** The rows, in render order, each with its day, and the date it was marked done (null while it is not). */
  rows: (CleanupRow & { day: string; done: string | null; record?: CleanupCheckpoint; verification?: 'current' | 'changed' | 'historical' | 'incomplete' | 'unread'; verificationReason?: string })[]
  /** The emergency-access account ids the alerting and drill rows act on. */
  accountIds: string[]
  accountUpnsById?: Record<string, string>
  recoveryFindings?: ConfigurationFinding[]
  recoveryCandidates?: Record<string, RecoveryCandidateReading[]>
  tenantId?: string
  configurationObservedAtByAccount?: Record<string, string | null>
  latestFailedAtByAccount?: Record<string, string | null>
  preChangeConfigurationObservedAtByAccount?: Record<string, string | null>
  preChangeRecoveryCandidates?: Record<string, RecoveryCandidateReading[]>
  snapshotObservedAt?: string
  accountBasis?: Record<string, string>
  recoveryCandidateSetBasis?: Record<string, string>
  signInEvidenceSource?: TenantSnapshot['sources']['signInEvidence']
  consolidationCandidateIds?: string[]
  namingProposals?: { id: string; from: string; to: string; collision: boolean }[]
  policyOptions?: { id: string; name: string; basis: string | null; state: string }[]
  /** The tenant's naming convention, as a shape a person can follow; null when none is usable. */
  convention: string | null
}

export type CleanupPhaseInput = {
  /** The end of the last enforcement window (the schedule's target end). */
  after: string
  rhythm: TenantRhythm | null
  emergencyAccountIds: string[]
  accountBasis?: Record<string, string>
  recoveryCandidateSetBasis?: Record<string, string>
  signInEvidenceSource?: TenantSnapshot['sources']['signInEvidence']
  recoveryFindings?: ConfigurationFinding[]
  recoveryCandidates?: Record<string, RecoveryCandidateReading[]>
  tenantId?: string
  configurationObservedAtByAccount?: Record<string, string | null>
  preChangeConfigurationObservedAtByAccount?: Record<string, string | null>
  preChangeRecoveryCandidates?: Record<string, RecoveryCandidateReading[]>
  snapshotObservedAt?: string
  policies?: readonly unknown[] | null
  emergencyAccounts: string[]
  emergencyAccountUpns: string[]
  organisation: OrganisationReport
  /**
   * The policies the plan's steps already found covering their goal (each step's
   * existingCoverage line names them): the consolidation row retires them once
   * the baseline's version is enforced, so it exists whenever that line rendered.
   */
  superseded?: string[]
  /** Each row's recorded completion (cleanupDone.ts). */
  records?: CleanupCheckpoint[]
  now?: string
  done?: CleanupDone
  /** Deferred emergency-access hardening, worded (roadmap/generate.ts). */
  hardening?: string[]
  hardeningTracked?: boolean
  hardeningVerified?: boolean
  /** The tenant's policies that exclude an emergency account by name, worded (cleanup.ts namedEmergencyExclusions). */
  namedExclusions?: string[]
  early?: string
}

/** The convention as a name shape ("Core - Scope - Action - Target"), or null below the agreement floor. */
export function conventionShape(naming: OrganisationReport['naming']): string | null {
  if (!usable(naming.convention)) return null
  return proposeName(naming.convention, naming.names, { prefix: 'CA', rest: ['Scope', 'Action', 'Target'], collapsed: 'what it does' }).name
}

/**
 * The name an outlier would carry in the tenant's convention: its own segments
 * after the foreign prefix, in the convention's prefix, casing and separator.
 */
export function proposedRename(from: string, naming: OrganisationReport['naming']): string {
  const c = naming.convention
  const parts = from.split(/\s*[-–—:|]\s*/).map((s) => s.trim()).filter((s) => s.length > 0)
  const rest = parts.length >= 2 && /^(?:core|ca|iac|conditional access)$/i.test(parts[0]) ? parts.slice(1) : parts
  return proposeName(c, naming.names, { prefix: c?.prefix ?? 'CA', rest, collapsed: rest.join(' ') }).name
}

/** The naming row's line for one outlier: from → to. */
export function renameLine(from: string, naming: OrganisationReport['naming']): string {
  return `${from} → ${proposedRename(from, naming)}`
}

/**
 * The Cleanup phase for this tenant, or null when nothing in it has anything to
 * say (§5: a group with nothing in it does not render). Rows are dated one per
 * working day from the day after `after`, in render order.
 */
export function cleanupPhaseFor(input: CleanupPhaseInput): CleanupPhase | null {
  const naming = input.organisation.naming
  const convention = conventionShape(naming)
  const policyRows = (input.policies ?? []) as Record<string, unknown>[]
  const overlaps = [...new Set([...input.organisation.consolidation.map((c) => c.policyNames.join(', ')), ...(input.superseded ?? [])])]
  const candidateNames = new Set([...input.organisation.consolidation.flatMap(c => c.policyNames), ...(input.superseded ?? [])])
  const consolidationCandidateIds = policyRows.filter(p => [...candidateNames].some(name => name === p.displayName || name.includes(`${p.displayName} (`))).map(p => String(p.id))
  const comparisonLines = input.organisation.consolidation.map(group => {
    const members = policyRows.filter(p => group.policyNames.includes(String(p.displayName)))
    const stable = (value: unknown): string => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v)
    const parts: [string, (p: Record<string, any>) => unknown][] = [
      ['user scope and exclusions', p => p.conditions?.users], ['resource scope', p => p.conditions?.applications],
      ['sign-in conditions', p => Object.fromEntries(Object.entries(p.conditions ?? {}).filter(([key]) => !['users', 'applications'].includes(key)))],
      ['grant requirements', p => p.grantControls], ['session controls', p => p.sessionControls], ['policy state', p => p.state],
    ]
    const differences = parts.filter(([, value]) => new Set(members.map(p => stable(value(p)))).size > 1).map(([label]) => label)
    return members.length > 1 ? `${group.policyNames.join(' / ')}: ${differences.length ? `different ${differences.join(', ')}` : 'the collected settings match; confirm the operational purpose before retiring either policy'}.` : ''
  }).filter(Boolean)
  const rows = cleanupRows({
    emergencyAccounts: input.emergencyAccounts,
    emergencyAccountUpns: input.emergencyAccountUpns,
    // Align Policy Names needs each policy's name as tracking reads it, after
    // this schedule is built: settleRenames adds it (owner, 2026-09-26).
    renames: [],
    overlaps: [...overlaps.map(line => `${line}${policyRows.filter(p => line.includes(String(p.displayName))).map(p => `; ${p.displayName} (ID: ${p.id})`).join('')}`), ...comparisonLines],
    hardening: input.hardening ?? [],
    namedExclusions: input.namedExclusions ?? [],
  })
  // Intended retirement removes the overlap that originally created this row;
  // keep its recorded result visible and reassess the retained replacement.
  if (!rows.some(r => r.kind === 'consolidation') && input.records?.some(r => r.cleanup === 'consolidation')) rows.push({ kind: 'consolidation', lists: { overlaps: [] } })
  if (!rows.some(r => r.kind === 'hardening') && input.hardeningTracked) rows.push({ kind: 'hardening', lists: { hardening: [] } })
  if (rows.length === 0) return null
  const ctx = input.rhythm ? { rhythm: input.rhythm } : undefined
  let day = addWorkingDays(input.after, 1, ctx)
  const dated: CleanupPhase['rows'] = []
  // The drill is Establish Emergency Access's, dated early on its own; the rest
  // follow the last enforcement, one working day each.
  let placed = 0
  for (const r of rows) {
    const early = r.kind === 'drill' && input.early ? input.early : null
    if (early === null && placed++ > 0) day = addWorkingDays(day, 1, ctx)
    const accounts = r.kind === 'drill' || r.kind === 'alerting' ? input.emergencyAccountIds : []
    const basis = cleanupBasis(r.kind, r.lists, accounts)
    const now = input.now ?? new Date().toISOString()
    const records = input.records ?? []
    const record = records.filter((c) => c.cleanup === r.kind && c.basis === basis && validCompletionDate(c.date, now, c.timeZone) && Date.parse(c.at) <= Date.parse(now)).sort((a, b) => a.at.localeCompare(b.at)).at(-1)
    // Each current account needs its own recent recovery test. They may be tested on different days.
    const tests = accounts.map((id) => input.accountBasis && !input.accountBasis[id] ? null : latestRecoveryTest(id, records, now, input.accountBasis?.[id], { readings: input.recoveryCandidates?.[id] ?? [], tenantId: input.tenantId ?? '', currentSnapshotObservedAt: input.snapshotObservedAt ?? now, signInSource: input.signInEvidenceSource, candidateSetBasis: input.recoveryCandidateSetBasis?.[id] }))
    const tested = accounts.length > 0 && tests.every((date) => date !== null && Date.parse(now) - Date.parse(date) <= BREAK_GLASS_DRILL_DAYS * 86_400_000)
    const latestConsolidation = r.kind === 'consolidation' ? records.filter(c => c.cleanup === 'consolidation' && validCompletionDate(c.date, now, c.timeZone) && Date.parse(c.at) <= Date.parse(now)).sort((a,b) => a.at.localeCompare(b.at)).at(-1) : undefined
    const done = r.kind === 'hardening' ? input.hardeningVerified ? now : null : r.kind === 'consolidation' ? consolidationVerified(latestConsolidation, input.policies) && consolidationCandidateIds.every(id => [...(latestConsolidation?.retainedPolicyIds ?? []), ...(latestConsolidation?.retiredPolicyIds ?? []), latestConsolidation?.replacementPolicyId].includes(id)) ? latestConsolidation!.date : null : r.kind === 'drill' ? tested ? tests.filter((d): d is string => d !== null).sort().at(-1) ?? null : null : record && (r.kind !== 'alerting' || record.outcome !== 'failed') ? record.date : null
    // The drill's recorded check is a legacy manual record only (overnight review
    // B1): the automatic per-account records are Step 4's Sign-in evidence tile.
    const latest = records.filter(c => c.cleanup === r.kind && (r.kind !== 'drill' || isLegacyManualDrillRecord(c))).sort((a,b) => a.at.localeCompare(b.at)).at(-1)
    const verification = done ? 'current' : latest && (r.kind === 'consolidation' || r.kind === 'naming') ? input.policies == null ? 'unread' : (r.kind === 'naming' ? !latest.namingChanges?.length : !latest.replacementPolicyId && latest.consolidationDecision !== 'retain-both') ? 'historical' : 'changed' : latest && r.kind === 'drill' && !latest.outcome ? 'historical' : latest && input.accountBasis && accounts.some(id => !input.accountBasis?.[id]) ? 'unread' : latest && latest.basis !== basis ? 'changed' : 'incomplete'
    dated.push({ ...r, day: early !== null ? addWorkingDays(early, 2, ctx) : day, done, ...(latest ? { record: latest, verification, ...(verification === 'changed' ? { verificationReason: 'The recorded check does not cover the current accounts or configuration.' } : verification === 'unread' ? { verificationReason: 'The latest scan could not verify the configuration used for this check.' } : verification === 'historical' ? { verificationReason: 'The earlier date is retained; it does not record a successful scoped test.' } : verification === 'incomplete' ? { verificationReason: r.kind === 'naming' ? 'Save the approved names, rescan after renaming, and confirm the tooling check.' : r.kind === 'consolidation' ? 'Review the current candidate policies and save the outcome.' : 'Record a successful test for the current scope.' } : {}) } : {}) })
  }
  const policyOptions = new Map<string, { id: string; name: string; basis: string | null; state: string }>()
  for (const raw of input.policies ?? []) {
    const p = raw as Record<string, unknown>
    if (typeof p.id === 'string') policyOptions.set(p.id, { id: p.id, name: typeof p.displayName === 'string' ? p.displayName : p.id, basis: replacementPolicyBasis(p), state: String(p.state ?? 'unknown') })
  }
  for (const record of input.records ?? []) for (const id of [...(record.retiredPolicyIds ?? []), ...(record.replacementPolicyId ? [record.replacementPolicyId] : [])]) {
    if (!policyOptions.has(id)) policyOptions.set(id, { id, name: `${record.policyNames?.[id] ?? id} (not in current scan)`, basis: null, state: 'absent' })
  }
  dated.sort((a, b) => a.day.localeCompare(b.day))
  const latestFailedAtByAccount = Object.fromEntries(input.emergencyAccountIds.map(id => [id, (input.records ?? []).filter(record => record.cleanup === 'drill' && record.purpose === 'final' && record.outcome === 'failed' && record.accountIds?.some(accountId => accountId.toLowerCase() === id.toLowerCase())).sort((a, b) => a.at.localeCompare(b.at)).at(-1)?.at ?? null]))
  return { start: dated.map(r => r.day).sort()[0], end: [input.after, ...dated.map(r => r.day)].sort().at(-1)!, rows: dated, consolidationCandidateIds, accountIds: input.emergencyAccountIds, accountUpnsById: Object.fromEntries(input.emergencyAccountIds.map((id, index) => [id, input.emergencyAccountUpns[index] ?? id])), accountBasis: input.accountBasis, recoveryCandidateSetBasis: input.recoveryCandidateSetBasis, signInEvidenceSource: input.signInEvidenceSource, recoveryFindings: input.recoveryFindings, recoveryCandidates: input.recoveryCandidates, preChangeRecoveryCandidates: input.preChangeRecoveryCandidates, tenantId: input.tenantId, configurationObservedAtByAccount: input.configurationObservedAtByAccount, latestFailedAtByAccount, preChangeConfigurationObservedAtByAccount: input.preChangeConfigurationObservedAtByAccount, snapshotObservedAt: input.snapshotObservedAt, policyOptions: [...policyOptions.values()], convention }
}

/** One policy to rename: its id, the tenant's name for it, and the baseline's. */
export type Rename = { id: string; from: string; to: string }

/**
 * The tenant's policies the plan tracks under a name that is not the
 * baseline's (owner, 2026-09-26: Jon's names), one each, in plan order: tracking
 * reads each member's name beside the one the step's create gives it
 * (MemberTracking.plannedName). A difference in capitals only is none, and a
 * step skipped, set aside or not applying renames nothing. A policy two steps
 * track takes the first step's name, and a name another policy already has or
 * takes first is none: two policies never share one.
 */
export function renamesOf(steps: readonly Step[]): Rename[] {
  const key = (n: string): string => n.trim().toLowerCase()
  const live = steps.filter((s) => s.status !== 'skipped' && !s.doesntApply && !s.state.setAside)
  const members = live.flatMap((s) => s.tracking?.members ?? []).filter((m) => m.policyId && m.policyName)
  const out = new Map<string, Rename>()
  const seen = new Set<string>()
  const taken = new Set(members.map((m) => key(m.policyName!)))
  for (const m of members) {
    if (seen.has(m.policyId!)) continue
    seen.add(m.policyId!)
    const to = m.plannedName?.trim() ?? ''
    if (to === '' || key(to) === key(m.policyName!) || taken.has(key(to))) continue
    taken.add(key(to))
    out.set(m.policyId!, { id: m.policyId!, from: m.policyName!, to })
  }
  return [...out.values()]
}

/**
 * Align Policy Names, once tracking has read each policy's name
 * (roadmap/progress.ts applyProgress runs after the schedule is built): the
 * renames, in the row's list and as the phase's proposals, dated where
 * cleanup.ts orders the row, before Review Overlapping Policies. The row is in
 * the plan only while a policy is left to rename, so the scan that finds the
 * last baseline name completes it; nothing is recorded by hand.
 */
export function settleRenames(schedule: Schedule, steps: readonly Step[]): void {
  const phase = schedule.cleanup
  if (!phase) return
  const renames = renamesOf(steps)
  phase.rows = phase.rows.filter((r) => r.kind !== 'naming')
  phase.namingProposals = renames.map((r) => ({ ...r, collision: false }))
  // The rows after the rollout run one working day each from the last
  // enforcement (cleanupPhaseFor); the drill is dated on its own. Naming comes
  // before consolidation, which moves a day for it, and back without it.
  const ctx = schedule.rhythm ? { rhythm: schedule.rhythm } : undefined
  const consolidation = phase.rows.find((r) => r.kind === 'consolidation')
  const last = phase.rows.filter((r) => r.kind !== 'drill' && r.kind !== 'consolidation').map((r) => r.day).sort().at(-1)
  const day = addWorkingDays(last ?? schedule.targetEnd, 1, ctx)
  if (consolidation) consolidation.day = renames.length > 0 ? addWorkingDays(day, 1, ctx) : day
  if (renames.length > 0) phase.rows.push({ kind: 'naming', lists: { renames: renames.map((r) => `${r.from} → ${r.to} (ID: ${r.id})`) }, day, done: null })
  phase.rows.sort((x, y) => x.day.localeCompare(y.day))
  phase.start = phase.rows.map((r) => r.day).sort()[0]
  phase.end = [schedule.targetEnd, ...phase.rows.map((r) => r.day)].sort().at(-1)!
}
