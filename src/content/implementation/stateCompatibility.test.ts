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

// V1 audit S4-14: six packages' `notLicensed` words stated a licence requirement as a fact
// about the tenant — "IAMAI marks X as not licensed … so this policy cannot be created or
// changed until that license is in place" — where all the scan established is that it did
// not confirm the licence. Their siblings already said so honestly, and
// s-goal-mobile-app-protection adds why a bundle name is not the evidence. A package may
// say what IAMAI did not find and what IAMAI therefore withholds; it may not say what the
// tenant can and cannot do. Recorded with it: no step reaches this state at all
// (RUNTIME_REACH names it for no class, and packageStateOf never returns it), so these
// words are dead as well as wrong. Deleting them is the owner's call, not this test's.
test('no package’s Not licensed words claim what the tenant cannot do; each says the scan did not confirm the licence — and no step reaches the state', () => {
  // What the scan cannot establish: that the tenant holds no licence, and that a change to
  // the tenant is therefore impossible.
  const FALSE_CLAIM = /as not licensed in|cannot be (created|changed|deployed)|until that licen[sc]e is in place/i
  let read = 0
  for (const pkg of Object.values(PACKAGES)) {
    for (const [id, block] of Object.entries(pkg.blocks)) {
      // The words a person reads in that state, not the readiness or troubleshooting models beneath them.
      if (!Array.isArray(block.meta.states) || !block.meta.states.includes('notLicensed')) continue
      if (block.meta.channel !== 'aiInfo' && block.meta.channel !== 'entra') continue
      assert.doesNotMatch(block.text, FALSE_CLAIM, `${pkg.meta.stepId}/${id}: a licence requirement stated as a fact about the tenant`)
      read++
    }
  }
  assert.ok(read >= 15, `only ${read} Not licensed blocks were read`)
  // The six the audit named now say what their siblings already said, and why a bundle name is not the evidence.
  for (const id of ['s-goal-admin-session', 's-goal-azure-management-mfa', 's-goal-block-device-code', 's-goal-block-legacy-auth', 's-goal-block-unsupported-platforms', 's-goal-geo-restriction']) {
    const text = PACKAGES[id].blocks['ai.not-licensed'].text
    assert.match(text, /this scan did not confirm it for \{\{tenant\.displayName\}\}/, id)
    assert.match(text, /A product bundle name alone does not confirm the service plans this step needs\./, id)
    assert.match(text, /No implementation is offered until licensing is resolved; the licensing gap does not change the baseline goal\./, id)
  }
  // The state itself: authored by many packages, entered by none.
  for (const reach of Object.values(RUNTIME_REACH)) assert.equal(reach.includes('notLicensed'), false)
  assert.ok((PACKAGE_STATES as readonly string[]).includes('notLicensed'), 'the state is still declared, so its content is still compiled')
})
