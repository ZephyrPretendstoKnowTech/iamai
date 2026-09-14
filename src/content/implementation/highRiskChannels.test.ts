// B7 (S-RH-1, S-UR-2): the High-Risk sign-in and user-risk packages project the
// channels their Medium-Risk counterparts do, at the High threshold. The sign-in
// package keeps its own baseline member's authentication-strength grant and
// Every-time session: a decision never weakens a grant, so there is no plain-MFA
// variant waiting on a saved choice the runtime never supplies.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageState } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { projectImplementation } from './project.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const BINDINGS: Record<string, unknown> = {
  'policy.target.displayName': 'Sample - High-risk policy',
  'policy.target.excludeGroups': [ID(1)],
  'authStrength.target.id': ID(2),
  'authStrength.target.displayName': 'Sample strength',
  'policy.current.id': ID(3),
  'policy.current.semanticMismatches': ['risk level'],
  'policy.current.state': 'enabledForReportingButNotEnforced',
}

/** Whether the package's script withholds its Enforce mode by its declared invocation. */
const withheldEnforce = (pkg: CompiledPackage): boolean => {
  const invocation = (pkg.blocks['powershell.run']?.meta as { invocation?: { withheldModes?: Record<string, string> } } | undefined)?.invocation
  return typeof invocation?.withheldModes?.Enforce === 'string'
}

const PAIRS = [
  { high: 's-goal-sign-in-risk', medium: 's-goal-sign-in-risk-medium', risk: 'signInRiskLevels' },
  { high: 's-goal-user-risk', medium: 's-goal-user-risk-medium', risk: 'userRiskLevels' },
] as const

for (const { high, medium, risk } of PAIRS) {
  test(`${high} projects Entra, JSON, PowerShell and AI info wherever ${medium} does, at the High threshold`, () => {
    const cases: [PackageState, Record<string, unknown>][] = [
      ['missing', {}],
      ['partial', { [CHANGED_FIELDS_BINDING]: [`conditions.${risk}`] }],
      ['reportOnly', {}],
      ['readyToEnforce', {}],
    ]
    for (const [state, extra] of cases) {
      const bindings = { ...BINDINGS, ...extra }
      const own = projectImplementation(PACKAGES[high], state, bindings)
      const channels = new Set(own.channels.map((c) => c.channel))
      const theirs = projectImplementation(PACKAGES[medium], state, bindings).channels.map((c) => c.channel)
      assert.ok(theirs.length > 0, `${medium} ${state}: the premise, the counterpart projects channels`)
      for (const c of theirs) {
        // The one exception: a script that declares its invocation withholds Enforce, an
        // attestation IAMAI cannot pass. The Medium user-risk script does too since cycle 5,
        // so this only skips a PowerShell channel neither side draws.
        if (state === 'readyToEnforce' && c === 'powershell' && withheldEnforce(PACKAGES[high])) continue
        assert.ok(channels.has(c), `${high} ${state}: ${c} is missing (${[...channels].join(', ') || 'none'}; hold ${JSON.stringify(own.hold)})`)
      }
      if (state === 'missing' || state === 'partial') for (const c of ['entra', 'json', 'powershell', 'aiInfo']) assert.ok(channels.has(c as never), `${high} ${state}: ${c}`)
    }
    const create = projectImplementation(PACKAGES[high], 'missing', BINDINGS).channels.find((c) => c.channel === 'json')
    assert.ok(create)
    const body = JSON.parse(create.text) as { conditions: Record<string, unknown> }
    assert.deepEqual(body.conditions[risk], ['high'])
    assert.doesNotMatch(JSON.stringify(projectImplementation(PACKAGES[high], 'partial', { ...BINDINGS, [CHANGED_FIELDS_BINDING]: [`conditions.${risk}`] }).channels), /"medium"/)
  })
}

test('the High-Risk sign-in create keeps the baseline member: the resolved authentication strength, Every-time sign-in frequency, no plain-MFA variant', () => {
  const pkg = PACKAGES['s-goal-sign-in-risk']
  const json = projectImplementation(pkg, 'missing', BINDINGS).channels.find((c) => c.channel === 'json')
  assert.ok(json)
  const body = JSON.parse(json.text) as { grantControls: { builtInControls: string[]; authenticationStrength: { id: string } }; sessionControls: { signInFrequency: { frequencyInterval: string } } }
  assert.equal(body.grantControls.authenticationStrength.id, ID(2))
  assert.deepEqual(body.grantControls.builtInControls, [])
  assert.equal(body.sessionControls.signInFrequency.frequencyInterval, 'everyTime')
  assert.equal(JSON.stringify(pkg).includes('firstEnforcementMode'), false, 'no binding the runtime never supplies')
  assert.equal(Object.keys(pkg.blocks).some((id) => /plain-mfa|baseline-strength|decision/.test(id)), false)
})
