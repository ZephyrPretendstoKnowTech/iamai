import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const STEP = 's-goal-directory-baseline-scopes-mfa'

function plan(name: 'demo' | 'demo-week2') {
  const f = fixture(name)
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot) }
  return { ctx, step: r.steps.find((s) => s.id === STEP)! }
}

test('directory creation explains missing tabs and the actual wait in both sample states', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const { ctx, step } = plan(name)
    const body = stepBodyOf(step, ctx)
    assert.ok(!body.artifacts.some((a) => a.id === 'ps' || a.id === 'json'), `${name}: the safety gate still withholds the tabs`)
    const task = body.emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!.steps.join('\n')
    assert.match(task, /created from the \*\*PowerShell\*\* or \*\*JSON\*\* tab/)
    assert.match(task, name === 'demo' ? /Create or Correct Service Accounts Group/ : /Confirm What You Use/)
    assert.match(task, /Tasks Remaining.*Scan to update the plan/)
    assert.match(task, /Those tabs appear once/)
    assert.doesNotMatch(task, /so create this policy from/)
    const instruction = body.emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!.steps.find((line) => line.includes('Those tabs appear once'))!
    assert.ok(body.artifacts.find((a) => a.id === 'portal')!.text().includes(instruction), 'the displayed and copied Entra instruction agree')
  }
})

test('directory creation points to the runnable tabs once its prerequisites are cleared', () => {
  const { ctx, step } = plan('demo-week2')
  // This scan already resolves a valid Report-only create. Clear only the
  // foundation wait to exercise the normal presentation of that existing operation.
  const ready = { ...step, state: { ...step.state, condition: 'healthy' as const }, blockers: [], blockedBy: [] }
  const body = stepBodyOf(ready, ctx)
  assert.ok(body.artifacts.some((a) => a.id === 'ps'))
  assert.ok(body.artifacts.some((a) => a.id === 'json'))
  const task = body.emergencyAccountTasks!.tasks.find((t) => t.id === 'create')!.steps.join('\n')
  assert.match(task, /create this policy from the \*\*PowerShell\*\* or \*\*JSON\*\* tab/)
  assert.doesNotMatch(task, /tabs are not available yet/)
  assert.match(body.artifacts.find((a) => a.id === 'json')!.text(), /enabledForReportingButNotEnforced/)
})
