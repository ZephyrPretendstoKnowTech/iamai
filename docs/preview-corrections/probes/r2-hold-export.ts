// R2 probe: what the viewer (stepBodyOf) and the export (stepExportView) carry for the all-users step in three
// synthetic shapes, prerequisites met (curated demo-week2, every person Ready):
//   SHAPE=tie   two group-assigned policies (admins group phishing-resistant strength, staff group MFA) — S5 hold
//   SHAPE=lone  the admins-group phishing-resistant policy alone — BLOCKED S5 23:30
//   SHAPE=all   an All users MFA policy short of the exclusions group — the S1/S3 corrected case
// REV=1 reverses scan order. No network, nothing written.
import { curatedFixture } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../../../src/mapping/safetyChoice.ts'
import { personReadiness } from '../../../src/scoring/phishingResistant.ts'
import { stepBodyOf } from '../../../src/ui/surfaces/stepBody.ts'
import { stepContract } from '../../../src/ui/surfaces/stepContract.ts'
import { stepExportView } from '../../../src/ui/surfaces/stepExport.ts'
import { nextSafeAction } from '../../../src/roadmap/nextSafeAction.ts'
import type { StepVarContext } from '../../../src/ui/surfaces/stepVars.ts'
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const IDS = { admins: 'c0100000-0000-4000-8000-000000000001', staff: 'c0100000-0000-4000-8000-000000000002' }
const SHAPE = process.env.SHAPE ?? 'tie'
const base = curatedFixture('demo-week2')
const f = { ...base, groups: new Map(base.groups) }
const g = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
const staffGroup = [...f.groups.keys()].find((id) => id !== g)!
const adminsGroup = 'bbbbbbbb-0000-4000-8000-00000000000a'
const src = structuredClone(f.groups.get(staffGroup)) as any
f.groups.set(adminsGroup, { ...src, groupId: adminsGroup, memberIds: (src.memberIds ?? []).slice(0, 1), memberCount: 1 })
const apps = { includeApplications: ['All'] }
const admins = { id: IDS.admins, displayName: 'Policy A', state: 'enabled', conditions: { users: { includeGroups: [adminsGroup], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } }
const staff = { id: IDS.staff, displayName: 'Policy B', state: 'enabled', conditions: { users: SHAPE === 'all' ? { includeUsers: ['All'], excludeGroups: [] } : { includeGroups: [staffGroup], excludeGroups: [g] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
const rows = SHAPE === 'lone' ? [admins] : SHAPE === 'all' ? [staff] : [admins, staff]
const ca = f.snapshot.config.caPolicies!
const keep = (ca.rows as any[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [...(process.env.REV === '1' ? [...rows].reverse() : rows), ...keep] } } }
const scored = runFixture({ ...f, snapshot }, { snapshot } as never).viability
const r = runFixture({ ...f, snapshot }, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
const ctx = { snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as StepVarContext
const who = (t: string) => Object.entries(IDS).filter(([, v]) => t.includes(v)).map(([k]) => k)
console.log(`== SHAPE=${SHAPE} REV=${process.env.REV ?? 0} step ${step.id} kind ${step.kind} ambiguous ${step.action.ambiguousTarget ?? null} next ${JSON.stringify(nextSafeAction(step))}`)
const contract = stepContract(step, ctx)
const cText = JSON.stringify(contract)
console.log('  contract implementation.offered', contract.implementation.offered, '| ambiguity copy in contract', /more than one policy this goal could correct/.test(cText), '| doneTarget copy', /stands out as this goal/.test(cText))
const b = stepBodyOf(step, ctx)
console.log('  viewer packaged', b.packaged, 'preview', JSON.stringify(b.previewNote?.lines ?? null), 'empty', b.empty.key)
for (const a of b.artifacts) {
  if (a.unavailable) { console.log(`  [viewer ${a.id}] unavailable`); continue }
  const t = a.text()
  console.log(`  [viewer ${a.id}] ids=${JSON.stringify(who(t))} includeUsersAll=${/"includeUsers":\["All"\]|All users/.test(t)} intune=${/Intune Enrollment|d4ebce55/.test(t)} grant=${/Grant|grantControls/.test(t)} ambiguity=${/more than one policy/.test(t)}`)
  if (process.env.FULL === '1') console.log('    ' + t.replace(/\n/g, '\n    ').slice(0, 700))
}
const view = stepExportView(step, ctx)
const w = view.whatToDo.join('\n')
console.log(`  [export] implementation=${view.implementation} state=${JSON.stringify(view.state)} ids=${JSON.stringify(who(JSON.stringify(view)))} includeUsersAll=${/All users|"All"/.test(w)} intune=${/Intune Enrollment/.test(w)} grant=${/Grant/.test(w)} ambiguity=${/more than one policy/.test(w)}`)
console.log('    ' + w.replace(/\n/g, '\n    ').slice(0, 900))
