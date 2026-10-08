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
import { WITHHELD_CLEANUP, cleanupRows } from './cleanup.ts'
import type { CleanupKind, CleanupRow } from './cleanup.ts'
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
import { nameKey } from '../baseline/discover.ts'
import { cleanup as cleanupWords } from '../content/content.ts'
import { contentTitle } from '../content/stepTitle.ts'
import { fillText } from '../content/render.ts'
import { list } from '../copy/statements.ts'

/** Retire Replaced Policies' own words beyond its row (content.cleanup.retire). */
const RETIRE_WORDS = (cleanupWords as unknown as { retire: { recordStale: string; replacementPending: string; replacementPendingMany: string; replacementOn: string; replacementOnMany: string; stricter: string; stricterLine: string } }).retire

export type CleanupPhase = {
  /** The first Cleanup day: the working day after the last enforcement window. */
  start: string
  /** The last Cleanup day: one working day per row. */
  end: string
  /**
   * The rows, in render order, each with its day, and the date it was marked done (null while it is not).
   * `waitsOn` is the steps whose policy has to be On before the row can be done:
   * Retire Replaced Policies waits on the step that built the baseline's policy
   * beside the ones it retires (RetiringPolicy.stepId).
   */
  rows: (CleanupRow & { day: string; done: string | null; waitsOn?: string[]; record?: CleanupCheckpoint; verification?: 'current' | 'changed' | 'historical' | 'incomplete' | 'unread'; verificationReason?: string })[]
  /** The tenant's own policies Retire Replaced Policies lists, by id, in its order: what a kept-with-a-reason record names. */
  retiringPolicyIds?: string[]
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
  /** The tenant's own policies a step built the baseline's beside, still On or in Report-only (retiringOf). */
  retiring?: RetiringPolicy[]
  early?: string
  /** The rows held back from plans (cleanup.ts WITHHELD_CLEANUP); a test of a held-back row passes an empty set. */
  withheld?: ReadonlySet<CleanupKind>
}

/** One policy Retire Replaced Policies lists: the tenant's, the row's line for it, and the step that built the baseline's beside it. */
export type RetiringPolicy = { policyId: string; line: string; stepId: string; /** Every step whose policy has to be On before it goes (audit F2, F3). */ stepIds?: string[]; /** Asks more than the baseline's: a line to keep, listed last (audit, 2026-10-07). */ stricter?: boolean }

/**
 * The tenant's own policies a step built the baseline's beside and still On or
 * in Report-only (Action.besidePolicies), one each, in plan order: what Retire
 * Replaced Policies retires. A step skipped, set aside or not applying retires
 * nothing; a policy turned Off or deleted has left the list, so the scan that
 * finds the last one gone takes the row out of the plan, as Align Policy Names
 * leaves once the last name is aligned.
 */
export function retiringOf(steps: readonly Step[], stateWord: (state: string) => string): RetiringPolicy[] {
  const active = (s: Step): boolean => !(s.status === 'skipped' || s.doesntApply || s.state.setAside)
  const on = (s: Step): boolean => s.state.lifecycle === 'enforced' || s.state.satisfied || s.status === 'done'
  // The step's shown title (stepTitle.ts): a content id that is not the goal id fell
  // through to the goal's name ("keep it until Browser sessions never persist for
  // anyone is On", live check 2026-10-08).
  const titleOf = (s: Step): string => contentTitle(s)
  const lower = (id: unknown): string => String(id ?? '').toLowerCase()
  // The policy each step tracks, compares or edits is that step's own, and never
  // retired for another (audit F1, 2026-10-05).
  const owners = new Map<string, Set<string>>()
  for (const s of steps) {
    const own = [s.tracking?.policyId, ...(s.tracking?.members ?? []).map((m) => m.policyId), s.action.intendedFor, ...(s.action.resolution?.policies ?? []).filter((o) => o.mode === 'update').map((o) => o.policyId)]
    for (const id of own) if (id) owners.set(lower(id), (owners.get(lower(id)) ?? new Set()).add(s.id))
  }
  const listed = new Map<string, { name: string; state: string; stricter: boolean; stepIds: string[]; alsoGoals: Set<string> }>()
  for (const s of steps) {
    if (!active(s)) continue
    for (const p of s.action.besidePolicies ?? []) {
      if (p.state !== 'enabled' && p.state !== 'enabledForReportingButNotEnforced') continue
      const hit = listed.get(p.policyId) ?? { name: p.name, state: p.state, stricter: false, stepIds: [], alsoGoals: new Set<string>() }
      // Every step that lists it, not the first (audit F2): it goes once each of their policies is On.
      hit.stepIds.push(s.id)
      if (p.stricter) hit.stricter = true
      for (const g of p.alsoGoals ?? []) hit.alsoGoals.add(g)
      listed.set(p.policyId, hit)
    }
  }
  const out: RetiringPolicy[] = []
  for (const [policyId, p] of listed) {
    if ([...(owners.get(lower(policyId)) ?? [])].some((id) => !p.stepIds.includes(id))) continue
    // And every other goal it does a job for today that the plan holds a step for (audit F3): that
    // step's policy On too. A goal with no step on the plan asks nothing of it (audit, 2026-10-05:
    // "keep it" for a goal the replacement also covers was a false claim).
    const also = [...p.alsoGoals].map((g) => ({ g, step: steps.find((s) => s.goalId === g && active(s)) }))
    const waits = [...new Set([...p.stepIds, ...also.flatMap((x) => (x.step ? [x.step.id] : []))])]
    const waitSteps = waits.map((id) => steps.find((s) => s.id === id)!).filter(Boolean)
    const pending = waitSteps.filter((s) => !on(s))
    const names = (ss: Step[]): string => list(ss.map(titleOf))
    const replacement = pending.length > 0
      ? fillText(pending.length === 1 ? RETIRE_WORDS.replacementPending : RETIRE_WORDS.replacementPendingMany, { step: names(pending), steps: names(pending) })
      : fillText(waitSteps.length === 1 ? RETIRE_WORDS.replacementOn : RETIRE_WORDS.replacementOnMany, { step: names(waitSteps), steps: names(waitSteps) })
    // What to do with it first, then, for a stricter one, what it would loosen, as its own
    // sentence, then its ID last (audit and live check, 2026-10-05: "keep it with a reason"
    // and "keep it until" ran together in one clause).
    // A stricter policy is a line to keep, after the ones to turn off (audit, 2026-10-07).
    const line = p.stricter
      ? fillText(RETIRE_WORDS.stricterLine, { name: p.name, state: stateWord(p.state), id: policyId })
      : `${p.name} (${stateWord(p.state)}): ${replacement}. ID: ${policyId}`
    out.push({ policyId, line, stepId: waits[0], stepIds: waits, stricter: p.stricter })
  }
  return [...out.filter((r) => !r.stricter), ...out.filter((r) => r.stricter)]
}

/**
 * The day Retire Replaced Policies was completed by a record, else null: the
 * latest saved "keep them" record whose reason is written and which names every
 * policy still listed. Turning the policies Off needs no record: the scan that
 * finds them Off or gone takes them off the list.
 */
export function retireKeptOn(records: readonly CleanupCheckpoint[], ids: readonly string[], now: string): string | null {
  const latest = records.filter((c) => c.cleanup === 'retire' && validCompletionDate(c.date, now, c.timeZone) && Date.parse(c.at) <= Date.parse(now)).sort((a, b) => a.at.localeCompare(b.at)).at(-1)
  if (!latest || !latest.rationale?.trim() || ids.length === 0) return null
  const kept = new Set((latest.retainedPolicyIds ?? []).map((id) => id.toLowerCase()))
  return ids.every((id) => kept.has(id.toLowerCase())) ? latest.date : null
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
    retiring: (input.retiring ?? []).map((p) => p.line),
  }, input.withheld ?? WITHHELD_CLEANUP)
  const retiringIds = (input.retiring ?? []).map((p) => p.policyId)
  const retireWaits = [...new Set((input.retiring ?? []).flatMap((p) => p.stepIds ?? [p.stepId]))]
  // Intended retirement removes the overlap that originally created this row;
  // keep its recorded result visible and reassess the retained replacement.
  if (!(input.withheld ?? WITHHELD_CLEANUP).has('consolidation') && !rows.some(r => r.kind === 'consolidation') && input.records?.some(r => r.cleanup === 'consolidation')) rows.push({ kind: 'consolidation', lists: { overlaps: [] } })
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
    const done = r.kind === 'retire' ? retireKeptOn(records, retiringIds, now) : r.kind === 'hardening' ? input.hardeningVerified ? now : null : r.kind === 'consolidation' ? consolidationVerified(latestConsolidation, input.policies) && consolidationCandidateIds.every(id => [...(latestConsolidation?.retainedPolicyIds ?? []), ...(latestConsolidation?.retiredPolicyIds ?? []), latestConsolidation?.replacementPolicyId].includes(id)) ? latestConsolidation!.date : null : r.kind === 'drill' ? tested ? tests.filter((d): d is string => d !== null).sort().at(-1) ?? null : null : record && (r.kind !== 'alerting' || record.outcome !== 'failed') ? record.date : null
    // The drill's recorded check is a legacy manual record only (overnight review
    // B1): the automatic per-account records are Step 4's Sign-in evidence tile.
    const latest = records.filter(c => c.cleanup === r.kind && (r.kind !== 'drill' || isLegacyManualDrillRecord(c))).sort((a,b) => a.at.localeCompare(b.at)).at(-1)
    const verification = done ? 'current' : latest && (r.kind === 'consolidation' || r.kind === 'naming') ? input.policies == null ? 'unread' : (r.kind === 'naming' ? !latest.namingChanges?.length : !latest.replacementPolicyId && latest.consolidationDecision !== 'retain-both') ? 'historical' : 'changed' : latest && r.kind === 'drill' && !latest.outcome ? 'historical' : latest && input.accountBasis && accounts.some(id => !input.accountBasis?.[id]) ? 'unread' : latest && latest.basis !== basis ? 'changed' : 'incomplete'
    // Retire Replaced Policies waits on the step whose policy replaces the ones it
    // lists; a saved "keep them" record that no longer names every one still
    // listed is history, and says so.
    if (r.kind === 'retire') {
      dated.push({ ...r, day, done, ...(retireWaits.length > 0 ? { waitsOn: retireWaits } : {}), ...(latest ? { record: latest, verification: done ? 'current' as const : 'changed' as const, ...(done ? {} : { verificationReason: RETIRE_WORDS.recordStale }) } : {}) })
      continue
    }
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
  return { start: dated.map(r => r.day).sort()[0], end: [input.after, ...dated.map(r => r.day)].sort().at(-1)!, rows: dated, consolidationCandidateIds, ...(retiringIds.length > 0 ? { retiringPolicyIds: retiringIds } : {}), accountIds: input.emergencyAccountIds, accountUpnsById: Object.fromEntries(input.emergencyAccountIds.map((id, index) => [id, input.emergencyAccountUpns[index] ?? id])), accountBasis: input.accountBasis, recoveryCandidateSetBasis: input.recoveryCandidateSetBasis, signInEvidenceSource: input.signInEvidenceSource, recoveryFindings: input.recoveryFindings, recoveryCandidates: input.recoveryCandidates, preChangeRecoveryCandidates: input.preChangeRecoveryCandidates, tenantId: input.tenantId, configurationObservedAtByAccount: input.configurationObservedAtByAccount, latestFailedAtByAccount, preChangeConfigurationObservedAtByAccount: input.preChangeConfigurationObservedAtByAccount, snapshotObservedAt: input.snapshotObservedAt, policyOptions: [...policyOptions.values()], convention }
}

/** One policy to rename: its id, the tenant's name for it, and the baseline's. */
export type Rename = { id: string; from: string; to: string }

/**
 * The tenant's policies a step holds to the plan's own settings under a name
 * that is not the baseline's (owner, 2026-09-26: Jon's names), one each, in
 * plan order: tracking reads each member's name beside the one the step's
 * create gives it (MemberTracking.plannedName).
 *
 * Only a policy the step already compares exactly: the one it corrects (an
 * update operation's target) or the one it reads against its whole policy
 * (Action.intended). A tenant policy that only helps deliver the goal is
 * adopted as it is, and the baseline's name would make it the plan's own
 * (generate.ts claimedPolicy), so the next scan would read it against the plan
 * and reopen a finished step: a rename that "changes no sign-in" must not.
 *
 * A difference in capitals or dashes only (a hyphen for an en dash) is none; a step skipped, set aside or not
 * applying renames nothing; and a name any tenant policy already has, or an
 * earlier rename takes, is none: two policies never share one.
 */
export function renamesOf(steps: readonly Step[], tenantNames: readonly string[] = []): Rename[] {
  const key = nameKey
  const live = steps.filter((s) => s.status !== 'skipped' && !s.doesntApply && !s.state.setAside)
  const owned = live.flatMap((s) => {
    const updates = new Set((s.action.resolution?.policies ?? []).filter((o) => o.mode === 'update' && o.policyId).map((o) => String(o.policyId).toLowerCase()))
    // A policy the step itself renames (its update writes the name) is the step's to rename, not Align Policy Names' (owner, 2026-10-04).
    const renamedHere = new Set((s.action.resolution?.policies ?? []).filter((o) => o.mode === 'update' && o.policyId && typeof o.body.displayName === 'string').map((o) => String(o.policyId).toLowerCase()))
    // The one policy a finished step names for its comparison (Action.intendedFor), and no other.
    const compared = (id: string): boolean => s.action.intended !== undefined && (s.action.intendedFor === undefined || s.action.intendedFor.toLowerCase() === id.toLowerCase())
    return (s.tracking?.members ?? []).filter((m) => m.policyId && m.policyName && !renamedHere.has(m.policyId.toLowerCase()) && (compared(m.policyId) || updates.has(m.policyId.toLowerCase())))
  })
  const taken = new Set([...tenantNames, ...live.flatMap((s) => s.tracking?.members ?? []).map((m) => m.policyName ?? '')].filter((n) => n !== '').map(key))
  const out = new Map<string, Rename>()
  for (const m of owned) {
    if (out.has(m.policyId!)) continue
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
 * renames, in the row's list and as the phase's proposals, dated the working
 * day after the last Ongoing row, where the board draws it (stepGroups.ts: last
 * of Ongoing Checks and Cleanup). No other row moves. The row is in the plan
 * only while a policy is left to rename, so the scan that finds the last
 * baseline name completes it; nothing is recorded by hand.
 */
export function settleRenames(schedule: Schedule, steps: readonly Step[]): void {
  const phase = schedule.cleanup
  if (!phase) return
  phase.rows = phase.rows.filter((r) => r.kind !== 'naming')
  const renames = renamesOf(steps, (phase.policyOptions ?? []).map((p) => p.name))
  phase.namingProposals = renames.map((r) => ({ ...r, collision: false }))
  if (renames.length === 0) return
  // The drill is dated on its own; the rest run one working day each from the last enforcement.
  const ctx = schedule.rhythm ? { rhythm: schedule.rhythm } : undefined
  const last = phase.rows.filter((r) => r.kind !== 'drill').map((r) => r.day).sort().at(-1)
  const day = addWorkingDays(last ?? schedule.targetEnd, 1, ctx)
  phase.rows.push({ kind: 'naming', lists: { renames: renames.map((r) => `${r.from} → ${r.to} (ID: ${r.id})`) }, day, done: null })
  phase.rows.sort((x, y) => x.day.localeCompare(y.day))
  phase.start = phase.rows.map((r) => r.day).sort()[0]
  phase.end = [phase.end, day].sort().at(-1)!
}
