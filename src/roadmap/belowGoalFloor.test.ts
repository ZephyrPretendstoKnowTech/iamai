// R4-11 on the pin (owner decision, 2026-09-22: "enforce as written, say it").
//
// The pinned baseline files "IAC - GLOBAL - GRANT - MFA - AllAdmins" under the
// admins goal, whose floor is phishing-resistant MFA, and grants it the
// "Modern MFA + TAP" strength. Built exactly as written and watched in
// report-only, the step was handed that same grant back as a correction on
// every scan and never offered the turn-on: coverage read the grant below the
// floor, and a below-floor policy was never switched. The pinned baseline wins:
// the switch is offered, and the step says the grant is weaker — never an
// instruction to change it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asCuratedBaseline, curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { stepContract, readinessOf } from '../ui/surfaces/stepContract.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

const ADMINS = 's-goal-admins-phishing-resistant'
const onPin = (): Fixture => withFoundationSettled({ ...fixture('small'), baseline: asCuratedBaseline(pinnedPackage() as never) })

function tileOf(f: Fixture, r: ReturnType<typeof runFixture>) {
  const step = r.steps.find((s) => s.id === ADMINS)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const c = stepContract(step, ctx)
  return { step, c, tile: readinessOf(step, c).tiles.find((t) => t.key === 'below-goal-floor') ?? null }
}

test('on the pin, the admin step says its grant is weaker than phishing-resistant MFA and never says to change it; where the policy meets the floor, nothing is said', () => {
  // on the pin, the admin step says its grant is weaker than phishing-resistant MFA, from the create on
  {
    const f = onPin()
    const r = runFixture(f)
    const { step, tile, c } = tileOf(f, r)
    assert.equal(step.action.resolution?.policies[0]?.mode, 'create', 'the premise: the step creates the baseline policy')
    assert.ok(step.action.belowGoalFloor, 'the engine reads the written grant below the floor')
    assert.ok(tile, 'the step states it')
    assert.equal(tile.tone, 'warn')
    assert.equal(tile.value, 'Weaker than phishing-resistant MFA')
    assert.match(tile.note ?? '', /^The baseline writes this policy to ask for the .+ authentication strength, which is weaker than the phishing-resistant MFA this goal names\. IAMAI builds it and turns it on as the baseline wrote it\.$/, tile.note ?? '')
    assert.doesNotMatch([tile.note, c.whatToDo.text, ...c.doneWhen].join(' '), /change (the|its) grant|replace the strength|raise/i, 'no instruction to change it')
  }

  // where the baseline's policy meets the floor, nothing is said
  {
    const f = withFoundationSettled(curatedFixture('small'))
    const r = runFixture(f)
    const { step, tile } = tileOf(f, r)
    assert.equal(step.action.belowGoalFloor, undefined)
    assert.equal(tile, null)
  }
})

test('on the pin, built exactly as written and watched, the admin policy is offered its turn-on, not its own grant again', () => {
  const f = onPin()
  const op = runFixture(f).steps.find((s) => s.id === ADMINS)!.action.resolution!.policies[0]
  const row = { ...(structuredClone(op.body) as Record<string, unknown>), id: 'c0100000-0000-4000-8000-0000000000a1', state: 'enabledForReportingButNotEnforced', createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf }
  const g = structuredClone(f)
  ;(g.snapshot.config.caPolicies!.rows as Record<string, unknown>[]).push(row)
  const r = runFixture(g, { snapshot: g.snapshot } as never)
  const step = r.steps.find((s) => s.id === ADMINS)!
  const ops = step.action.resolution?.policies ?? []
  assert.deepEqual(ops.map((o) => [o.mode, o.body]), [['update', { state: 'enabled' }]], `the switch, and nothing it already holds: ${JSON.stringify(ops.map((o) => o.body))}`)
  assert.ok(tileOf(g, r).tile, 'the weaker grant is still stated')
})
