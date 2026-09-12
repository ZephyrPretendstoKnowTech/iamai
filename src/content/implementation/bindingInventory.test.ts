// The binding inventory (correction batch 1): what IAMAI binds for a package comes
// from the facts it holds — the tenant, the pinned baseline, saved decisions and
// what it derives — and not only from an operation it offers now. Every value a
// package requires has one human name, a reference still waiting on an answer is
// never bound, a hold does not erase a target IAMAI knows, a whole policy's absent
// root is null, and a multi-policy package binds each member by its stable id.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { operationsOf } from '../../roadmap/operations.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepContract, CONTRACT } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { bindingLabel, implementationPackageFor, incompleteFieldsOf, memberBindings, packageBindings, touches } from '../../ui/surfaces/stepPackage.ts'
import { NO_RUNTIME, bindText, bound, projectSafely } from './project.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { referenceOptions } from '../../roadmap/answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf } from '../../roadmap/sourceMappings.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const NAMES = ['demo', 'demo-week2', 'small'] as const

function plans() {
  return NAMES.map((name) => {
    const f = fixture(name)
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    return { name, f, r, ctx }
  })
}

const bindingsOf = (step: Step, ctx: StepVarContext) => packageBindings(step, ctx, stepContract(step, ctx))

test('the target’s excluded accounts bind as the resolved target holds them: a list, an empty list, null, or nothing while its users wait', () => {
  const SESSION = 's-goal-all-users-no-persistence'
  const source = BASELINE_MAPPINGS_KEY
  const base = fixture('demo')
  const baseRun = runFixture(base)
  const ctxOf = (f: typeof base, r: typeof baseRun): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })
  // Unavailable: its users still name a reference nobody has answered.
  const waiting = baseRun.steps.find((s) => s.id === SESSION)!
  assert.ok(touches(incompleteFieldsOf(waiting, operationsOf(waiting)[0] ?? null), 'conditions.users') || (waiting.action.missing ?? []).length > 0, 'the premise: its users wait on an answer')
  assert.equal(Object.hasOwn(bindingsOf(waiting, ctxOf(base, baseRun)), 'policy.target.excludeUsers'), false, 'bound while the users wait')
  // Answered: the pinned target excludes nobody by account, and that is a value.
  const pending = sourceMappingsOf(baseRun.steps)
  const f = { ...base, mapping: applyStepDecisions(base.mapping, { [source]: { answers: Object.fromEntries(pending.map((p) => [p.id, referenceOptions()[0]])), at: base.snapshot.asOf } }) }
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === SESSION)!
  const bindings = bindingsOf(step, ctxOf(f, r))
  assert.deepEqual(bindings['policy.target.excludeUsers'], [], 'the empty list the target holds is bound as the fact it is')
  assert.ok(Array.isArray(bindings['policy.target.excludeGroups']), 'the excluded groups still bind beside it')
  // Populated: the accounts the target excludes.
  const populated = structuredClone(step)
  const op = populated.action.resolution!.policies[0]
  for (const body of [op.body, op.target].filter((b): b is Record<string, unknown> => !!b)) ((body.conditions as { users: Record<string, unknown> }).users).excludeUsers = ['user-1']
  assert.deepEqual(bindingsOf(populated, ctxOf(f, r))['policy.target.excludeUsers'], ['user-1'])
  // A users field that is not a list binds nothing.
  const nulled = structuredClone(step)
  for (const body of [nulled.action.resolution!.policies[0].body, nulled.action.resolution!.policies[0].target].filter((b): b is Record<string, unknown> => !!b)) ((body.conditions as { users: Record<string, unknown> }).users).excludeUsers = null
  assert.equal(Object.hasOwn(bindingsOf(nulled, ctxOf(f, r)), 'policy.target.excludeUsers'), false)
  // The projection keeps its contract: null is a whole JSON value; a required list
  // that is empty is not a set IAMAI holds (pilot.test.ts: an empty exclusion set
  // never produces a Create); a key IAMAI does not hold is missing.
  assert.equal(bound({ k: null }, 'k'), true)
  assert.equal(bound({ k: ['user-1'] }, 'k'), true)
  assert.equal(bound({}, 'k'), false)
  assert.deepEqual(bindText('"excludeUsers": {{json:k}}', { k: ['user-1'] }, new Set(['k'])), { text: '"excludeUsers": ["user-1"]' })
  assert.deepEqual(bindText('"excludeUsers": {{json:k}}', {}, new Set(['k'])), { missing: ['k'] })
  // Session Lifetime still waits on a real blocker beside it: its second member has no stable id in the pin.
  const held = projectSafely(implementationPackageFor(step)!, 'missing', bindings, NO_RUNTIME).hold
  assert.ok((held?.missingBindings ?? []).includes('policies.session.unmanaged.target.displayName'), JSON.stringify(held))
})

test('every value a registered package requires has one human name in the content', () => {
  const labels = CONTRACT.implementation.values as Record<string, string>
  const unnamed = [...new Set(Object.values(PACKAGES).flatMap((p) => p.meta.requiredBindings ?? []))].filter((b) => typeof labels[b] !== 'string').sort()
  assert.deepEqual(unnamed, [], 'a preview would name these values by their keys')
  assert.equal(bindingLabel('policy.target.trustedLocationId'), 'trusted location')
})

test('no binding carries a source reference still waiting on an answer', () => {
  let checked = 0
  for (const { name, r, ctx } of plans()) {
    for (const step of r.steps) {
      if (!implementationPackageFor(step)) continue
      const waiting = (step.action.missing ?? []).map((m) => m.token.toLowerCase())
      if (waiting.length === 0) continue
      const text = JSON.stringify(bindingsOf(step, ctx)).toLowerCase()
      for (const token of waiting) assert.equal(text.includes(token), false, `${name}/${step.id}: ${token.slice(0, 8)} reached a binding`)
      checked++
    }
  }
  assert.ok(checked > 0, 'no fixture step waits on a reference: the premise is untested')
})

test('a step waiting on references binds none of the fields they would complete, and still binds its name and its grant', () => {
  const { r, ctx } = plans()[0]
  const step = r.steps.find((s) => s.id === 's-goal-device-registration-mfa')!
  assert.ok((step.action.missing ?? []).length > 0, 'the premise: the demo device-registration policy waits on the baseline groups')
  const op = step.action.resolution!.policies[0]
  assert.deepEqual([...incompleteFieldsOf(step, op)], ['conditions.users'], 'the waiting groups were not found in the pinned policy’s users')
  const b = bindingsOf(step, ctx)
  for (const key of ['policy.target.excludeGroups', 'policy.target.includeUsers', 'policy.target.conditions']) assert.equal(Object.hasOwn(b, key), false, `${key} was bound from an exclusion set short of the groups still to answer`)
  assert.equal(typeof b['policy.target.displayName'], 'string')
  assert.deepEqual(b['policy.target.grantControls'], (op.target ?? op.body).grantControls, 'a grant no waiting reference touches was left unbound')
  assert.equal(typeof b['authStrength.target.id'], 'string')
})

test('a hold does not erase a target IAMAI knows: a step held on references binds every target field no reference touches', () => {
  let found = 0
  for (const { name, r, ctx } of plans()) {
    for (const step of r.steps) {
      if (!implementationPackageFor(step) || operationsOf(step).length > 0) continue
      const op = step.action.resolution?.policies?.[0]
      if (!op) continue
      const open = incompleteFieldsOf(step, op)
      const b = bindingsOf(step, ctx)
      const whole = (op.target ?? op.body) as Record<string, unknown>
      for (const root of ['conditions', 'grantControls', 'sessionControls']) {
        if (touches(open, root)) assert.equal(Object.hasOwn(b, `policy.target.${root}`), false, `${name}/${step.id}: ${root} bound while a reference in it waits`)
        else {
          assert.deepEqual(b[`policy.target.${root}`], whole[root] ?? null, `${name}/${step.id}: a held step's ${root} was not bound`)
          found++
        }
      }
    }
  }
  assert.ok(found > 0, 'no held step with a resolved field in the fixtures: the premise is untested')
})

test('null is a value: a whole policy that sets no grant or no session binds that root as null', () => {
  let found = 0
  for (const { name, r, ctx } of plans()) {
    for (const step of r.steps) {
      if (!implementationPackageFor(step) || (step.action.missing ?? []).length > 0) continue
      const op = step.action.resolution?.policies?.[0]
      if (!op || op.mode !== 'create') continue
      const b = bindingsOf(step, ctx)
      for (const root of ['grantControls', 'sessionControls'] as const) {
        if (Object.hasOwn(op.body, root) && op.body[root] !== null) continue
        assert.equal(Object.hasOwn(b, `policy.target.${root}`), true, `${name}/${step.id}: an absent ${root} was left unbound`)
        assert.equal(b[`policy.target.${root}`], null)
        found++
      }
    }
  }
  assert.ok(found > 0, 'no whole policy without a grant or a session in the fixtures')
})

test('a multi-policy package binds each member by its stable id, and a member with none binds nothing', () => {
  const { r } = plans()[1]
  const step = r.steps.find((s) => s.id === 's-goal-all-users-no-persistence')!
  assert.equal(implementationPackageFor(step)?.meta.stepId, 's-goal-session-lifetime')
  const b = memberBindings(step, plans()[1].f.snapshot)
  assert.equal(typeof b['policies.session.browser.target.displayName'], 'string', 'the browser member, named by its stable id, was not bound')
  assert.equal(Object.keys(b).some((k) => k.startsWith('policies.session.unmanaged.')), false, 'a member with no stable id was bound by position')
})
