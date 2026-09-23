// A policy this plan tagged that the tenant switched off (Jordan D6).
//
// The step's own words said "Core - Block - Device code flow is already in the
// tenant and switched off. Turning it back on is the change here, not a new
// policy". Around them: the board read "Ready · Create", AI Info said "IAMAI did
// not find Block Device Code Sign-in… The next action is to create it in
// Report-only" and stated the create's settings as the intended result, and a
// finding said "or follow the instructions below and leave it switched off" over
// no instructions. Following any of them makes a second policy.
//
// And the way it said to restore the policy was "set Enable policy to On": a
// policy that is Off went straight to enforcing, with no report-only watch in
// between, whether it was never watched or was switched off after it broke
// something. The owner, 2026-09-23: "We only want one set of report-only. If
// someone has to revert and turns it off, we should advise placing it to
// Report-only, and then they switch it on when they are ready and data supports
// it." So an Off policy is set to Report-only on every channel, and the step's
// ordinary report-only watch and readiness gates decide the turn-on after that.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from '../../roadmap/fixtures/run.ts'
import { observationsOf } from '../../roadmap/tracking.ts'
import { pinnedPackage } from '../../baseline/pinned.ts'
import { enforcementHeld, unavailableReason } from '../../roadmap/operations.ts'
import type { Step } from '../../roadmap/types.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf, readinessBlockersOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView, stepLines } from './stepExport.ts'
import { CONTRACT } from './stepContract.ts'
import { app } from '../../content/content.ts'
import type { StepVarContext } from './stepVars.ts'

const STEP = 's-goal-block-device-code'

/**
 * A turn-on, in any channel's words: "Enable policy: On", "set Enable policy to
 * On", "from Report-only to On", or a request body or script that switches the
 * policy on.
 */
const TURN_ON = /Enable policy\**\s*(?::|to|from\s+\**Report-only\**\s+to)\s*\**On\b|"state":\s*"enabled"|state\s*=\s*'enabled'/i
/**
 * A second policy, in any channel's words: the portal's "New policy", a Graph
 * create (on its own or inside a batch), and the scripts that create one.
 */
const CREATE = /New policy|New-MgIdentityConditionalAccessPolicy|CreateMissing|"method":\s*"POST",\s*"url":\s*"\/identity\/conditionalAccess\/policies"/
/** The instruction every channel gives instead, in the portal's own words. */
const REPORT_ONLY = /set Enable policy to Report-only/i
const GRAPH_POLICY = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/'

/** The policies the step tracks that the tenant has Off, read from the scan's own tracking: one per member. */
function offOf(step: Step): { name: string; id: string }[] {
  return (step.tracking?.members ?? []).flatMap((m) => (m.state === 'disabled' && m.policyId && m.policyName ? [{ name: m.policyName, id: m.policyId }] : []))
}

type Scan = { f: Fixture; run: ReturnType<typeof runFixture> }

function drawn({ f, run }: Scan, id: string) {
  const step = run.steps.find((s) => s.id === id)
  assert.ok(step, `the premise: ${id} is on the plan`)
  const reading = laneReadings(run.steps).get(id)
  assert.ok(reading)
  const titleOf = (x: string): string | null => run.steps.find((s) => s.id === x)?.title ?? null
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const lane = laneViewOf(reading, titleOf)
  const body = stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf) })
  return { step, reading, ctx, lane, body, text: body.artifacts.map((a) => a.text()).join('\n') }
}

/** midflight carries this plan's device-code policy, tagged and switched off; on the baseline the product ships. */
const settled = (): Fixture => withFoundationSettled({ ...fixture('midflight'), baseline: pinnedPackage() })
const scanOf = (f: Fixture): Scan => ({ f, run: runFixture(f) })

/**
 * The same tenant `days` on, with the policy the first scan tracked for `id`
 * now in `state`: switched off after it was on (a revert), or set to Report-only.
 */
function later(id: string, state: string, f: Fixture = withFoundationSettled(structuredClone(fixture('midflight'))), days = 7): Scan & { before: Step } {
  const first = runFixture(f)
  const before = first.steps.find((s) => s.id === id)!
  assert.ok(before.tracking?.policyName, `the premise: ${id} tracks a policy`)
  const g = structuredClone(f)
  const rows = (g.snapshot.config.caPolicies!.rows ?? []) as Record<string, unknown>[]
  const row = rows.find((r) => String(r.displayName) === before.tracking!.policyName)
  assert.ok(row, `the premise: the tenant holds ${before.tracking!.policyName}`)
  row.state = state
  g.snapshot.asOf = new Date(Date.parse(g.snapshot.asOf) + days * 864e5).toISOString()
  return { f: g, run: runFixture(g, {}, observationsOf(first.steps, undefined), g.snapshot.asOf), before }
}

/**
 * Every channel of a step with a tracked policy Off says to set each Off policy
 * to Report-only, and none turns one on or builds a second one. `reason` is the
 * step's own reason: `switched-off`, or `missing-object`, which outranks it and
 * whose What to do names the missing object; the procedure it hands over for
 * the policy is the same.
 */
function assertReportOnlyEverywhere(scan: Scan, id: string, label: string, reason: 'switched-off' | 'missing-object' = 'switched-off'): void {
  const { step, ctx, lane, body } = drawn(scan, id)
  const off = offOf(step)
  assert.ok(off.length > 0, `${label}: the premise: the tenant has a tracked policy switched off`)
  assert.equal(unavailableReason(step), reason, `${label}: the step reads ${unavailableReason(step)}`)
  // The step's one action.
  if (reason === 'switched-off') {
    assert.match(body.contract.whatToDo.text, REPORT_ONLY, `${label}: What to do: ${body.contract.whatToDo.text}`)
    for (const p of off) assert.ok(body.contract.whatToDo.text.includes(p.name), `${label}: What to do does not name ${p.name}: ${body.contract.whatToDo.text}`)
  }
  assert.doesNotMatch(body.contract.whatToDo.text, TURN_ON, `${label}: What to do turns it on`)
  const artifact = (x: string) => body.artifacts.find((a) => a.id === x)
  // The Readiness tile that carries the action names it, rather than calling the
  // implementation unavailable over a procedure the step hands over.
  const tile = body.readiness.tiles.find((t) => t.key === 'implementation')
  if (tile) assert.match(String(tile.value), /Report-only/, `${label}: the implementation tile reads "${tile.value}"`)
  // The portal lines: each policy that is Off, by name and id.
  const portal = artifact('portal')
  assert.ok(portal, `${label}: no portal channel`)
  assert.match(portal.text(), REPORT_ONLY, `${label}: portal: ${portal.text()}`)
  for (const p of off) assert.ok(portal.text().includes(p.name) && portal.text().includes(p.id), `${label}: the portal does not name ${p.name}`)
  // The Implementation Task drawn from them.
  const task = body.emergencyAccountTasks?.tasks[0]
  assert.ok(task, `${label}: no Implementation Task`)
  assert.match(task.title, /Report-only/, `${label}: the task is called "${task.title}"`)
  assert.ok(task.steps.some((s) => REPORT_ONLY.test(s)), `${label}: task steps: ${task.steps.join(' | ')}`)
  // JSON and PowerShell: the one-field patch to each policy that is there, and
  // to nothing else. One policy is one PATCH; more are one Graph batch of them.
  const json = artifact('json')
  assert.ok(json, `${label}: no JSON channel`)
  const sent = JSON.parse(json.text()) as { state?: string; requests?: { method: string; url: string; body: unknown }[] }
  if (off.length === 1) {
    assert.deepEqual(sent, { state: 'enabledForReportingButNotEnforced' }, `${label}: JSON: ${json.text()}`)
    assert.equal(json.note, `PATCH ${GRAPH_POLICY}${off[0].id}`)
  } else {
    assert.equal(json.note, 'POST https://graph.microsoft.com/v1.0/$batch', `${label}: JSON note`)
    assert.deepEqual(
      (sent.requests ?? []).map((r) => [r.method, r.url, r.body]),
      off.map((p) => ['PATCH', `/identity/conditionalAccess/policies/${p.id}`, { state: 'enabledForReportingButNotEnforced' }]),
      `${label}: JSON: ${json.text()}`,
    )
  }
  const ps = artifact('ps')
  assert.ok(ps, `${label}: no PowerShell channel`)
  for (const p of off) assert.ok(ps.text().includes(`Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId '${p.id}'`), `${label}: PowerShell: ${ps.text()}`)
  assert.equal(ps.text().match(/Update-MgIdentityConditionalAccessPolicy/g)?.length, off.length, `${label}: PowerShell updates a policy that is not Off`)
  assert.match(ps.text(), /"state": "enabledForReportingButNotEnforced"/)
  // AI Info.
  const ai = artifact('ai')
  assert.ok(ai, `${label}: no AI Info`)
  assert.match(ai.text(), REPORT_ONLY, `${label}: AI Info does not say Report-only`)
  // The exports: the view every artifact speaks from, and its lines.
  const view = stepExportView(step, ctx, lane)
  assert.ok(view.whatToDo.some((l) => REPORT_ONLY.test(l)), `${label}: export: ${view.whatToDo.join(' | ')}`)
  const lines = stepLines(step, ctx)
  // And nothing anywhere says On, or builds a second policy.
  const spoken: [string, string][] = [...body.artifacts.map((a): [string, string] => [a.id, a.text()]), ['task', task.steps.join('\n')], ['export', view.whatToDo.join('\n')], ['lines', lines.join('\n')]]
  for (const [where, text] of spoken) {
    assert.doesNotMatch(text, TURN_ON, `${label}: ${where} turns the policy on: ${text.match(TURN_ON)?.[0]}`)
    assert.doesNotMatch(text, CREATE, `${label}: ${where} builds a second policy: ${text.match(CREATE)?.[0]}`)
  }
}

test('a switched-off tagged policy reads Correct on the board, and no channel builds a second one', () => {
  const { step, reading, body, text } = drawn(scanOf(settled()), STEP)
  assert.equal(offOf(step).length, 1, 'the premise: the tenant holds the tagged policy, switched off')
  assert.equal(unavailableReason(step), 'switched-off')
  assert.equal(reading.substatus, 'Correct', `the board reads "${reading.lane} · ${reading.substatus}" over a policy that exists`)
  assert.doesNotMatch(text, /did not find|create it in Report-only|Policies → New policy/, 'a channel builds the policy the tenant already has')
  assert.equal(body.contract.found.some((f) => /follow the instructions below/.test(f.text)), false, 'a finding points at instructions the step does not give')
})

test('a policy found Off is set to Report-only on every channel, never straight to On', () => {
  // Whether or not the plan's own prerequisites of enforcement are met: Report-only
  // denies nobody, so the recovery test holds the turn-on and not this.
  const held = scanOf(settled())
  assert.ok((drawn(held, STEP).step.action.enforceWaitsOn ?? []).length > 0, 'the premise: the recovery test is still outstanding')
  assertReportOnlyEverywhere(held, STEP, 'recovery untested')
  const tested = scanOf(withRecoveryTested(settled()))
  assert.equal(drawn(tested, STEP).step.action.enforceWaitsOn, undefined, 'the premise: nothing the plan asks for first is outstanding')
  assertReportOnlyEverywhere(tested, STEP, 'recovery tested')
})

test('a policy switched Off after the plan turned it On (a revert) goes back to Report-only, not On', () => {
  const ID = 's-goal-block-legacy-auth'
  const scan = later(ID, 'disabled')
  assert.equal(scan.before.state.lifecycle, 'enforced', 'the premise: IAMAI watched this policy go live')
  assertReportOnlyEverywhere(scan, ID, 'reverted')
})

test('a reverted policy whose readiness threshold is unmet is still set to Report-only, and the threshold waits for the turn-on', () => {
  // Report-only changes nothing anybody has to do, so a threshold the plan
  // waits for holds the turn-on and never this. The gate stays on the step.
  let checked = 0
  for (const ID of ['s-goal-admins-phishing-resistant', 's-goal-mfa-all-users']) {
    const scan = later(ID, 'disabled')
    const step = scan.run.steps.find((s) => s.id === ID)!
    if (!enforcementHeld(step)) continue
    checked++
    assertReportOnlyEverywhere(scan, ID, `${ID} (threshold unmet)`)
    assert.ok(drawn(scan, ID).body.contract.found.some((x) => x.key === 'gate'), `${ID}: the threshold the turn-on waits for is no longer on the step`)
  }
  assert.ok(checked > 0, 'no gated step reached the case')
})

test('once the policy is in Report-only the step is the ordinary report-only step, and never asks for Report-only again', () => {
  const ID = 's-goal-block-legacy-auth'
  const off = later(ID, 'disabled')
  const back = later(ID, 'enabledForReportingButNotEnforced', off.f, 1)
  const { step, body } = drawn(back, ID)
  assert.equal(step.tracking?.state, 'enabledForReportingButNotEnforced', 'the premise: the next scan finds it in Report-only')
  assert.equal(step.state.lifecycle === 'report-only' || step.state.lifecycle === 'ready-to-enforce', true, `it reads ${step.state.lifecycle}, not the report-only stage`)
  assert.notEqual(unavailableReason(step), 'switched-off')
  assert.doesNotMatch(body.contract.whatToDo.text, REPORT_ONLY, `a policy already in Report-only is told to go to Report-only: ${body.contract.whatToDo.text}`)
  for (const a of body.artifacts) assert.doesNotMatch(a.text(), REPORT_ONLY, `${a.id} asks for Report-only again`)
})

test('the other readings of a policy found Off say Report-only too, and never On', () => {
  // A tagged policy found Off on a step something else holds first (the
  // tagged-disabled finding), and a step whose every tracked policy is Off with
  // no operation to offer (noOperationDisabled): the same rule, in their words.
  for (const [key, line] of [['foundTaggedDisabled', CONTRACT.foundTaggedDisabled], ['noOperationDisabled', app.plan.noOperationDisabled]] as const) {
    assert.match(line, REPORT_ONLY, `${key}: ${line}`)
    assert.doesNotMatch(line, TURN_ON, `${key}: ${line}`)
    assert.doesNotMatch(line, /\benable it\b|\bScan again once it is on\b/i, `${key}: ${line}`)
  }
})

const GUESTS = 's-goal-guests-mfa'
const REPORT_ONLY_STATE = 'enabledForReportingButNotEnforced'
/** Sample ids for the pair's two policies, never a tenant's. */
const PAIR_IDS = ['c0200000-0000-4000-8000-000000000000', 'c0200000-0000-4000-8000-000000000001'] as const

/**
 * getiamai on the pin, where the guests' MFA goal is two policies: both built in
 * Report-only as the plan wrote them and scanned, then a week on with each in
 * `states`. The step tracks the pair by its members; no one policy is the step.
 */
function guestsPair(states: readonly [string, string]): Scan {
  const base = withFoundationSettled(structuredClone(fixture('getiamai')))
  base.baseline = pinnedPackage()
  const first = runFixture(base)
  const creates = first.steps.find((s) => s.id === GUESTS)?.action.resolution?.policies ?? []
  assert.deepEqual(creates.map((o) => o.mode), ['create', 'create'], 'the premise: the guests goal is a pair the plan creates')
  const built = structuredClone(base)
  const at = built.snapshot.asOf
  creates.forEach((o, i) => (built.snapshot.config.caPolicies!.rows as Record<string, unknown>[]).push({ ...structuredClone(o.body as object), id: PAIR_IDS[i], state: REPORT_ONLY_STATE, createdDateTime: at, modifiedDateTime: at }))
  built.snapshot.asOf = new Date(Date.parse(at) + 864e5).toISOString()
  const second = runFixture(built, {}, observationsOf(first.steps, undefined), built.snapshot.asOf)
  const watched = second.steps.find((s) => s.id === GUESTS)!
  assert.deepEqual(watched.tracking?.members.map((m) => m.state), [REPORT_ONLY_STATE, REPORT_ONLY_STATE], 'the premise: the next scan tracks both, in Report-only')
  assert.equal(watched.tracking?.policyId, null, 'the premise: no one policy is the pair')
  const g = structuredClone(built)
  states.forEach((state, i) => ((g.snapshot.config.caPolicies!.rows as Record<string, unknown>[]).find((r) => r.id === PAIR_IDS[i])!.state = state))
  g.snapshot.asOf = new Date(Date.parse(built.snapshot.asOf) + 7 * 864e5).toISOString()
  return { f: g, run: runFixture(g, {}, observationsOf(second.steps, undefined), g.snapshot.asOf) }
}

test('a pair with one policy switched Off sets that one to Report-only, and never recreates or turns on either', () => {
  // It handed over a Graph batch creating both guest policies again, and the
  // script in CreateMissing mode, beside a policy of each already there.
  const scan = guestsPair(['disabled', REPORT_ONLY_STATE])
  const step = scan.run.steps.find((s) => s.id === GUESTS)!
  assert.deepEqual(offOf(step).map((p) => p.id), [PAIR_IDS[0]], 'the premise: one member is Off')
  assertReportOnlyEverywhere(scan, GUESTS, 'one Off')
  // The one in Report-only is not touched: its turn-on waits for the pair.
  const { body } = drawn(scan, GUESTS)
  for (const a of body.artifacts.filter((x) => x.id === 'json' || x.id === 'ps')) assert.equal(a.text().includes(PAIR_IDS[1]), false, `${a.id} changes the member already in Report-only`)
})

test('a pair with one policy Off is set to Report-only even where nothing holds the turn-on', () => {
  // With the readiness threshold and the prerequisites met, the batch PATCHed
  // {"state":"enabled"} onto the policy that was Off: straight from Off to On.
  const scan = guestsPair(['disabled', REPORT_ONLY_STATE])
  const step = scan.run.steps.find((s) => s.id === GUESTS)!
  delete step.action.readinessGate
  delete step.action.enforceWaitsOn
  assertReportOnlyEverywhere(scan, GUESTS, 'one Off, nothing holding the turn-on')
})

test('a pair with both policies Off sets each to Report-only, and never recreates them', () => {
  // It said "Create the two guest policies" with a create for each, beside the
  // two already there, and nothing said Report-only.
  const scan = guestsPair(['disabled', 'disabled'])
  const step = scan.run.steps.find((s) => s.id === GUESTS)!
  assert.deepEqual(offOf(step).map((p) => p.id), [...PAIR_IDS], 'the premise: both members are Off')
  assertReportOnlyEverywhere(scan, GUESTS, 'both Off')
})

test('a pair reverted Off after it was enforced goes back to Report-only', () => {
  // Both on, then one switched Off: the step read "nothing to submit" over a
  // script in CreateMissing mode and a batch that created both again.
  const on = guestsPair(['enabled', 'enabled'])
  const g = structuredClone(on.f)
  ;(g.snapshot.config.caPolicies!.rows as Record<string, unknown>[]).find((r) => r.id === PAIR_IDS[0])!.state = 'disabled'
  g.snapshot.asOf = new Date(Date.parse(on.f.snapshot.asOf) + 7 * 864e5).toISOString()
  const scan = { f: g, run: runFixture(g, {}, observationsOf(on.run.steps, undefined), g.snapshot.asOf) }
  assert.deepEqual(offOf(scan.run.steps.find((s) => s.id === GUESTS)!).map((p) => p.id), [PAIR_IDS[0]], 'the premise: one member is Off')
  assertReportOnlyEverywhere(scan, GUESTS, 'reverted pair')
})
