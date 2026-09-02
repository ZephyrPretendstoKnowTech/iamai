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
import { buildQuestions } from '../../mapping/questions.ts'
import { activeWizardQuestions } from '../../mapping/wizard.ts'
import { toCoverageMapping } from '../../mapping/store.ts'
import { buildViabilityInputs } from '../../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../../scoring/mfaViability.ts'
import { buildNameDirectory } from '../../names.ts'
import { generateRoadmap } from '../generate.ts'
import { annotateStateReasons } from '../stateReason.ts'
import { applyProgress } from '../progress.ts'
import type { Fixture } from './index.ts'
import type { RoadmapInput } from '../generate.ts'

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
  return [f.planId, f.planCreatedAt, f.operatorId, JSON.stringify(f.mapping), JSON.stringify([...f.groups]), JSON.stringify(f.baseline), JSON.stringify(f.snapshot)].join('\u0000')
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
  const questions = buildQuestions(f.baseline)
  const coverage = computeCoverage({
    snapshot,
    tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
    baselinePolicies: f.baseline.policies,
    baselineUnusable: f.baseline.report.warnings,
    strengths,
    groupMembers: f.groups,
    mapping: toCoverageMapping(f.mapping, questions, activeWizardQuestions(f.baseline, { snapshot, state: f.mapping })),
    facetOverrides: f.mapping.facetOverrides,
    goalMap: over.goalMap,
  })
  // Confirmed service accounts are counted nowhere (target-state §8.1): they
  // leave the viability rows here, exactly as sets.activeUsers leaves them out.
  const viability = buildViabilityInputs(snapshot, snapshot.asOf, new Set(f.mapping.serviceAccountUserIds)).map(scoreMfaViability)
  const names = buildNameDirectory(snapshot, f.groups)
  const input: RoadmapInput = {
    planId: f.planId,
    coverage,
    snapshot,
    baseline: f.baseline,
    baselineAuthor: { author: 'Fixture author', url: 'https://example.test/baseline' },
    mapping: f.mapping,
    questions,
    viability,
    strengths,
    startDate: '2026-08-31',
    operatorUserId: f.operatorId,
    names,
    groupMembers: f.groups,
    ...over,
  }
  const t1 = performance.now()
  const result = generateRoadmap(input)
  applyProgress(result.steps, snapshot, coverage, f.planId, undefined, f.planCreatedAt)
  // State reasons read the tracking (the real enforcement date), so they come last.
  annotateStateReasons(result.steps)
  const end = performance.now()
  return { ...result, input, coverage, viability, ms: end - t0, roadmapMs: end - t1 }
}
