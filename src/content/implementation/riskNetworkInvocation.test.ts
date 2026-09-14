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
      'policy.current.id': ID(3),
      'policy.current.state': 'enabled',
    },
    create: `Invoke-IAMAIStep -Mode 'Create' -DisplayName 'Sample - O''Brien medium-risk users' -ExcludeGroups @('${ID(1)}', '${ID(2)}')`,
    conditions: `Invoke-IAMAIStep -Mode 'CorrectConditions' -PolicyId '${ID(3)}' -ExcludeGroups @('${ID(1)}', '${ID(2)}')`,
    conditionsFacts: { 'policy.current.semanticMismatches': ['users.scope-or-exclusions'], [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'] },
    grantFacts: { 'policy.current.semanticMismatches': ['grant.password-change-mfa'], [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] },
    verify: `Invoke-IAMAIStep -Mode 'Verify' -PolicyId '${ID(3)}'`,
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
    grantFacts: { 'policy.current.semanticMismatches': ['grant.block'], [CHANGED_FIELDS_BINDING]: ['grantControls.builtInControls'] },
    verify: `Invoke-IAMAIStep -Mode 'Verify' -PolicyId '${ID(3)}' -ServiceAccountsGroupId '${ID(5)}' -TrustedLocations @('${ID(21)}', '${ID(22)}')`,
    enforce: /IdentityTypesValidated/,
  },
] as const

for (const c of CASES) {
  const pkg = PACKAGES[c.id]

  test(`${c.id}: the script takes its values as parameters, not JSON text or '{{binding}}' defaults`, () => {
    const script = pkg.blocks['powershell.run']
    assert.equal(script.meta.kind, 'deployableAfterBinding')
    // A request body is still serialised with ConvertTo-Json, and Create still refuses an unfilled '{{…' name.
    assert.doesNotMatch(script.text, /\$\w+Json\b|ParseArray|=\s*'\{\{/, 'a JSON-text parameter or a binding default remains')
    assert.match(script.text, /\[string\[\]\]\$ExcludeGroups=@\(\)/)
  })

  test(`${c.id}: Create is one call after the whole script, with no policy id, and creates in report-only`, () => {
    const { p, ps } = psOf(pkg, 'missing', { ...c.bindings, 'policy.current.id': undefined, 'policy.current.state': undefined })
    assert.ok(ps, JSON.stringify(p.hold ?? p.degraded))
    assert.deepEqual(callsOf(ps.text), [c.create])
    assert.ok(ps.text.startsWith('function Invoke-IAMAIStep {\nparam('), ps.text.slice(0, 60))
    assert.ok(ps.text.trimEnd().endsWith(c.create), 'the call does not follow the whole body')
    assert.match(ps.text, /state='enabledForReportingButNotEnforced'/)
  })

  test(`${c.id}: corrections call CorrectConditions and CorrectGrant on the policy and write no state`, () => {
    for (const [facts, call] of [[c.conditionsFacts, c.conditions], [c.grantFacts, `Invoke-IAMAIStep -Mode 'CorrectGrant' -PolicyId '${ID(3)}'`]] as const) {
      const { p, ps } = psOf(pkg, 'partial', { ...c.bindings, ...facts })
      assert.ok(ps, JSON.stringify(p.hold ?? p.degraded))
      assert.deepEqual(callsOf(ps.text), [call])
      assert.doesNotMatch(callsOf(ps.text).join('\n'), /ReportOnly|Enforce/)
    }
  })

  test(`${c.id}: Verify is called on the policy; Enforce is withheld with its reason, never drawn as a call that would throw`, () => {
    const { ps } = psOf(pkg, 'reportOnly', c.bindings)
    assert.ok(ps)
    assert.deepEqual(callsOf(ps.text), [c.verify])
    assert.match(pkg.blocks['powershell.run'].meta.invocation?.withheldModes?.Enforce ?? '', c.enforce)
    assert.equal(psOf(pkg, 'readyToEnforce', c.bindings).ps, undefined)
  })
}
