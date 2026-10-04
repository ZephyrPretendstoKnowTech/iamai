// Policies as JSON (F-024; owner, 2026-10-04): every policy step in one file, a
// body only where the step's own tabs hand one over today.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { boardOf } from './planBoard.ts'
import { planPoliciesOf } from './planPolicies.ts'
import { stepOperations } from './stepJson.ts'
import { lockdownKitCreatesOf } from './lockdownKitStep.ts'
import { LOCKDOWN_KIT_STEP_ID } from '../../roadmap/stepIds.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { baselineNamesFrom } from './planPolicies.ts'

const META = { tenantId: 't', tenantName: 'Contoso', baselineSource: 'jhope188/ConditionalAccessPolicies', baselinePin: 'abc', generated: '2026-10-04T00:00:00.000Z' }

function fileOf(f: ReturnType<typeof fixture>) {
  const r = runFixture(f)
  const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  return { r, file: planPoliciesOf(board, { ...META, baselineNamesOf: baselineNamesFrom(PINNED_GOAL_MAP, f.baseline.policies) }) }
}

test('every policy step is one entry, by its Plan number, with the baseline policies it comes from; the kit is among them', () => {
  for (const f of [curatedFixture('demo'), withFoundationSettled(curatedFixture('demo-week2'))]) {
    const { r, file } = fileOf(f)
    assert.equal(file.tool, 'IAMAI Planner')
    assert.deepEqual(file.baseline, { source: META.baselineSource, pin: 'abc' })
    const policySteps = r.steps.filter((s) => s.kind === 'create' || s.kind === 'adjust' || s.id === LOCKDOWN_KIT_STEP_ID)
    assert.ok(file.steps.length > 10 && file.steps.length <= policySteps.length, `${f.name}: ${file.steps.length} of ${policySteps.length}`)
    for (const e of file.steps) {
      assert.match(e.step, /^\d+\.\d+$/, `${e.title}: numbered as the Plan numbers it`)
      assert.ok(e.baselinePolicies.length > 0, `${e.title}: names the baseline policy it comes from`)
      assert.equal(e.operations !== undefined, e.status === 'write', `${e.title}: a body only where it writes today`)
    }
    assert.ok(file.steps.some((e) => e.title === 'Prepare the Lockdown Kit'))
  }
})

test('a step that writes today carries exactly its own operations; one that waits or is in place carries none', () => {
  const f = withFoundationSettled(curatedFixture('demo-week2'))
  const { r, file } = fileOf(f)
  const writes = file.steps.filter((e) => e.status === 'write')
  assert.ok(writes.length >= 3, `the premise: some steps write today (${writes.length})`)
  for (const e of writes) {
    const step = r.steps.find((s) => s.action.resolution?.policies?.some((o) => e.baselinePolicies.includes(o.sourceName)) && (e.title.length > 0))!
    const own = step.id === LOCKDOWN_KIT_STEP_ID ? lockdownKitCreatesOf(step) : stepOperations(step)
    assert.deepEqual(e.operations!.map((o) => o.body), own.map((o) => o.body), `${e.title}: the same bodies as its own tabs`)
  }
  // The kit's switches are created Off.
  const kit = file.steps.find((e) => e.title === 'Prepare the Lockdown Kit')!
  if (kit.status === 'write') for (const o of kit.operations!) assert.equal(o.body.state, 'disabled')
  // The demo's first scan: Emergency Access is not settled, so no policy is handed over before it.
  const first = fileOf(curatedFixture('demo')).file
  for (const e of first.steps) if (e.status === 'write') assert.ok(e.title === 'Prepare the Lockdown Kit' || e.operations!.every((o) => o.body.state !== 'enabled'), `${e.title}: nothing enforcing is handed over on a first scan`)
})

test('Export offers it in Doing the work, unredacted as an implementation artifact', () => {
  const src = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')
  assert.match(src, /exportName\('iamai-policies\.json', fileTenant, \{ id: snapshot\.tenantId \}\)/)
  assert.match(src, /planPoliciesOf\(board, \{/)
  assert.match(src, /unredactedFrom\('implementation-artifact'\)\)\}>\s*\{buttons\('policies'\)\[0\]\}/)
})
