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
const STRONG = { conditions: { users, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', authenticationStrength: { id: ID(2) } }, sessionControls: null }
const MIXED = { conditions: { users, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null }
const TARGETS = JSON.stringify([
  { role: 'strong', displayName: "Sample - O'Brien guests strong", ...STRONG },
  { role: 'mixed', displayName: 'Sample - guests mixed', ...MIXED },
])
const ROOTS = ['conditions', 'grantControls', 'sessionControls'] as const
const roots = (role: string, target: Record<(typeof ROOTS)[number], unknown>): Record<string, unknown> => Object.fromEntries(ROOTS.map((r) => [`policies.guests.${role}.target.${r}`, target[r]]))
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
  ...roots('strong', STRONG),
  ...roots('mixed', MIXED),
  ...extra,
})
const callsOf = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
const psOf = (state: PackageState, b: Record<string, unknown>) => {
  const p = projectImplementation(PKG, state, b)
  return { p, ps: p.channels.find((c) => c.channel === 'powershell') }
}
const quoted = `'${TARGETS.replaceAll("'", "''")}'`

test('s-goal-guests-mfa: the script is defined once and called per mode — CreateMissing with both targets and no id, creating in report-only; CorrectPair, Observe and EnforcePair on both ids, the correction writing no state; ApplyPartnerTrust withheld with its reason', () => {
  // s-goal-guests-mfa: CreateMissing is one call after the whole script, with both targets and no policy id
  {
    const { p, ps } = psOf('missing', bindings({ 'policies.guests.strong.current.id': undefined, 'policies.guests.mixed.current.id': undefined }))
    assert.equal(PKG.blocks['powershell.run'].meta.kind, 'deployableAfterBinding')
    assert.ok(ps, JSON.stringify(p.hold ?? p.degraded))
    const calls = callsOf(ps.text)
    assert.deepEqual(calls, [`Invoke-IAMAIStep -Mode 'CreateMissing' -TargetPoliciesJson ${quoted}`])
    assert.ok(ps.text.startsWith('function Invoke-IAMAIStep {\nparam('), ps.text.slice(0, 60))
    assert.ok(ps.text.trimEnd().endsWith(calls[0]), 'the call does not follow the whole body')
    // The body the call runs creates each missing member in report-only.
    assert.match(ps.text, /state='enabledForReportingButNotEnforced'/)
  }
  // s-goal-guests-mfa: the pair correction calls CorrectPair with both targets and both ids, and writes no state
  {
    const { p, ps } = psOf('partial', bindings({ 'policies.guests.semanticMismatches': ['users.exclusions'], [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'], 'policies.guests.strong.current.changedFields': ['conditions.users.excludeGroups'], 'policies.guests.mixed.current.changedFields': ['conditions.users.excludeGroups'] }))
    assert.ok(ps, JSON.stringify(p.hold ?? p.degraded))
    assert.deepEqual(callsOf(ps.text), [`Invoke-IAMAIStep -Mode 'CorrectPair' -TargetPoliciesJson ${quoted} -StrongPolicyId '${ID(3)}' -MixedPolicyId '${ID(4)}'`])
    const correct = /if\(\$Mode -eq 'CorrectPair'\)\{[\s\S]*?\n\}/.exec(ps.text)?.[0] ?? ''
    assert.ok(correct.length > 0, 'the CorrectPair branch is not in the body')
    assert.doesNotMatch(correct, /state=/, 'the pair correction writes a state')
  }
  // s-goal-guests-mfa: Observe and EnforcePair are called on both ids; ApplyPartnerTrust is withheld with its reason
  {
    for (const [state, mode] of [['reportOnly', 'Observe'], ['readyToEnforce', 'EnforcePair']] as const) {
      const { p, ps } = psOf(state, bindings())
      assert.ok(ps, `${state}: ${JSON.stringify(p.hold ?? p.degraded)}`)
      assert.deepEqual(callsOf(ps.text), [`Invoke-IAMAIStep -Mode '${mode}' -TargetPoliciesJson ${quoted} -StrongPolicyId '${ID(3)}' -MixedPolicyId '${ID(4)}'`])
    }
    // The runtime never reaches `partnerTrustRequired` (not a PackageState), so the reason is what is pinned.
    assert.match(PKG.blocks['powershell.run'].meta.invocation?.withheldModes?.ApplyPartnerTrust ?? '', /JSON text/)
  }
})

// Review 5 R5-1: `json.target-pair` was an instructional envelope
// ({"kind":"conditionalAccessPolicyPair",…}) and `json.enforce-pair` was not a Graph body;
// neither carried a request, so both were taken out of every projection. A pair create
// is two Graph requests and the JSON channel carries one: the create is now Graph's own
// JSON batch, one report-only POST per pinned member, each body that member's resolved
// target. A pair correction and an enforcement are batches too, one PATCH per member: the
// endpoint-identity guard (project.ts batchRequests) now reads every inner request, so
// each PATCH names its own member's bound policy id and nothing else is sent.
const NASTY = 'Sample - O\'Brien "guests"\n\u0000\u001b[31m\u001f\u007f\u2028 strong'
test('s-goal-guests-mfa: with both members resolved the create is one Graph JSON batch of two report-only POSTs, each the member’s own target; a partly resolved pair offers no batch', () => {
  // s-goal-guests-mfa: with both members resolved, the create is one Graph JSON batch of two report-only POSTs, each the member’s own target
  {
    const p = projectImplementation(PKG, 'missing', bindings({ 'policies.guests.strong.current.id': undefined, 'policies.guests.mixed.current.id': undefined, 'policies.guests.strong.target.displayName': NASTY }))
    assert.equal(p.hold, null, JSON.stringify(p.hold))
    const json = p.channels.find((c) => c.channel === 'json')
    assert.ok(json, JSON.stringify(p.degraded))
    assert.deepEqual(json.requests, [{ method: 'POST', endpoint: 'https://graph.microsoft.com/v1.0/$batch' }])
    const batch = JSON.parse(json.text) as { requests: { id: string; method: string; url: string; headers: Record<string, string>; body: Record<string, unknown> }[] }
    assert.deepEqual(Object.keys(batch), ['requests'])
    assert.deepEqual(batch.requests.map((r) => [r.id, r.method, r.url, r.headers['Content-Type']]), [['strong', 'POST', '/identity/conditionalAccess/policies', 'application/json'], ['mixed', 'POST', '/identity/conditionalAccess/policies', 'application/json']])
    // Each body is the member's resolved target, the tenant's name read back exactly.
    assert.deepEqual(batch.requests[0].body, { displayName: NASTY, state: 'enabledForReportingButNotEnforced', ...STRONG })
    assert.deepEqual(batch.requests[1].body, { displayName: 'Sample - guests mixed', state: 'enabledForReportingButNotEnforced', ...MIXED })
    // No instructional envelope, and no raw C0 control character (which JSON forbids in a
    // string) reaches the copied text. U+007F and U+2028 are legal in a JSON string and
    // stay as they are: the read-back above is exact.
    assert.doesNotMatch(json.text, /"kind"|"role"|"rule"|applyTo|[\u0000-\u001f]/)
  }
  // s-goal-guests-mfa: a partly resolved pair offers no batch: the JSON is withheld on the unresolved member’s values, and never sent as one policy
  {
    const create = bindings({ 'policies.guests.strong.current.id': undefined, 'policies.guests.mixed.current.id': undefined })
    for (const r of ROOTS) delete create[`policies.guests.mixed.target.${r}`]
    const p = projectImplementation(PKG, 'missing', create)
    assert.equal(p.channels.some((c) => c.channel === 'json'), false)
    assert.deepEqual([...(p.degraded?.find((d) => d.channel === 'json')?.missingBindings ?? [])].sort(), ROOTS.map((r) => `policies.guests.mixed.target.${r}`).sort())
    assert.ok(p.channels.some((c) => c.channel === 'entra'), 'the Entra create was withheld with the JSON')
  }
})

const PARTIAL = { 'policies.guests.semanticMismatches': ['users.exclusions'], [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'], 'policies.guests.strong.current.changedFields': ['conditions.users.excludeGroups'], 'policies.guests.mixed.current.changedFields': ['conditions.users.excludeGroups'] }
type Batch = { requests: { id: string; method: string; url: string; headers: Record<string, string>; body: Record<string, unknown> }[] }
const batchOf = (pkg: CompiledPackage, state: PackageState, b: Record<string, unknown>) => {
  const p = projectImplementation(pkg, state, b)
  const json = p.channels.find((c) => c.channel === 'json')
  return { p, json, batch: json ? (JSON.parse(json.text) as Batch) : null, withheld: p.degraded?.find((d) => d.channel === 'json') }
}
/** The fields the script's own PATCH in `mode` sends (its first `IG PATCH …/policies/$id @{…}`). */
const scriptPatchFields = (mode: string): string[] => {
  const branch = new RegExp(`if\\(\\$Mode -eq '${mode}'\\)\\{[\\s\\S]*?\\n\\}`).exec(PKG.blocks['powershell.run'].text)?.[0] ?? ''
  const hash = /IG PATCH "\$G\/identity\/conditionalAccess\/policies\/\$id" @\{([^}]*)\}/.exec(branch)?.[1] ?? ''
  return hash.split(';').map((kv) => kv.split('=')[0])
}
const policyUrl = (id: string): string => `/identity/conditionalAccess/policies/${id}`

test('s-goal-guests-mfa: a pair correction and an enforcement are one Graph JSON batch PATCHing each member by its own id, as CorrectPair and EnforcePair do', () => {
  // s-goal-guests-mfa: a pair correction is one Graph JSON batch PATCHing each member by its own id with its resolved target and no state, as CorrectPair does
  {
    const { p, json, batch } = batchOf(PKG, 'partial', bindings(PARTIAL))
    assert.ok(json && batch, JSON.stringify(p.degraded))
    assert.deepEqual(json.requests, [{ method: 'POST', endpoint: 'https://graph.microsoft.com/v1.0/$batch' }])
    assert.deepEqual(batch.requests.map((r) => [r.id, r.method, r.url, r.headers['Content-Type']]), [['strong', 'PATCH', policyUrl(ID(3)), 'application/json'], ['mixed', 'PATCH', policyUrl(ID(4)), 'application/json']])
    assert.deepEqual(batch.requests[0].body, { displayName: "Sample - O'Brien guests strong", ...STRONG })
    assert.deepEqual(batch.requests[1].body, { displayName: 'Sample - guests mixed', ...MIXED })
    // The operations the script runs: CorrectPair on the same two ids, sending the same fields and never a state.
    const ps = p.channels.find((c) => c.channel === 'powershell')!
    assert.ok(callsOf(ps.text)[0].endsWith(`-StrongPolicyId '${ID(3)}' -MixedPolicyId '${ID(4)}'`))
    for (const r of batch.requests) assert.deepEqual(Object.keys(r.body), scriptPatchFields('CorrectPair'))
    assert.doesNotMatch(json.text, /\{policies\.|"state"/)
  }
  // s-goal-guests-mfa: an enforcement is one Graph JSON batch setting only state to enabled on exactly the two member ids EnforcePair enables
  {
    const { p, json, batch } = batchOf(PKG, 'readyToEnforce', bindings())
    assert.ok(json && batch, JSON.stringify(p.degraded))
    assert.deepEqual(batch.requests.map((r) => [r.id, r.method, r.url, r.body]), [['strong', 'PATCH', policyUrl(ID(3)), { state: 'enabled' }], ['mixed', 'PATCH', policyUrl(ID(4)), { state: 'enabled' }]])
    assert.deepEqual(scriptPatchFields('EnforcePair'), ['state'])
    assert.match(PKG.blocks['powershell.run'].text, /@\{state='enabled'\}/)
    assert.ok(callsOf(p.channels.find((c) => c.channel === 'powershell')!.text)[0].startsWith("Invoke-IAMAIStep -Mode 'EnforcePair'"))
    assert.doesNotMatch(json.text, /\{policies\./, 'a url template reached the copied text')
  }
})

test('s-goal-guests-mfa: with one member’s id unresolved the JSON batch and the script are withheld on that id, never sent as half a pair', () => {
  // s-goal-guests-mfa: with one member’s id unresolved the correction and enforcement JSON is withheld on that id, never sent as half a batch
  {
    for (const [state, extra] of [['partial', PARTIAL], ['readyToEnforce', {}]] as const) {
      const { json, withheld } = batchOf(PKG, state, bindings({ ...extra, 'policies.guests.mixed.current.id': undefined }))
      assert.equal(json, undefined, state)
      assert.deepEqual(withheld?.missingBindings, ['policies.guests.mixed.current.id'], state)
    }
  }
  // s-goal-guests-mfa: a partly deployed pair withholds only the script, on the id of the member still to create
  // Review 5 missing test: a pair with one member in the tenant is corrected as a set
  // (stepPackage.ts partlyDeployed), and CorrectPair needs both ids. With the member still
  // to create unbound, only the script is withheld, on exactly that id.
  {
    const { p, ps } = psOf('partial', bindings({ 'policies.guests.strong.current.id': undefined, 'policies.guests.semanticMismatches': ['users.exclusions'], [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'], 'policies.guests.mixed.current.changedFields': ['conditions.users.excludeGroups'] }))
    assert.equal(ps, undefined, 'a CorrectPair call without the strong policy id is drawn')
    assert.deepEqual(p.degraded?.find((d) => d.channel === 'powershell')?.missingBindings, ['policies.guests.strong.current.id'])
    assert.deepEqual(p.degraded?.find((d) => d.channel === 'json')?.missingBindings, ['policies.guests.strong.current.id'], 'the batch is withheld on the same id')
    assert.ok(p.channels.some((c) => c.channel === 'entra'), JSON.stringify(p.hold))
  }
})

test('s-goal-guests-mfa: two PATCHes reaching one policy, in any casing, or a bound value that is not a policy id, are refused; two distinct ids pass', () => {
  // s-goal-guests-mfa: two PATCHes reaching one policy, or a bound value that is not a policy id, are refused
  {
    for (const [state, extra] of [['partial', PARTIAL], ['readyToEnforce', {}]] as const) {
      const dup = batchOf(PKG, state, bindings({ ...extra, 'policies.guests.mixed.current.id': ID(3) }))
      assert.equal(dup.json, undefined, state)
      assert.match(dup.withheld?.invalid.join('\n') ?? '', /mixed: a PATCH to a policy another request in the batch already targets/, state)
      const wrong = batchOf(PKG, state, bindings({ ...extra, 'policies.guests.strong.current.id': "x'); DROP" }))
      assert.equal(wrong.json, undefined, state)
      assert.match(wrong.withheld?.invalid.join('\n') ?? '', /strong: policies\.guests\.strong\.current\.id is not a policy id/, state)
    }
  }
  // s-goal-guests-mfa: one policy id in two casings is one target, refused like an exact duplicate; two distinct ids still pass
  {
    const lower = 'abcdefab-1234-4567-89ab-abcdefabcdef'
    const upper = 'ABCDEFAB-1234-4567-89AB-ABCDEFABCDEF'
    const DUPLICATE = /mixed: a PATCH to a policy another request in the batch already targets/
    for (const [state, extra] of [['partial', PARTIAL], ['readyToEnforce', {}]] as const) {
      for (const [name, strong, mixed] of [['different casing', lower, upper], ['same casing', lower, lower], ['same casing, upper', upper, upper]] as const) {
        const { json, withheld } = batchOf(PKG, state, bindings({ ...extra, 'policies.guests.strong.current.id': strong, 'policies.guests.mixed.current.id': mixed }))
        assert.equal(json, undefined, `${state}/${name}: a batch reaching one policy twice is offered`)
        assert.match(withheld?.invalid.join('\n') ?? '', DUPLICATE, `${state}/${name}`)
      }
      const distinct = batchOf(PKG, state, bindings({ ...extra, 'policies.guests.strong.current.id': lower, 'policies.guests.mixed.current.id': ID(4).toUpperCase() }))
      assert.ok(distinct.batch, `${state}: two distinct ids are refused: ${JSON.stringify(distinct.withheld)}`)
      assert.deepEqual(distinct.batch.requests.map((r) => [r.id, r.method, r.url]), [['strong', 'PATCH', policyUrl(lower)], ['mixed', 'PATCH', policyUrl(ID(4).toUpperCase())]], state)
    }
  }
})

test('s-goal-guests-mfa: the guard reads every inner request: a swapped member id, another url, method or member, or a body naming an id is refused', () => {
  const ENFORCE = 'json.enforce-pair'
  const edited = (edit: (text: string) => string): CompiledPackage => ({ ...PKG, blocks: { ...PKG.blocks, [ENFORCE]: { ...PKG.blocks[ENFORCE], text: edit(PKG.blocks[ENFORCE].text) } } })
  const cases: [string, (t: string) => string, RegExp][] = [
    ['swapped', (t) => t.replace('policies/{policies.guests.strong.current.id}', 'policies/{policies.guests.mixed.current.id}'), /strong: a PATCH whose url does not name the strong member's own policy id/],
    ['absolute url', (t) => t.replace('"url":"/identity/', '"url":"https://graph.microsoft.com/v1.0/identity/'), /strong: a PATCH whose url/],
    ['literal id', (t) => t.replace('{policies.guests.strong.current.id}', ID(9)), /strong: a PATCH whose url/],
    ['other object', (t) => t.replace('conditionalAccess/policies/{policies.guests.mixed.current.id}', 'conditionalAccess/namedLocations/{policies.guests.mixed.current.id}'), /mixed: a PATCH whose url/],
    ['DELETE', (t) => t.replace('"method":"PATCH"', '"method":"DELETE"'), /strong: a "DELETE" request in a \$batch/],
    ['GET', (t) => t.replace('"method":"PATCH"', '"method":"GET"'), /strong: a "GET" request in a \$batch/],
    ['POST elsewhere', (t) => t.replace('"method":"PATCH","url":"/identity/conditionalAccess/policies/{policies.guests.strong.current.id}"', '"method":"POST","url":"/policies/crossTenantAccessPolicy/partners"'), /strong: a POST to "\/policies\/crossTenantAccessPolicy\/partners"/],
    ['unknown member', (t) => t.replace('"id":"mixed"', '"id":"everyone"'), /a \$batch request "everyone" that is not one pinned member/],
    ['member twice', (t) => t.replace('"id":"mixed"', '"id":"strong"'), /a \$batch request "strong" that is not one pinned member, once/],
    ['body names an id', (t) => t.replace('"body":{"state":"enabled"}', '"body":{"id":"x","state":"enabled"}'), /strong: a \$batch request whose body is not a policy body/],
    ['not a batch', (t) => `{"value":${t}}`, /a \$batch body that is not one list of requests/],
  ]
  for (const [name, edit, reason] of cases) {
    const { json, withheld } = batchOf(edited(edit), 'readyToEnforce', bindings())
    assert.equal(json, undefined, `${name}: the JSON is offered`)
    assert.match(withheld?.invalid.join('\n') ?? '', reason, name)
  }
  assert.ok(batchOf(edited((t) => t), 'readyToEnforce', bindings()).json, 'the unedited block is refused')
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
