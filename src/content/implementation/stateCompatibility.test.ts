// Authored states reconciled with the runtime's (correction batch 1): no engine
// state is added, every state a package authors is named against the nine the
// runtime enters, and a finding fails only where reachable behaviour is undefined
// or unsafe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { PACKAGE_STATES } from './protocol.ts'
import { RUNTIME_REACH, stateCompatibility, stepClassOf } from './states.ts'
import { contentStepForPackage } from '../stepTitle.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { implementationPackageFor, packageStateOf } from '../../ui/surfaces/stepPackage.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const classOf = (stepId: string) => stepClassOf((contentStepForPackage(stepId) as { kind?: string } | undefined)?.kind)

test('every state a registered package authors is a runtime state or reconciled with one, and none leaves a reachable action unsafe', () => {
  const findings = Object.values(PACKAGES).flatMap((pkg) => stateCompatibility(pkg, classOf(pkg.meta.stepId)))
  assert.ok(findings.length >= 37, `only ${findings.length} authored states were reconciled`)
  assert.deepEqual(
    findings.filter((f) => f.problem !== null).map((f) => `${f.package}.${f.state}: ${f.detail}`),
    [],
  )
})

test('a state gated on an object is reported unsafe where a reachable action deploys without that object', () => {
  const pkg = {
    meta: { stepId: 's-goal-synthetic', requiredBindings: ['location.syncServer.displayName'], projection: { locationMissing: { requires: ['location.syncServer.displayName'] }, missing: { json: [{ block: 'j' }] } } },
    blocks: { j: { meta: { id: 'j', channel: 'json', states: ['missing'], format: 'json', kind: 'deployableAfterBinding' }, text: '{ "displayName": {{json:policy.target.displayName}} }' } },
  } as unknown as CompiledPackage
  const [finding] = stateCompatibility(pkg, 'policy')
  assert.equal(finding.problem, 'unsafe')
  assert.match(finding.detail ?? '', /missing deploys without location\.syncServer/)
  // The same package cannot reach `missing` as a check step, so nothing is unsafe there.
  assert.equal(stateCompatibility(pkg, 'other')[0].problem, null)
  // A state no reconciliation names is undefined.
  const unknown = { ...pkg, meta: { ...pkg.meta, projection: { somethingNew: {} } } } as unknown as CompiledPackage
  assert.equal(stateCompatibility(unknown, 'policy')[0].problem, 'undefined')
})

test('the runtime enters only its own states, within what each kind of step can reach', () => {
  let checked = 0
  for (const name of ['demo', 'demo-week2', 'small', 'getiamai', 'midflight'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const step of r.steps) {
      const pkg = implementationPackageFor(step)
      if (!pkg) continue
      const state = packageStateOf(step, stepContract(step, ctx), f.snapshot)
      if (state === null) continue
      assert.ok((PACKAGE_STATES as readonly string[]).includes(state), `${name}/${step.id}: ${state}`)
      assert.ok(RUNTIME_REACH[classOf(pkg.meta.stepId)].includes(state), `${name}/${step.id}: ${state} is outside what a ${classOf(pkg.meta.stepId)} step reaches`)
      checked++
    }
  }
  assert.ok(checked > 50)
})
