// Cycle 2 (C05): passkey settings project what IAMAI holds, and nothing it does not.
//
// Every render of the passkey step was held as a package fault: the FIDO2 JSON had
// no request, the Authenticator and Temporary Access Pass bodies bind values no
// source provides, and with the only value-bearing channel withheld the valid Entra
// procedure and AI Info were withheld with it. FIDO2's body is now the documented
// Graph request (PATCH …/authenticationMethodConfigurations/fido2) with the pinned
// target, restriction included; Authenticator and TAP get no invented body; the
// script that would write all three is withheld with its reason.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { projectImplementation, planSafely, NO_RUNTIME } from './project.ts'
import { PASSKEY_TARGET_AAGUIDS, passkeyBindings, resolvePasskeyTarget } from '../../roadmap/passkeySettings.ts'
import type { Fido2Configuration } from '../../roadmap/passkeySettings.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const PASSKEY = PACKAGES['s-prereq-passkey-settings']
const FIDO2 = 'https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2'
const HARDWARE = 'cb69481e-8ff7-4039-93ec-0a2729a154a8'

/** A scan whose methods policy carries exactly this Fido2 entry. */
const scanOf = (fido2: Fido2Configuration): TenantSnapshot => ({ config: { authMethodsPolicy: { status: 'ok', reason: null, rows: [{ authenticationMethodConfigurations: [fido2] }] } } }) as unknown as TenantSnapshot

test('passkey settings: Entra, JSON and AI Info project the resolved change; the JSON is the FIDO2 request keeping the tenant\'s allowed model, and nothing else', () => {
  const tenant: Fido2Configuration = { id: 'Fido2', state: 'enabled', isSelfServiceRegistrationAllowed: true, isAttestationEnforced: false, keyRestrictions: { isEnforced: true, enforcementType: 'allow', aaGuids: [HARDWARE] }, includeTargets: [{ targetType: 'group', id: 'all_users', isRegistrationRequired: false, allowedPasskeyProfiles: [] }], excludeTargets: [] }
  const p = projectImplementation(PASSKEY, 'missing', passkeyBindings(scanOf(tenant)))
  assert.equal(p.hold, null, JSON.stringify(p.hold))
  assert.deepEqual(p.channels.map((c) => c.channel).sort(), ['aiInfo', 'entra', 'json', 'powershell'])
  const json = p.channels.find((c) => c.channel === 'json')!
  assert.deepEqual(json.requests, [{ method: 'PATCH', endpoint: FIDO2 }])
  const body = JSON.parse(json.text)
  const resolved = resolvePasskeyTarget(tenant)
  assert.ok(resolved.kind === 'target')
  assert.deepEqual(body, resolved.target)
  assert.equal(body['@odata.type'], '#microsoft.graph.fido2AuthenticationMethodConfiguration')
  assert.deepEqual(body.keyRestrictions, { isEnforced: true, enforcementType: 'allow', aaGuids: [HARDWARE, ...PASSKEY_TARGET_AAGUIDS] })
  // No Authenticator or TAP body is made up, and no channel is withheld for lacking one.
  assert.doesNotMatch(json.text, /microsoftAuthenticator|temporaryAccessPass|lifetimeInMinutes/)
  assert.equal(p.degraded, undefined, JSON.stringify(p.degraded))
  const entra = p.channels.find((c) => c.channel === 'entra')!.text
  assert.match(entra, /attestation/i)
  assert.ok(JSON.stringify(body.keyRestrictions).includes(HARDWARE), 'the retained model stays in the exact request')
  // A settings step draws no JSON tab (stepBody.ts: machine channels are Conditional Access policy steps'), so Entra names none.
  assert.doesNotMatch(entra, /JSON tab/)
  assert.doesNotMatch(entra, /lifetime (of|to) \d|\d+ (minutes|hours|days)/)
  assert.match(p.channels.find((c) => c.channel === 'aiInfo')!.text, /passkey|FIDO2/i)
})

test('passkey settings: with no readable configuration no request body is built at all', () => {
  const p = projectImplementation(PASSKEY, 'missing', passkeyBindings(null))
  assert.equal(p.channels.some((c) => c.channel === 'json'), false, JSON.stringify(p.channels.map((c) => c.channel)))
})

test('passkey settings: Apply writes only FIDO2; missing configuration keeps Verify available', () => {
  const script = PASSKEY.blocks['powershell.run']
  assert.equal(script.meta.invocation?.withheldModes?.Apply, undefined)
  assert.doesNotMatch(script.text, /authenticationMethodConfigurations\/(microsoftAuthenticator|temporaryAccessPass)/)
  assert.equal(projectImplementation(PASSKEY, 'missing', passkeyBindings(null)).channels.some((c) => c.channel === 'powershell'), false)
  const verify = planSafely(PASSKEY, 'inPlace', passkeyBindings(null), NO_RUNTIME, key => `missing ${key}`)
  const ps = verify.channels.find((c) => c.channel === 'powershell')
  assert.ok(ps, JSON.stringify(verify.hold ?? verify.degraded))
  assert.deepEqual(ps.text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep ')), ["Invoke-IAMAIStep -Mode 'Verify'"])
})

test('a change request with no target identifier is still refused outside authentication-method configurations', () => {
  const values = {
    'policy.target.displayName': 'Sample',
    'policy.target.conditions': { users: { includeUsers: ['All'], excludeGroups: ['00000000-0000-4000-8000-000000000001'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['exchangeActiveSync', 'other'] },
    'policy.target.grantControls': { operator: 'OR', builtInControls: ['block'] },
    'policy.target.sessionControls': null,
    'policy.target.json': '{}',
    'policy.current.id': '00000000-0000-4000-8000-000000000003',
    'policy.current.semanticMismatches': ['conditions.users.excludeGroups'],
    [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'],
  }
  // Positive twin: the package as compiled projects its conditions PATCH with these values.
  const real = projectImplementation(PACKAGES['s-goal-block-legacy-auth'], 'partial', values)
  assert.ok(real.channels.some((c) => c.channel === 'json'), JSON.stringify(real.hold ?? real.degraded))
  // Negative control: the same PATCH with the policy id taken out of its endpoint is refused.
  const legacy = structuredClone(PACKAGES['s-goal-block-legacy-auth'])
  legacy.blocks['json.correct-conditions'].meta.endpoint = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
  const p = projectImplementation(legacy, 'partial', values)
  assert.equal(p.channels.some((c) => c.channel === 'json'), false)
  assert.ok(p.degraded?.some((d) => d.channel === 'json' && d.invalid.some((i) => /names no target identifier/.test(i))), JSON.stringify(p.hold ?? p.degraded))
  // And a look-alike path under another Graph root is not exempt either.
  legacy.blocks['json.correct-conditions'].meta.endpoint = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/authenticationMethodConfigurations/fido2'
  const q = projectImplementation(legacy, 'partial', values)
  assert.equal(q.channels.some((c) => c.channel === 'json'), false)
  assert.ok(q.degraded?.some((d) => d.channel === 'json' && d.invalid.some((i) => /names no target identifier/.test(i))), JSON.stringify(q.hold ?? q.degraded))
})
