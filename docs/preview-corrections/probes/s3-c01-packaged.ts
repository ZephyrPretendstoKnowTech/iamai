// S3: the S1 C01 synthetic scenario (s1-c01-render.ts rows) through stepBodyOf — the package
// channels the Implementation region actually draws, not the engine's stepJson/stepPowerShell.
// ADMIN=enabled keeps the admin policy On (default report-only); REV=1 reverses scan order;
// NOEX=1 drops the exclusions group from the admin policy. No network.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { personReadiness } from '../../../src/scoring/phishingResistant.ts'
import { stepBodyOf } from '../../../src/ui/surfaces/stepBody.ts'
import { packageStateOf, packageBindings } from '../../../src/ui/surfaces/stepPackage.ts'
import type { StepVarContext } from '../../../src/ui/surfaces/stepVars.ts'
import { policyJson, stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
const GA = '62e90394-69f5-4237-9190-012177145e10'
const IDS = { admin: 'c0100000-0000-4000-8000-000000000001', everyone: 'c0100000-0000-4000-8000-000000000002', session: 'c0100000-0000-4000-8000-000000000003' }
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const f = curatedFixture('demo-week2')
const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
const apps = { includeApplications: ['All'] }
const adminExcl = process.env.NOEX === '1' ? [] : [g]
const rows = [
  { id: IDS.admin, displayName: 'Policy A', state: process.env.ADMIN === 'enabled' ? 'enabled' : 'enabledForReportingButNotEnforced', conditions: { users: { includeRoles: [GA], excludeGroups: adminExcl }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
  { id: IDS.everyone, displayName: 'Policy B', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: [], excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider', externalTenants: { membershipKind: 'all' } } }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
  { id: IDS.session, displayName: 'Policy C', state: 'enabled', conditions: { users: { includeRoles: [GA], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 24, type: 'hours', frequencyInterval: 'timeBased' } } },
]
const ca = f.snapshot.config.caPolicies!
const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: process.env.REV === '1' ? [...rows].reverse() : rows } } }
const scored = runFixture({ ...f, snapshot }, { snapshot } as never).viability
const r = runFixture({ ...f, snapshot }, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
const who = (text: string) => Object.entries(IDS).filter(([, v]) => text.includes(v)).map(([k]) => k)
for (const goalId of ['mfa-all-users', 'admins-phishing-resistant', 'admin-session']) {
  const step = r.steps.find((x) => x.goalId === goalId && x.kind !== 'verify')
  if (!step) { console.log('==', goalId, 'no step'); continue }
  const ctx = { snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as StepVarContext
  const b = stepBodyOf(step, ctx)
  const state = packageStateOf(step, b.contract, snapshot)
  const bind = state ? packageBindings(step, ctx, b.contract) : {}
  console.log('==', goalId, step.id, 'kind', step.kind, 'pkgState', state, 'packaged', b.packaged, 'preview', b.previewNote?.lines ?? null, 'empty', b.empty.key)
  console.log('  bindings current.id', who(String(bind['policy.current.id'] ?? '')), 'changedFields', JSON.stringify(bind['policy.current.changedFields'] ?? null), 'mismatches', JSON.stringify(bind['policy.current.semanticMismatches'] ?? null))
  if (process.env.ENGINE === '1') {
    for (const o of stepOperations(step) as { mode: string; policyId?: string; body: unknown; target?: unknown }[]) console.log('  engine op', o.mode, who(String(o.policyId ?? '')), 'body', JSON.stringify(o.body), '\n  engine target', JSON.stringify(o.target ?? null))
    console.log('  engine policyJson', JSON.stringify(policyJson(step)))
    console.log('  tenant row', JSON.stringify(rows.find((x) => x.id === bind['policy.current.id'])?.conditions ?? null))
  }
  for (const a of b.artifacts) {
    if (a.unavailable) { console.log(`  [${a.id}] unavailable`); continue }
    const t = a.text()
    console.log(`  [${a.id}] note=${a.note ?? ''} ids=${JSON.stringify(who(t))}`)
    console.log('    ' + t.replace(/\n/g, '\n    ').slice(0, Number(process.env.CHARS ?? 900)))
  }
}
