// The two deterministic pieces of the implementation-content runtime contract:
// machine conditions (conditions.ts) and PowerShell invocation (invocation.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { conditionErrors, holds } from './conditions.ts'
import type { Condition, ConditionContext } from './conditions.ts'
import { invocationErrors, renderInvocation, scriptParameters } from './invocation.ts'
import type { InvocationSpec } from './invocation.ts'
import { parseBlocks } from './protocol.ts'

const ctx = (over: Partial<ConditionContext> = {}): ConditionContext => ({ state: 'readyToEnforce', bindings: { 'policy.current.id': 'p', 'policy.target.excludeGroups': ['g'], 'policy.current.state': 'enabled', empty: [] }, satisfied: new Set(['legacy']), baselineCommit: 'a'.repeat(40), ...over })

test('every operator evaluates deterministically over state, bindings, prerequisites and the pin', () => {
  const cases: [Condition, boolean][] = [
    [{ state: ['readyToEnforce'] }, true],
    [{ state: ['missing'] }, false],
    [{ present: 'policy.current.id' }, true],
    [{ present: 'empty' }, false],
    [{ absent: 'nope' }, true],
    [{ equals: ['policy.current.state', 'enabled'] }, true],
    [{ equals: ['policy.current.state', 'disabled'] }, false],
    [{ in: ['policy.current.state', ['enabledForReportingButNotEnforced', 'enabled']] }, true],
    [{ confirmed: 'legacy' }, true],
    [{ confirmed: 'workflows' }, false],
    [{ baselineCommit: 'a'.repeat(40) }, true],
    [{ baselineCommit: 'b'.repeat(40) }, false],
    [{ all: [{ state: ['readyToEnforce'] }, { confirmed: 'legacy' }] }, true],
    [{ any: [{ state: ['missing'] }, { confirmed: 'workflows' }] }, false],
    [{ not: { confirmed: 'workflows' } }, true],
  ]
  for (const [c, want] of cases) assert.equal(holds(c, ctx()), want, JSON.stringify(c))
  // An unknown shape never holds.
  assert.equal(holds({ whenever: true } as never, ctx()), false)
})

test('the validator refuses unknown operators, undeclared bindings and prerequisites, and prose', () => {
  const vocab = { bindings: new Set(['policy.current.id']), prerequisites: new Set(['legacy']), states: new Set(['missing', 'readyToEnforce']) }
  assert.deepEqual(conditionErrors({ all: [{ present: 'policy.current.id' }, { confirmed: 'legacy' }, { state: ['missing'] }] }, vocab, 'x'), [])
  assert.ok(conditionErrors('canonical exclusion set is resolved', vocab, 'x').length > 0, 'prose was accepted as a condition')
  assert.ok(conditionErrors({ present: 'policy.target.nope' }, vocab, 'x').length > 0)
  assert.ok(conditionErrors({ confirmed: 'unknown' }, vocab, 'x').length > 0)
  assert.ok(conditionErrors({ state: ['someday'] }, vocab, 'x').length > 0)
  assert.ok(conditionErrors({ present: 'policy.current.id', absent: 'x' }, vocab, 'x').length > 0, 'two operators in one condition')
  assert.ok(conditionErrors({ guess: 'x' }, vocab, 'x').length > 0)
})

const PILOT = parseBlocks(readFileSync('docs/implementation-content/s-goal-device-registration-mfa/CONTENT.md', 'utf8'))
const SCRIPT = PILOT['powershell.run'].text
const SPEC: InvocationSpec = {
  modeParameter: 'Mode',
  correctionsParameter: 'Corrections',
  parameters: {
    PolicyDisplayName: { binding: 'policy.target.displayName', modes: ['Create'] },
    PolicyId: { binding: 'policy.current.id', modes: ['Correct', 'Verify', 'Enforce'] },
    ExcludeGroupIds: { binding: 'policy.target.excludeGroups', modes: ['Create', 'Correct', 'Verify', 'Enforce'] },
    LegacyDeviceMfaToggleConfirmedNo: { switch: true, prerequisite: 'legacy-device-mfa-toggle', modes: ['Enforce'] },
  },
}
const VOCAB = { bindings: new Set(['policy.target.displayName', 'policy.current.id', 'policy.target.excludeGroups']), prerequisites: new Set(['legacy-device-mfa-toggle']) }

test('the script’s own param() block is read: names and which are mandatory', () => {
  const params = scriptParameters(SCRIPT)
  assert.deepEqual(params.find((p) => p.name === 'Mode'), { name: 'Mode', mandatory: true })
  assert.deepEqual(params.find((p) => p.name === 'PolicyId'), { name: 'PolicyId', mandatory: false })
  assert.ok(params.some((p) => p.name === 'EnrollmentWorkflowsValidated'))
  // Variables the script uses outside param() are not parameters.
  assert.equal(params.some((p) => p.name === 'StrengthId'), false)
})

test('an invocation that names a parameter the script lacks, or leaves the mode unnamed, is refused', () => {
  assert.deepEqual(invocationErrors('powershell.run', SPEC, SCRIPT, VOCAB), [])
  assert.ok(invocationErrors('x', { ...SPEC, parameters: { ...SPEC.parameters, PolicyGuid: { binding: 'policy.current.id', modes: ['Enforce'] } } }, SCRIPT, VOCAB).some((e) => /PolicyGuid/.test(e)))
  assert.ok(invocationErrors('x', { ...SPEC, modeParameter: 'Action' }, SCRIPT, VOCAB).some((e) => /modeParameter/.test(e)))
  assert.ok(invocationErrors('x', { ...SPEC, parameters: { PolicyId: { binding: 'policy.unknown', modes: ['Enforce'] } } }, SCRIPT, VOCAB).some((e) => /policy\.unknown/.test(e)))
  assert.ok(invocationErrors('x', undefined, SCRIPT, VOCAB).length > 0, 'a deployable script with no invocation passed')
})

test('the artifact defines the script once and calls it with IAMAI’s values; a switch only for a satisfied prerequisite', () => {
  const bindings = { 'policy.current.id': '00000000-0000-4000-8000-00000000a001', 'policy.target.excludeGroups': ["g-1", "o'brien"] }
  const done = renderInvocation(SCRIPT, SPEC, [{ mode: 'Enforce', corrections: [] }], bindings, new Set(['legacy-device-mfa-toggle']))
  assert.ok('text' in done)
  assert.ok(done.text.startsWith('function Invoke-IAMAIStep {\n# IAMAI compact implementation script'))
  assert.equal(done.text.split('[CmdletBinding()]').length - 1, 1, 'the script is defined more than once')
  assert.equal(done.calls[0], "Invoke-IAMAIStep -Mode 'Enforce' -PolicyId '00000000-0000-4000-8000-00000000a001' -ExcludeGroupIds @('g-1', 'o''brien') -LegacyDeviceMfaToggleConfirmedNo")
  assert.ok(done.text.endsWith(done.calls[0]))
  const unconfirmed = renderInvocation(SCRIPT, SPEC, [{ mode: 'Enforce', corrections: [] }], bindings, new Set())
  assert.ok('calls' in unconfirmed && !unconfirmed.calls[0].includes('-LegacyDeviceMfaToggleConfirmedNo'), 'a switch attested a prerequisite nobody satisfied')
  const correct = renderInvocation(SCRIPT, SPEC, [{ mode: 'Correct', corrections: ['Conditions', 'Grant'] }], bindings, new Set())
  assert.ok('calls' in correct && correct.calls[0].startsWith("Invoke-IAMAIStep -Mode 'Correct' -Corrections 'Conditions','Grant' -PolicyId"))
  const noId = renderInvocation(SCRIPT, SPEC, [{ mode: 'Verify', corrections: [] }], { 'policy.target.excludeGroups': ['g'] }, new Set())
  assert.deepEqual(noId, { missing: ['policy.current.id'] })
})
