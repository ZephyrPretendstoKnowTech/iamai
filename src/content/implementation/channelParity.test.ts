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

const PARITY = ['s-goal-admins-phishing-resistant', 's-goal-mfa-all-users']

test('a conditions-only correction instructs no grant change in Entra and changes conditions only in JSON, and a grant that differs is still corrected', () => {
  for (const stepId of PARITY) {
    const p = projectImplementation(PACKAGES[stepId], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'] }))
    assert.equal(p.hold, null, `${stepId}: ${JSON.stringify(p.hold)}`)
    const entra = p.channels.find((c) => c.channel === 'entra')
    const json = p.channels.find((c) => c.channel === 'json')
    assert.ok(entra && json, `${stepId} channels: ${p.channels.map((c) => c.channel).join(', ')}`)
    assert.doesNotMatch(entra.text, /grant|authentication strength|Temporary Access Pass|multifactor authentication/i, stepId)
    assert.deepEqual(Object.keys(JSON.parse(json.text)), ['conditions'], stepId)
    assert.deepEqual(JSON.parse(json.text).conditions, CONDITIONS, stepId)
    // Lines stay numbered in order, with no gap where the grant line was.
    const numbers = [...entra.text.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]))
    assert.deepEqual(numbers, numbers.map((_, i) => i + 1), stepId)

    const g = projectImplementation(PACKAGES[stepId], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] }))
    const gEntra = g.channels.find((c) => c.channel === 'entra')
    const gJson = g.channels.find((c) => c.channel === 'json')
    assert.ok(gEntra && gJson, `${stepId}: ${JSON.stringify(g.hold)}`)
    assert.match(gEntra.text, /Grant/, stepId)
    assert.deepEqual(Object.keys(JSON.parse(gJson.text)), ['grantControls'], stepId)
  }
})

test('the script is called with the whole target and the policy it corrects, in every state it projects; Mandatory=$true is read as mandatory', () => {
  assert.deepEqual(scriptParameters("param(\n [Parameter(Mandatory=$true)][ValidateSet('A','B')][string]$Mode,\n [Parameter(Mandatory=$true)][string]$TargetPolicyJson,\n [string]$PolicyId,\n [switch]$Flag=$false\n)\n$x=$true"), [
    { name: 'Mode', mandatory: true },
    { name: 'TargetPolicyJson', mandatory: true },
    { name: 'PolicyId', mandatory: false },
    { name: 'Flag', mandatory: false },
  ])
  const target = { displayName: "Sample - O'Brien", conditions: CONDITIONS, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null }
  const values = bindings({ 'policy.target.json': JSON.stringify(target) })
  const literal = `'${JSON.stringify(target).replaceAll("'", "''")}'`
  const cases: [string, Record<string, unknown>, string[]][] = [
    ['missing', {}, ['Create']],
    ['partial', { [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'] }, ['CorrectConditions']],
    ['reportOnly', {}, ['Observe']],
    ['readyToEnforce', {}, ['Enforce']],
  ]
  for (const stepId of PARITY) {
    for (const [state, extra, modes] of cases) {
      const p = projectImplementation(PACKAGES[stepId], state as never, { ...values, ...extra })
      const ps = p.channels.find((c) => c.channel === 'powershell')
      assert.ok(ps, `${stepId} ${state}: ${JSON.stringify(p.hold)} ${JSON.stringify(p.degraded ?? null)}`)
      assert.deepEqual(ps.runs.map((r) => r.mode), modes)
      const calls = ps.text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
      assert.equal(calls.length, modes.length)
      for (const call of calls) {
        assert.ok(call.includes(`-TargetPolicyJson ${literal}`), `${stepId} ${state}: ${call}`)
        assert.equal(call.includes(`-PolicyId '${ID(3)}'`), state !== 'missing', `${stepId} ${state}: ${call}`)
      }
    }
    // A target short of any material root is not the target: the script waits, the other channels still project.
    const { ['policy.target.json']: _none, ...short } = values
    const held = projectImplementation(PACKAGES[stepId], 'missing', short)
    assert.equal(held.channels.some((c) => c.channel === 'powershell'), false)
    assert.deepEqual(held.degraded?.map((d) => [d.channel, d.missingBindings]), [['powershell', ['policy.target.json']]])
  }
})

test('a planning preview shows an unresolved whole JSON value as its bare stand-in, and with every value held it is a typed request body equal to the bound values', () => {
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
  // With every value held, the same projection is the typed request, preview or not.
  const grant = { operator: 'OR', builtInControls: ['block'] }
  const whole = { 'policy.target.displayName': 'Sample - legacy', 'policy.target.conditions': CONDITIONS, 'policy.target.grantControls': grant, 'policy.current.id': ID(3), [CHANGED_FIELDS_BINDING]: ['conditions.clientAppTypes', 'grantControls.builtInControls'] }
  const p = projectImplementation(pkg, 'partial', whole)
  const typed = p.channels.find((c) => c.channel === 'json')
  assert.ok(typed, JSON.stringify(p.hold))
  assert.deepEqual(typed.requests, [{ method: 'PATCH', endpoint: `https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/${ID(3)}` }])
  assert.deepEqual(JSON.parse(typed.text), { conditions: CONDITIONS, grantControls: grant })
  const planned = projectPlanned(pkg, 'partial', whole, NO_RUNTIME, (b) => `‹${b}›`)
  assert.deepEqual(JSON.parse(planned.channels.find((c) => c.channel === 'json')!.text), { conditions: CONDITIONS, grantControls: grant })
})

// 2026-09-20 (owner): every implementation channel on the Medium user-risk step builds the
// policy the pinned baseline intends. The Entra procedure and the correction named the pin's
// pair — `passwordChange` with the tenant's custom authentication strength under AND — while
// the JSON and PowerShell wrote Microsoft's documented `passwordChange` + `mfa` pair, and the
// package carried a note explaining the divergence. The pinned baseline wins (CLAUDE.md), so
// the machine channels write the pin's pair and the note has nothing left to say.
const MEDIUM_RISK = 's-goal-user-risk-medium'
const PINNED_GRANT = { operator: 'AND', builtInControls: ['passwordChange'], authenticationStrength: { id: ID(2) }, customAuthenticationFactors: [], termsOfUse: [] }

test('s-goal-user-risk-medium (owner, 2026-09-20): the create and a grant correction write the pin\'s grant in JSON and the script, the Entra procedure names the same pair, and no channel or note says a machine channel differs', () => {
  // the created policy is the pin's grant in JSON and in the script, and the Entra procedure names the same pair
  {
    const p = projectImplementation(PACKAGES[MEDIUM_RISK], 'missing', bindings({}))
    assert.equal(p.hold, null, JSON.stringify(p.hold))
    const [entra, json, ps] = ['entra', 'json', 'powershell'].map((c) => p.channels.find((x) => x.channel === c))
    assert.ok(entra && json && ps, p.channels.map((c) => c.channel).join(', '))
    const body = JSON.parse(json.text) as { grantControls: unknown; sessionControls: unknown; conditions: { users: Record<string, unknown> } }
    assert.deepEqual(body.grantControls, PINNED_GRANT)
    assert.equal(body.sessionControls, null, 'the pin holds no session control')
    assert.ok(body.conditions.users.excludeGuestsOrExternalUsers, 'the pin excludes every guest and external type')
    // The script builds the same grant and is called with the strength IAMAI resolved.
    assert.match(ps.text, /builtInControls=@\('passwordChange'\)/)
    assert.match(ps.text, /authenticationStrength=@\{id=\(Strength\)\}/)
    assert.ok(ps.text.includes(`-AuthenticationStrengthId '${ID(2)}'`), ps.text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep ')).join('\n'))
    // And the Entra lines name that pair, with nothing to say about a channel that differs.
    assert.match(entra.text, /Require authentication strength: \*\*Sample strength\*\* \*\*and\*\* Require password change/)
    assert.doesNotMatch(entra.text, /JSON and PowerShell|documented pair|built-in `mfa`/)
  }
  // a grant correction writes the pin's pair in every channel that carries one
  {
    const p = projectImplementation(PACKAGES[MEDIUM_RISK], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: ['grantControls'] }))
    assert.equal(p.hold, null, JSON.stringify(p.hold))
    const [entra, json, ps] = ['entra', 'json', 'powershell'].map((c) => p.channels.find((x) => x.channel === c))
    assert.ok(entra && json && ps, p.channels.map((c) => c.channel).join(', '))
    assert.deepEqual(Object.keys(JSON.parse(json.text)), ['grantControls'])
    assert.deepEqual((JSON.parse(json.text) as { grantControls: unknown }).grantControls, PINNED_GRANT)
    assert.ok(ps.text.includes(`-Mode 'CorrectGrant' -PolicyId '${ID(3)}' -AuthenticationStrengthId '${ID(2)}'`), ps.text)
    assert.match(entra.text, /Require authentication strength: \*\*Sample strength\*\* \*\*and\*\* Require password change/)
  }
  // no channel and no baseline note says a machine channel builds a different grant
  {
    const pkg = PACKAGES[MEDIUM_RISK]
    assert.equal((pkg.meta.baselineAuthority as Record<string, unknown>).compatibilityNote, undefined, 'the per-channel caveat outlived the divergence it explained')
    for (const [id, block] of Object.entries(pkg.blocks)) {
      assert.doesNotMatch(block.text, /builtInControls[^\n]*['"]mfa['"]/, `${id}: a channel still writes the built-in mfa companion`)
      assert.doesNotMatch(block.text, /outputs write|documented pair(ing)?/, `${id}: a caveat still explains a divergence`)
    }
  }
})

// V1 audit S4-11: on Remediate High-Risk Users the Entra tab hedged a grant the other two
// always write — "When Entra adds authentication strength, select …" — while the JSON and the
// script wrote `riskRemediation` + the resolved strength under AND unconditionally, and the
// script's Assert-Canonical threw without the strength. The package's own correction stated
// it flatly, so the create and the correction disagreed too. The pin holds the pair, and the
// pinned baseline wins (CLAUDE.md), so the Entra create states it as its correction does.
const HIGH_RISK = 's-goal-user-risk'
const RISK_GRANT = { operator: 'AND', builtInControls: ['riskRemediation'], authenticationStrength: { id: ID(2) }, customAuthenticationFactors: [], termsOfUse: [] }

test(`${HIGH_RISK}: the create names the strength as the grant it is, in the same words as the correction, and all three channels write the pin's pair`, () => {
  const created = projectImplementation(PACKAGES[HIGH_RISK], 'missing', bindings({}))
  assert.equal(created.hold, null, JSON.stringify(created.hold))
  const entra = created.channels.find((c) => c.channel === 'entra')!
  const json = created.channels.find((c) => c.channel === 'json')!
  const ps = created.channels.find((c) => c.channel === 'powershell')!
  assert.deepEqual((JSON.parse(json.text) as { grantControls: unknown }).grantControls, RISK_GRANT)
  assert.match(ps.text, /builtInControls=@\('riskRemediation'\)/)
  assert.ok(ps.text.includes(`-AuthenticationStrengthId '${ID(2)}'`), ps.text)
  // The create states the strength, and no channel makes it a future capability of the portal.
  assert.match(entra.text, /Grant access > Require risk remediation\*\* with authentication strength \*\*Sample strength\*\*/)
  for (const c of created.channels) assert.doesNotMatch(c.text, /When Entra adds authentication strength/, c.channel)
  // And the correction says the same thing, so create and correct cannot disagree.
  const corrected = projectImplementation(PACKAGES[HIGH_RISK], 'partial', bindings({ [CHANGED_FIELDS_BINDING]: ['grantControls'] }))
  assert.equal(corrected.hold, null, JSON.stringify(corrected.hold))
  assert.match(corrected.channels.find((c) => c.channel === 'entra')!.text, /Require risk remediation\*\* with authentication strength \*\*Sample strength\*\*/)
  for (const [id, block] of Object.entries(PACKAGES[HIGH_RISK].blocks)) assert.doesNotMatch(block.text, /When Entra adds/, `${id}: a channel still hedges the grant`)
})
