// Runs the same engine wiring the Roadmap page uses over a fixture, so the
// property tests exercise exactly what a user would see.
import { computeCoverage } from '../../coverage/coverage.ts'
import { buildStrengthLookup } from '../../coverage/strength.ts'
import { buildQuestions } from '../../mapping/questions.ts'
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

export function runFixture(f: Fixture, over: Partial<RoadmapInput> = {}): FixtureRun {
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
    mapping: toCoverageMapping(f.mapping, questions),
    facetOverrides: f.mapping.facetOverrides,
  })
  const viability = buildViabilityInputs(snapshot, snapshot.asOf).map(scoreMfaViability)
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
