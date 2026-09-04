// One naming rule for the objects the plan proposes (proposedNames.ts): the
// prerequisite step that creates the group or the location and every portal
// line that names it read the same name, from the plan's own steps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { proposedObjectNames } from '../../coverage/naming.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'
import { planProposedNames } from './proposedNames.ts'

const f = fixture('demo')
const r = runFixture(f)
const base = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
const withPlan: StepVarContext = { ...base, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
const prereq = (id: string) => r.steps.find((s) => s.id === id)!
/** Every portal line of every policy step on the plan, with the step. */
const portal = (ctx: StepVarContext): { step: string; line: string }[] =>
  r.steps.filter((s) => (contentStepFor(s) as { kind?: string } | undefined)?.kind === 'policy').flatMap((s) => {
    const ex = stepVars(s, ctx) as Record<string, unknown>
    return (stepPortalLines(s, portalNamesFor(ctx, ex, s.title)) ?? []).map((line) => ({ step: s.id, line }))
  })

test('the exclusions-group step names the plan\'s proposal, and the policy steps wait for the group rather than naming a proposal', () => {
  assert.equal(f.mapping.records['__globalExclusion']?.resolvedId ?? null, null, 'the demo recognises no exclusions group, so the plan proposes one')
  const step = prereq(PREREQ_STEP_ID.exclusionsGroup)
  const proposed = String(step.naming?.proposed)
  assert.ok(proposed.length > 0)
  assert.equal((stepVars(step, withPlan) as Record<string, unknown>).proposedName, proposed, 'the prerequisite step names the plan\'s proposal')
  assert.equal(withPlan.proposed?.exclusionsGroup, proposed)
  // No policy step offers instructions while the group does not exist, so no
  // portal line names an object the tenant does not have (resolvePolicy.ts).
  assert.deepEqual(portal(withPlan), [], 'the policy steps wait on the exclusions-group step')
})

test('with the group saved, every portal exclusions line names the tenant\'s own group', () => {
  const f2 = fixture('demo-week2')
  const r2 = runFixture(f2)
  const ctx2: StepVarContext = { snapshot: f2.snapshot, mapping: f2.mapping, nameOf: (id: string) => r2.input.names!.label(id), signature: 'IT', operatorId: f2.operatorId, now: f2.snapshot.asOf, groups: f2.groups, naming: r2.coverage.organisation.naming, ...planDates(r2.steps, r2.schedule.start, r2.coverage.organisation.naming) }
  const lines = r2.steps
    .filter((s) => (contentStepFor(s) as { kind?: string } | undefined)?.kind === 'policy')
    .flatMap((s) => (stepPortalLines(s, portalNamesFor(ctx2, stepVars(s, ctx2) as Record<string, unknown>, s.title)) ?? []).map((line) => ({ step: s.id, line })))
    .filter((l) => /Exclude → Groups:/.test(l.line))
  assert.ok(lines.length > 0, 'policy steps carry an exclusions line')
  for (const l of lines) assert.ok(l.line.includes('Exclude → Groups: Core - Exclusions'), `${l.step} names the tenant's group: ${l.line}`)
})

test('the trusted-network step and the portal names name the same proposed location', () => {
  const step = prereq(PREREQ_STEP_ID.trustedLocation)
  const proposed = String(step.naming?.proposed)
  assert.equal((stepVars(step, withPlan) as Record<string, unknown>).proposedName, proposed)
  const names = portalNamesFor(withPlan, stepVars(step, withPlan) as Record<string, unknown>, step.title)
  assert.equal(names.proposed?.trustedLocation, proposed)
  assert.equal(names.proposed?.exclusionsGroup, prereq(PREREQ_STEP_ID.exclusionsGroup).naming?.proposed)
})

test('the names come from the plan, not from the context\'s convention: a context without the convention names the same group', () => {
  const noConvention: StepVarContext = { ...base, ...planDates(r.steps, r.schedule.start) }
  const proposed = String(prereq(PREREQ_STEP_ID.exclusionsGroup).naming?.proposed)
  for (const l of portal(noConvention).filter((l) => /Exclude → Groups:/.test(l.line))) assert.ok(l.line.includes(`Exclude → Groups: ${proposed}`), `${l.step}: ${l.line}`)
  // Without the plan's steps, the engine's own proposal for the convention stands in, on both sides.
  const bare = planProposedNames([], null)
  assert.equal(bare.exclusionsGroup, proposedObjectNames(null).exclusionsGroup.name)
  assert.equal(portalNamesFor(base, {}, 'x').proposed?.exclusionsGroup, bare.exclusionsGroup)
})
