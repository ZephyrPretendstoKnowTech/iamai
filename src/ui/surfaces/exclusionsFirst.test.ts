// F-001: a correction that removes an exclusion from a policy Configure
// Emergency Exclusions has not reached yet waits for that step, and says so on
// its card, its Correct task and its PowerShell script. Done first, it took the
// emergency accounts' old exclusion off an enforced policy before the
// exclusions group was on it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { policySubjectsOf } from './policyTasks.ts'

const DEVICE_CODE = 's-goal-block-device-code'

function opened(name: FixtureName, stepId: string) {
  const f = fixture(name)
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === stepId)
  assert.ok(step, `the premise: ${name} plans ${stepId}`)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  const body = stepBodyOf(step, ctx)
  const correct = body.emergencyAccountTasks?.tasks.find((t) => t.id === 'correct') ?? null
  const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  const ps = body.artifacts.find((a) => a.id === 'ps')?.text() ?? ''
  return { correct, cards, ps }
}

test('before Configure Emergency Exclusions, the removal of the old exclusion says to wait for it, on the card, the task and the script', () => {
  const { correct, cards, ps } = opened('demo', DEVICE_CODE)
  assert.ok(correct, 'the premise: the demo corrects its device-code policy')
  assert.ok(correct.steps.some((l) => /remove the group \*{0,2}Core - Break glass/.test(l)), `the premise: the correction removes the old exclusion: ${correct.steps.join(' | ')}`)
  const first = 'Do this after Configure Emergency Exclusions adds Core - Exclusions to this policy.'
  assert.equal(correct.steps[0], first, correct.steps.join('\n'))
  const card = cards.find((c) => c.key.startsWith('correct:'))
  assert.ok(card, 'the correction is one card')
  assert.match(String(card.detail), /remove the group Core - Break glass\.\nAfter Configure Emergency Exclusions adds Core - Exclusions to it\.$/, String(card.detail))
  assert.ok(ps !== '', 'the premise: the step hands over a PowerShell script')
  assert.ok(ps.startsWith(`# ${first}\n`), ps.slice(0, 200))
})

test('once Configure Emergency Exclusions has put the group on the policy, nothing waits and nothing says so', () => {
  const { correct, cards, ps } = opened('demo-week2', DEVICE_CODE)
  for (const line of correct?.steps ?? []) assert.doesNotMatch(line, /Do this after Configure Emergency Exclusions/)
  for (const card of cards) assert.doesNotMatch(String(card.detail ?? ''), /After Configure Emergency Exclusions adds/)
  assert.doesNotMatch(ps, /Do this after Configure Emergency Exclusions/)
})
