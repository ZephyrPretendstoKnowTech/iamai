// S5 probe: REVIEW-1 F2 after the fix — what the held all-users step says and hands over (reason, blocked row,
// export lines, channels), prerequisites met, listed and reversed. Synthetic only; no network.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { personReadiness } from '../../../src/scoring/phishingResistant.ts'
import { implementationOffered, policyJson, stepOperations } from '../../../src/ui/surfaces/stepJson.ts'
import { nextSafeAction } from '../../../src/roadmap/nextSafeAction.ts'
import { unavailableReason } from '../../../src/roadmap/operations.ts'
import { powershellFor } from '../../../src/ui/surfaces/stepPowerShell.ts'
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const base = curatedFixture('demo-week2')
const f = { ...base, groups: new Map(base.groups) }
const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
const others = [...f.groups.keys()].filter((id) => id !== g)
const internalGroup = others[0]
const adminsGroup = 'bbbbbbbb-0000-4000-8000-00000000000a'
const src = structuredClone(f.groups.get(internalGroup)) as any
f.groups.set(adminsGroup, { ...src, groupId: adminsGroup, memberIds: (src.memberIds ?? []).slice(0, 1), memberCount: 1 })
const apps = { includeApplications: ['All'] }
const rows = [
  { id: 'c0100000-0000-4000-8000-000000000001', displayName: 'Policy A', state: 'enabled', conditions: { users: { includeGroups: [adminsGroup], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
  { id: 'c0100000-0000-4000-8000-000000000002', displayName: 'Policy B', state: 'enabled', conditions: { users: { includeGroups: [internalGroup], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
]
const ca = f.snapshot.config.caPolicies!
const keep = (ca.rows as any[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
for (const order of [rows, [...rows].reverse()]) {
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [...order, ...keep] } } }
  const scored = runFixture({ ...f, snapshot }, { snapshot } as never).viability
  const r = runFixture({ ...f, snapshot }, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
  const s = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
  const { stepContract } = await import('../../../src/ui/surfaces/stepContract.ts') as any
  const { blockedReasonFor, holdReasonFor } = await import('../../../src/roadmap/stateReason.ts') as any
  const byId = new Map(r.steps.map((x) => [x.id, x]))
  console.log('== first listed', order[0].displayName)
  console.log('  kind', s.kind, 'unmatchedPair', s.action.unmatchedPair, 'ambiguousTarget', s.action.ambiguousTarget, 'reason', unavailableReason(s), 'offered', implementationOffered(s), 'next', JSON.stringify(nextSafeAction(s)))
  console.log('  ops', JSON.stringify(stepOperations(s)), 'json', JSON.stringify(policyJson(s)).slice(0, 120), 'ps has policy ids', /c0100000/.test(powershellFor(stepOperations(s))))
  console.log('  tracking', JSON.stringify(s.tracking?.policyId ?? null))
  for (const fn of [blockedReasonFor, holdReasonFor]) if (typeof fn === 'function') { try { console.log('  reason fn', fn.name, JSON.stringify(fn(s, byId))) } catch (e) { console.log('  reason fn', fn.name, 'threw', String(e).slice(0, 120)) } }
  if (typeof stepContract === 'function') { try { console.log('  contract', JSON.stringify(stepContract(s, { tenant: 'Contoso' })).match(/[^"]*(more than one policy|stands out)[^"]*/g)) } catch (e) { console.log('  contract threw', String(e).slice(0, 160)) } }
}
