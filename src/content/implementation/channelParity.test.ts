// S3 (C02, C06): what a correction's channels say agrees with the change it makes.
//
// A correction whose only difference is the policy's conditions writes no grant in
// any channel: the admins package's Entra lines used to set the grant to the
// baseline's TAP-inclusive custom strength, and the all-users package's to plain
// MFA, while the JSON beside them PATCHed conditions only. The grant module still
// says so when the grant is what differs.
//
// A planning preview's JSON is visibly a template: a whole JSON value IAMAI does not
// hold yet is its bare stand-in, never a quoted string where Graph takes an object
// or a list (`"conditions":"‹policy conditions›"`). A complete body stays a typed
// request equal to the values bound.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { NO_RUNTIME, projectImplementation, projectPlanned } from './project.ts'
import { scriptParameters } from './invocation.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const CONDITIONS = { users: { includeUsers: ['All'], excludeGroups: [ID(1)] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }
const bindings = (extra: Record<string, unknown>): Record<string, unknown> => ({
  'policy.target.displayName': 'Sample - policy',
  'policy.target.conditions': CONDITIONS,
  'policy.target.excludeGroups': [ID(1)],
  'policy.target.grantControls': { operator: 'OR', builtInControls: [], authenticationStrength: { id: ID(2) } },
  'policy.target.sessionControls': null,
  'authStrength.target.id': ID(2),
  'authStrength.target.displayName': 'Sample strength',
  'policy.current.id': ID(3),
  'policy.current.displayName': 'Sample - tenant policy',
  'policy.current.state': 'enabled',
  ...extra,
})

for (const stepId of ['s-goal-admins-phishing-resistant', 's-goal-mfa-all-users']) {
  test(`${stepId}: a conditions-only correction instructs no grant change in Entra, and the JSON changes conditions only`, () => {
    const p = projectImplementation(PACKAGES[stepId], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'] }))
    assert.equal(p.hold, null, JSON.stringify(p.hold))
    const entra = p.channels.find((c) => c.channel === 'entra')
    const json = p.channels.find((c) => c.channel === 'json')
    assert.ok(entra && json, `channels: ${p.channels.map((c) => c.channel).join(', ')}`)
    assert.doesNotMatch(entra.text, /grant|authentication strength|Temporary Access Pass|multifactor authentication/i)
    assert.deepEqual(Object.keys(JSON.parse(json.text)), ['conditions'])
    assert.deepEqual(JSON.parse(json.text).conditions, CONDITIONS)
    // Lines stay numbered in order, with no gap where the grant line was.
    const numbers = [...entra.text.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]))
    assert.deepEqual(numbers, numbers.map((_, i) => i + 1))
  })

  test(`${stepId}: a grant that differs is still corrected in Entra and JSON`, () => {
    const p = projectImplementation(PACKAGES[stepId], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] }))
    const entra = p.channels.find((c) => c.channel === 'entra')
    const json = p.channels.find((c) => c.channel === 'json')
    assert.ok(entra && json, JSON.stringify(p.hold))
    assert.match(entra.text, /Grant/)
    assert.deepEqual(Object.keys(JSON.parse(json.text)), ['grantControls'])
  })
}

test('a script parameter declared Mandatory=$true is read as that parameter, mandatory — $true is not a parameter', () => {
  const script = "param(\n [Parameter(Mandatory=$true)][ValidateSet('A','B')][string]$Mode,\n [Parameter(Mandatory=$true)][string]$TargetPolicyJson,\n [string]$PolicyId,\n [switch]$Flag=$false\n)\n$x=$true"
  assert.deepEqual(scriptParameters(script), [
    { name: 'Mode', mandatory: true },
    { name: 'TargetPolicyJson', mandatory: true },
    { name: 'PolicyId', mandatory: false },
    { name: 'Flag', mandatory: false },
  ])
})

for (const stepId of ['s-goal-admins-phishing-resistant', 's-goal-mfa-all-users']) {
  test(`${stepId}: the script is called with the whole target and the policy it corrects, in every state it projects`, () => {
    const target = { displayName: "Sample - O'Brien", conditions: CONDITIONS, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null }
    const values = bindings({ 'policy.target.json': JSON.stringify(target) })
    const literal = `'${JSON.stringify(target).replaceAll("'", "''")}'`
    const cases: [string, Record<string, unknown>, string[]][] = [
      ['missing', {}, ['Create']],
      ['partial', { [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'] }, ['CorrectConditions']],
      ['reportOnly', {}, ['Observe']],
      ['readyToEnforce', {}, ['Enforce']],
    ]
    for (const [state, extra, modes] of cases) {
      const p = projectImplementation(PACKAGES[stepId], state as never, { ...values, ...extra })
      const ps = p.channels.find((c) => c.channel === 'powershell')
      assert.ok(ps, `${state}: ${JSON.stringify(p.hold)} ${JSON.stringify(p.degraded ?? null)}`)
      assert.deepEqual(ps.runs.map((r) => r.mode), modes)
      const calls = ps.text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
      assert.equal(calls.length, modes.length)
      for (const call of calls) {
        assert.ok(call.includes(`-TargetPolicyJson ${literal}`), `${state}: ${call}`)
        assert.equal(call.includes(`-PolicyId '${ID(3)}'`), state !== 'missing', `${state}: ${call}`)
      }
    }
    // A target short of any material root is not the target: the script waits, the other channels still project.
    const { ['policy.target.json']: _none, ...short } = values
    const held = projectImplementation(PACKAGES[stepId], 'missing', short)
    assert.equal(held.channels.some((c) => c.channel === 'powershell'), false)
    assert.deepEqual(held.degraded?.map((d) => [d.channel, d.missingBindings]), [['powershell', ['policy.target.json']]])
  })
}

test('the admins grant correction names the Temporary Access Pass difference from the built-in phishing-resistant strength', () => {
  const p = projectImplementation(PACKAGES['s-goal-admins-phishing-resistant'], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: ['grantControls.authenticationStrength.id'] }))
  const entra = p.channels.find((c) => c.channel === 'entra')
  assert.ok(entra)
  assert.match(entra.text, /also accepts a Temporary Access Pass; Microsoft's built-in Phishing-resistant MFA strength does not/)
})

test('a planning preview shows an unresolved whole JSON value as its bare stand-in, never as a JSON string', () => {
  const pkg = PACKAGES['s-goal-block-legacy-auth']
  const held = { 'policy.target.displayName': 'Sample - legacy', 'policy.current.id': ID(3), 'policy.current.state': 'enabled' }
  const one = projectPlanned(pkg, 'partial', { ...held, [CHANGED_FIELDS_BINDING]: ['conditions.clientAppTypes'] }, NO_RUNTIME, (b) => `‹${b}›`)
  const json = one.channels.find((c) => c.channel === 'json')
  assert.ok(json, JSON.stringify(one.hold))
  assert.equal(one.preview, true)
  assert.match(json.text, /"conditions":‹policy\.target\.conditions›/)
  assert.doesNotMatch(json.text, /"‹|@@iamai/)
  assert.throws(() => JSON.parse(json.text), 'a body with a value still to resolve is not a document Graph could take')
  assert.ok(one.hold?.missingBindings.includes('policy.target.conditions'))

  // Two bodies for one request still merge into one, each stand-in bare.
  const two = projectPlanned(pkg, 'partial', { ...held, [CHANGED_FIELDS_BINDING]: ['conditions.clientAppTypes', 'grantControls.builtInControls'] }, NO_RUNTIME, (b) => `‹${b}›`)
  const merged = two.channels.find((c) => c.channel === 'json')
  assert.ok(merged, JSON.stringify(two.hold))
  assert.equal(merged.requests.length, 1)
  assert.match(merged.text, /"conditions": ‹policy\.target\.conditions›/)
  assert.match(merged.text, /"grantControls": ‹policy\.target\.grantControls›/)
  assert.doesNotMatch(merged.text, /"‹|@@iamai/)
})

test('with every value held, the same projection is a typed request body equal to the bound values', () => {
  const pkg = PACKAGES['s-goal-block-legacy-auth']
  const grant = { operator: 'OR', builtInControls: ['block'] }
  const p = projectImplementation(pkg, 'partial', { 'policy.target.displayName': 'Sample - legacy', 'policy.target.conditions': CONDITIONS, 'policy.target.grantControls': grant, 'policy.current.id': ID(3), [CHANGED_FIELDS_BINDING]: ['conditions.clientAppTypes', 'grantControls.builtInControls'] })
  const json = p.channels.find((c) => c.channel === 'json')
  assert.ok(json, JSON.stringify(p.hold))
  assert.deepEqual(json.requests, [{ method: 'PATCH', endpoint: `https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/${ID(3)}` }])
  assert.deepEqual(JSON.parse(json.text), { conditions: CONDITIONS, grantControls: grant })
  // A preview with nothing left to resolve is the same typed body.
  const planned = projectPlanned(pkg, 'partial', { 'policy.target.displayName': 'Sample - legacy', 'policy.target.conditions': CONDITIONS, 'policy.target.grantControls': grant, 'policy.current.id': ID(3), [CHANGED_FIELDS_BINDING]: ['conditions.clientAppTypes', 'grantControls.builtInControls'] }, NO_RUNTIME, (b) => `‹${b}›`)
  assert.deepEqual(JSON.parse(planned.channels.find((c) => c.channel === 'json')!.text), { conditions: CONDITIONS, grantControls: grant })
})
