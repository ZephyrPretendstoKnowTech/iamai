// The PIM package's two remaining validator findings (correction batch 2.1): its
// authentication-context correction is selectable under the generic correction
// contract, and its per-policy PIM request is reported as the request shape the
// runtime does not project — never as a binding the author forgot, and never with
// an invented role-management policy id.
//
// And the round-4 finding R4-18 (Marcus D9): the step could not be completed as
// written, because the authentication context the plan targets never reached
// the package. Those cases read the opened step, as the admin does.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageMeta } from './protocol.ts'
import { CHANGED_FIELDS_BINDING, normalizePackage, parseBlocks, validatePackage } from './protocol.ts'
import { selectMismatches } from './project.ts'
import { readFileSync } from 'node:fs'
import { pinnedPackage } from '../../baseline/pinned.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { asCuratedBaseline, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import type { Step } from '../../roadmap/types.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from '../../ui/surfaces/planBoard.ts'
import { laneReadings } from '../../ui/surfaces/planLanes.ts'
import { stepBodyOf } from '../../ui/surfaces/stepBody.ts'
import type { StepBody } from '../../ui/surfaces/stepBody.ts'
import { packageBindings, plannedOperationsOf } from '../../ui/surfaces/stepPackage.ts'
import { planDates } from '../../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../../ui/surfaces/stepVars.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const DIR = 'docs/implementation-content/s-goal-pim-activation-reauth'
const PIM = PACKAGES['s-goal-pim-activation-reauth']
const PIM_STEP = 's-goal-pim-activation-reauth'

/**
 * A tenant whose plan holds the PIM step as the product builds it: the pinned
 * baseline's own member (a6b3b754, authentication context c1, the tenant's
 * resolved strength), on a mid-sized tenant with the foundation settled so the
 * step is Ready. The shipped mid fixture carries the eight-policy synthetic
 * baseline, whose PIM step is the goal's template instead.
 */
const pinnedMid = (edit: (f: Fixture) => void = () => {}): Fixture => {
  const f = withFoundationSettled({ ...structuredClone(fixture('mid')), baseline: asCuratedBaseline(pinnedPackage()) })
  edit(f)
  return f
}

/** The opened PIM step on a tenant, as Plan.tsx composes it. */
function pimOn(f: Fixture): { step: Step; body: StepBody; ctx: StepVarContext } {
  setDisplayTimeZone('UTC')
  try {
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const step = r.steps.find((s) => s.id === PIM_STEP)
    assert.ok(step, 'the plan holds no PIM step')
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    const reading = readings.get(step.id)
    const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
    return { step, ctx, body: stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }) }
  } finally {
    setDisplayTimeZone(null)
  }
}

const channelText = (b: StepBody, id: string): string => b.artifacts.find((a) => a.id === id)?.text() ?? ''

// R4-18 (Marcus D9). The resolved operation targets authentication context c1
// — it is in the body the plan would send — and nothing bound it, so the
// package held every channel on `authContext.target.id` and the planning
// preview drew the create on a Ready · Create row with the ID glossed into a
// sentence: "Target resources → Authentication context: `the authentication
// context configured for the intended PIM role` (`the ID of that context in
// Conditional Access → Authentication context`)". That context is configured for
// no role at create time — the package forbids pointing PIM at it until the
// policy is On — and the JSON and PowerShell tabs fell back to a bare GET.
test('the create names the authentication context the plan targets, the ID its own request sends', () => {
  const { step, body, ctx } = pimOn(pinnedMid())
  const op = plannedOperationsOf(step)[0]
  const sent = (op.body as { conditions?: { applications?: { includeAuthenticationContextClassReferences?: string[] } } }).conditions?.applications?.includeAuthenticationContextClassReferences
  assert.deepEqual(sent, ['c1'], 'the premise: the pinned member targets c1')
  const bindings = packageBindings(step, ctx, body.contract)
  assert.equal(bindings['authContext.target.id'], 'c1')
  assert.equal(bindings['authContext.target.displayName'], 'Privileged role activation')
  const portal = channelText(body, 'portal')
  assert.match(portal, /Target resources → Authentication context: `Privileged role activation` \(`c1`\)/)
  assert.doesNotMatch(portal, /the ID of that context|configured for the intended PIM role/)
  // Executable, every channel: the request the JSON tab carries targets the same context.
  const json = channelText(body, 'json')
  assert.match(json, /"includeAuthenticationContextClassReferences":\s*\[\s*"c1"\s*\]/)
  assert.doesNotMatch(json, /"method":\s*"GET"/)
  assert.match(channelText(body, 'ps'), /-Mode 'Create' -AuthenticationContextId 'c1'/)
})

// The one thing a scan does see about authentication contexts is which of the
// tenant's policies target one. Where another of them already targets c1, the
// tenant uses that context for something this plan did not make, and the
// package's words — create or update it with this name, publish it, point the
// new policy at it — would put everything that already requests it behind this
// policy's grant. IAMAI does not pick another ID for the reader either.
test('a context another of the tenant policies already targets is not bound as this plan’s', () => {
  const f = pinnedMid((t) => {
    const rows = t.snapshot.config.caPolicies.rows as Record<string, unknown>[]
    rows.push({ id: '5d1b7f0e-6c2a-4f7e-9d3b-2a8c4e6f1b90', displayName: 'Sensitive sites need a compliant device', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeAuthenticationContextClassReferences: ['c1'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['compliantDevice'] } })
  })
  const { step, body, ctx } = pimOn(f)
  const sent = (plannedOperationsOf(step)[0]?.body as { conditions?: { applications?: { includeAuthenticationContextClassReferences?: string[] } } } | undefined)?.conditions?.applications?.includeAuthenticationContextClassReferences
  assert.deepEqual(sent, ['c1'], 'the premise: the plan still targets c1, and the other policy is not the step’s own')
  assert.notEqual(step.tracking?.policyId, '5d1b7f0e-6c2a-4f7e-9d3b-2a8c4e6f1b90')
  const bindings = packageBindings(step, ctx, body.contract)
  assert.equal(bindings['authContext.target.id'], undefined)
  assert.equal(bindings['authContext.target.displayName'], undefined)
  assert.doesNotMatch(channelText(body, 'portal'), /`c1`/)
})

test('the authentication-context correction is selected only when IAMAI knows the context is unpublished, and never from a fact it does not read', () => {
  const partial = PIM.meta.projection.partial as Record<string, unknown>
  const table = partial.mismatches as Record<string, { select?: unknown; facts?: unknown }>
  assert.ok(table['context.unpublished-or-wrong'], 'the context correction was withheld at compile time')
  assert.deepEqual(table['context.unpublished-or-wrong'].select, { equals: ['authContext.current.isAvailable', false] })
  const ctx = (bindings: Record<string, unknown>) => ({ state: 'partial', bindings, satisfied: new Set<string>(), baselineCommit: null })
  // IAMAI reads no authentication contexts today: unbound, the correction is not selected.
  assert.deepEqual(selectMismatches(partial, ctx({ [CHANGED_FIELDS_BINDING]: ['grantControls.authenticationStrength.id'] })), { selected: ['policy.authentication-strength'], unknown: [] })
  // Where the context is known to be unpublished, it is selected beside the policy's own correction.
  assert.deepEqual(selectMismatches(partial, ctx({ [CHANGED_FIELDS_BINDING]: ['grantControls.authenticationStrength.id'], 'authContext.current.isAvailable': false })).selected, ['context.unpublished-or-wrong', 'policy.authentication-strength'])
  assert.equal(selectMismatches(partial, ctx({ 'authContext.current.isAvailable': true })).selected.includes('context.unpublished-or-wrong'), false)
})

test('a request repeated once per role-management policy is reported as an unsupported request shape, and withheld; no id is declared or invented', () => {
  const meta = JSON.parse(readFileSync(`${DIR}/META.json`, 'utf8')) as PackageMeta
  const normal = normalizePackage(meta, parseBlocks(readFileSync(`${DIR}/CONTENT.md`, 'utf8')))
  const errors = validatePackage({ meta: normal.meta, blocks: normal.blocks })
  assert.deepEqual(errors.filter((e) => /undeclared binding|cannot select this module/.test(e)), [], 'a PIM finding is still reported as a schema defect')
  assert.ok(errors.some((e) => /json\.pim\.auth-context-rule: a request repeated for each value of pim\.roleManagementPolicyIds \(repeatForBinding, per-value roleManagementPolicyId\)/.test(e)), errors.join('\n'))
  assert.equal([...(meta.requiredBindings ?? []), ...(meta.optionalBindings ?? [])].includes('roleManagementPolicyId'), false, 'a per-value variable was declared as a binding IAMAI holds')
  assert.equal(PIM.blocks['json.pim.auth-context-rule'], undefined, 'the request the runtime cannot build was registered')
  // Another block with an undeclared endpoint binding and no repeat is still the author's defect.
  const stray = { meta: { stepId: 'x', projection: {} } as unknown as PackageMeta, blocks: { j: { meta: { id: 'j', channel: 'json', format: 'json', endpoint: 'https://graph.microsoft.com/v1.0/x/{missingId}' }, text: '{}\n' } } }
  assert.deepEqual(validatePackage(stray as unknown as CompiledPackage), ['j: endpoint names undeclared binding missingId'])
})

// R4-18, the first link of the package's own setup order. The create put the
// policy on the context and nothing on the step said to create or publish the
// context: in Entra a context that does not exist cannot be chosen under Target
// resources, so the procedure stopped at step 3, and PIM can only ever be
// pointed at a published one. The package authors that work as its own state
// (`contextMissing`), which the runtime never enters because IAMAI reads no
// authentication contexts and cannot tell a missing one from a published one.
// The create carries it first instead; it is a create-or-update, so a context
// already prepared is left as it is.
test('the create prepares and publishes the context before the policy that targets it', () => {
  const { body } = pimOn(pinnedMid())
  const portal = channelText(body, 'portal')
  const prepare = portal.indexOf('Conditional Access → Authentication context. Create or update the IAMAI-resolved context ID/name `c1` / `Privileged role activation`')
  const create = portal.indexOf('Conditional Access → Policies → New policy')
  assert.ok(prepare >= 0, portal)
  assert.ok(create > prepare, 'the context is prepared after the policy that must select it')
  assert.match(portal, /and publish it/)
  // The Implementation Task reads the same procedure, context first.
  const task = body.emergencyAccountTasks?.tasks[0]
  assert.ok(task, 'the step draws no Implementation Task')
  assert.match(task.steps[0], /Authentication context\. Create or update the IAMAI-resolved context ID\/name `c1`/)
  // The script runs the same two modes in the same order.
  const ps = channelText(body, 'ps')
  const runs = [...ps.matchAll(/^Invoke-IAMAIStep -Mode '(\w+)'/gm)].map((m) => m[1])
  assert.deepEqual(runs, ['PrepareContext', 'Create'])
  assert.match(ps, /-Mode 'PrepareContext' -AuthenticationContextId 'c1' -AuthenticationContextDisplayName 'Privileged role activation'/)
})

// R4-18, secondary. On a plan whose PIM policy is the goal's own template
// (built-in MFA, so no strength resolved for the package's strength grant), the
// planning preview's settings read "Grant → Require authentication strength:
// Multifactor authentication": a strength IAMAI did not resolve, named as
// Microsoft's built-in one, beside a procedure asking for "IAMAI-resolved
// target strength". The preview now keeps the marker that says it is unresolved.
test('the preview names no strength IAMAI did not resolve', () => {
  const { body, ctx, step } = pimOn(withFoundationSettled(structuredClone(fixture('mid'))))
  assert.equal(packageBindings(step, ctx, body.contract)['authStrength.target.id'], undefined, 'the premise: the strength is unresolved here')
  const portal = channelText(body, 'portal')
  assert.match(portal, /Grant → Require authentication strength: ‹authentication strength›/)
  assert.doesNotMatch(portal, /Multifactor authentication/)
})
