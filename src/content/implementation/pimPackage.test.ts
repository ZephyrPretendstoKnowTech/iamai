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
import { projectImplementation, selectMismatches } from './project.ts'
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

/** The opened PIM step (or another step, by id) on a tenant, as Plan.tsx composes it. */
function pimOn(f: Fixture, id: string = PIM_STEP): { step: Step; body: StepBody; ctx: StepVarContext } {
  setDisplayTimeZone('UTC')
  try {
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const step = r.steps.find((s) => s.id === id)
    assert.ok(step, `the plan holds no ${id} step`)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    const reading = readings.get(step.id)
    const lane = laneViewFor(step, { readings, titleOf })
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
//
// R4-18 review: that was done by leaving the ID unbound, and the create still
// read Ready · Create / Ready now, over a procedure whose first instruction was
// "Create or update … `‹authentication context ID›` … Do not choose a different
// context ID", with no Readiness tile saying why. The premise of this test
// changes: the step holds on the tenant fact (roadmap/authContext.ts) and
// Readiness says which context; the planned work names the context it targets.
const sharedContext = (): Fixture =>
  pinnedMid((t) => {
    const rows = t.snapshot.config.caPolicies.rows as Record<string, unknown>[]
    rows.push({ id: '5d1b7f0e-6c2a-4f7e-9d3b-2a8c4e6f1b90', displayName: 'Sensitive sites need a compliant device', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeAuthenticationContextClassReferences: ['C1'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['compliantDevice'] } })
  })
test('a context another of the tenant’s policies already targets holds the create, and Readiness says why', () => {
  const { step, body, ctx } = pimOn(sharedContext())
  const sent = (plannedOperationsOf(step)[0]?.body as { conditions?: { applications?: { includeAuthenticationContextClassReferences?: string[] } } } | undefined)?.conditions?.applications?.includeAuthenticationContextClassReferences
  assert.deepEqual(sent, ['c1'], 'the premise: the plan still targets c1, and the other policy is not the step’s own')
  assert.notEqual(step.tracking?.policyId, '5d1b7f0e-6c2a-4f7e-9d3b-2a8c4e6f1b90')
  // Not a Ready row.
  assert.equal(body.laneView.lane, 'On Hold', `${body.laneView.lane} · ${body.laneView.substatus}`)
  assert.notEqual(body.readiness.bar.key, 'create')
  assert.notEqual(body.readiness.bar.main, 'Ready now')
  // Readiness says what holds it, and which context.
  const held = body.allTiles.find((t) => t.value === 'Authentication context')
  assert.ok(held, body.allTiles.map((t) => `${t.label} · ${t.value}`).join('\n'))
  assert.equal(held.note, 'while another policy targets authentication context c1')
  assert.equal(held.tone, 'warn')
  // Once: the board's reading of the same fact is not a second, bare card.
  assert.equal(body.allTiles.some((t) => t.value === 'Tenant fact'), false, body.allTiles.map((t) => `${t.label} · ${t.value}`).join('\n'))
  // The planned work names the context it would use, and no stand-in.
  const bindings = packageBindings(step, ctx, body.contract)
  assert.equal(bindings['authContext.target.id'], 'c1')
  for (const id of ['portal', 'ps', 'json']) assert.doesNotMatch(channelText(body, id), /‹[^›]+›/, id)
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
// The create carries it first instead.
//
// R4-18 review: it carried it as the package wrote it for a context IAMAI had
// read as its own — "Create or update … c1 / Privileged role activation … and
// publish it", a blind PATCH of name, description and published state. IAMAI has
// read nothing here, and c1 is the baseline author's ID, not one resolved against
// this tenant: a c1 that exists for something else (sensitivity labels, Defender
// for Cloud Apps, a context left unpublished) was renamed and published, and once
// enforced this All-users policy gates whatever requests it. The preparation only
// creates: a context under any other name or description stops the step, in the
// procedure and in the script, whose Create refuses a context it did not prepare.
test('the create prepares the context only where there is none, before the policy that targets it', () => {
  const { body } = pimOn(pinnedMid())
  const portal = channelText(body, 'portal')
  const prepare = portal.indexOf('Conditional Access → Authentication context. If no context has ID `c1`, create it with that ID, the name `Privileged role activation` and the description `Fresh strong authentication for privileged role activation.`, and publish it.')
  const create = portal.indexOf('Conditional Access → Policies → New policy')
  assert.ok(prepare >= 0, portal)
  assert.ok(create > prepare, 'the context is prepared after the policy that must select it')
  assert.match(portal, /If it exists under any other name or description, stop here: something in your tenant may already request that context, and this step does not rename, republish or reuse a context it did not create\./)
  assert.doesNotMatch(portal, /Create or update|IAMAI-resolved context/)
  // The Implementation Task reads the same procedure, context first.
  const task = body.emergencyAccountTasks?.tasks[0]
  assert.ok(task, 'the step draws no Implementation Task')
  assert.match(task.steps[0], /Authentication context\. If no context has ID `c1`, create it/)
  // The script runs the same two modes in the same order, and reads before it writes.
  const ps = channelText(body, 'ps')
  const runs = [...ps.matchAll(/^Invoke-IAMAIStep -Mode '(\w+)'/gm)].map((m) => m[1])
  assert.deepEqual(runs, ['PrepareContext', 'Create'])
  assert.match(ps, /-Mode 'PrepareContext' -AuthenticationContextId 'c1' -AuthenticationContextDisplayName 'Privileged role activation'/)
  assert.match(ps, /-Mode 'Create' -AuthenticationContextId 'c1' -AuthenticationContextDisplayName 'Privileged role activation'/)
  const arm = (mode: string): string => ps.slice(ps.indexOf(`  '${mode}' {`), ps.indexOf('\n  }', ps.indexOf(`  '${mode}' {`)))
  const prepareArm = arm('PrepareContext')
  const read = prepareArm.indexOf('$existing = Get-ContextIfPresent')
  const refuse = prepareArm.indexOf("throw \"Authentication context $AuthenticationContextId already exists as")
  const write = prepareArm.indexOf('-Method PATCH')
  assert.ok(read >= 0 && refuse > read && write > refuse, `PrepareContext writes before it reads the context:\n${prepareArm}`)
  assert.match(prepareArm, /\$existing\.displayName -ne \$AuthenticationContextDisplayName -or \$existing\.description -ne \$ContextDescription/)
  const createArm = arm('Create')
  assert.ok(createArm.indexOf('Assert-ContextCanonical (Get-Context)') >= 0 && createArm.indexOf('Assert-ContextCanonical (Get-Context)') < createArm.indexOf('-Method POST'), `Create posts the policy before it checks the context:\n${createArm}`)
})

// R4-18, secondary. On a plan whose PIM policy had no strength resolved for the
// package's strength grant, the planning preview's settings read "Grant →
// Require authentication strength: Multifactor authentication": a strength IAMAI
// did not resolve, named as Microsoft's built-in one, beside a procedure asking
// for "IAMAI-resolved target strength". The preview names no strength it did
// not resolve — not its ‹…› stand-in either, which is a placeholder the portal
// of a held step never carries (ui/surfaces/stepResources.test.ts).
//
// That plan's PIM policy was the goal's own template (built-in MFA). A goal the
// pinned map holds is written from the pinned policy now (q-pin), so the strength
// goes unresolved the way it does in a real tenant: nothing there answers the
// baseline's own strength yet.
test('the preview names no strength IAMAI did not resolve', () => {
  const f = structuredClone(fixture('mid'))
  const strengths = f.snapshot.config.authStrengths as { rows: { policyType?: string }[] }
  strengths.rows = strengths.rows.filter((r) => r.policyType === 'builtIn')
  const { body, ctx, step } = pimOn(withFoundationSettled(f))
  assert.equal(packageBindings(step, ctx, body.contract)['authStrength.target.id'], undefined, 'the premise: the strength is unresolved here')
  const portal = channelText(body, 'portal')
  assert.match(portal, /Require authentication strength/, 'the procedure still states the requirement')
  assert.doesNotMatch(portal, /^- Grant → Require authentication strength: /m)
  assert.doesNotMatch(portal, /Multifactor authentication|‹authentication strength›/)
})

/**
 * A step's planned policy, already On in the tenant: enforced, matched to the
 * step, and waiting on the person's workflow record. As the plan builds it — its
 * own tag in the description — unless `edit` makes it the tenant's own.
 */
const enforcedOn = (id: string = PIM_STEP, edit: (policy: Record<string, unknown>) => void = () => {}): Fixture => {
  const f = pinnedMid()
  const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
  const op = plannedOperationsOf(r.steps.find((s) => s.id === id)!)[0]
  const policy: Record<string, unknown> = { ...structuredClone(op.body), state: 'enabled', id: '3a9e6c1d-2b4f-4e8a-9c7d-5f1b0a2e4d63', createdDateTime: '2026-07-01T00:00:00Z', modifiedDateTime: '2026-07-01T00:00:00Z' }
  edit(policy)
  ;(f.snapshot.config.caPolicies.rows as unknown[]).push(policy)
  return f
}
const pimEnforced = (): Fixture => enforcedOn()

// R4-18, the last link. Once the policy read enforced, the step said "Your
// review · Waiting on you · The policy is enforced and IAMAI is finished with
// it", offered a read-only inspection, and no channel ever said to configure the
// PIM role settings — only to "inspect each selected role's activation
// settings". Without that setting role activation never asks for the context,
// so the enforced policy requires nothing, and a reader would take it as
// protection activation did not have. The package authors the work
// (`pimSettingsPending`), which the runtime never entered. IAMAI does not read
// PIM role settings, so it stays the step's work until the workflow record.
//
// The enforced step has no operation to read the context from — plannedOperationsOf
// is empty there — so the PIM line read the raw stand-in: the context the policy
// targets is read off the tenant policy matched to the step.
test('an enforced activation policy asks for the PIM role settings that make it apply, and does not say IAMAI is finished', () => {
  const { step, body, ctx } = pimOn(pimEnforced())
  assert.equal(step.state.lifecycle, 'enforced', 'the premise: the policy reads enforced')
  assert.equal(step.manualReview?.readyToConfirm, true, 'the premise: only the workflow record is left')
  assert.equal(plannedOperationsOf(step).length, 0, 'the premise: no operation names the context here')
  const review = body.allTiles.find((t) => t.key === 'review')
  assert.ok(review, body.allTiles.map((t) => t.label).join(', '))
  assert.doesNotMatch(review.note ?? '', /IAMAI is finished/)
  assert.match(review.note ?? '', /only once each role's PIM settings require it, and IAMAI does not read PIM role settings/)
  assert.equal(packageBindings(step, ctx, body.contract)['authContext.target.id'], 'c1')
  const portal = channelText(body, 'portal')
  assert.match(portal, /Privileged Identity Management → Microsoft Entra roles → Roles\. For each selected role, open \*\*Role settings\*\* → \*\*Edit\*\* and enable \*\*On activation, require Microsoft Entra Conditional Access authentication context\*\*, selecting the authentication context with ID `c1` — the context this policy targets — then \*\*Update\*\*/)
  // The plan built this policy on its own context, so the name its create
  // proposed is said as that, on its own line.
  assert.match(portal, /^This plan proposed the name `Privileged role activation` for that context\.$/m)
  // IAMAI selects no roles, so the procedure does not say it did.
  assert.doesNotMatch(portal, /IAMAI-selected/)
  const task = body.emergencyAccountTasks?.tasks[0]
  assert.ok(task && /On activation, require Microsoft Entra Conditional Access authentication context/.test(task.steps[0]), JSON.stringify(task?.steps))
})

// The name IAMAI proposes is the create's instruction ("create or update … c1 /
// Privileged role activation, and publish it"), never a reading: IAMAI reads no
// authentication contexts. A tenant's own activation policy, found On with no
// plan tag, targets a context the tenant named itself, and the PIM line told the
// reader to select `Privileged role activation` — a context that may not exist,
// or a different one of that name, whose own policy then decides role activation.
// The ID is read off the policy.
//
// R4-18 review: the name then stayed unresolved and drew its ‹authentication
// context name› stand-in into the procedure — "selecting … ID `c7` (`‹authentication
// context name›`)" — a placeholder the portal of a step never carries
// (ui/surfaces/stepResources.test.ts), because the PIM state required a name IAMAI
// has no business giving a context the tenant named. The context is named by
// the ID its policy targets, and the premise of this test's last assertion changes
// with it: no stand-in, and the proposed-name line drops.
test('a tenant’s own activation policy is named by the context ID it targets, never by the name IAMAI proposes for its own', () => {
  const { step, body, ctx } = pimOn(enforcedOn(PIM_STEP, (p) => {
    delete p.description
    p.displayName = 'PIM step-up'
    ;(p.conditions as { applications: { includeAuthenticationContextClassReferences: string[] } }).applications.includeAuthenticationContextClassReferences = ['c7']
  }))
  assert.equal(step.state.lifecycle, 'enforced', 'the premise: the policy reads enforced')
  assert.equal(step.tracking?.matchedBy, 'fingerprint', 'the premise: the scan tied it by its settings, not by the plan’s tag')
  const bindings = packageBindings(step, ctx, body.contract)
  assert.equal(bindings['authContext.target.id'], 'c7')
  assert.equal(bindings['authContext.target.displayName'], undefined)
  const portal = channelText(body, 'portal')
  assert.match(portal, /selecting the authentication context with ID `c7` — the context this policy targets — then \*\*Update\*\*/)
  assert.doesNotMatch(portal, /Privileged role activation|‹[^›]+›|This plan proposed the name/)
})

// R4-18 review: the portal of a held or completed step never carries a ‹…›
// stand-in (ui/surfaces/stepResources.test.ts, on the demo and mid fixtures),
// and the PIM step on the pinned baseline is on neither, so its context line
// broke the rule where nothing looked: the enforced tenant's own policy read
// `‹authentication context name›`. Every state the PIM step reaches on the
// pinned mid tenant, as each channel's copyable text.
test('no PIM state on the pinned baseline draws a ‹…› stand-in into the portal, the script or the request', () => {
  const states: [string, Fixture][] = [
    ['create', pinnedMid()],
    ['create, on a context another policy targets', sharedContext()],
    ['report-only, the plan’s own', reportOnlyOn('c1', false)],
    ['report-only, the tenant’s own', reportOnlyOn('c7', true)],
    ['enforced, the plan’s own', pimEnforced()],
    ['enforced, the tenant’s own', enforcedOn(PIM_STEP, (p) => {
      delete p.description
      p.displayName = 'PIM step-up'
      ;(p.conditions as { applications: { includeAuthenticationContextClassReferences: string[] } }).applications.includeAuthenticationContextClassReferences = ['c7']
    })],
  ]
  for (const [name, f] of states) {
    const { body } = pimOn(f)
    for (const id of ['portal', 'ps', 'json']) assert.doesNotMatch(channelText(body, id), /‹[^›]+›/, `${name}/${id}`)
  }
})

/**
 * The PIM step with its policy already in the tenant, in report-only: the plan's
 * own (its tag in the description), or — `own` — the tenant's, found by its
 * settings with no tag, on context `context`.
 */
const reportOnlyOn = (context: string, own: boolean): Fixture =>
  enforcedOn(PIM_STEP, (p) => {
    p.state = 'enabledForReportingButNotEnforced'
    if (own) {
      delete p.description
      p.displayName = 'Contoso PIM step-up'
    }
    ;(p.conditions as { applications: { includeAuthenticationContextClassReferences: string[] } }).applications.includeAuthenticationContextClassReferences = [context]
  })

// R4-18 review (blocking). "Privileged role activation" is the name the package
// proposes for its own context — the one its create asks the reader to create —
// and it was bound for every operation. A tenant's own activation policy on c7,
// in report-only, read "Authentication context: Privileged role activation / c7"
// in AI Info, and a correction of its context target would have said to select
// `Privileged role activation` (`c7`): a context that may not exist, or another
// one of that name. The same policy lost the name once enforced, where only that
// path was gated. IAMAI reads no authentication contexts: the ID is read off the
// policy, and the name is bound only on the policy the plan builds on its own
// context.
test('a tenant’s own policy in report-only names its context by ID and never by the name IAMAI proposes for its own', () => {
  const { step, body, ctx } = pimOn(reportOnlyOn('c7', true))
  assert.equal(step.state.lifecycle, 'report-only', 'the premise: the policy reads report-only')
  const op = plannedOperationsOf(step)[0]
  assert.equal(op?.mode, 'update', 'the premise: the step hands over an update of the tenant’s policy')
  assert.equal(step.tracking?.members[0]?.matchedBy, 'operation-target', 'the premise: the tie is the operation’s, which says nothing of a tag')
  const bindings = packageBindings(step, ctx, body.contract)
  assert.equal(bindings['authContext.target.id'], 'c7')
  assert.equal(bindings['authContext.target.displayName'], undefined)
  assert.match(channelText(body, 'ai'), /^- Authentication context ID the policy targets: c7$/m)
  for (const a of body.artifacts) assert.doesNotMatch(a.text(), /Privileged role activation/, a.id)
  // The correction of that policy's context target names the context by its ID alone.
  const corrected = projectImplementation(PIM, 'partial', { ...bindings, [CHANGED_FIELDS_BINDING]: ['conditions.applications'] })
  const entra = corrected.channels.find((c) => c.channel === 'entra')?.text ?? ''
  assert.match(entra, /Set Target resources to the single authentication context with ID `c7`\./, JSON.stringify(corrected.hold))
  assert.doesNotMatch(entra, /Privileged role activation|‹/)
  const ai = corrected.channels.find((c) => c.channel === 'aiInfo')?.text ?? ''
  assert.match(ai, /Authentication context ID the policy targets: c7/)
  assert.doesNotMatch(ai, /Privileged role activation/)
})

// The counterpart: the policy the plan's create built — its tag in the
// description, on the package's own context — keeps the name the create asked
// for, before and after enforcement, and says it is the plan's proposal.
test('the plan’s own policy on its own context keeps the name the create proposed, as a proposal', () => {
  const { step, body, ctx } = pimOn(reportOnlyOn('c1', false))
  assert.equal(plannedOperationsOf(step)[0]?.mode, 'update', 'the premise: an update, whose tie says nothing of the tag')
  assert.equal(packageBindings(step, ctx, body.contract)['authContext.target.displayName'], 'Privileged role activation')
  assert.match(channelText(body, 'ai'), /^- Name this plan proposes for that context \(IAMAI does not read authentication contexts\): Privileged role activation$/m)
  // The plan's tag on a policy the reader moved to another context proves the
  // policy, not the context: c7 was never the context the create named.
  const moved = pimOn(reportOnlyOn('c7', false))
  assert.equal(packageBindings(moved.step, moved.ctx, moved.body.contract)['authContext.target.id'], 'c7')
  assert.equal(packageBindings(moved.step, moved.ctx, moved.body.contract)['authContext.target.displayName'], undefined)
})

// The note is the package's answer, not the tile's: another step waiting on its
// workflow record, with no setup after enforcement, keeps "IAMAI is finished".
test('an enforced step with no setup after enforcement keeps its own review words', () => {
  const { step, body } = pimOn(enforcedOn('s-goal-device-registration-mfa'), 's-goal-device-registration-mfa')
  assert.equal(step.manualReview?.readyToConfirm, true, 'the premise: only the workflow record is left')
  const note = body.allTiles.find((t) => t.key === 'review')?.note ?? ''
  // Its own review words (donewhen): what the scan confirmed, never that IAMAI is finished with it.
  assert.match(note, /^The scan found the policy enforced, with the assessed configuration in place./, note)
  assert.doesNotMatch(note, /PIM/, note)
})
