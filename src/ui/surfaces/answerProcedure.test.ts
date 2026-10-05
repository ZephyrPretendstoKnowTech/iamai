// A policy waiting on a Direction answer keeps its whole procedure (owner,
// 2026-09-25: Implementation Tasks whole in every state). The admin accounts
// group, the Azure Virtual Desktop groups and the emergency account were each
// still to be named, and the step fell back to "Review the policies that affect
// …" (audit, 2026-10-05). The procedure now names the answer for what it will
// be, and the wait stays in Tasks Remaining.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { PROCEDURE } from '../../roadmap/policyProcedure.ts'

const NAMES = (PROCEDURE as unknown as { answerNames: Record<string, string> }).answerNames
const CASES: { step: string; slot: string }[] = [
  { step: 's-goal-admin-accounts-group-strength', slot: '{adminAccountGroups}' },
  { step: 's-goal-avd-allowed-users', slot: '{avdUserGroups}' },
  { step: 's-goal-emergency-account-strong-signin', slot: '{emergencyStrongAccount}' },
]

test('a policy waiting on a Direction answer shows its whole procedure, naming the answer for what it will be', () => {
  const f = fixture('demo')
  const run = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  let checked = 0
  for (const { step: id, slot } of CASES) {
    const step = run.steps.find((s) => s.id === id)
    if (!step || step.status === 'skipped' || step.doesntApply) continue
    // The premise: the answer is still to come.
    if (!(step.action.missing ?? []).some((m) => m.token === slot)) continue
    const tasks = stepBodyOf(step, ctx).emergencyAccountTasks?.tasks ?? []
    const create = tasks.find((t) => t.id === 'create')
    assert.ok(create, `${id}: no create procedure while the answer waits: ${JSON.stringify(tasks.map((t) => t.title))}`)
    const text = create.steps.join('\n')
    assert.ok(text.includes(NAMES[slot]), `${id}: the procedure does not name "${NAMES[slot]}":\n${text}`)
    assert.doesNotMatch(text, /Review the policies that affect/, `${id}: the generic fallback stands in for the procedure`)
    assert.ok(!text.includes(slot), `${id}: the raw slot reached the reader`)
    checked++
  }
  assert.ok(checked >= 2, `only ${checked} unanswered steps checked`)
})
