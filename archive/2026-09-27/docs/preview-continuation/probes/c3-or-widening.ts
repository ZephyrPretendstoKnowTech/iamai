// Cycle 3 copy of the cycle 2 reviewer probe rv2-or.ts, run for both the admins and staff group.
// Reviewer probe, cycle 2: a group policy whose OR grant offers a weaker alternative beside a
// stronger method (strength OR compliant device). Is it widened to All users with its grant kept?
// SRC=<source tree>. Plan and render only; nothing executed.
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
const SRC = process.env.SRC ?? '.'
const imp = (p: string) => import(pathToFileURL(join(SRC, p)).href)
const { curatedFixture } = await imp('src/roadmap/fixtures/index.ts')
const { runFixture } = await imp('src/roadmap/fixtures/run.ts')
const { actionableExclusionsGroupId, directoryEvidenceFromGroups } = await imp('src/mapping/safetyChoice.ts')
const { personReadiness } = await imp('src/scoring/phishingResistant.ts')
const { stepExportView } = await imp('src/ui/surfaces/stepExport.ts')
const { stepBodyOf } = await imp('src/ui/surfaces/stepBody.ts')
const { nextSafeAction } = await imp('src/roadmap/nextSafeAction.ts')

const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const A = 'c0100000-0000-4000-8000-000000000001'
const STRONG_ID = '00000000-0000-0000-0000-000000000004'

function run(grant: any, admins: boolean) {
  const base = curatedFixture('demo-week2')
  const f = { ...base, groups: new Map(base.groups) }
  const excl = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
  const staffGroup = [...f.groups.keys()].find((id) => id !== excl)!
  const adminsGroup = 'bbbbbbbb-0000-4000-8000-00000000000a'
  const src = structuredClone(f.groups.get(staffGroup)) as any
  f.groups.set(adminsGroup, { ...src, groupId: adminsGroup, memberIds: (src.memberIds ?? []).slice(0, 1), memberCount: 1 })
  const ca = f.snapshot.config.caPolicies!
  const keep = (ca.rows as any[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
  const row = { id: A, displayName: 'Policy A', state: 'enabled', conditions: { users: { includeGroups: [admins ? adminsGroup : staffGroup], excludeGroups: [excl] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: grant }
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [row, ...keep] } } }
  const scored = runFixture({ ...f, snapshot }, { snapshot } as never).viability
  const r = runFixture({ ...f, snapshot }, { snapshot, viability: scored.map((v: any) => ({ ...v, readiness: READY })) } as never)
  const step = r.steps.find((x: any) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
  const ctx = { snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as any
  const res = r.coverage.results.find((g: any) => g.goal.id === 'mfa-all-users')!
  return { step, ctx, res }
}
const shapes: [string, any][] = [
  ['strength OR compliant device', { operator: 'OR', builtInControls: ['compliantDevice'], authenticationStrength: { id: STRONG_ID } }],
  ['MFA OR compliant device', { operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] }],
]
for (const [label, grant] of shapes) {
  for (const admins of [true, false]) {
    const { step, ctx, res } = run(grant, admins)
    const ops = step.action.resolution?.policies ?? []
    const up = ops.find((o: any) => o.mode === 'update')
    console.log(`\n== ${label} [${admins ? 'admins' : 'staff'} group, enabled]: status ${res.status} reasons ${JSON.stringify(res.reasons.map((q: any) => [q.kind, q.userIds?.length]))}`)
    console.log(`  candidate ${JSON.stringify(res.candidates.filter((c: any) => c.policyId === A).map((c: any) => [c.contribution, c.ownScope, c.meetsFloor]))}`)
    console.log(`  ops ${JSON.stringify(ops.map((o: any) => [o.mode, o.policyId ?? null, Object.keys(o.body ?? {})]))} next ${JSON.stringify(nextSafeAction(step))}`)
    if (up) console.log(`  update users ${JSON.stringify(up.body.conditions?.users)} grant-in-body ${'grantControls' in up.body}`)
    console.log(`  changes ${JSON.stringify((step.action.changes ?? []).map((c: any) => c.field))}`)
    const view = stepExportView(step, ctx)
    console.log(`  export ${JSON.stringify(view.state)}\n    ${view.whatToDo.join('\n    ').slice(0, 900)}`)
    for (const a of stepBodyOf(step, ctx).artifacts) {
      if (a.unavailable) continue
      const t = a.text()
      const m = /Invoke-IAMAIStep -Mode '[A-Za-z]+'.*$/m.exec(t)
      console.log(`  [${a.id}] strength ${t.includes(STRONG_ID)} compliantDevice ${/compliantDevice|compliant device/i.test(t)} ${m ? 'call ' + m[0].replace(/'\{.*\}'/, "'<target>'") + ' target grant ' + JSON.stringify((/"grantControls":(\{[^}]*\}[^}]*\})/.exec(t) ?? [])[1] ?? null) : ''}`)
    }
  }
}
