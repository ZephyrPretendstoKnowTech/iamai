// Cycle 3 (review 2 queue 2): the shared-devices script is called with IAMAI's values.
//
// The block was a bare `template` with a mandatory -Mode, so the executable prerequisite
// step drew a PowerShell tab nothing called, and a technician who ran it had to supply
// the accounts, the exclusions and the trusted location by hand. Every one of those is a
// binding IAMAI already holds, so the script is now defined once and called with them.
// Enforce needs two attestations no prerequisite can pass, and PeopleExclusions takes
// JSON text IAMAI holds only as objects: both are withheld with the reason.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { CHANGED_FIELDS_BINDING } from './protocol.ts'
import { projectImplementation } from './project.ts'

const PKG = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages['s-shared-devices']
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const bindings = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  'tenant.displayName': 'Sample tenant',
  'policy.target.displayName': "Sample - O'Brien shared devices",
  'policy.target.includeUsers': [ID(11), ID(12)],
  'policy.target.excludeGroups': [ID(1)],
  'policy.target.trustedLocationId': ID(21),
  'peoplePolicies.resolvedPatches': [],
  'policy.current.id': ID(3),
  'policy.current.state': 'enabled',
  ...extra,
})
const callsOf = (text: string): string[] => text.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
const psOf = (p: ReturnType<typeof projectImplementation>) => p.channels.find((c) => c.channel === 'powershell')

test('s-shared-devices: Create is one call after the whole script with the resolved values, and with no single trusted location the script is withheld', () => {
  // s-shared-devices: Create is one call after the whole script, with the name, the accounts, the exclusions and the trusted location
  {
    const script = PKG.blocks['powershell.run']
    assert.equal(script.meta.kind, 'deployableAfterBinding')
    const p = projectImplementation(PKG, 'missing', bindings())
    const ps = psOf(p)
    assert.ok(ps, JSON.stringify(p.hold ?? p.degraded))
    const calls = callsOf(ps.text)
    assert.deepEqual(calls, [`Invoke-IAMAIStep -Mode 'Create' -DisplayName 'Sample - O''Brien shared devices' -IncludeUsers @('${ID(11)}', '${ID(12)}') -ExcludeGroups @('${ID(1)}') -TrustedLocationId '${ID(21)}'`])
    assert.ok(ps.text.startsWith('function Invoke-IAMAIStep {\nparam('), ps.text.slice(0, 60))
    assert.ok(ps.text.trimEnd().endsWith(calls[0]))
    // The body the call runs is the authored one: the Create branch creates in Report-only and checks the values it is given.
    assert.match(ps.text, /'Create'\{[^\n]*state='enabledForReportingButNotEnforced'/)
    assert.match(ps.text, /GuidOk \$TrustedLocationId 'TrustedLocationId'/)
  }
  // s-shared-devices: with no single trusted location the script is withheld, never drawn as a call that would throw
  {
    const p = projectImplementation(PKG, 'missing', bindings({ 'policy.target.trustedLocationId': undefined }))
    assert.equal(psOf(p), undefined)
    assert.ok(p.degraded?.some((d) => d.channel === 'powershell' && d.missingBindings.includes('policy.target.trustedLocationId')), JSON.stringify(p.degraded))
  }
})

test('s-shared-devices: a conditions correction calls CorrectConditions on the policy and moves nothing to report-only; Verify is called on the policy and Enforce is withheld with its reason', () => {
  // s-shared-devices: a conditions correction calls CorrectConditions on the policy with the resolved values, and moves nothing to report-only
  {
    const p = projectImplementation(PKG, 'partial', bindings({ 'policy.current.semanticMismatches': ['users.shared-devices'], [CHANGED_FIELDS_BINDING]: ['conditions.users.includeUsers'] }))
    const ps = psOf(p)
    assert.ok(ps, JSON.stringify(p.hold ?? p.degraded))
    assert.deepEqual(callsOf(ps.text), [`Invoke-IAMAIStep -Mode 'CorrectConditions' -PolicyId '${ID(3)}' -IncludeUsers @('${ID(11)}', '${ID(12)}') -ExcludeGroups @('${ID(1)}') -TrustedLocationId '${ID(21)}'`])
    assert.doesNotMatch(callsOf(ps.text).join('\n'), /ReportOnly/)
  }
  // s-shared-devices: Verify is called on the policy, Enforce is withheld with its reason
  {
    const observed = psOf(projectImplementation(PKG, 'reportOnly', bindings()))
    assert.ok(observed)
    assert.deepEqual(callsOf(observed.text), [`Invoke-IAMAIStep -Mode 'Verify' -PolicyId '${ID(3)}'`])
    const withheld = PKG.blocks['powershell.run'].meta.invocation?.withheldModes ?? {}
    assert.match(withheld.Enforce ?? '', /TrustedLocationReconfirmed/)
    assert.match(withheld.PeopleExclusions ?? '', /JSON/)
    assert.equal(psOf(projectImplementation(PKG, 'readyToEnforce', bindings())), undefined, 'an Enforce call without its two switches would throw')
  }
})
