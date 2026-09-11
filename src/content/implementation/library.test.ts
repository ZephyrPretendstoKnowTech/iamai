// The whole implementation-content library in the Plan: every package that
// describes a content step is registered from its sources, reaches the steps that
// show its content entry, is projected from IAMAI's state, and is safe in every
// state (README.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import { compileLibrary, registryOf } from './library.ts'
import { PACKAGE_STATES, validatePackage } from './protocol.ts'
import type { CompiledPackage } from './protocol.ts'
import { NO_ACTION_STATES, NO_RUNTIME, UNRESOLVED, projectSafely, readinessSafely, troubleshootingSafely } from './project.ts'
import type { RuntimeContext } from './project.ts'
import { contentStepFor, contentStepForPackage } from '../stepTitle.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { operationsOf } from '../../roadmap/operations.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { BASELINE_COMMIT, REGISTERED_PACKAGE_STEP_IDS, implementationPackageFor, packageBindings, packageDrawsImplementation, packageReviewFor, packageRuntime, packageStateOf } from '../../ui/surfaces/stepPackage.ts'

const LIBRARY = compileLibrary()
const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

type Placed = { step: Step; ctx: StepVarContext }

function placed(name: 'small' | 'demo' | 'demo-week2'): Placed[] {
  const f = fixture(name)
  const r = runFixture(f)
  return r.steps.map((step) => ({ step, ctx: { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } }))
}
const SMALL = placed('small')
const DEMO = placed('demo')
const at = (steps: Placed[], id: string): Placed => steps.find((p) => p.step.id === id)!

/** A step as ContentStep projects it: IAMAI's state and bindings into its package, nobody's confirmation given. */
function project({ step, ctx }: Placed) {
  const pkg = implementationPackageFor(step)!
  const c = stepContract(step, ctx)
  const state = packageStateOf(step, c, ctx.snapshot)!
  const bindings = packageBindings(step, ctx, c)
  const { runtime } = packageRuntime(pkg, state, bindings, {})
  return { pkg, state, bindings, projection: projectSafely(pkg, state, bindings, runtime) }
}

test('the registry is the whole library compiled: every package for a Plan content step, nothing else, and no part the runtime cannot project', () => {
  assert.deepEqual(registry, JSON.parse(JSON.stringify(registryOf(LIBRARY))), 'registry.generated.json drifted from docs/implementation-content: run scripts/compile-implementation-content.mjs --registry')
  assert.equal(LIBRARY.registered.length, 44)
  // The two Cleanup rows are not content steps: the Plan draws them with CleanupBody.
  assert.deepEqual(LIBRARY.notSteps.map((p) => p.stepId), ['cleanup-drill', 'cleanup-notAssessed'])
  for (const id of REGISTERED_PACKAGE_STEP_IDS) assert.deepEqual(validatePackage(PACKAGES[id]), [], `${id} was registered with a part the runtime cannot project`)
  // What was withheld is reported, never silently lost: the library's authored gaps are in the compiler's output.
  assert.ok(LIBRARY.registered.some((p) => p.withheld.length > 0))
  assert.deepEqual(LIBRARY.registered.find((p) => p.stepId === 's-goal-device-registration-mfa')?.withheld, [])
})

test('each package reaches the steps whose title comes from its content entry, a merged goal included', () => {
  let reached = 0
  let reviewed = 0
  for (const { step } of DEMO) {
    const pkg = implementationPackageFor(step)
    if (!pkg) {
      // A package the semantic re-pin review set aside still reaches its step, as a review.
      if (packageReviewFor(step)) reviewed++
      continue
    }
    reached++
    assert.equal(contentStepForPackage(pkg.meta.stepId)?.id, contentStepFor(step)?.id, `${step.id} reached ${pkg.meta.stepId}`)
  }
  assert.ok(reached + reviewed >= 27, `only ${reached + reviewed} demo steps reached a package`)
  assert.equal(implementationPackageFor(at(DEMO, 's-goal-all-users-no-persistence').step)?.meta.stepId, 's-goal-session-lifetime')
  assert.equal(implementationPackageFor({ id: 'cleanup-drill', goalId: '' }), null)
})

test('a policy IAMAI would create projects the package’s Entra, PowerShell, JSON and AI Info, and the JSON is the pinned baseline’s policy', () => {
  const p = at(SMALL, 's-goal-admins-phishing-resistant')
  const { pkg, state, projection } = project(p)
  assert.equal(pkg.meta.stepId, 's-goal-admins-phishing-resistant')
  assert.equal(state, 'missing')
  assert.equal(projection.hold, null)
  assert.deepEqual(projection.channels.map((c) => c.channel), ['entra', 'powershell', 'json', 'aiInfo'])
  const op = operationsOf(p.step)[0]
  const target = (op.target ?? op.body) as Record<string, unknown>
  const json = JSON.parse(projection.channels.find((c) => c.channel === 'json')!.text) as Record<string, unknown>
  // The bound values are the resolved policy's; the grant around the strength is the package's own words (content audit).
  assert.deepEqual(json.conditions, target.conditions, 'the JSON does not carry the resolved policy’s conditions')
  const strength = (g: unknown): unknown => (g as { authenticationStrength?: { id?: unknown } } | undefined)?.authenticationStrength?.id
  assert.equal(strength(json.grantControls), strength(target.grantControls), 'the JSON does not name the resolved authentication strength')
  for (const c of projection.channels) assert.equal(UNRESOLVED.test(c.text), false, `${c.channel}: a placeholder reached the page`)
})

test('a required value IAMAI does not hold withholds only the channel that names it; a package with nothing for the state leaves the step its own channels', () => {
  // The registration package words its portal steps by a mode the resolved target
  // does not settle (MFA outside trusted locations is neither of its two modes), so
  // IAMAI binds no mode: the portal steps are withheld and say so, and the JSON and
  // PowerShell rendered from the pinned target still project.
  const held = project(at(SMALL, 's-goal-register-info-protected'))
  assert.equal(held.state, 'missing')
  assert.equal(held.projection.hold, null)
  assert.equal(held.projection.channels.some((c) => c.channel === 'entra'), false)
  assert.ok(held.projection.channels.some((c) => c.channel === 'json'), 'the JSON rendered from the pinned target was withheld with the portal steps')
  assert.deepEqual(held.projection.degraded, [{ channel: 'entra', missingBindings: ['policy.target.mode'], invalid: [] }])
  assert.equal(packageDrawsImplementation(held.pkg, held.projection), true, 'a held package gave the step back channels it holds')
  const none = projectSafely(held.pkg, 'missing', {}, NO_RUNTIME)
  assert.deepEqual(none.channels, [], 'a projection with none of its values offered something')
  assert.ok((none.hold?.missingBindings.length ?? 0) > 0)
  // A registered package in a state it authors nothing for leaves the step its own channels.
  const quiet = Object.values(PACKAGES).flatMap((pkg) => PACKAGE_STATES.filter((s) => !NO_ACTION_STATES.has(s) && !pkg.meta.projection[s]).map((state) => ({ pkg, state })))[0]
  assert.ok(quiet, 'every registered package authors every action state: the premise is untested')
  const silent = projectSafely(quiet.pkg, quiet.state, {}, NO_RUNTIME)
  assert.equal(silent.hold?.noProjection, true)
  assert.equal(packageDrawsImplementation(quiet.pkg, silent), false)
  assert.equal(packageDrawsImplementation(null, null), false)
})

test('every registered package projects in every state without a fault, and a state with nothing to implement projects nothing', () => {
  const faults: string[] = []
  const report = (stepId: string, what: string, e: unknown): void => void faults.push(`${stepId}: ${what}: ${String(e)}`)
  const real = project(at(SMALL, 's-goal-admins-phishing-resistant')).bindings
  for (const id of REGISTERED_PACKAGE_STEP_IDS) {
    const pkg = PACKAGES[id]
    const everything: RuntimeContext = { satisfied: new Set((pkg.meta.prerequisites ?? []).map((p) => p.id)), baselineCommit: BASELINE_COMMIT }
    for (const bindings of [{}, real]) {
      for (const runtime of [NO_RUNTIME, everything]) {
        for (const state of PACKAGE_STATES) {
          const p = projectSafely(pkg, state, bindings, runtime, report)
          readinessSafely(pkg, state, bindings, runtime, report)
          troubleshootingSafely(pkg, state, bindings, report)
          if (NO_ACTION_STATES.has(state)) assert.deepEqual(p, { state, hold: null, channels: [] }, `${id}: ${state} offered an implementation`)
          else for (const c of p.channels) if (c.channel === 'json') JSON.parse(c.text)
        }
      }
    }
  }
  assert.deepEqual(faults, [])
})

test('every registered Partial composes its corrections from the engine’s changed fields', () => {
  for (const id of REGISTERED_PACKAGE_STEP_IDS) {
    const partial = PACKAGES[id].meta.projection.partial
    if (partial) assert.equal(partial.mode, 'composeByMismatch', `${id}: a Partial that cannot choose its corrections was registered`)
  }
})

test('the demo’s held Intune enrollment policy, prepared in report-only, offers the package’s JSON, and it parses', () => {
  const { pkg, state, projection } = project(at(placed('demo-week2'), 's-goal-intune-enrollment-reauth'))
  assert.equal(pkg.meta.stepId, 's-goal-intune-enrollment-reauth')
  assert.equal(state, 'missing')
  assert.equal(projection.hold, null, JSON.stringify(projection.hold))
  const json = projection.channels.find((c) => c.channel === 'json')
  assert.ok(json, 'no JSON channel')
  assert.equal(typeof (JSON.parse(json.text) as { displayName?: unknown }).displayName, 'string')
  for (const c of projection.channels) assert.equal(UNRESOLVED.test(c.text), false, `${c.channel}: an authoring marker reached the page`)
})
