// Content corrections pass (release review R01): "Limit How Long Sessions Last"
// creates, corrects, reviews and enables the pinned browser policy alone, yet its
// AI Info still described an unmanaged-device Policy B, told the reader not to
// collapse "the two policies", and Done when required the policy "with its pair".
// This reads every projected channel in every state, not only the corrected
// opening sentence; the Plan's own words are pinned by docs/qa/step-snapshots.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageState } from '../../content/implementation/protocol.ts'
import { CHANGED_FIELDS_BINDING } from '../../content/implementation/protocol.ts'
import { projectImplementation } from '../../content/implementation/project.ts'

const PKG = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages['s-goal-session-lifetime']
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const base = (): Record<string, unknown> => ({
  'tenant.displayName': 'Sample tenant',
  'policies.session.browser.target.displayName': 'Sample - browser sessions',
  'policies.session.browser.current.id': ID(3),
  // S4-10: the interval is the resolved target's own session controls in every channel that needs a value.
  'policies.session.browser.target.sessionControls': { signInFrequency: { isEnabled: true, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication', type: 'hours', value: 12 }, persistentBrowser: { isEnabled: true, mode: 'never' }, applicationEnforcedRestrictions: null, cloudAppSecurity: null, disableResilienceDefaults: null },
  'policy.target.excludeGroups': [ID(1)],
  'policy.target.excludeUsers': [ID(2)],
})
const STATES: [PackageState, Record<string, unknown>][] = [
  ['missing', { ...base(), 'policies.session.browser.current.id': undefined }],
  ['partial', { ...base(), 'policies.session.semanticMismatches': ['sessionControls'], [CHANGED_FIELDS_BINDING]: ['sessionControls.signInFrequency'], 'policies.session.browser.current.changedFields': ['sessionControls.signInFrequency'], 'policies.session.browser.operation': 'update' }],
  ['reportOnly', base()],
  ['readyToEnforce', base()],
]

/** Wording that describes a second, unmanaged-device session policy as part of this step. */
const COMPANION = /Policy B:|two-policy|two policies|collapse|with its pair|this pair|both (component )?policies|either component|9-hour|9 hours|12\/9|unmanaged-device component|unmanaged component|every app\b/i
/**
 * A sign-in frequency written out as a number. The pinned target carries the
 * interval; the step and its package point at the target everywhere, so a re-pin
 * cannot leave a stale number behind (docs/plans/risk-and-sessions-spec.md,
 * "Limit How Long Sessions Last takes its interval from the target").
 */
const INTERVAL = /\b\d+[- ]hours?\b/i

test('session-lifetime: every projected explanation in every state describes the browser policy alone', () => {
  for (const [state, bindings] of STATES) {
    const p = projectImplementation(PKG, state, bindings)
    assert.equal(p.hold, null, `${state}: ${JSON.stringify(p.hold)}`)
    const ai = p.channels.find((c) => c.channel === 'aiInfo')?.text ?? ''
    assert.ok(ai.length > 0, `${state}: no AI Info drawn`)
    // The pinned baseline wins: the target is its one browser policy, every state
    // says it is the only one, and a state that writes settings says not to add a
    // companion the baseline does not contain.
    assert.match(ai, /The baseline has one session policy for this step/, state)
    if (state === 'missing' || state === 'partial') assert.match(ai, /Do not add a companion policy, conditions or exclusions that the baseline does not contain/, state)
    // Every channel, the script included: S4-10 removed its unmanaged-device modes and
    // its hardcoded intervals, so it is read on the same terms as the others.
    for (const c of p.channels) {
      assert.doesNotMatch(c.text, COMPANION, `${state}/${c.channel}: ${c.text.match(COMPANION)?.[0]}`)
      // Only the resolved target carries the interval, so no channel writes one out.
      assert.doesNotMatch(c.text, INTERVAL, `${state}/${c.channel}: ${c.text.match(INTERVAL)?.[0]}`)
    }
    // A correction keeps the policy's state, and says what saving does to one that is On.
    if (state === 'partial') {
      const entra = p.channels.find((c) => c.channel === 'entra')?.text ?? ''
      assert.match(entra, /If it is On, the changed rule can affect access after you save\./)
      assert.doesNotMatch(entra, /Do not turn it On until/)
    }
  }
})
