// Phones Blocked from company data under Jon's baseline (owner, Phase 2a): no
// phone policy of IAMAI's own ("Keep Company Data Off Phones" left). The answer
// widens Jon's Block Unsupported Device Platforms to iOS and Android, and the
// step shows his version beside it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { DEVICE_ANSWER_KEYS, QUESTION_STEP, answerKey } from './answers.ts'

type Body = { conditions?: { platforms?: { includePlatforms?: string[]; excludePlatforms?: string[] } } }
const excluded = (b: unknown): string[] => ((b as Body | undefined)?.conditions?.platforms?.excludePlatforms ?? []).map((p) => p.toLowerCase()).sort()

function withPhones(value: 'enrolled' | 'unmanaged' | 'blocked'): Fixture {
  const f = structuredClone(fixture('demo'))
  f.mapping.questionAnswers = {
    ...(f.mapping.questionAnswers ?? {}),
    [answerKey(QUESTION_STEP.devices, DEVICE_ANSWER_KEYS.phoneManagement)]: value,
    [answerKey(QUESTION_STEP.devices, DEVICE_ANSWER_KEYS.phoneAppProtection)]: value === 'blocked' ? 'not-required' : 'required',
    [answerKey(QUESTION_STEP.devices, DEVICE_ANSWER_KEYS.computers)]: 'enrolled',
  }
  return f
}

const blockOf = (f: Fixture) => runFixture(f).steps.find((s) => s.goalId === 'block-unsupported-platforms')!

test('phones blocked: Jon’s unsupported-platforms block also blocks iOS and Android, beside his version; no phone policy of IAMAI’s own', () => {
  const r = runFixture(withPhones('blocked'))
  assert.equal(r.steps.find((s) => s.id === 's-ladder-phone-access-restriction'), undefined, 'Keep Company Data Off Phones is not on the plan')
  const op = blockOf(withPhones('blocked')).action.resolution!.policies[0]
  assert.deepEqual(excluded(op.body), ['macos', 'windows'], 'the block leaves only the computers alone')
  assert.ok(op.baseline, 'Jon’s version travels with the change')
  assert.deepEqual(excluded(op.baseline), ['android', 'ios', 'macos', 'windows'], 'and it leaves the phones alone')
})

test('phones enrolled or not enrolled: Jon’s block as he wrote it', () => {
  for (const value of ['enrolled', 'unmanaged'] as const) {
    const op = blockOf(withPhones(value)).action.resolution!.policies[0]
    assert.deepEqual(excluded(op.body), ['android', 'ios', 'macos', 'windows'], value)
    assert.equal(op.baseline ?? null, null, `${value}: nothing to show beside it`)
  }
})
