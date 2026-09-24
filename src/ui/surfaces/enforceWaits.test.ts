// The plan's own prerequisites of turning a policy on hold the turn-on in every
// channel (roadmap/enforceWaits.ts, operations.ts hold `prerequisite-unmet`).
//
// The board filed a ready-to-enforce policy On Hold on the emergency-access
// recovery test and, while security defaults were on, on Turn Off Security
// Defaults. Every channel of the same step handed over the turn-on anyway:
// "Change Enable policy to On", `{"state":"enabled"}`, a PowerShell Enforce mode
// with the policy id filled in, AI Info saying "the next action is enforcement",
// and What to do reading "ready to be turned on. The plan turns it on on Sep 21".
// The one dissent was a "Stop" line spliced into one channel. A reader enforced
// eight policies beside security defaults (Sam D2) — which Entra refuses,
// pointing at turning security defaults off, which removes the MFA they require
// while the plan's own MFA policy is still held — and another was handed an
// enabling script with the recovery test undone (Nadia D1). A warning beside an
// instruction is still the instruction; these assert that it is not given.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDirectionApproved, withRecoveryTested } from '../../roadmap/fixtures/run.ts'
import { cleanupComplete } from '../../roadmap/cleanupDone.ts'
import { implementationOffered, operationsOf, policyHold, policyResult } from '../../roadmap/operations.ts'
import { nextMilestone } from '../../roadmap/lifecycle.ts'
import { DRILL_PREREQUISITE, SECURITY_DEFAULTS_STEP_ID } from '../../roadmap/enforceWaits.ts'
import type { Step } from '../../roadmap/types.ts'
import { cleanupEntry } from './cleanupExport.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf, readinessBlockersOf } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView } from './stepExport.ts'
import { packageStateOf, plannedPackageStateOf } from './stepPackage.ts'
import type { StepVarContext } from './stepVars.ts'

/** The canonical ready-to-enforce policy: the demo's week-two token protection, seven clean days behind it, its recovery test recorded. */
const STEP_ID = 's-goal-token-protection'

/** Anything that turns a policy on, in any channel's words. */
const TURN_ON = /Enable policy\*\*\s*to\s*\*\*On|"state"\s*:\s*"enabled"|ValidateSet\([^)]*'Enforce'|-Mode 'Enforce'|next action is enforcement|ready to be turned on/

function base(): Fixture {
  return withDirectionApproved(curatedFixture('demo-week2'))
}

function withSecurityDefaultsOn(f: Fixture): Fixture {
  const g = structuredClone(f)
  g.snapshot.config.securityDefaults = { status: 'ok', rows: [{ isEnabled: true }] } as never
  return g
}

function withoutRecoveryTest(f: Fixture): Fixture {
  return { ...f, checkpoints: (f.checkpoints ?? []).filter((c) => (c as { cleanup?: string }).cleanup !== 'drill') }
}

/** The step as the screen draws it — the board's lane and blockers — and its artifacts' text. */
function drawn(f: Fixture, stepId = STEP_ID): { step: Step; run: ReturnType<typeof runFixture>; text: string; exported: string; ctx: StepVarContext } {
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === stepId)
  assert.ok(step, `${stepId} left the plan`)
  const cleanup = (run.schedule.cleanup?.rows ?? []).filter((row) => cleanupEntry(row.kind) !== null).map((row) => ({ id: `cleanup-${row.kind}`, complete: cleanupComplete(row, null) }))
  const readings = laneReadings(run.steps, cleanup)
  const titleOf = (id: string): string | null => run.steps.find((x) => x.id === id)?.title ?? null
  const reading = readings.get(stepId)
  const lane = reading ? laneViewOf(reading, titleOf) : null
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const body = stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf) })
  const text = body.artifacts.map((a) => `[${a.id}] ${a.text()}`).join('\n')
  const view = stepExportView(step, ctx, lane ?? undefined)
  const exported = [...view.whatToDo, view.dates ?? ''].join('\n')
  return { step, run, text, exported, ctx }
}

test('a ready-to-enforce policy hands over its turn-on only when nothing holds it: with security defaults on or the recovery test undone, no channel turns it on and the step names the wait', () => {
  {
    const { step, text } = drawn(base())
    assert.equal(step.state.lifecycle, 'ready-to-enforce', 'the premise: the evidence is earned')
    assert.equal(step.action.enforceWaitsOn, undefined, 'the premise: the recovery test is recorded and security defaults are off')
    assert.equal(policyResult(step).kind, 'implementable')
    assert.match(text, TURN_ON, 'the control does not offer the turn-on, so the cases below prove nothing')
  }
  {
    // The recovery test recorded on this configuration: turning security defaults
    // on changes what a recorded test covered, and this case is about them alone.
    const { step, run, text, exported, ctx } = drawn(withRecoveryTested(withSecurityDefaultsOn(base())))
    assert.equal(step.state.lifecycle, 'ready-to-enforce', 'the step keeps its stage: the evidence is still earned')
    assert.deepEqual(step.action.enforceWaitsOn?.map((w) => w.id), [SECURITY_DEFAULTS_STEP_ID])
    assert.equal(policyHold(step), 'prerequisite-unmet')
    assert.equal(implementationOffered(step), false)
    assert.equal(operationsOf(step).length > 0, true, 'held, not unavailable: the operation is sound and kept')
    // Neither what the package executes nor what it previews is the turn-on: the
    // step is not current (the security-defaults ordering blocks it), and what it
    // previews is the policy staying in Report-only.
    const contract = stepBodyOf(step, ctx).contract
    assert.notEqual(packageStateOf(step, contract, run.input.snapshot), 'readyToEnforce')
    assert.equal(plannedPackageStateOf(step, contract, run.input.snapshot), 'reportOnly')
    assert.doesNotMatch(text, TURN_ON, `a channel still turns the policy on:\n${text}`)
    assert.doesNotMatch(exported, TURN_ON, `the export still turns the policy on:\n${exported}`)
    const m = nextMilestone(step)
    // The policy card's own words (walk list 4.x items 17 and 20).
    assert.match(m.label, /It turns on after Turn Off Security Defaults/, m.label)
    assert.match(m.label, /Turn Off Security Defaults turns security defaults off and this policy on together/, m.label)
    assert.doesNotMatch(m.label, /ready to be turned on/)
  }
  {
    const { step, text, exported } = drawn(withoutRecoveryTest(base()))
    assert.deepEqual(step.action.enforceWaitsOn?.map((w) => w.id), [DRILL_PREREQUISITE])
    assert.equal(policyHold(step), 'prerequisite-unmet')
    assert.doesNotMatch(text, TURN_ON, `a channel still turns the policy on:\n${text}`)
    assert.doesNotMatch(exported, TURN_ON, `the export still turns the policy on:\n${exported}`)
    const m = nextMilestone(step)
    assert.match(m.label, /It turns on after Verify Emergency Access/, m.label)
    assert.doesNotMatch(m.label, /security defaults/i, 'a wait that is not there is named')
    // The day stays: waiting on a step the plan schedules is sequencing (owner, Step 4).
    assert.equal(m.at, step.events?.enforce.at ?? null)
  }
})

test('a create lands in report-only and denies nobody, so the hold leaves it offered; a policy already on is finished with the turn-on', () => {
  {
    const run = runFixture(withSecurityDefaultsOn(withoutRecoveryTest(base())))
    const creates = run.steps.filter((s) => (s.action.enforceWaitsOn?.length ?? 0) > 0 && operationsOf(s).some((o) => o.mode === 'create'))
    assert.ok(creates.length > 0, 'the premise: a policy still to be created waits on both')
    for (const s of creates) assert.notEqual(policyHold(s), 'prerequisite-unmet', `${s.id}: a report-only create was held`)
  }
  {
    const f = withSecurityDefaultsOn(base())
    const run = runFixture(f)
    for (const s of run.steps) if (s.state.lifecycle === 'enforced') assert.notEqual(policyHold(s), 'prerequisite-unmet', `${s.id} is already on and was held`)
  }
})
