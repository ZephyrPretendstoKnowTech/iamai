// Cycle 5 (review 4 queue 3): the Medium-Risk user and service-accounts trusted-network
// scripts are called with IAMAI's values.
//
// Both were bare `template`s with a mandatory -Mode nothing called, and their param
// blocks defaulted every value to a '{{binding}}' literal. The user-risk create was
// withheld on `policy.current.id`, a value no create has, and the exclusions and trusted
// locations were JSON-text parameters while IAMAI holds arrays. The scripts now take
// string arrays and are defined once and called per mode; Enforce needs attestations no
// prerequisite passes, so it is withheld with the reason.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageState } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { projectImplementation } from './project.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const callsOf = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
const psOf = (pkg: CompiledPackage, state: PackageState, bindings: Record<string, unknown>) => {
  const p = projectImplementation(pkg, state, bindings)
  return { p, ps: p.channels.find((c) => c.channel === 'powershell') }
}

const CASES = [
  {
    id: 's-goal-user-risk-medium',
    bindings: {
      'tenant.displayName': 'Sample tenant',
      'policy.target.displayName': "Sample - O'Brien medium-risk users",
      'policy.target.excludeGroups': [ID(1), ID(2)],
      'authStrength.target.id': ID(4),
      'authStrength.target.displayName': 'Sample strength',
      'policy.current.id': ID(3),
      'policy.current.state': 'enabled',
    },
    create: `Invoke-IAMAIStep -Mode 'Create' -DisplayName 'Sample - O''Brien medium-risk users' -ExcludeGroups @('${ID(1)}', '${ID(2)}') -AuthenticationStrengthId '${ID(4)}'`,
    conditions: `Invoke-IAMAIStep -Mode 'CorrectConditions' -PolicyId '${ID(3)}' -ExcludeGroups @('${ID(1)}', '${ID(2)}')`,
    conditionsFacts: { 'policy.current.semanticMismatches': ['users.scope-or-exclusions'], [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'] },
    grant: `Invoke-IAMAIStep -Mode 'CorrectGrant' -PolicyId '${ID(3)}' -AuthenticationStrengthId '${ID(4)}'`,
    grantFacts: { 'policy.current.semanticMismatches': ['grant.password-change-strength'], [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] },
    verify: `Invoke-IAMAIStep -Mode 'Verify' -PolicyId '${ID(3)}' -AuthenticationStrengthId '${ID(4)}'`,
    enforce: /MfaRegistrationValidated/,
  },
  {
    id: 's-goal-service-accounts-trusted-network',
    bindings: {
      'tenant.displayName': 'Sample tenant',
      'policy.target.displayName': 'Sample - service accounts trusted network',
      'policy.target.excludeGroups': [ID(1)],
      'serviceAccounts.group.id': ID(5),
      'trustedLocations.ids': [ID(21), ID(22)],
      'policy.current.id': ID(3),
      'policy.current.state': 'enabled',
    },
    create: `Invoke-IAMAIStep -Mode 'Create' -DisplayName 'Sample - service accounts trusted network' -ServiceAccountsGroupId '${ID(5)}' -ExcludeGroups @('${ID(1)}') -TrustedLocations @('${ID(21)}', '${ID(22)}')`,
    conditions: `Invoke-IAMAIStep -Mode 'CorrectConditions' -PolicyId '${ID(3)}' -ServiceAccountsGroupId '${ID(5)}' -ExcludeGroups @('${ID(1)}') -TrustedLocations @('${ID(21)}', '${ID(22)}')`,
    conditionsFacts: { 'policy.current.semanticMismatches': ['network.outside-trusted'], [CHANGED_FIELDS_BINDING]: ['conditions.locations.excludeLocations'] },
    grant: `Invoke-IAMAIStep -Mode 'CorrectGrant' -PolicyId '${ID(3)}'`,
    grantFacts: { 'policy.current.semanticMismatches': ['grant.block'], [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] },
    verify: `Invoke-IAMAIStep -Mode 'Verify' -PolicyId '${ID(3)}' -ServiceAccountsGroupId '${ID(5)}' -TrustedLocations @('${ID(21)}', '${ID(22)}')`,
    enforce: /IdentityTypesValidated/,
  },
] as const

test('each script takes its values as parameters, not JSON text or binding defaults, and Create is one call after the whole script, with no policy id, creating in report-only', () => {
  for (const c of CASES) {
    const pkg = PACKAGES[c.id]
    const script = pkg.blocks['powershell.run']
    assert.equal(script.meta.kind, 'deployableAfterBinding', c.id)
    // A request body is still serialised with ConvertTo-Json, and Create still refuses an unfilled '{{…' name.
    assert.doesNotMatch(script.text, /\$\w+Json\b|ParseArray|=\s*'\{\{/, `${c.id}: a JSON-text parameter or a binding default remains`)
    assert.match(script.text, /\[string\[\]\]\$ExcludeGroups=@\(\)/, c.id)
    const { p, ps } = psOf(pkg, 'missing', { ...c.bindings, 'policy.current.id': undefined, 'policy.current.state': undefined })
    assert.ok(ps, `${c.id}: ${JSON.stringify(p.hold ?? p.degraded)}`)
    assert.deepEqual(callsOf(ps.text), [c.create])
    assert.ok(ps.text.startsWith('function Invoke-IAMAIStep {\nparam('), ps.text.slice(0, 60))
    assert.ok(ps.text.trimEnd().endsWith(c.create), `${c.id}: the call does not follow the whole body`)
    assert.match(ps.text, /state='enabledForReportingButNotEnforced'/, c.id)
  }
})

test('each script corrects conditions and grant on the policy writing no state, verifies on the policy, and withholds Enforce with its reason rather than draw a call that would throw', () => {
  for (const c of CASES) {
    const pkg = PACKAGES[c.id]
    for (const [facts, call] of [[c.conditionsFacts, c.conditions], [c.grantFacts, c.grant]] as const) {
      const { p, ps } = psOf(pkg, 'partial', { ...c.bindings, ...facts })
      assert.ok(ps, `${c.id}: ${JSON.stringify(p.hold ?? p.degraded)}`)
      assert.deepEqual(callsOf(ps.text), [call])
      assert.doesNotMatch(callsOf(ps.text).join('\n'), /ReportOnly|Enforce/, c.id)
    }
    const { ps } = psOf(pkg, 'reportOnly', c.bindings)
    assert.ok(ps, c.id)
    assert.deepEqual(callsOf(ps.text), [c.verify])
    assert.match(pkg.blocks['powershell.run'].meta.invocation?.withheldModes?.Enforce ?? '', c.enforce, c.id)
    assert.equal(psOf(pkg, 'readyToEnforce', c.bindings).ps, undefined, c.id)
  }
})
