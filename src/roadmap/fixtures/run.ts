// Runs the same engine wiring the Roadmap page uses over a fixture, so the
// property tests exercise exactly what a user would see.
//
// Each fixture's derivation is memoised per process (prune A): the test files
// share one process (--test-isolation=none) and most of them derive every
// fixture, so after the first file a derivation is a lookup. The key is the
// fixture's content, never its identity, so a test that edits a mapping or a
// snapshot in place and derives again gets a fresh derivation; and every call
// returns its own copy of the steps, schedule and housekeeping, so a skip
// applied to one derivation never reaches another. A call with overrides is
// derived afresh and not memoised.
import { computeCoverage } from '../../coverage/coverage.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import { toCoverageMapping } from '../../mapping/store.ts'
import { EXCLUSIONS_RECORD_KEY, actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../mapping/safetyChoice.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { notPeopleIds } from '../../derive/sets.ts'
import { activePeopleIds } from '../../derive/population.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import { buildNameDirectory } from '../../names.ts'
import { generateRoadmap } from '../generate.ts'
import { annotateStateReasons } from '../stateReason.ts'
import { applyProgress } from '../progress.ts'
import { settleForecast } from '../forecast.ts'
import { cleanupRecord } from '../cleanupDone.ts'
import { applyStepDecisions } from '../decisions.ts'
import { DIRECTION_STEP, directionDecisionOf } from '../directionAnswers.ts'
import { observedRecoveryRecords, recoveryCandidate, withPreparedPasskeys } from './recoveryRecords.ts'
import { recoveryAccountBasis } from '../cleanupDone.ts'
import { recoveryPasskeyCandidateSet } from '../passkeyCompatibility.ts'
import type { DirectionStepId } from '../directionAnswers.ts'
import type { Fixture } from './index.ts'
import type { RoadmapInput } from '../generate.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'
import type { StepObservationRecord } from '../observation.ts'

export type FixtureRun = ReturnType<typeof generateRoadmap> & {
  input: RoadmapInput
  coverage: RoadmapInput['coverage']
  viability: RoadmapInput['viability']
  /** Whole engine time in milliseconds, coverage included. */
  ms: number
  /** The roadmap engine alone (generate, state reasons, progress): what a re-plan costs. */
  roadmapMs: number
}

const memo = new Map<string, { key: string; run: FixtureRun }>()

/** Everything the derivation reads, serialised: a fixture edited in place gets a new key. */
function keyOf(f: Fixture): string {
  return [f.planId, f.planCreatedAt, f.operatorId, JSON.stringify(f.mapping), JSON.stringify([...f.groups]), JSON.stringify(f.baseline), JSON.stringify(f.snapshot), JSON.stringify(f.checkpoints ?? [])].join('\u0000')
}

/**
 * The fixture's plan run. `observations` is what a *previous* scan of this same
 * tenant recorded (roadmap/observation.ts), exactly as the plan record carries
 * it: passing it makes this call the second scan of a sequence rather than a
 * first sighting, and it runs through the one `applyProgress` the app runs. A
 * run given one is never memoised — the record is part of what it derives from.
 * `now` is the clock the tracking stamps its history with (tracking.ts
 * trackExecution); a caller that needs a run that never moves with the run date
 * (the per-step snapshots, A3) passes the fixture's own time, and such a run is
 * not memoised either.
 */
export function runFixture(f: Fixture, over: Partial<RoadmapInput> = {}, observations: Record<string, StepObservationRecord> | null = null, now: string | null = null): FixtureRun {
  if (Object.keys(over).length > 0 || observations !== null || now !== null) return derive(f, over, observations, now)
  const key = keyOf(f)
  let hit = memo.get(f.name)
  if (!hit || hit.key !== key) {
    hit = { key, run: derive(f, over, null, null) }
    memo.set(f.name, hit)
  }
  const { steps, schedule, housekeeping } = structuredClone({ steps: hit.run.steps, schedule: hit.run.schedule, housekeeping: hit.run.housekeeping })
  return { ...hit.run, steps, schedule, housekeeping }
}

function derive(f: Fixture, over: Partial<RoadmapInput>, observations: Record<string, StepObservationRecord> | null, now: string | null): FixtureRun {
  const t0 = performance.now()
  const { snapshot } = f
  const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
  // What the fixture's scan read of each group. A fixture holds the groups its
  // scan loaded, so those are present with the membership it holds; a group it
  // does not hold is one nothing read, which is unknown and not absent
  // (mapping/safetyChoice.ts). A fixture that wants an object proved gone says
  // so by passing its own `directory`.
  // A fixture's `groups` is its tenant's whole group list, so this is the one
  // caller that may claim a complete candidate universe (mapping/safetyChoice.ts
  // CandidateUniverse). The app's own reading is the groups somebody asked for
  // and stays partial.
  const directory = over.directory ?? directoryEvidenceFromGroups(f.groups, 'complete')
  const exclusionsGroupId = actionableExclusionsGroupId({ snapshot, mapping: f.mapping, groups: f.groups, directory })
  const coverage = computeCoverage({
    snapshot,
    tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
    baselinePolicies: f.baseline.policies,
    baselineUnusable: f.baseline.report.warnings,
    strengths,
    groupMembers: f.groups,
    mapping: toCoverageMapping(f.mapping, exclusionsGroupId),
    facetOverrides: f.mapping.facetOverrides,
    goalMap: over.goalMap,
  })
  // Confirmed service accounts are counted nowhere (target-state §8.1): they
  // leave the viability rows here, exactly as population.ts activePeopleIds leaves them out.
  const viability = buildViabilityInputs(snapshot, snapshot.asOf, notPeopleIds(f.mapping), f.mapping).map(scoreMfaViability)
  const names = buildNameDirectory(snapshot, f.groups)
  const input: RoadmapInput = {
    planId: f.planId,
    coverage,
    snapshot,
    baseline: f.baseline,
    baselineAuthor: { author: 'Fixture author', url: 'https://example.test/baseline' },
    mapping: f.mapping,
    viability,
    strengths,
    startDate: '2026-08-31',
    operatorUserId: f.operatorId,
    names,
    groupMembers: f.groups,
    directory,
    // What the fixture's technician recorded on Cleanup (E3), as the app reads it from the plan record.
    cleanupRecord: cleanupRecord(f.checkpoints ?? []),
    ...over,
  }
  const t1 = performance.now()
  const result = generateRoadmap(input)
  applyProgress(result.steps, snapshot, coverage, f.planId, now ?? undefined, f.planCreatedAt, observations, {
    groupMembers: Object.fromEntries([...f.groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), g.memberIds])),
    activePeople: activePeopleIds(snapshot, snapshot.asOf, notPeopleIds(f.mapping)),
  })
  // Tracking has settled every lifecycle, so the schedule's own forecast can be
  // taken off the steps it was never earned for: an enforcement wave and an
  // enforce event were placed on every step before the scan found which policies
  // already exist (roadmap/forecast.ts settleForecast).
  settleForecast(result.steps, result.schedule)
  // State reasons read the tracking (the real enforcement date), so they come last.
  annotateStateReasons(result.steps)
  const end = performance.now()
  return { ...result, input, coverage, viability, ms: end - t0, roadmapMs: end - t1 }
}

/**
 * The same tenant with its admins already at the rung the admins policy asks
 * for. The plan holds every enforcement behind the readiness threshold it names
 * (roadmap/operations.ts readinessGate), so a case about *what an update
 * submits* has to meet that prerequisite first or it is testing the hold
 * instead. Rung 5 is a portable phishing-resistant method the records prove
 * (derive/ladder.ts rungOf).
 */
export function adminsAtRung5(viability: MfaViability[], at: string): MfaViability[] {
  // Step 7: an admin is ready when Ready (scoring/phishingResistant.ts) — a passkey held and proven on the platform they use.
  return viability.map((v) =>
    v.isAdmin
      ? {
          ...v,
          kinds: [...new Set([...v.kinds, 'passkey' as const])],
          evidence: { at, method: 'Passkey' },
          readiness: { ...v.readiness, state: 'ready', unknown: null, blocked: null, methods: [...new Set([...(v.readiness.methods ?? []), 'passkey' as const])], qualifying: ['passkey'], hasPasskey: true, onLeave: false, lastConfirmed: { cls: 'passkey', os: 'Windows', at, retained: false }, lost: [], next: { kind: 'none' }, recommended: null },
        }
      : v,
  )
}

/**
 * The same tenant with Decide Your Tenant's Direction approved as the plan
 * suggests it (roadmap/direction.ts): every question of each named step at its
 * saved answer, else its suggestion, saved as Approve answers saves it. A case
 * about what a policy does once nothing is waiting on a person's direction
 * starts here, or it is testing the wait instead. All four steps by default.
 */
export function withDirectionApproved(f: Fixture, ids: readonly DirectionStepId[] = Object.values(DIRECTION_STEP)): Fixture {
  const steps = runFixture(f).steps
  const decisions = Object.fromEntries(ids.map((id) => {
    const questions = steps.find((s) => s.id === id)?.directionQuestions ?? []
    const answers = Object.fromEntries(questions.map((q) => [q.key, q.saved ?? q.suggested]))
    const basis = Object.fromEntries(questions.filter((q) => q.basis !== null).map((q) => [q.key, q.basis!]))
    return [id, { ...directionDecisionOf(answers, basis), at: f.snapshot.asOf }]
  }))
  return { ...f, mapping: applyStepDecisions(f.mapping, decisions) }
}

/**
 * The same tenant with the plan's foundation settled (roadmap/foundations.ts):
 * Establish Emergency Access complete — an approved recovery passkey on each
 * emergency account, a recovery sign-in this scan can see, and the two answers
 * that step asks — and every Decide Your Tenant's Direction answer approved.
 *
 * Until both pinned groups are settled no policy step is Ready and none is
 * dated, so a case about what a policy does, when it is dated or what it hands
 * over starts here, or it is testing the gate instead. It is the completion the
 * demo-week2 fixture builds into its own snapshot, over any fixture.
 */
export function withFoundationSettled(f: Fixture): Fixture {
  return withDirectionApproved(withEmergencyAccessSettled(f))
}

/**
 * Half of it: Establish Emergency Access complete, with Decide Your Tenant's
 * Direction left exactly as it was. A case about an unsaved Direction answer
 * starts here — approving them all would answer the question it is asking.
 */
/**
 * The emergency-access recovery test recorded as passed on the tenant as it now
 * stands: each emergency account's own observed passkey sign-in, after the
 * configuration it covers was read — the record the fixtures build for the demo's
 * week two (fixtures/index.ts), rebuilt on this snapshot.
 *
 * For a case whose premise is that nothing holds a policy's enforcement. The
 * recovery test is one of the plan's own prerequisites of turning a policy on
 * (roadmap/enforceWaits.ts), and settling the foundation changes the very
 * configuration a recorded test covered, so the record a fixture carried stops
 * counting — correctly: a test of a different configuration is not this one.
 * Every emergency account needs a recovery sign-in on the scan
 * (`withEmergencyAccessSettled` gives each one); without one this changes nothing.
 */
export function withRecoveryTested(f: Fixture): Fixture {
  const ids = f.mapping.breakGlassUserIds
  const events = Object.fromEntries(ids.flatMap((id) => { const e = f.snapshot.signInEvidence[id]?.recoveryCandidates?.[0]; return e ? [[id, e]] : [] }))
  if (ids.length === 0 || Object.keys(events).length !== ids.length) return f
  const earliest = Math.min(...Object.values(events).map((e) => Date.parse(e.at)))
  const configurationObservedAt = new Date(earliest - 3_600_000).toISOString()
  const accountBasis = recoveryAccountBasis(f.snapshot, ids, f.mapping, f.groups)
  const candidateSetBasis = Object.fromEntries(ids.map((id) => { const set = recoveryPasskeyCandidateSet(f.snapshot, id, f.mapping, f.groups); return [id, set.state === 'complete' ? JSON.stringify([...set.ids].sort()) : ''] }))
  const tested = observedRecoveryRecords({ tenantId: f.snapshot.tenantId, events, configurationObservedAt, at: f.snapshot.asOf, accountBasis, candidateSetBasis })
  return { ...f, checkpoints: [...(f.checkpoints ?? []).filter((c) => (c as { cleanup?: string }).cleanup !== 'drill'), ...tested] }
}

export function withEmergencyAccessSettled(f: Fixture): Fixture {
  const snapshot = structuredClone(f.snapshot)
  const ids = f.mapping.breakGlassUserIds
  withPreparedPasskeys(snapshot, ids)
  // And the tenant's own policies carving out the group its technician chose,
  // wherever they carve out another one (the inverse of withBreakGlassCarveOut):
  // a chosen group the policies do not use leaves Configure Emergency Exclusions
  // with a correction to make, which is a member of the group and holds it.
  const chosen = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string } | undefined)?.resolvedId ?? null
  const emergencyGroups = new Set([...f.groups].filter(([id, g]) => id.toLowerCase() !== chosen?.toLowerCase() && g.memberIds.length > 0 && g.memberIds.every((m) => ids.includes(m))).map(([id]) => id.toLowerCase()))
  if (chosen !== null) {
    for (const raw of snapshot.config.caPolicies?.rows ?? []) {
      const users = (raw as { conditions?: { users?: { excludeGroups?: string[]; excludeUsers?: string[] } } }).conditions?.users
      if (!users) continue
      if (users.excludeGroups) users.excludeGroups = [...new Set(users.excludeGroups.map((g) => (emergencyGroups.has(g.toLowerCase()) ? chosen : g)))]
      // An emergency account carved out by name is the shape the exclusions
      // group replaces (CLAUDE.md: exclusions go through the group, never an
      // account by name), so the group takes its place.
      if (users.excludeUsers?.some((u) => ids.some((id) => id.toLowerCase() === u.toLowerCase()))) {
        users.excludeUsers = users.excludeUsers.filter((u) => !ids.some((id) => id.toLowerCase() === u.toLowerCase()))
        users.excludeGroups = [...new Set([...(users.excludeGroups ?? []), chosen])]
      }
    }
  }
  for (const [index, id] of ids.entries()) {
    const at = snapshot.users.find((u) => u.id === id)?.lastSuccessfulSignIn ?? snapshot.asOf
    const held = snapshot.signInEvidence[id] ?? { signInCount: 1, lastSignIn: at, lastMfaSuccess: { at, method: 'Passkey (FIDO2)' } }
    snapshot.signInEvidence[id] = { ...held, recoveryCandidates: [{ ...recoveryCandidate(id, at, snapshot.tenantId, `settled-recovery-${index + 1}`), credentialId: `demo-emergency-passkey-${index + 1}` }] }
  }
  const mapping = { ...f.mapping, breakGlassAnswers: { ...f.mapping.breakGlassAnswers, credentialStorage: true, signInMonitoring: true } }
  return { ...f, snapshot, mapping }
}
