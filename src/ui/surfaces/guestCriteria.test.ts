// F-035 (owner, 2026-09-28): on the sample's Follow-up scan, Require MFA for Guests read
// "requiring Modern MFA + TAP for guests except Core - Exclusions and guests", as if the
// guest MFA policy exempted guests, and its AI Info carried a stray "strong: <policy>"
// line ("browser:" on the persistence step). The excluded guest types are named by the
// portal's own names, and a one-policy step's AI Info repeats no role-keyed line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import type { StepDecision } from '../../roadmap/decisions.ts'
import type { MappingState } from '../../mapping/types.ts'
import { defaultDecisions } from './pickerRows.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'

/** The mapping as the plan derives it: the detected defaults, then the saved decisions. */
function applied(f: Fixture, decisions: Record<string, StepDecision> | null): MappingState {
  const nameOf = (id: string): string => f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const defaults = applyStepDecisions(f.mapping, defaultDecisions({ snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, now: f.snapshot.asOf }), 'detected')
  return applyStepDecisions(defaults, decisions)
}

function bodyOf(f: Fixture, mapping: MappingState, id: string) {
  const r = runFixture({ ...f, mapping }, { mapping })
  const step = r.steps.find((s) => s.id === id)
  assert.ok(step, `the premise: ${f.name} has ${id}`)
  const ctx = { snapshot: f.snapshot, mapping, groups: f.groups, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  return stepBodyOf(step, ctx)
}

test('the guest policy\'s Completion Criteria name the guest type it leaves out, never "guests except … and guests"', () => {
  const f = fixture('demo-week2')
  assert.ok(f.decisions, 'the premise: the Follow-up scan carries the partner answer')
  const done = bodyOf(f, applied(f, f.decisions), 's-goal-guests-mfa').contract.doneWhen.join(' ')
  assert.doesNotMatch(done, /except [^.]*\band guests\b/, done)
  assert.match(done, /Service provider users/, `the excluded type is not named: ${done}`)
})

test('a one-policy step\'s AI Info carries no raw role-keyed line ("strong:", "browser:")', () => {
  const f = fixture('demo')
  for (const id of ['s-goal-guests-mfa', 's-goal-all-users-no-persistence']) {
    const ai = bodyOf(f, f.mapping, id).artifacts.find((a) => a.id === 'ai')
    assert.ok(ai, `the premise: ${id} has AI Info`)
    const stray = ai.text().split('\n').filter((l) => /^- [a-z]+: /.test(l))
    assert.deepEqual(stray, [], `${id}: ${stray.join(' | ')}`)
  }
})
