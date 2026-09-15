// S1 probe for BLOCKED gap (4): a report-only admin policy asking only for plain MFA (below the
// phishing-resistant floor). Is its own weak grant corrected? Synthetic (curated demo-week2). No network.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { nextSafeAction } from '../../../src/roadmap/nextSafeAction.ts'
import { unavailableReason } from '../../../src/roadmap/operations.ts'
const GA = '62e90394-69f5-4237-9190-012177145e10'
const f = curatedFixture('demo-week2')
const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
const row = { id: 'c0100000-0000-4000-8000-000000000009', displayName: 'Policy W', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeRoles: [GA], excludeGroups: [g] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
const ca = f.snapshot.config.caPolicies!
const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [row] } } }
const r = runFixture({ ...f, snapshot }, { snapshot } as never)
const cov = r.coverage.results.find((x) => x.goal.id === 'admins-phishing-resistant')!
console.log('cov', cov.status, 'candidates', JSON.stringify(cov.candidates.map((c) => [c.policyName, c.contribution, c.ownScope, c.meetsFloor, c.caveats])))
console.log('reasons', JSON.stringify(cov.reasons.map((x) => [x.kind, x.expected ?? null])))
const s = r.steps.find((x) => x.goalId === 'admins-phishing-resistant' && x.kind !== 'verify')!
console.log('step', s.kind, s.state.lifecycle, s.state.condition, 'status', s.status)
console.log('ops', JSON.stringify((s.action.resolution?.policies ?? []).map((o: any) => [o.mode, o.policyId === row.id ? 'W' : o.policyId, Object.keys(o.body)])), 'changes', JSON.stringify((s.action.changes ?? []).map((c) => c.field)))
console.log('unavailable', JSON.stringify(unavailableReason(s as never)), 'next', JSON.stringify(nextSafeAction(s)).slice(0, 300))
