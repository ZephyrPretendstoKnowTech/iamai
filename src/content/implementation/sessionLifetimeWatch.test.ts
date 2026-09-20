// Review queue (session-lifetime reportOnly/readyToEnforce): both states required
// `policies.session.unmanaged.current.id`, an id the package's unmanaged companion can
// never bind (the pin maps the goal to the browser policy alone, and the companion has
// no stable id), and their Entra, AI Info, JSON and Verify run named both policies. So a
// report-only or enforce state of the authoritative browser policy always held. Both
// states now read the browser policy alone, as the create already does, and say why
// there is no Policy B. Enforce stays withheld (-ReadinessApproved), as before.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageState } from './protocol.ts'
import { planSafely, projectImplementation } from './project.ts'
import type { Projection } from './project.ts'

const PKG = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages['s-goal-session-lifetime']
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const bindings = (): Record<string, unknown> => ({
  'tenant.displayName': 'Sample tenant',
  'policies.session.browser.target.displayName': "Sample - O'Brien browser sessions",
  'policies.session.browser.current.id': ID(3),
  // S4-10: the interval reaches the deployable channels as the resolved target's own
  // session controls; no channel of this package states one.
  'policies.session.browser.target.sessionControls': { signInFrequency: { isEnabled: true, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication', type: 'hours', value: 12 }, persistentBrowser: { isEnabled: true, mode: 'never' }, applicationEnforcedRestrictions: null, cloudAppSecurity: null, disableResilienceDefaults: null },
  'policy.target.excludeGroups': [ID(1)],
  'policy.target.excludeUsers': [ID(2)],
})
const by = (p: Projection, channel: string) => p.channels.find((c) => c.channel === channel)
const callsOf = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
// Editorial batch C: the Policy A/B framing is gone; AI Info says the baseline has one session policy.
const ONE_POLICY = /The baseline has one session policy for this step\./
const POLICY_B = /Policy B|both component policies|unmanaged-device policy is limited/

test('session-lifetime report-only: the browser policy alone, verified by its own id, with no unmanaged id asked for', () => {
  const p = projectImplementation(PKG, 'reportOnly', bindings())
  assert.equal(p.hold, null, JSON.stringify(p.hold))
  assert.deepEqual(p.degraded ?? [], [])
  const entra = by(p, 'entra')?.text ?? ''
  assert.match(entra, /^Keep the policy in Report-only while you review the evidence listed for this step\./)
  // The interval is the resolved target's, never a number in the package's own
  // words (docs/plans/risk-and-sessions-spec.md section 7).
  assert.match(entra, /confirm the policy applies to browser sign-ins with the intended target's sign-in frequency and Never persistent/)
  assert.doesNotMatch(entra, POLICY_B)
  const ps = by(p, 'powershell')
  assert.ok(ps, JSON.stringify(p.degraded))
  const calls = callsOf(ps.text)
  assert.equal(calls.length, 1, ps.text.slice(-400))
  assert.ok(calls[0].startsWith(`Invoke-IAMAIStep -Mode 'VerifyBrowser' -BrowserPolicyId '${ID(3)}'`), calls[0])
  assert.ok(calls[0].includes(ID(1)) && calls[0].includes(ID(2)), calls[0])
  assert.doesNotMatch(calls[0], /Unmanaged/)
  // The branch the call runs reads the browser policy alone.
  const branch = /'VerifyBrowser' \{[\s\S]*?\n {2}\}/.exec(ps.text)?.[0] ?? ''
  assert.ok(branch.includes('Get-Policy $BrowserPolicyId') && !branch.includes('Unmanaged'), branch)
  const ai = by(p, 'aiInfo')?.text ?? ''
  assert.match(ai, /The browser session policy is in Report-only\./)
  assert.match(ai, ONE_POLICY)
})

test('session-lifetime ready to enforce: the browser policy is turned on by its own id; nothing names a Policy B to turn on; Enforce stays withheld', () => {
  const p = projectImplementation(PKG, 'readyToEnforce', bindings())
  assert.equal(p.hold, null, JSON.stringify(p.hold))
  const json = by(p, 'json')
  assert.ok(json, JSON.stringify(p.degraded))
  assert.deepEqual(json.requests, [{ method: 'PATCH', endpoint: `https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/${ID(3)}` }])
  assert.deepEqual(JSON.parse(json.text), { state: 'enabled' })
  const entra = by(p, 'entra')?.text ?? ''
  assert.match(entra, /Open the browser policy by its policy ID\./)
  assert.match(entra, /Change it from Report-only to \*\*On\*\*/)
  assert.doesNotMatch(entra, POLICY_B)
  assert.equal(by(p, 'powershell'), undefined, 'the withheld Enforce run was drawn')
  // S4-10: the companion is gone from the package, so the attestation is the whole reason.
  assert.match(PKG.blocks['powershell.run'].meta.invocation?.withheldModes?.Enforce ?? '', /^the script enforces only with -ReadinessApproved/)
  assert.doesNotMatch(PKG.blocks['powershell.run'].meta.invocation?.withheldModes?.Enforce ?? '', /unmanaged/)
  const ai = by(p, 'aiInfo')?.text ?? ''
  assert.match(ai, /This state enables the reviewed browser session policy\. The only change is its state from Report-only to On\./)
  assert.match(ai, ONE_POLICY)
  assert.doesNotMatch(ai, POLICY_B)
  assert.doesNotMatch(by(p, 'email')?.text ?? '', /managed\/compliant/)
})

test('session-lifetime report-only and ready to enforce: without the excluded accounts, both hold and preview on that value alone, never on an unmanaged id', () => {
  const { ['policy.target.excludeUsers']: _users, ...short } = bindings()
  for (const state of ['reportOnly', 'readyToEnforce'] as PackageState[]) {
    assert.deepEqual(projectImplementation(PKG, state, short).hold?.missingBindings, ['policy.target.excludeUsers'], state)
    const preview = planSafely(PKG, state, short, { satisfied: new Set(), baselineCommit: null }, (binding) => `‹${binding}›`)
    assert.deepEqual(preview.hold?.missingBindings, ['policy.target.excludeUsers'], state)
  }
})
