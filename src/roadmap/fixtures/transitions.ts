// The paired-scan transition corpus (task 043).
//
// Task 042 proved that one tenant fact produces one truthful conclusion across
// the four surfaces, within a single scan. This module is the same discipline
// across TIME: scan A, a change somebody made to the tenant, scan B carrying
// scan A's plan record — and the question every test asks of the pair is
//
//   identity continuity -> what changed -> what did not -> decision validity ->
//   lifecycle/condition/readiness effect -> current action
//
// Three rules the corpus is built to keep, and the reason it is one module
// rather than a transition handler per case:
//
//  1. NOTHING HERE IS A PRODUCT CONCEPT. A transition is a fixture edit plus a
//     clock advance. Every state it produces is a state the production
//     authorities already distinguish — `roadmap/observation.ts` for identity
//     and material change, `roadmap/lifecycle.ts` for the lifecycle and the
//     condition, `mapping/safetyChoice.ts` and `mapping/emergencyChoice.ts` for
//     the operator's decisions, `derive/ladder.ts` and `derive/mfaReadiness.ts`
//     for a person. This file adds no state and keeps no history of its own.
//
//  2. SELECTION IS BY PREDICATE. Which policy is rewritten, which person ages
//     out, which account gains a role: each is chosen by asking scan A's own
//     derivation a question — "the step this plan has deployed and is watching",
//     "the active person closest to the inactivity boundary". No object id, no
//     display name, no step id and no fixture name decides anything, so a
//     transition stops being covered only when production stops producing it.
//     `rescanDurability.test.ts` asserts that by reading this file's own bytes.
//
//  3. TIME IS INJECTED, NEVER SLEPT. A later scan is the same tenant with the
//     clock moved: `advance` shifts `asOf`, every source's `asOf` and the
//     sign-in evidence window by a whole number of days and leaves every fact
//     about the tenant where it was. Aging is then a consequence of the
//     arithmetic the production authorities already do, which is the only way a
//     recency boundary can be tested without owning a second copy of it.
//
// A builder returns null where the base tenant cannot produce its case, so a
// fixture change shows up as a corpus gap (test 043.0) rather than as a
// silently skipped scenario.
//
// Pure: no DOM, no network, no wall clock.
import { curatedFixture, strengthMissing } from './index.ts'
import type { Fixture, FixtureName } from './index.ts'
import { runFixture } from './run.ts'
import type { FixtureRun } from './run.ts'
import { observationsOf } from '../tracking.ts'
import type { StepObservationRecord } from '../observation.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import type { ReadinessRow, ReadinessView } from '../../derive/mfaReadiness.ts'
import { directoryEvidenceFromGroups, exclusionsGroupIdToVerify } from '../../mapping/safetyChoice.ts'
import type { DirectoryEvidence, ObjectEvidence } from '../../mapping/safetyChoice.ts'
import { INACTIVE_DAYS } from '../../scoring/mfaViability.ts'
import { adminUserIds } from '../../roles.ts'
import type { RoadmapInput } from '../generate.ts'
import type { Step } from '../types.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import type { GroupMembers } from '../../coverage/population.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'

const DAY = 86_400_000

/** One scan of one tenant: what the engine derived, and what it would leave for the next scan. */
export type Scan = {
  fixture: Fixture
  run: FixtureRun
  steps: Step[]
  readiness: ReadinessView
  /** The plan record's observations block, exactly as `planData.ts` persists it. */
  observations: Record<string, StepObservationRecord>
}

/**
 * The object the change was made to, as scan A identified it. A test names the
 * subject of an assertion through this rather than through an identifier of its
 * own.
 */
export type Focus = { policyId: string | null; userId: string | null; groupId: string | null }

export type Transition = {
  key: TransitionKey
  label: string
  /** Days between the two scans. */
  days: number
  a: Scan
  b: Scan
  /**
   * The same second scan with the tenant untouched: the clock moved and nothing
   * else did.
   *
   * A rescan test that compares B against A cannot tell the change apart from
   * the passage of time, and time is not inert — a plan's evidence gate is read
   * over the window from the day a policy went into report-only to the day of
   * the scan, so a later scan whose sign-in collection has not caught up finds
   * the window no longer covered and a step that was ready to enforce is not.
   * That is honest behaviour and it is not what any of these cases is about, so
   * "what this change moved" is B against the control, and "what the clock
   * moved" is the control against A.
   */
  control: Scan
  focus: Focus
}

/**
 * The transitions, covering the task contract's cases A–P. Each name is what
 * somebody did to the tenant between two scans, never a state IAMAI holds.
 */
export type TransitionKey =
  /** A. Nothing moved: the same tenant, scanned again. */
  | 'unchanged'
  /** B. Every policy and every person relabelled; nothing means anything different. */
  | 'renamed'
  /** C. The watched policy's grant narrowed by somebody outside the plan. */
  | 'rewritten'
  /** D. The watched policy is gone from the tenant. */
  | 'policyRemoved'
  /** E. The watched policy deleted and recreated: same name, same body, new immutable id. */
  | 'policyReplaced'
  /** F. A new group appears that would serve the exclusions role. */
  | 'newCandidateGroup'
  /** G. The confirmed exclusions group is proved gone by the directory. */
  | 'decisionTargetGone'
  /** P. One group read fails, so every goal whose policies name it cannot be assessed this scan. */
  | 'coverageUnreadable'
  /** H. The confirmed exclusions group is still there and no longer holds the emergency accounts. */
  | 'safetyMembershipChanged'
  /** G/M. A confirmed emergency-access account is gone from the directory. */
  | 'emergencyTargetGone'
  /** I. The clock passes the inactivity boundary for the active person closest to it. */
  | 'proofAged'
  /** J. A person who could not prove a phishing-resistant method now can. */
  | 'strongerProof'
  /** K. A person who proved a passkey has only a generic MFA record this scan. */
  | 'weakerLaterEvidence'
  /** L. An ordinary person holds Global Administrator this scan. */
  | 'roleGained'
  /** L. An administrator no longer holds the role. */
  | 'roleLost'
  /** L. An active person's account is disabled. */
  | 'accountDisabled'
  /** N. The baseline's provenance moved; what it asks for did not. */
  | 'baselineProvenanceChanged'
  /** O. The prerequisite a step waited on is satisfied this scan. */
  | 'prerequisiteCleared'
  /** P. The prerequisite a step had is missing this scan. */
  | 'prerequisiteAppeared'

export const TRANSITION_KEYS: readonly TransitionKey[] = [
  'unchanged',
  'renamed',
  'rewritten',
  'policyRemoved',
  'policyReplaced',
  'newCandidateGroup',
  'decisionTargetGone',
  'coverageUnreadable',
  'safetyMembershipChanged',
  'emergencyTargetGone',
  'proofAged',
  'strongerProof',
  'weakerLaterEvidence',
  'roleGained',
  'roleLost',
  'accountDisabled',
  'baselineProvenanceChanged',
  'prerequisiteCleared',
  'prerequisiteAppeared',
]

// ---- reading a scan ----

type Row = Record<string, unknown>

const rowsOf = (f: Fixture): Row[] => (f.snapshot.config.caPolicies?.rows ?? []) as Row[]

function withRows(f: Fixture, rows: Row[]): Fixture {
  const config = { ...f.snapshot.config, caPolicies: { ...f.snapshot.config.caPolicies!, rows } }
  return { ...f, snapshot: { ...f.snapshot, config } as TenantSnapshot }
}

/**
 * The step this plan has deployed and is watching: in report-only, in no
 * trouble, and matched to a tenant policy this scan can name. It is the only
 * step whose history a second scan can move, so it is the subject of every
 * policy transition. Chosen by state; null where the tenant has none.
 */
export function watchedStep(run: FixtureRun): Step | null {
  return run.steps.find((s) => s.state.lifecycle === 'report-only' && s.state.condition === 'healthy' && typeof s.tracking?.policyId === 'string') ?? null
}

/** The active people this scan counts, as MFA Readiness rows. */
export const activePeople = (v: ReadinessView): ReadinessRow[] => v.rows.filter((r) => r.kind === 'person' && r.active)

/** Days between two instants, exactly as the scoring computes them. */
const daysBetween = (from: string, to: string): number => (Date.parse(to) - Date.parse(from)) / DAY

/**
 * The same tenant, `days` later. `asOf`, every source's own `asOf` and the
 * sign-in evidence window all move together; nothing about the tenant does. A
 * fact that ages does so because a production authority measures it against the
 * clock, which is the only honest way to cross a recency boundary in a test.
 */
export function advance(f: Fixture, days: number): Fixture {
  if (days === 0) return f
  const shift = (iso: string): string => new Date(Date.parse(iso) + days * DAY).toISOString()
  const s = f.snapshot
  const sources = Object.fromEntries(
    Object.entries(s.sources).map(([k, v]) => [k, { ...v, asOf: shift(v.asOf), coveredWindow: v.coveredWindow ? { from: shift(v.coveredWindow.from), to: shift(v.coveredWindow.to) } : null }]),
  ) as TenantSnapshot['sources']
  return { ...f, snapshot: { ...s, asOf: shift(s.asOf), sources } }
}

/** A directory reading of these groups, with `absent` recorded for the ones this scan proved gone. */
function directoryWithout(groups: GroupMembers, goneIds: readonly string[]): DirectoryEvidence {
  const base = directoryEvidenceFromGroups(groups, 'complete')
  const map = new Map<string, ObjectEvidence>(base.groups)
  for (const id of goneIds) map.set(id.toLowerCase(), { presence: 'absent', members: 'unknown', displayName: null, memberIds: [], memberCount: null })
  return { groups: map, universe: 'complete' }
}

/** The same tenant with one account gone from every table a scan reads it in. */
function withoutAccount(f: Fixture, id: string): Fixture {
  const authMethods = { ...f.snapshot.authMethods }
  delete authMethods[id]
  const signInEvidence = { ...f.snapshot.signInEvidence }
  delete signInEvidence[id]
  const active = { ...(f.snapshot.roles?.active ?? {}) }
  delete active[id]
  const groups: GroupMembers = new Map()
  for (const [gid, g] of f.groups) {
    const memberIds = g.memberIds.filter((m) => m !== id)
    groups.set(gid, { ...g, memberIds, memberCount: g.memberCount - (memberIds.length === g.memberIds.length ? 0 : 1) })
  }
  return {
    ...f,
    groups,
    snapshot: {
      ...f.snapshot,
      users: f.snapshot.users.filter((u) => u.id !== id),
      registrationDetails: f.snapshot.registrationDetails.filter((r) => r.id !== id),
      authMethods,
      signInEvidence,
      roles: { ...(f.snapshot.roles ?? { active: {}, eligible: {} }), active },
    },
  }
}

// ---- the builders ----

type Built = { fixture: Fixture; over?: Partial<RoadmapInput>; focus?: Partial<Focus>; days?: number }

type Builder = {
  key: TransitionKey
  label: string
  base: FixtureName
  /** Days between the scans; a builder may raise it from what scan A holds. */
  days: number
  /** Applied before scan A, where the transition is about a state clearing rather than appearing. */
  beforeA?: (f: Fixture) => Fixture
  /**
   * `f` is the tenant scan A was derived from — `beforeA` already applied, so a
   * builder edits what the first scan actually saw. `base` is the curated
   * fixture before `beforeA`, which is what a transition about a state CLEARING
   * needs: scan B is the tenant without whatever scan A was given.
   */
  build: (f: Fixture, a: Scan, base: Fixture) => Built | null
}

function scanOf(f: Fixture, prior: Record<string, StepObservationRecord> | null, over: Partial<RoadmapInput> = {}): Scan {
  const run = runFixture(f, over, prior)
  // The record this scan leaves is what `planData.ts` persists: this scan's
  // reading over what the record already held, never a replacement for it.
  return { fixture: f, run, steps: run.steps, readiness: readinessView(f.snapshot, f.snapshot.asOf, f.mapping), observations: observationsOf(run.steps, prior) }
}

/**
 * One more scan of the same plan, carrying the record the previous one left. A
 * transition is a pair because two scans are what most questions need; a
 * question about what a scan LOST needs a third, and this is how a test asks it
 * without building a second harness.
 */
export function rescan(prev: Scan, f: Fixture, over: Partial<RoadmapInput> = {}): Scan {
  return scanOf(f, prev.observations, over)
}

/**
 * The tenant every policy transition is built on: a plan mid-flight, with
 * policies deployed and being watched, an answered exclusions question and a
 * confirmed emergency-access set. A transition about a deployed policy needs a
 * deployed policy, and this is the curated tenant that has one.
 */
const DEPLOYED: FixtureName = 'demo-week2'
/** The tenant the person-level transitions are built on: small, and every person in it is scored. */
const PEOPLE: FixtureName = 'small'

/** A Global Administrator role id, as the fixtures' own role table writes it. */
const GLOBAL_ADMIN = '62e90394-69f5-4237-9190-012177145e10'

const BUILDERS: Builder[] = [
  {
    key: 'unchanged',
    label: 'the same tenant, scanned again the same minute',
    base: DEPLOYED,
    days: 0,
    build: (f) => ({ fixture: f }),
  },
  {
    key: 'renamed',
    label: 'every policy and every person relabelled; nothing means anything different',
    base: DEPLOYED,
    days: 1,
    build: (f, a) => {
      const step = watchedStep(a.run)
      if (!step) return null
      // A rename is the label and the stamp that goes with an edit, and nothing
      // else: the conditions, the grant and the session are what they were, so a
      // fingerprint that moves here is a fingerprint reading a cosmetic field
      // (observation.ts COSMETIC).
      const stamp = new Date(Date.parse(f.snapshot.asOf) + DAY).toISOString()
      const rows = rowsOf(f).map((r) => ({ ...r, displayName: `${String(r.displayName ?? '')} (relabelled)`, modifiedDateTime: stamp }))
      const renamed = withRows(f, rows)
      // The people are relabelled too — the display name and the local part of
      // the sign-in name. The domain is left alone: it is not a label, it is
      // what `bg.initialDomain` reads.
      const relabel = <T,>(upn: T): T | string => (typeof upn === 'string' ? upn.replace(/^[^@]+/, (local) => `relabelled-${local}`) : upn)
      const users = renamed.snapshot.users.map((u) => ({ ...u, displayName: `${u.displayName ?? ''} (relabelled)`, userPrincipalName: relabel(u.userPrincipalName) }))
      const registrationDetails = renamed.snapshot.registrationDetails.map((r) => ({ ...r, userPrincipalName: relabel(r.userPrincipalName) }))
      const groups: GroupMembers = new Map([...renamed.groups].map(([id, g]) => [id, { ...g, displayName: `${g.displayName ?? ''} (relabelled)` }]))
      return { fixture: { ...renamed, groups, snapshot: { ...renamed.snapshot, users, registrationDetails } }, focus: { policyId: step.tracking!.policyId } }
    },
  },
  {
    key: 'rewritten',
    label: 'somebody narrowed the watched policy to a block',
    base: DEPLOYED,
    days: 3,
    build: (f, a) => {
      const target = watchedStep(a.run)?.tracking?.policyId
      if (!target) return null
      const rows = rowsOf(f).map((r) => (r.id === target ? { ...structuredClone(r), grantControls: { operator: 'OR', builtInControls: ['block'] } } : r))
      return { fixture: withRows(f, rows), focus: { policyId: target } }
    },
  },
  {
    key: 'policyRemoved',
    label: 'the watched policy is gone from the tenant',
    base: DEPLOYED,
    days: 3,
    build: (f, a) => {
      const target = watchedStep(a.run)?.tracking?.policyId
      if (!target) return null
      return { fixture: withRows(f, rowsOf(f).filter((r) => r.id !== target)), focus: { policyId: target } }
    },
  },
  {
    key: 'policyReplaced',
    label: 'the watched policy deleted and recreated: same name, same body, new id',
    base: DEPLOYED,
    days: 3,
    build: (f, a) => {
      const target = watchedStep(a.run)?.tracking?.policyId
      if (!target) return null
      // The replacement is the same policy in every respect a fingerprint can
      // see. Only the immutable id is new, which is exactly the move a
      // fingerprint cannot see and `artifactIdOf` can.
      const replacement = `${target}-recreated`
      const stamp = new Date(Date.parse(f.snapshot.asOf) + DAY).toISOString()
      const rows = rowsOf(f).map((r) => (r.id === target ? { ...structuredClone(r), id: replacement, createdDateTime: stamp } : r))
      return { fixture: withRows(f, rows), focus: { policyId: replacement } }
    },
  },
  {
    key: 'newCandidateGroup',
    label: 'a new group appears that would serve the exclusions role',
    base: DEPLOYED,
    days: 1,
    build: (f) => {
      const chosen = exclusionsGroupIdToVerify(f.mapping)
      if (chosen === null) return null
      // A group holding exactly the emergency accounts and nothing else: the
      // shape the second candidate rule looks for, so this is a nomination the
      // detection really would make and not a decoy nothing would offer.
      const groups: GroupMembers = new Map(f.groups)
      const newId = `${chosen}-appeared`
      const members = [...f.mapping.breakGlassUserIds]
      groups.set(newId, { memberIds: members, memberCount: members.length, sampled: false, displayName: 'Emergency access exclusions' })
      return { fixture: { ...f, groups }, focus: { groupId: newId } }
    },
  },
  {
    key: 'decisionTargetGone',
    label: 'the confirmed exclusions group is proved gone by the directory',
    base: DEPLOYED,
    days: 1,
    build: (f) => {
      const chosen = exclusionsGroupIdToVerify(f.mapping)
      if (chosen === null) return null
      const groups: GroupMembers = new Map(f.groups)
      groups.delete(chosen)
      // The scan read the tenant's groups and Graph said this one is not there.
      // Absent, not unknown: the difference is the whole of Foundation C.
      return { fixture: { ...f, groups }, over: { directory: directoryWithout(groups, [chosen]) }, focus: { groupId: chosen } }
    },
  },
  {
    key: 'coverageUnreadable',
    label: 'one group read fails, so the goals whose policies name it cannot be assessed',
    base: DEPLOYED,
    days: 3,
    build: (f) => {
      const chosen = exclusionsGroupIdToVerify(f.mapping)
      if (chosen === null) return null
      // The group is simply not in what this scan loaded, and nothing says why:
      // `groupPresence` answers `unknown` rather than `absent`, which is a
      // request that failed and not an object proved gone. Every goal whose
      // deployed policies name the group then has an unresolved population, so
      // its coverage cannot be settled — and a goal with an unknown result keeps
      // its step and holds it until the group can be read (generate.ts; A2 of
      // the drift audit). This is the scan that sees less of the tenant than the
      // one before it.
      const groups: GroupMembers = new Map(f.groups)
      groups.delete(chosen)
      return { fixture: { ...f, groups }, focus: { groupId: chosen } }
    },
  },
  {
    key: 'safetyMembershipChanged',
    label: 'the confirmed exclusions group no longer holds the emergency accounts',
    base: DEPLOYED,
    days: 1,
    build: (f) => {
      const chosen = exclusionsGroupIdToVerify(f.mapping)
      const entry = chosen === null ? undefined : f.groups.get(chosen)
      if (chosen === null || !entry) return null
      const emergency = new Set(f.mapping.breakGlassUserIds)
      const memberIds = entry.memberIds.filter((id) => !emergency.has(id))
      if (memberIds.length === entry.memberIds.length) return null
      const groups: GroupMembers = new Map(f.groups)
      groups.set(chosen, { ...entry, memberIds, memberCount: memberIds.length })
      return { fixture: { ...f, groups }, focus: { groupId: chosen } }
    },
  },
  {
    key: 'emergencyTargetGone',
    label: 'a confirmed emergency-access account is gone from the directory',
    base: DEPLOYED,
    days: 1,
    build: (f) => {
      const gone = f.mapping.breakGlassUserIds[0]
      if (gone === undefined) return null
      return { fixture: withoutAccount(f, gone), focus: { userId: gone } }
    },
  },
  {
    key: 'proofAged',
    label: 'the clock passes the inactivity boundary for the active person closest to it',
    base: PEOPLE,
    days: 1,
    build: (f, a) => {
      // The active person the boundary reaches first: the largest number of days
      // since a sign-in that the scoring still calls active. Advancing just past
      // their boundary moves the fewest other people with them, so the case is
      // about one person aging rather than about a tenant going quiet.
      const rows = activePeople(a.readiness).filter((r) => typeof r.user.lastSuccessfulSignIn === 'string')
      let target: ReadinessRow | null = null
      let since = -1
      for (const r of rows) {
        const d = daysBetween(r.user.lastSuccessfulSignIn as string, a.fixture.snapshot.asOf)
        if (d > since) {
          since = d
          target = r
        }
      }
      if (!target) return null
      // `activity` is dormant strictly beyond INACTIVE_DAYS, so a whole extra
      // day past the remainder is the smallest advance that crosses it.
      const days = Math.max(1, Math.floor(INACTIVE_DAYS - since) + 1)
      return { fixture: f, days, focus: { userId: target.user.id } }
    },
  },
  {
    key: 'strongerProof',
    label: 'a person who could not prove a phishing-resistant method now can',
    base: PEOPLE,
    days: 1,
    build: (f, a) => {
      const target = activePeople(a.readiness).find((r) => r.state !== null && r.state !== 'ready' && r.state !== 'unknown')
      if (!target) return null
      const id = target.user.id
      const at = new Date(Date.parse(f.snapshot.asOf) + DAY).toISOString()
      const registrationDetails = f.snapshot.registrationDetails.map((r) =>
        r.id === id ? { ...r, isMfaCapable: true, isMfaRegistered: true, isPasswordlessCapable: true, methodsRegistered: [...new Set([...r.methodsRegistered, 'passKeyDeviceBound'])] } : r,
      )
      const existing = f.snapshot.authMethods[id]
      const authMethods = { ...f.snapshot.authMethods, [id]: [...(Array.isArray(existing) ? existing : []), { kind: 'passkey' as const }] }
      const evidence = f.snapshot.signInEvidence[id]
      // The passkey proven on every platform the person signs in from (Step 7): proof is per platform.
      const platforms = evidence?.platforms && evidence.platforms.length > 0 ? evidence.platforms.map((p) => ({ os: p.os, at })) : [{ os: 'Windows' as const, at }]
      const signInEvidence = {
        ...f.snapshot.signInEvidence,
        [id]: { ...(evidence ?? { signInCount: 1, lastSignIn: at }), lastSignIn: at, lastMfaSuccess: { at, method: 'Passkey (device-bound)' }, proofs: [...(evidence?.proofs ?? []), ...platforms.map((p) => ({ cls: 'passkey' as const, os: p.os, at, method: 'Passkey (device-bound)' }))], platforms },
      }
      const users = f.snapshot.users.map((u) => (u.id === id ? { ...u, lastSuccessfulSignIn: at } : u))
      return { fixture: { ...f, snapshot: { ...f.snapshot, users, registrationDetails, authMethods, signInEvidence } }, focus: { userId: id } }
    },
  },
  {
    key: 'weakerLaterEvidence',
    label: 'a person who proved a passkey has only a generic MFA record this scan',
    base: PEOPLE,
    days: 1,
    build: (f, a) => {
      const target = activePeople(a.readiness).find((r) => r.state === 'ready')
      if (!target) return null
      const id = target.user.id
      const at = new Date(Date.parse(f.snapshot.asOf) + DAY).toISOString()
      // The registration is untouched: the person still holds the passkey. What
      // has changed is that the newest record names no method — "multifactor
      // authentication happened" — which is evidence that MFA happened and never
      // proof of what it was done with (derive/ladder.ts).
      const evidence = f.snapshot.signInEvidence[id]
      if (!evidence) return null
      const signInEvidence = { ...f.snapshot.signInEvidence, [id]: { ...evidence, lastSignIn: at, lastMfaSuccess: { at, method: 'Multifactor authentication' } } }
      const users = f.snapshot.users.map((u) => (u.id === id ? { ...u, lastSuccessfulSignIn: at } : u))
      return { fixture: { ...f, snapshot: { ...f.snapshot, users, signInEvidence } }, focus: { userId: id } }
    },
  },
  {
    key: 'roleGained',
    label: 'an ordinary person holds Global Administrator this scan',
    base: PEOPLE,
    days: 1,
    build: (f, a) => {
      const target = activePeople(a.readiness).find((r) => !r.admin)
      if (!target) return null
      const roles = f.snapshot.roles ?? { active: {}, eligible: {} }
      return { fixture: { ...f, snapshot: { ...f.snapshot, roles: { ...roles, active: { ...roles.active, [target.user.id]: [GLOBAL_ADMIN] } } } }, focus: { userId: target.user.id } }
    },
  },
  {
    key: 'roleLost',
    label: 'an administrator no longer holds the role',
    base: PEOPLE,
    days: 1,
    build: (f, a) => {
      // An admin the plan does not treat as an emergency account: taking the
      // role off one of those is a different transition (`emergencyTargetGone`).
      const emergency = new Set(f.mapping.breakGlassUserIds)
      const target = activePeople(a.readiness).find((r) => r.admin && !emergency.has(r.user.id))
      if (!target) return null
      const roles = f.snapshot.roles ?? { active: {}, eligible: {} }
      const active = { ...roles.active }
      delete active[target.user.id]
      return { fixture: { ...f, snapshot: { ...f.snapshot, roles: { ...roles, active } } }, focus: { userId: target.user.id } }
    },
  },
  {
    key: 'accountDisabled',
    label: 'an active person’s account is disabled',
    base: PEOPLE,
    days: 1,
    build: (f, a) => {
      const emergency = new Set([...f.mapping.breakGlassUserIds, ...f.mapping.serviceAccountUserIds])
      const target = activePeople(a.readiness).find((r) => !emergency.has(r.user.id))
      if (!target) return null
      const users = f.snapshot.users.map((u) => (u.id === target.user.id ? { ...u, accountEnabled: false } : u))
      return { fixture: { ...f, snapshot: { ...f.snapshot, users } }, focus: { userId: target.user.id } }
    },
  },
  {
    key: 'baselineProvenanceChanged',
    label: 'the baseline’s provenance moved and what it asks for did not',
    base: DEPLOYED,
    days: 1,
    build: (f) => {
      // Where each policy came from, and who published it, both change; not one
      // condition, grant or session control does. The pinned artifacts on disk
      // are untouched — a scan never re-pins — so this is the whole of what a
      // provenance change is, and the plan may not move on it.
      const origins = Object.fromEntries(Object.keys(f.baseline.origins).map((k) => [k, `elsewhere/${k}`]))
      return { fixture: { ...f, baseline: { ...f.baseline, origins } }, over: { baselineAuthor: null }, focus: {} }
    },
  },
  {
    key: 'prerequisiteCleared',
    label: 'the custom authentication strength the plan waited on exists this scan',
    base: DEPLOYED,
    days: 1,
    beforeA: (f) => ({ ...f, snapshot: strengthMissing(f.snapshot) }),
    build: (_f, _a, base) => ({ fixture: base, focus: {} }),
  },
  {
    key: 'prerequisiteAppeared',
    label: 'the custom authentication strength the plan relied on is missing this scan',
    base: DEPLOYED,
    days: 1,
    build: (f) => ({ fixture: { ...f, snapshot: strengthMissing(f.snapshot) }, focus: {} }),
  },
]

// ---- the corpus ----

const scanACache = new Map<string, Scan>()

function scanA(b: Builder): Scan {
  const key = b.beforeA ? `${b.base}:${b.key}` : b.base
  const hit = scanACache.get(key)
  if (hit) return hit
  const built = scanOf(b.beforeA ? b.beforeA(curatedFixture(b.base)) : curatedFixture(b.base), null)
  scanACache.set(key, built)
  return built
}

function build(b: Builder): Transition | null {
  const a = scanA(b)
  const made = b.build(a.fixture, a, curatedFixture(b.base))
  if (!made) return null
  const days = made.days ?? b.days
  const fixture = advance(made.fixture, days)
  // Scan B is handed scan A's plan record and nothing else. That is the whole
  // of what one scan tells the next: `planData.ts` regenerates everything else.
  const bScan = scanOf(fixture, a.observations, made.over ?? {})
  const control = days === 0 ? a : scanOf(advance(a.fixture, days), a.observations)
  return { key: b.key, label: b.label, days, a, b: bScan, control, focus: { policyId: null, userId: null, groupId: null, ...(made.focus ?? {}) } }
}

let cached: Transition[] | null = null

/** Every transition the corpus can build, memoised: the derivations are the cost. */
export function transitions(): Transition[] {
  if (cached) return cached
  cached = BUILDERS.map(build).filter((t): t is Transition => t !== null)
  return cached
}

/** One transition by key; throws where the corpus could not build it, so a gap is never a skipped test. */
export function transition(key: TransitionKey): Transition {
  const hit = transitions().find((t) => t.key === key)
  if (!hit) throw new Error(`the corpus could not build the ${key} transition`)
  return hit
}

/** The step with this id in a scan; null where the scan has none. */
export function stepIn(scan: Scan, id: string): Step | null {
  return scan.steps.find((s) => s.id === id) ?? null
}

/** The readiness row for one account in a scan; null where the scan has none. */
export function rowIn(scan: Scan, id: string): ReadinessRow | null {
  return scan.readiness.rows.find((r) => r.user.id === id) ?? null
}

/** The administrators a scan reads from the directory's own role table (roles.ts). */
export function adminsIn(scan: Scan): Set<string> {
  return adminUserIds(scan.fixture.snapshot.roles ?? { active: {} })
}

/**
 * A step's variable context in one scan, as the Plan and Export both build it
 * (planData.ts / Export.tsx). The point of building it here is that a test
 * comparing what two scans say is handing both of them the same shape, so a
 * difference is a difference about the scan and never about the context.
 */
export function ctxFor(scan: Scan, step: Step): StepVarContext {
  return {
    snapshot: scan.fixture.snapshot,
    mapping: scan.fixture.mapping,
    nameOf: (id: string) => scan.run.input.names!.label(id),
    signature: 'IT',
    operatorId: scan.fixture.operatorId,
    now: scan.fixture.snapshot.asOf,
    groups: scan.fixture.groups,
    reportOnlyAt: scan.run.schedule.reportOnlyAt[step.id] ?? null,
  }
}
