// S3 C06: the PowerShell the viewer shows and Copy copies for the all-users and admins
// packages, written to <out>/<scenario>.ps1 for a syntax-only parse
// ([System.Management.Automation.Language.Parser]::ParseFile — nothing is run, no Graph).
// Scenarios: complete synthetic inputs per state, and the S1 C01 tenant (partial).
// Usage: node docs/preview-corrections/probes/s3-ps-render.ts <out-dir>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import registry from '../../../src/content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../../src/content/implementation/protocol.ts'
import { CHANGED_FIELDS_BINDING } from '../../../src/content/implementation/protocol.ts'
import { NO_RUNTIME, projectImplementation, projectPlanned } from '../../../src/content/implementation/project.ts'

const out = process.argv[2]
mkdirSync(out, { recursive: true })
const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const target = { displayName: "Sample - O'Brien policy", conditions: { users: { includeUsers: ['All'], excludeGroups: [ID(1)] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null }
const base = { 'policy.target.displayName': target.displayName, 'policy.target.conditions': target.conditions, 'policy.target.grantControls': target.grantControls, 'policy.target.sessionControls': null, 'authStrength.target.id': ID(2), 'policy.current.id': ID(3), 'policy.target.json': JSON.stringify(target) }
for (const stepId of ['s-goal-mfa-all-users', 's-goal-admins-phishing-resistant']) {
  const cases: [string, Record<string, unknown>][] = [
    ['missing', {}],
    ['partial', { [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups'] }],
    ['reportOnly', {}],
    ['readyToEnforce', {}],
  ]
  for (const [state, extra] of cases) {
    const p = projectImplementation(PACKAGES[stepId], state as never, { ...base, ...extra })
    const ps = p.channels.find((c) => c.channel === 'powershell')
    const json = p.channels.find((c) => c.channel === 'json')
    const name = `${stepId}-${state}`
    if (!ps) { console.log(name, 'NO POWERSHELL', JSON.stringify(p.hold), JSON.stringify(p.degraded ?? null)); continue }
    writeFileSync(join(out, `${name}.ps1`), ps.text)
    const calls = ps.text.split('\n').filter((l) => /^Invoke-IAMAIStep /.test(l))
    console.log(name, 'runs', JSON.stringify(ps.runs), '| json', json ? `${json.requests.map((r) => r.method).join(',')} ${Object.keys(JSON.parse(json.text)).join(',')}` : 'none')
    for (const c of calls) console.log('   ', c.length > 260 ? `${c.slice(0, 260)}…` : c)
  }
  // Without the whole target (a field still waiting on a reference): the script is not offered as runnable.
  const { ['policy.target.json']: _drop, ...partialValues } = base
  const held = projectImplementation(PACKAGES[stepId], 'missing', partialValues)
  console.log(`${stepId}-missing-without-target`, 'powershell', held.channels.some((c) => c.channel === 'powershell'), 'degraded', JSON.stringify(held.degraded ?? null), 'hold', JSON.stringify(held.hold))
  const planned = projectPlanned(PACKAGES[stepId], 'missing', partialValues, NO_RUNTIME, (b) => `‹${b}›`)
  console.log(`${stepId}-missing-preview`, (planned.channels.find((c) => c.channel === 'powershell')?.text.split('\n').filter((l) => /^Invoke-IAMAIStep /.test(l)) ?? []).join(' / '))
}
