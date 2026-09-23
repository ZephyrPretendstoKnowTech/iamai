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
import { enforcementHeld, switchedOffPolicy, unavailableReason } from '../../roadmap/operations.ts'
import type { Step } from '../../roadmap/types.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf, readinessBlockersOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView, stepLines } from './stepExport.ts'
import type { StepVarContext } from './stepVars.ts'

const STEP = 's-goal-block-device-code'

/**
 * A turn-on, in any channel's words: "Enable policy: On", "set Enable policy to
 * On", "from Report-only to On", or a request body that switches the policy on.
 */
const TURN_ON = /Enable policy\**\s*(?::|to|from\s+\**Report-only\**\s+to)\s*\**On\b|"state":\s*"enabled"/i
/** The instruction every channel gives instead, in the portal's own words. */
const REPORT_ONLY = /set Enable policy to Report-only/i

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

/** Every channel the switched-off step speaks through says Report-only, and none says On. */
function assertReportOnlyEverywhere(scan: Scan, id: string, label: string): void {
  const { step, ctx, lane, body } = drawn(scan, id)
  const off = switchedOffPolicy(step)
  assert.ok(off, `${label}: the premise: the tenant has the tracked policy switched off`)
  assert.equal(unavailableReason(step), 'switched-off', `${label}: the step does not read it as switched off`)
  // The step's one action.
  assert.match(body.contract.whatToDo.text, REPORT_ONLY, `${label}: What to do: ${body.contract.whatToDo.text}`)
  assert.doesNotMatch(body.contract.whatToDo.text, TURN_ON, `${label}: What to do turns it on`)
  assert.ok(body.contract.whatToDo.text.includes(off.name), `${label}: What to do does not name the policy`)
  const artifact = (x: string) => body.artifacts.find((a) => a.id === x)
  // The portal lines.
  const portal = artifact('portal')
  assert.ok(portal, `${label}: no portal channel`)
  assert.match(portal.text(), REPORT_ONLY, `${label}: portal: ${portal.text()}`)
  assert.ok(portal.text().includes(off.name), `${label}: the portal does not name the policy`)
  // The Implementation Task drawn from them.
  const task = body.emergencyAccountTasks?.tasks[0]
  assert.ok(task, `${label}: no Implementation Task`)
  assert.match(task.title, /Report-only/, `${label}: the task is called "${task.title}"`)
  assert.ok(task.steps.some((s) => REPORT_ONLY.test(s)), `${label}: task steps: ${task.steps.join(' | ')}`)
  // JSON and PowerShell: the one-field patch to the policy that is there.
  const json = artifact('json')
  assert.ok(json, `${label}: no JSON channel`)
  assert.deepEqual(JSON.parse(json.text()), { state: 'enabledForReportingButNotEnforced' }, `${label}: JSON: ${json.text()}`)
  assert.equal(json.note, `PATCH https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/${off.id}`)
  const ps = artifact('ps')
  assert.ok(ps, `${label}: no PowerShell channel`)
  assert.ok(ps.text().includes(`Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId '${off.id}'`), `${label}: PowerShell: ${ps.text()}`)
  assert.match(ps.text(), /"state": "enabledForReportingButNotEnforced"/)
  // AI Info.
  const ai = artifact('ai')
  assert.ok(ai, `${label}: no AI Info`)
  assert.match(ai.text(), REPORT_ONLY, `${label}: AI Info does not say Report-only`)
  // The exports: the view every artifact speaks from, and its lines.
  const view = stepExportView(step, ctx, lane)
  assert.ok(view.whatToDo.some((l) => REPORT_ONLY.test(l)), `${label}: export: ${view.whatToDo.join(' | ')}`)
  const lines = stepLines(step, ctx)
  // And nothing anywhere says On.
  const spoken: [string, string][] = [...body.artifacts.map((a): [string, string] => [a.id, a.text()]), ['task', task.steps.join('\n')], ['export', view.whatToDo.join('\n')], ['lines', lines.join('\n')]]
  for (const [where, text] of spoken) assert.doesNotMatch(text, TURN_ON, `${label}: ${where} turns the policy on: ${text.match(TURN_ON)?.[0]}`)
}

test('a switched-off tagged policy reads Correct on the board, and no channel builds a second one', () => {
  const { step, reading, body, text } = drawn(scanOf(settled()), STEP)
  assert.ok(switchedOffPolicy(step), 'the premise: the tenant holds the tagged policy, switched off')
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
