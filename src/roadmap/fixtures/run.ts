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
  /** Engine time in milliseconds, from coverage to annotated steps. */
  ms: number
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
    ...over,
  }
  const result = generateRoadmap(input)
  annotateStateReasons(result.steps)
  applyProgress(result.steps, snapshot, coverage, f.planId)
  return { ...result, input, coverage, viability, ms: performance.now() - t0 }
}
