// Cycle 5 (review 4 queue 3): the guests pair script is called with both targets and both ids.
//
// The block was a bare `template` with a mandatory -Mode and -TargetPoliciesJson, so every
// render drew a script nothing called and no binding held the pair's targets. IAMAI now
// binds `policies.guests.targets.json` (stepPackage.ts memberBindings) only when both
// members resolve whole, and the script is defined once and called per mode. Partner
// trust patches are held as objects, not the JSON text ApplyPartnerTrust reads, so that
// mode is withheld with the reason.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageState } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { planSafely, projectImplementation } from './project.ts'

const PKG = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages['s-goal-guests-mfa']
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const users = { includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } }, excludeGroups: [ID(1)] }
const TARGETS = JSON.stringify([
  { role: 'strong', displayName: "Sample - O'Brien guests strong", conditions: { users }, grantControls: { operator: 'OR', authenticationStrength: { id: ID(2) } }, sessionControls: null },
  { role: 'mixed', displayName: 'Sample - guests mixed', conditions: { users }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null },
])
const bindings = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  'tenant.displayName': 'Sample tenant',
  'policies.guests.strong.target.displayName': "Sample - O'Brien guests strong",
  'policies.guests.mixed.target.displayName': 'Sample - guests mixed',
  'policies.guests.strong.target.users': users,
  'policies.guests.mixed.target.users': users,
  'authStrength.target.id': ID(2),
  'policies.guests.strong.current.id': ID(3),
  'policies.guests.mixed.current.id': ID(4),
  'policies.guests.targets.json': TARGETS,
  ...extra,
})
const callsOf = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
const psOf = (state: PackageState, b: Record<string, unknown>) => {
  const p = projectImplementation(PKG, state, b)
  return { p, ps: p.channels.find((c) => c.channel === 'powershell') }
}
const quoted = `'${TARGETS.replaceAll("'", "''")}'`

test('s-goal-guests-mfa: CreateMissing is one call after the whole script, with both targets and no policy id', () => {
  const { p, ps } = psOf('missing', bindings({ 'policies.guests.strong.current.id': undefined, 'policies.guests.mixed.current.id': undefined }))
  assert.equal(PKG.blocks['powershell.run'].meta.kind, 'deployableAfterBinding')
  assert.ok(ps, JSON.stringify(p.hold ?? p.degraded))
  const calls = callsOf(ps.text)
  assert.deepEqual(calls, [`Invoke-IAMAIStep -Mode 'CreateMissing' -TargetPoliciesJson ${quoted}`])
  assert.ok(ps.text.startsWith('function Invoke-IAMAIStep {\nparam('), ps.text.slice(0, 60))
  assert.ok(ps.text.trimEnd().endsWith(calls[0]), 'the call does not follow the whole body')
  // The body the call runs creates each missing member in report-only.
  assert.match(ps.text, /state='enabledForReportingButNotEnforced'/)
})

test('s-goal-guests-mfa: the pair correction calls CorrectPair with both targets and both ids, and writes no state', () => {
  const { p, ps } = psOf('partial', bindings({ 'policies.guests.semanticMismatches': ['users.exclusions'], [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'], 'policies.guests.strong.current.changedFields': ['conditions.users.excludeGroups'], 'policies.guests.mixed.current.changedFields': ['conditions.users.excludeGroups'] }))
  assert.ok(ps, JSON.stringify(p.hold ?? p.degraded))
  assert.deepEqual(callsOf(ps.text), [`Invoke-IAMAIStep -Mode 'CorrectPair' -TargetPoliciesJson ${quoted} -StrongPolicyId '${ID(3)}' -MixedPolicyId '${ID(4)}'`])
  const correct = /if\(\$Mode -eq 'CorrectPair'\)\{[\s\S]*?\n\}/.exec(ps.text)?.[0] ?? ''
  assert.ok(correct.length > 0, 'the CorrectPair branch is not in the body')
  assert.doesNotMatch(correct, /state=/, 'the pair correction writes a state')
})

test('s-goal-guests-mfa: Observe and EnforcePair are called on both ids; ApplyPartnerTrust is withheld with its reason', () => {
  for (const [state, mode] of [['reportOnly', 'Observe'], ['readyToEnforce', 'EnforcePair']] as const) {
    const { p, ps } = psOf(state, bindings())
    assert.ok(ps, `${state}: ${JSON.stringify(p.hold ?? p.degraded)}`)
    assert.deepEqual(callsOf(ps.text), [`Invoke-IAMAIStep -Mode '${mode}' -TargetPoliciesJson ${quoted} -StrongPolicyId '${ID(3)}' -MixedPolicyId '${ID(4)}'`])
  }
  // The runtime never reaches `partnerTrustRequired` (not a PackageState), so the reason is what is pinned.
  assert.match(PKG.blocks['powershell.run'].meta.invocation?.withheldModes?.ApplyPartnerTrust ?? '', /JSON text/)
})

// Review 5 R5-1: `json.target-pair` and `json.enforce-pair` carried no request (a pair of
// policies is two Graph requests, and the enforce body was not a Graph body), so with
// every pair value bound the JSON channel was invalid in missing, partial and
// readyToEnforce. They are no longer projected; Entra, the called script and AI Info
// carry the pair.
test('s-goal-guests-mfa: with the pair bound, no state offers or fails on a JSON body with no request', () => {
  const partial = bindings({ 'policies.guests.semanticMismatches': ['users.exclusions'], [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'], 'policies.guests.strong.current.changedFields': ['conditions.users.excludeGroups'], 'policies.guests.mixed.current.changedFields': ['conditions.users.excludeGroups'] })
  const create = bindings({ 'policies.guests.strong.current.id': undefined, 'policies.guests.mixed.current.id': undefined })
  for (const [state, b] of [['missing', create], ['partial', partial], ['readyToEnforce', bindings()]] as const) {
    const p = projectImplementation(PKG, state, b)
    assert.equal(p.hold, null, `${state}: ${JSON.stringify(p.hold)}`)
    assert.deepEqual((p.degraded ?? []).filter((d) => d.channel === 'json'), [], `${state}: the JSON channel is withheld`)
    assert.equal(p.channels.some((c) => c.channel === 'json'), false, `${state}: a JSON body with no request is offered`)
    for (const channel of ['entra', 'powershell', 'aiInfo']) assert.ok(p.channels.some((c) => c.channel === channel), `${state}: ${channel} is not drawn`)
  }
})

// Review 5 missing test: a pair with one member in the tenant is corrected as a set
// (stepPackage.ts partlyDeployed), and CorrectPair needs both ids. With the member still
// to create unbound, only the script is withheld, on exactly that id.
test('s-goal-guests-mfa: a partly deployed pair withholds only the script, on the id of the member still to create', () => {
  const { p, ps } = psOf('partial', bindings({ 'policies.guests.strong.current.id': undefined, 'policies.guests.semanticMismatches': ['users.exclusions'], [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'], 'policies.guests.mixed.current.changedFields': ['conditions.users.excludeGroups'] }))
  assert.equal(ps, undefined, 'a CorrectPair call without the strong policy id is drawn')
  assert.deepEqual(p.degraded?.find((d) => d.channel === 'powershell')?.missingBindings, ['policies.guests.strong.current.id'])
  assert.ok(p.channels.some((c) => c.channel === 'entra'), JSON.stringify(p.hold))
})

test('s-goal-guests-mfa: without both targets the script is never drawn as a call; a create keeps Entra, a report-only watch is planned', () => {
  const { ['policies.guests.targets.json']: _none, ...short } = bindings()
  // A create's Entra binds the names, so only the script is withheld.
  const create = projectImplementation(PKG, 'missing', short)
  assert.equal(create.channels.some((c) => c.channel === 'powershell'), false)
  assert.ok(create.channels.some((c) => c.channel === 'entra'))
  assert.ok(create.degraded?.some((d) => d.channel === 'powershell' && d.missingBindings.includes('policies.guests.targets.json')), JSON.stringify(create.degraded))
  // The watch's Entra carries none of IAMAI's values, so nothing is offered alone
  // (project.ts): the projection waits on the one value, and the planning preview
  // draws every channel with that value named and Copy withheld.
  const watch = projectImplementation(PKG, 'reportOnly', short)
  assert.deepEqual(watch.channels, [])
  assert.deepEqual(watch.hold?.missingBindings, ['policies.guests.targets.json'])
  const preview = planSafely(PKG, 'reportOnly', short, { satisfied: new Set(), baselineCommit: null }, (binding) => `‹${binding}›`)
  assert.equal(preview.preview, true)
  assert.deepEqual(preview.channels.map((c) => c.channel), ['entra', 'powershell', 'aiInfo'])
  assert.deepEqual(callsOf(preview.channels.find((c) => c.channel === 'powershell')!.text), [`Invoke-IAMAIStep -Mode 'Observe' -TargetPoliciesJson '‹policies.guests.targets.json›' -StrongPolicyId '${ID(3)}' -MixedPolicyId '${ID(4)}'`])
})
