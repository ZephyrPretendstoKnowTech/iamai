// The whole implementation-content library in the Plan: every package that
// describes a content step is registered from its sources, reaches the steps that
// show its content entry, is projected from IAMAI's state, and is safe in every
// state (README.md).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import { readFileSync } from 'node:fs'
import { compileLibrary, libraryIndexOf, registryOf } from './library.ts'
import type { LibraryIndex } from './library.ts'
import { PACKAGE_STATES, unconfiguredConditions, validatePackage } from './protocol.ts'
import type { CompiledPackage } from './protocol.ts'
import { NO_ACTION_STATES, NO_RUNTIME, UNRESOLVED, projectSafely, readinessSafely, troubleshootingSafely } from './project.ts'
import type { PackageState, RuntimeContext } from './project.ts'
import { contentStepFor, contentStepForPackage } from '../stepTitle.ts'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { stepContract } from '../../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'
import { BASELINE_COMMIT, REGISTERED_PACKAGE_STEP_IDS, implementationPackageFor, packageBindings, packageForEntry, packageDrawsImplementation, packageReviewFor, packageRuntime, packageStateOf } from '../../ui/surfaces/stepPackage.ts'

const LIBRARY = compileLibrary()
const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages

type Placed = { step: Step; ctx: StepVarContext }

function placed(name: 'small' | 'demo' | 'demo-week2', curated = false): Placed[] {
  // The foundation gate withholds every policy's implementation until Emergency
  // Access and Direction are settled (owner, 2026-09-19), and this file is about
  // what a package projects once a step may act — so the fixtures arrive settled.
  const f = withFoundationSettled(curated ? curatedFixture(name) : fixture(name))
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

/**
 * A step's package projected in a state it is not in yet: a User Action policy is
 * created On since Phase 2e, so its create waits on readiness (state `blocked`),
 * and what it will hand over is read as the create it will be.
 */
function projectAs({ step, ctx }: Placed, state: PackageState) {
  const pkg = implementationPackageFor(step)!
  const bindings = packageBindings(step, ctx, stepContract(step, ctx))
  const { runtime } = packageRuntime(pkg, state, bindings, {})
  return { pkg, state, bindings, projection: projectSafely(pkg, state, bindings, runtime) }
}

test('the registry and LIBRARY.json are the whole library compiled and regenerated, never kept by hand: every package for a Plan content step, no part the runtime cannot project, every Partial composed from changed fields', () => {
  // the registry is the whole library compiled: every package for a Plan content step, nothing else, and no part the runtime cannot project
  {
    assert.deepEqual(registry, JSON.parse(JSON.stringify(registryOf(LIBRARY))), 'registry.generated.json drifted from docs/implementation-content: run scripts/compile-implementation-content.mjs --registry')
    // 42: the trip-operations package left with its step (docs/plans/step-redundancy-analysis.md
    // finding 4), and the partner and mail follow-ups folded into the policy steps
    // that own their outcomes (findings 5 and 6). 41: Give Shared Devices Their Own
    // Policy left with its step (Phase 2a: shared-device accounts join the service accounts).
    assert.equal(LIBRARY.registered.length, 41)
    // The drill row is not a content step: the Plan draws it with CleanupBody. The
    // not-assessed row left with its duplicate (docs/plans/step-redundancy-analysis.md finding 8).
    assert.deepEqual(LIBRARY.notSteps.map((p) => p.stepId), ['cleanup-drill'])
    for (const id of REGISTERED_PACKAGE_STEP_IDS) assert.deepEqual(validatePackage(PACKAGES[id]), [], `${id} was registered with a part the runtime cannot project`)
    // What was withheld is reported, never silently lost: the library's authored gaps are in the compiler's output.
    assert.ok(LIBRARY.registered.some((p) => p.withheld.length > 0))
    assert.deepEqual(LIBRARY.registered.find((p) => p.stepId === 's-goal-device-registration-mfa')?.withheld, [])
  }
  // LIBRARY.json’s counts, binding inventory, validation, provenance and review are the library’s own, regenerated and never kept by hand
  {
    const current = JSON.parse(readFileSync('docs/implementation-content/LIBRARY.json', 'utf8')) as LibraryIndex
    assert.deepEqual(current, JSON.parse(JSON.stringify(libraryIndexOf(LIBRARY, current))), 'LIBRARY.json drifted from docs/implementation-content: run scripts/compile-implementation-content.mjs --library-index')
    // No required binding is one no part of its package names (correction batch 2).
    const passing = current.packages.filter((p) => p.validationResult === 'pass').map((p) => p.stepId)
    assert.ok(passing.includes('s-goal-device-registration-mfa'))
    assert.equal(current.aggregate.packagesPassingStrictValidation, passing.length)
  }
  // every registered Partial composes its corrections from the engine’s changed fields
  {
    for (const id of REGISTERED_PACKAGE_STEP_IDS) {
      const partial = PACKAGES[id].meta.projection.partial
      if (partial) assert.equal(partial.mode, 'composeByMismatch', `${id}: a Partial that cannot choose its corrections was registered`)
    }
  }
})

// §S4-1/§S4-2, the whole library at once: a condition left at Configure: No is
// not applied, so every portal procedure that narrows a toggled condition names
// the toggle. The rule is the acceptance, not the four blocks the V1 audit
// listed — the class came back twice because each instance was fixed alone.
test('no portal procedure in the library narrows a toggled condition without naming Configure', () => {
  const offences: string[] = []
  for (const [stepId, pkg] of Object.entries(PACKAGES))
    for (const [blockId, b] of Object.entries(pkg.blocks))
      if (b.meta.channel === 'entra' || b.meta.channel === 'aiInfo')
        for (const u of unconfiguredConditions(b.text)) offences.push(`${stepId} ${blockId}: ${u.condition} — ${u.passage.slice(0, 90)}`)
  assert.deepEqual(offences, [], 'a condition narrowed with no Configure toggle: at No it is not applied and the policy reaches everything it was meant to narrow')
})

test('each package reaches the steps whose title comes from its content entry, a merged goal included, and is named what its step is named, script header too', () => {
  // each package reaches the steps whose title comes from its content entry, a merged goal included
  {
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
    assert.equal(packageForEntry({ id: 'cleanup-drill', goalId: '' }), null)
  }
  // a package is named what its step is named, and the script it hands over carries that same name
  // V1 audit S4-12: the workload-identity step's title, its package title and the header of
  // the script it hands over all named "the Entra Connect Sync Account", while its own Entra
  // channel says Connect Sync signs in as a user account and only Cloud Sync's provisioning
  // service principal can be a workload-identity policy's target. A step cannot be named after
  // the identity its procedure forbids, and a rename that reaches one surface and not the
  // others is two names for one step. The rule is general, so every package is read.
  {
    let checked = 0
    for (const pkg of Object.values(PACKAGES)) {
      const title = contentStepForPackage(pkg.meta.stepId)?.title
      if (typeof title !== 'string') continue
      assert.equal(pkg.meta.title, title, `${pkg.meta.stepId}: the package title is not the step's`)
      const script = pkg.blocks['powershell.run']?.text
      if (typeof script === 'string' && /^# IAMAI compact implementation script/m.test(script)) {
        assert.ok(script.includes(`# IAMAI compact implementation script — ${title}`), `${pkg.meta.stepId}: the script header names another step`)
      }
      checked++
    }
    assert.ok(checked >= 30, `only ${checked} packages were read`)
    // The identity this step's policy can actually target, said the same way everywhere.
    const workload = 'Restrict the Directory Sync Service Principal to Its Address'
    assert.equal(contentStepForPackage('s-goal-workload-identity-block')?.title, workload)
    for (const block of Object.values(PACKAGES['s-goal-workload-identity-block'].blocks)) assert.doesNotMatch(block.text, /Entra Connect Sync Account/)
  }
})

test('a policy IAMAI would create projects the package’s Entra, PowerShell, JSON, AI Info and Email; a JSON body authored with no request is withheld (S6)', () => {
  const p = at(SMALL, 's-goal-admins-phishing-resistant')
  const { pkg, state, bindings, projection } = project(p)
  assert.equal(pkg.meta.stepId, 's-goal-admins-phishing-resistant')
  assert.equal(state, 'missing')
  assert.equal(projection.hold, null)
  assert.deepEqual(projection.channels.map((c) => c.channel), ['entra', 'powershell', 'json', 'aiInfo', 'email'])
  // The JSON channel is a request or nothing (S6 task 3): the package's create
  // body is sent as the POST it declares (S8 authored the request on every
  // single-policy package's create, correction and enforce blocks).
  assert.deepEqual(projection.channels.find((c) => c.channel === 'json')?.requests, [{ method: 'POST', endpoint: 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies' }])
  assert.deepEqual(projection.degraded ?? [], [])
  // The same package with the request stripped from that block: a bare body is
  // not a request, so the channel is withheld rather than offered as one, and
  // every other channel is untouched.
  const bare = structuredClone(pkg)
  delete (bare.blocks['json.target-policy'].meta as Record<string, unknown>).method
  delete (bare.blocks['json.target-policy'].meta as Record<string, unknown>).endpoint
  const stripped = projectSafely(bare, state, bindings, packageRuntime(bare, state, bindings, {}).runtime)
  assert.deepEqual(stripped.channels.map((c) => c.channel), ['entra', 'powershell', 'aiInfo', 'email'])
  assert.match(stripped.degraded?.find((d) => d.channel === 'json')?.invalid.join(' ') ?? '', /json\.target-policy: a JSON body with no request/)
  // The rollout Email the package authored for the Report-only creation reaches the
  // step (correction batch 2): its audience is the author's, its trigger the one state it is for.
  assert.deepEqual(projection.channels.find((c) => c.channel === 'email')?.communication, { audience: 'administrators-in-scope', trigger: 'before-report-only', purpose: '' })
  // The JSON the pilot authored with its request is the pinned baseline's policy, bound.
  // On the curated baseline: small's step is written from that pinned policy
  // (q-pin), which names a group of the author's this baseline has not settled,
  // and an unsettled source group holds the create.
  const pilot = at(placed('small', true), 's-goal-device-registration-mfa')
  assert.equal(project(pilot).state, 'blocked', 'created On, its create waits for everyone it covers to be ready')
  const piloted = projectAs(pilot, 'missing')
  const op = pilot.step.action.resolution!.policies[0]
  const target = (op.target ?? op.body) as Record<string, unknown>
  const artifact = piloted.projection.channels.find((c) => c.channel === 'json')!
  assert.deepEqual(artifact.requests, [{ method: 'POST', endpoint: '/identity/conditionalAccess/policies' }])
  const json = JSON.parse(artifact.text) as { conditions: { users: Record<string, unknown>; applications: Record<string, unknown> }; grantControls: unknown }
  const conditions = target.conditions as { users: Record<string, unknown>; applications: Record<string, unknown> }
  // The package spells the body out in full (its empty arrays are Graph's own defaults); the values IAMAI holds are the resolved policy's.
  assert.deepEqual(json.conditions.users.excludeGroups, conditions.users.excludeGroups, 'the JSON does not carry the resolved policy’s exclusions')
  assert.deepEqual(json.conditions.users.includeUsers, conditions.users.includeUsers)
  assert.deepEqual(json.conditions.applications.includeUserActions, conditions.applications.includeUserActions)
  const strength = (g: unknown): unknown => (g as { authenticationStrength?: { id?: unknown } } | undefined)?.authenticationStrength?.id
  assert.equal(strength(json.grantControls), strength(target.grantControls), 'the JSON does not name the resolved authentication strength')
  for (const c of [...projection.channels, ...piloted.projection.channels]) assert.equal(UNRESOLVED.test(c.text), false, `${c.channel}: a placeholder reached the page`)
})

test('a required value IAMAI does not hold withholds only the channel that names it; a package with nothing for the state leaves the step its own channels', () => {
  // The registration package words its portal grant from the resolved target's own
  // portal lines (`policy.target.grantWords`; it once asked for a mode IAMAI never
  // binds). Without that one value the portal steps are withheld, and the PowerShell
  // rendered from the pinned target still projects, and so does its JSON create request.
  // Created On since Phase 2e, its create waits on MFA readiness and on what its turn-on waits for; read here with both met.
  const registration = at(SMALL, 's-goal-register-info-protected')
  assert.equal(project(registration).state, 'blocked', 'the premise: readiness holds the create')
  const ready: Placed = { ...registration, step: { ...registration.step, action: { ...registration.step.action, readinessGate: undefined, enforceWaitsOn: [] }, blockers: registration.step.blockers.filter((b) => b.kind !== 'readiness') } }
  const opened = projectAs(ready, 'missing')
  assert.equal(opened.projection.hold, null)
  assert.ok(opened.projection.channels.some((c) => c.channel === 'entra'), 'the premise: with the grant words bound the portal steps are drawn')
  const { ['policy.target.grantWords']: _grant, ...withoutGrant } = opened.bindings as Record<string, unknown>
  const held = { pkg: opened.pkg, projection: projectSafely(opened.pkg, 'missing', withoutGrant, NO_RUNTIME) }
  assert.equal(held.projection.hold, null)
  assert.equal(held.projection.channels.some((c) => c.channel === 'entra'), false)
  assert.ok(held.projection.channels.some((c) => c.channel === 'powershell'), 'the PowerShell rendered from the pinned target was withheld with the portal steps')
  assert.ok(held.projection.channels.some((c) => c.channel === 'json'), 'the JSON create, sent as the request the package declares, was withheld with the portal steps')
  assert.deepEqual(held.projection.degraded?.map((d) => [d.channel, d.missingBindings, d.invalid.length]), [['entra', ['policy.target.grantWords'], 0]])
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
