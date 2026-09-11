// Partial, generically (correction batch 1): a mapped policy whose material
// fields differ from the plan is corrected by the modules those fields select,
// in every policy package that authors a correction — not only the pilot's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { CHANGED_FIELDS_BINDING, mismatchBindingOf } from './protocol.ts'
import { projectSafely } from './project.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { correctionFieldsOf, implementationPackageFor, packageBindings, packageRuntime, packageStateOf, plannedPackageStateOf, planningPreview } from '../../ui/surfaces/stepPackage.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

function plan(name: FixtureName) {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { f, r, ctx }
}

test('every policy package that authors a correction registers it, and every module it keeps is one IAMAI can select', () => {
  const partials = Object.values(PACKAGES).filter((p) => p.meta.projection.partial)
  assert.ok(partials.length >= 21, `only ${partials.length} Partial projections are registered`)
  for (const p of partials) {
    const table = (p.meta.projection.partial as { mismatches: Record<string, { facts?: unknown; select?: unknown }> }).mismatches
    for (const [id, m] of Object.entries(table)) assert.ok(m.facts !== undefined || m.select !== undefined, `${p.meta.stepId}: ${id} cannot be selected`)
  }
})

test('the workload identity Partial names its one mismatch binding and composes the policy corrections its facts select', () => {
  const pkg = PACKAGES['s-goal-workload-identity-block']
  const partial = pkg.meta.projection.partial as Record<string, unknown> | undefined
  assert.ok(partial, 'the Partial projection was withheld at compile time')
  assert.equal(mismatchBindingOf(partial), 'policy.current.semanticMismatches')
  const bindings = {
    'policy.current.id': 'policy-1',
    'policy.current.state': 'enabledForReportingButNotEnforced',
    [CHANGED_FIELDS_BINDING]: ['conditions.locations'],
    'workload.cloudSync.servicePrincipalId': 'sp-1',
    'location.syncServer.id': 'location-1',
    'location.syncServer.ipRanges': ['203.0.113.10/32'],
    'location.syncServer.displayName': 'Sync server',
    'policy.target.displayName': 'Workload block',
    'tenant.displayName': 'Tenant',
  }
  const prerequisites = ((pkg.meta as { prerequisites?: { id: string }[] }).prerequisites ?? []).map((p) => p.id)
  const p = projectSafely(pkg, 'partial', bindings, { satisfied: new Set(prerequisites), baselineCommit: null })
  assert.deepEqual(p.hold?.invalid ?? [], [], JSON.stringify(p.hold))
  assert.deepEqual(p.hold?.unknownMismatches ?? [], [])
  const blocks = p.channels.flatMap((c) => c.blocks)
  assert.ok(blocks.includes('entra.correct.policy.location-boundary'), `the selected correction is not composed: ${JSON.stringify(p.hold)} ${blocks.join(', ')}`)
  assert.equal(blocks.some((b) => /location\.ip-ranges|json\.correct\.location$/.test(b)), false, 'a named-location correction no fact selects was composed')
})

test('an enforced policy whose exclusions differ from the plan plans the conditions correction, and only that', () => {
  const { f, r, ctx } = plan('demo')
  const step = r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  const c = stepContract(step, ctx)
  assert.deepEqual(correctionFieldsOf(step, f.snapshot), ['conditions.users.excludeGroups'])
  assert.equal(plannedPackageStateOf(step, c, f.snapshot), 'partial')
  const pkg = implementationPackageFor(step)!
  const state = packageStateOf(step, c, f.snapshot)!
  const bindings = packageBindings(step, ctx, c)
  const { runtime } = packageRuntime(pkg, state, bindings, {})
  const preview = planningPreview(pkg, step, c, f.snapshot, bindings, runtime, projectSafely(pkg, state, bindings, runtime))
  assert.ok(preview?.preview, 'the held correction shows no planned work')
  assert.equal(preview.state, 'partial')
  assert.deepEqual(preview.channels.find((x) => x.channel === 'json')?.blocks, ['json.correct-conditions'], 'a correction the changed fields do not ask for was composed')
  assert.equal(preview.channels.some((x) => x.blocks.some((b) => /grant|session|name/.test(b))), false)
})

test('Partial is never the state of a source conflict, a question for a person, or a step that implements nothing', () => {
  let checked = 0
  for (const name of ['demo', 'demo-week2', 'small', 'getiamai'] as const) {
    const { f, r, ctx } = plan(name)
    for (const step of r.steps) {
      if (!implementationPackageFor(step)) continue
      const c = stepContract(step, ctx)
      const now = packageStateOf(step, c, f.snapshot)
      const planned = plannedPackageStateOf(step, c, f.snapshot)
      if (c.state.condition === 'baseline-conflict') {
        assert.equal(now, 'sourceConflict', `${name}/${step.id}`)
        assert.equal(planned, null, `${name}/${step.id}: a contradiction planned a correction`)
        checked++
      }
      if (c.state.condition === 'needs-decision') {
        assert.equal(now, 'needsDecision', `${name}/${step.id}`)
        checked++
      }
      if (step.kind !== 'create' && step.kind !== 'adjust') assert.notEqual(planned, 'partial', `${name}/${step.id}: a ${step.kind} step planned a policy correction`)
    }
  }
  assert.ok(checked > 0, 'no conflict or decision in the fixtures: the premise is untested')
})
