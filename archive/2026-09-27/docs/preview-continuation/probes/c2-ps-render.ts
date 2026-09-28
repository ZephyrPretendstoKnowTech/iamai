// Cycle 2 C02/C06: the PowerShell the viewer shows and Copy copies for the ten
// packages that used to stage corrections, written to <out>/<step>-<state>.ps1 for a
// syntax-only parse ([System.Management.Automation.Language.Parser]::ParseFile —
// nothing is run, no Graph). Synthetic values only.
// Usage: node docs/preview-continuation/probes/c2-ps-render.ts <out-dir>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import registry from '../../../src/content/implementation/registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from '../../../src/content/implementation/protocol.ts'
import { CHANGED_FIELDS_BINDING } from '../../../src/content/implementation/protocol.ts'
import { projectImplementation } from '../../../src/content/implementation/project.ts'

const out = process.argv[2]
mkdirSync(out, { recursive: true })
const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const target = { displayName: "Sample - O'Brien policy", conditions: { users: { includeUsers: ['All'], excludeGroups: [ID(1)] }, applications: { includeApplications: ['All'], excludeApplications: ['d4ebce55-015a-49b5-a083-c84d1797ae8c'] }, clientAppTypes: ['exchangeActiveSync', 'other'] }, grantControls: { operator: 'OR', builtInControls: ['block'] }, sessionControls: null }
const base = { 'policy.target.displayName': target.displayName, 'policy.target.conditions': target.conditions, 'policy.target.grantControls': target.grantControls, 'policy.target.sessionControls': null, 'policy.target.mode': 'blockOutsideTrusted', 'intune.compliance.prerequisiteState': 'satisfied', 'policy.current.id': ID(3), 'policy.current.displayName': 'Sample - tenant policy', 'policy.target.json': JSON.stringify(target) }
const STEPS = ['s-goal-admin-session', 's-goal-azure-management-mfa', 's-goal-block-auth-transfer', 's-goal-block-device-code', 's-goal-block-legacy-auth', 's-goal-block-unsupported-platforms', 's-goal-geo-restriction', 's-goal-mobile-app-protection', 's-goal-register-info-protected', 's-goal-require-managed-device']
let files = 0
for (const stepId of STEPS) {
  const cases: [string, Record<string, unknown>][] = [
    ['missing', {}],
    ['partial', { [CHANGED_FIELDS_BINDING]: ['conditions.users.excludeGroups', 'grantControls.builtInControls', 'sessionControls.signInFrequency'] }],
    ['reportOnly', {}],
    ['readyToEnforce', {}],
  ]
  for (const [state, extra] of cases) {
    const p = projectImplementation(PACKAGES[stepId], state as never, { ...base, ...extra })
    const ps = p.channels.find((c) => c.channel === 'powershell')
    const name = `${stepId}-${state}`
    if (!ps) {
      console.log(name, 'NO POWERSHELL', JSON.stringify(p.degraded ?? p.hold))
      continue
    }
    writeFileSync(join(out, `${name}.ps1`), ps.text)
    files += 1
    const calls = ps.text.split('\n').filter((l) => /^Invoke-IAMAIStep /.test(l)).map((c) => c.replace(/-TargetPolicyJson '.*?'(?= -|$)/, "-TargetPolicyJson '<target>'"))
    console.log(name, 'modes', ps.runs.map((r) => r.mode).join(','), '| staging', /StageForCorrection|enabledForReportingButNotEnforced'\}\|Out-Null; *Write-Host 'Moved/.test(ps.text), '|', calls.join(' / '))
  }
}
console.log(`${files} scripts -> ${out}`)
