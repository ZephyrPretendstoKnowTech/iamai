// Prune B (3): a saved decision changes the plan, on the demo tenant. Saving
// two emergency accounts removes the create instructions; saving a group makes
// every policy step's exclusions line name it; and before any group exists the
// line names the group the exclusions step proposes, never an unnamed thing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { FixtureRun } from '../../roadmap/fixtures/run.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { Step } from '../../roadmap/types.ts'
import { applyStepDecisions, DECISION_STEPS } from '../../roadmap/decisions.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { shared } from '../../content/content.ts'
import { UNNAMED } from '../../names.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepPortalLines, stepPortalLinesFromBody, portalNamesFor } from './stepPortal.ts'

const AT = '2026-09-02T00:00:00.000Z'

/** The demo derived with a mapping of the test's choosing, as the plan does after a decision (no memo). */
function run(f: Fixture, mapping: MappingState): FixtureRun {
  return runFixture({ ...f, mapping }, { mapping })
}

function ctxFor(f: Fixture, r: FixtureRun, mapping: MappingState): StepVarContext {
  return { snapshot: f.snapshot, mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: null, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
}

/** Every policy step's portal lines, as the step and the exports render them. */
function policyPortals(f: Fixture, r: FixtureRun, mapping: MappingState): { step: Step; lines: string[] }[] {
  const ctx = ctxFor(f, r, mapping)
  const out: { step: Step; lines: string[] }[] = []
  for (const step of r.steps) {
    const cs = contentStepFor(step) as { kind?: string; title?: string } | undefined
    if (!cs || cs.kind !== 'policy') continue
    const ex = stepVars(step, ctx)
    const names = portalNamesFor(ctx, ex, String(cs.title))
    const lines = stepPortalLines(step.goalId, names) ?? (step.floor && step.action.json ? stepPortalLinesFromBody(step.action.json, names) : null)
    if (lines && lines.length > 0) out.push({ step, lines })
  }
  return out
}

/** The exclusions line's opening, up to the group's name (shared.exclusionsLine). */
const EXCLUSIONS_PREFIX = String(shared.exclusionsLine).split('{exclusionsGroup}')[0]

test('saving two emergency accounts removes the create instructions', () => {
  const f = fixture('demo')
  // One account held: the checks engine asks for a second, and the step shows
  // the create instructions with a picker of the accounts the signals nominate.
  const one: MappingState = { ...f.mapping, breakGlassUserIds: f.mapping.breakGlassUserIds.slice(0, 1) }
  const before = run(f, one)
  const step = before.steps.find((s) => DECISION_STEPS.emergency.has(s.id))
  assert.ok(step, 'one account: the emergency-access step is in the plan')
  const ex = stepVars(step, ctxFor(f, before, one))
  assert.equal(ex.needsCreate, true, 'one account: the create instructions show')
  const rows = ex.emergencyCandidates as string[]
  const ids = ex.emergencyCandidatesIds as string[]
  assert.equal(rows.length, ids.length)
  assert.ok(f.mapping.breakGlassUserIds.every((id) => ids.includes(id)), 'the picker nominates both accounts')
  assert.deepEqual(ex.emergencyCandidatesTicked, one.breakGlassUserIds, 'the one the plan holds starts ticked')
  for (const row of rows) assert.doesNotMatch(row, /[0-9a-f]{8}-[0-9a-f]{4}/i, 'a row is names, never an id')

  // Save both: the decision is the plan's, and the next derivation has no
  // second-account check and no create instructions.
  const decided = applyStepDecisions(one, { [step.id]: { picked: f.mapping.breakGlassUserIds, at: AT } })
  assert.deepEqual(decided.breakGlassUserIds, f.mapping.breakGlassUserIds)
  assert.equal(decided.wizardAnswered.breakGlass, true)
  assert.equal(one.breakGlassUserIds.length, 1, 'the mapping passed in is not mutated')
  const after = run(f, decided)
  const stepAfter = after.steps.find((s) => DECISION_STEPS.emergency.has(s.id))
  assert.ok(!stepAfter || stepVars(stepAfter, ctxFor(f, after, decided)).needsCreate !== true, 'two accounts: the create instructions are gone')
  assert.ok(!stepAfter || !stepAfter.checks?.items.some((it) => it.fix === 'second-account'), 'two accounts: no second-account check')
})

test('saving a group names it on every policy step; before that, the proposed group is named, never an unnamed thing', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  // The demo starts without an exclusions group: the line names the group the
  // exclusions step proposes, in the tenant's convention.
  const exclusionsStep = r.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))
  assert.ok(exclusionsStep?.naming?.proposed, 'the exclusions step carries the proposed name')
  const proposed = exclusionsStep.naming!.proposed
  const before = policyPortals(f, r, f.mapping)
  assert.ok(before.length >= 10, 'the demo has policy steps with portal lines')
  for (const { step, lines } of before) {
    const exclusions = lines.filter((l) => l.includes(EXCLUSIONS_PREFIX))
    assert.ok(exclusions.length > 0, `${step.id}: has an exclusions line`)
    for (const l of exclusions) assert.ok(l.includes(`${EXCLUSIONS_PREFIX}${proposed}.`), `${step.id}: names the proposed group: ${l}`)
    for (const l of lines) assert.ok(!l.includes(UNNAMED), `${step.id}: no unnamed thing: ${l}`)
  }
  // The exclusions step's picker lists the tenant's groups, with member counts and how many policies exclude each.
  const ex = stepVars(exclusionsStep, ctxFor(f, r, f.mapping))
  const rows = ex.groups as string[]
  assert.ok(rows.some((row) => row.startsWith('Core - Exclusions')), 'the tenant group is a row')
  assert.ok(rows.every((row) => /\d+ members? .* \d+ of \d+ polic/.test(row)), `rows carry counts: ${rows.join(' | ')}`)

  // Save the tenant's group: every exclusions line names it, on the next derivation.
  const gid = [...f.groups.entries()].find(([, g]) => g.displayName === 'Core - Exclusions')![0]
  const decided = applyStepDecisions(f.mapping, { [exclusionsStep.id]: { picked: [gid], at: AT } })
  assert.equal(decided.records['__globalExclusion'].resolvedId, gid)
  assert.equal(decided.records['__globalExclusion'].doesNotExist, false)
  const r2 = run(f, decided)
  const after = policyPortals(f, r2, decided)
  assert.equal(after.length, before.length, 'the same policy steps')
  for (const { step, lines } of after) {
    const exclusions = lines.filter((l) => l.includes(EXCLUSIONS_PREFIX))
    assert.ok(exclusions.length > 0, `${step.id}: has an exclusions line`)
    for (const l of exclusions) assert.ok(l.includes(`${EXCLUSIONS_PREFIX}Core - Exclusions.`), `${step.id}: names the saved group: ${l}`)
    for (const l of lines) assert.ok(!l.includes(UNNAMED), `${step.id}: no unnamed thing: ${l}`)
  }
  // The picker on whichever exclusions step remains (correct the group) starts on the saved group.
  const remaining = r2.steps.find((s) => DECISION_STEPS.exclusions.has(s.id))
  if (remaining) assert.deepEqual(stepVars(remaining, ctxFor(f, r2, decided)).groupsTicked, [gid])
})
