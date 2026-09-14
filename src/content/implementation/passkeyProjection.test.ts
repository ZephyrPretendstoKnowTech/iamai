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
import { projectImplementation } from './project.ts'
import { PASSKEY_TARGET, passkeyBindings } from '../../roadmap/passkeySettings.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const PASSKEY = PACKAGES['s-prereq-passkey-settings']
const FIDO2 = 'https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2'

test('passkey settings: Entra, JSON and AI Info project; the JSON is the FIDO2 request with the pinned restriction, and nothing else', () => {
  const p = projectImplementation(PASSKEY, 'missing', passkeyBindings(null))
  assert.equal(p.hold, null, JSON.stringify(p.hold))
  assert.deepEqual(p.channels.map((c) => c.channel).sort(), ['aiInfo', 'entra', 'json'])
  const json = p.channels.find((c) => c.channel === 'json')!
  assert.deepEqual(json.requests, [{ method: 'PATCH', endpoint: FIDO2 }])
  const body = JSON.parse(json.text)
  assert.deepEqual(body, PASSKEY_TARGET)
  assert.equal(body['@odata.type'], '#microsoft.graph.fido2AuthenticationMethodConfiguration')
  assert.deepEqual(body.keyRestrictions, { isEnforced: true, enforcementType: 'allow', aaGuids: ['90a3ccdf-635c-4729-a248-9b709135078f', 'de1e552d-db1d-4423-a619-566b625cdc84'] })
  // No Authenticator or TAP body is made up, and no channel is withheld for lacking one.
  assert.doesNotMatch(json.text, /microsoftAuthenticator|temporaryAccessPass|lifetimeInMinutes/)
  assert.equal(p.degraded, undefined, JSON.stringify(p.degraded))
  const entra = p.channels.find((c) => c.channel === 'entra')!.text
  assert.match(entra, /can no longer be used to sign in/)
  assert.match(entra, /The JSON tab sets Passkey \(FIDO2\) only\./)
  assert.doesNotMatch(entra, /lifetime (of|to) \d|\d+ (minutes|hours|days)/)
  assert.match(p.channels.find((c) => c.channel === 'aiInfo')!.text, /stops working for sign-in once these settings are saved/)
})

test('passkey settings: the script that writes all three methods is not offered while two of them have no target; Verify is', () => {
  const script = PASSKEY.blocks['powershell.run']
  assert.equal(typeof script.meta.invocation?.withheldModes?.Apply, 'string')
  assert.equal(projectImplementation(PASSKEY, 'missing', passkeyBindings(null)).channels.some((c) => c.channel === 'powershell'), false)
  const verify = projectImplementation(PASSKEY, 'verificationRequired' as never, passkeyBindings(null))
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
