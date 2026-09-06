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
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../mapping/safetyChoice.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { notPeopleIds } from '../../derive/sets.ts'
import { activePeopleIds } from '../../derive/population.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import { buildNameDirectory } from '../../names.ts'
import { generateRoadmap } from '../generate.ts'
import { annotateStateReasons } from '../stateReason.ts'
import { applyProgress } from '../progress.ts'
import { cleanupRecord } from '../cleanupDone.ts'
import type { Fixture } from './index.ts'
import type { RoadmapInput } from '../generate.ts'
import type { MfaViability } from '../../scoring/mfaViability.ts'

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

export function runFixture(f: Fixture, over: Partial<RoadmapInput> = {}): FixtureRun {
  if (Object.keys(over).length > 0) return derive(f, over)
  const key = keyOf(f)
  let hit = memo.get(f.name)
  if (!hit || hit.key !== key) {
    hit = { key, run: derive(f, over) }
    memo.set(f.name, hit)
  }
  const { steps, schedule, housekeeping } = structuredClone({ steps: hit.run.steps, schedule: hit.run.schedule, housekeeping: hit.run.housekeeping })
  return { ...hit.run, steps, schedule, housekeeping }
}

function derive(f: Fixture, over: Partial<RoadmapInput>): FixtureRun {
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
    mapping: toCoverageMapping(f.mapping, snapshot, exclusionsGroupId),
    facetOverrides: f.mapping.facetOverrides,
    goalMap: over.goalMap,
  })
  // Confirmed service accounts are counted nowhere (target-state §8.1): they
  // leave the viability rows here, exactly as sets.activeUsers leaves them out.
  const viability = buildViabilityInputs(snapshot, snapshot.asOf, notPeopleIds(f.mapping)).map(scoreMfaViability)
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
  applyProgress(result.steps, snapshot, coverage, f.planId, undefined, f.planCreatedAt, null, {
    groupMembers: Object.fromEntries([...f.groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), g.memberIds])),
    activePeople: activePeopleIds(snapshot, snapshot.asOf, notPeopleIds(f.mapping)),
  })
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
  return viability.map((v) => (v.isAdmin ? { ...v, kinds: [...new Set([...v.kinds, 'passkey' as const])], evidence: { at, method: 'Passkey' } } : v))
}
