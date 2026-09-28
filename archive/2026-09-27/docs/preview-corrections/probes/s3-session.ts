// S3 C05: why the session-lifetime package (s-goal-all-users-no-persistence) previews in every
// fixture: its planned operations' member keys and target users against the members the
// package names and the bindings IAMAI supplies. No network.
import { curatedFixture, allFixtures } from '../../../src/roadmap/fixtures/index.ts'
import { runFixture } from '../../../src/roadmap/fixtures/run.ts'
import { stepBodyOf } from '../../../src/ui/surfaces/stepBody.ts'
import { implementationPackageFor, memberBindings, packageBindings, plannedOperationsOf } from '../../../src/ui/surfaces/stepPackage.ts'
import type { StepVarContext } from '../../../src/ui/surfaces/stepVars.ts'

const want = process.argv[2] ?? 'demo-week2'
const f = want === 'curated' ? curatedFixture('demo-week2') : allFixtures().find((x) => x.name === want)!
const r = runFixture(f)
const step = r.steps.find((s) => s.id === 's-goal-all-users-no-persistence')
if (!step) throw new Error('no session step')
const pkg = implementationPackageFor(step)!
const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as StepVarContext
const b = stepBodyOf(step, ctx)
console.log('step', step.id, step.kind, 'goal', step.goalId, 'lifecycle', step.state.lifecycle, 'missing refs', JSON.stringify((step.action.missing ?? []).map((m) => m.token)))
for (const m of pkg.meta.baselineAuthority?.members ?? []) console.log('member', m.role, 'stable id', m.memberStableId)
for (const o of plannedOperationsOf(step)) {
  const t = (o.target ?? o.body) as { displayName?: string; conditions?: { users?: unknown } }
  console.log('op', o.mode, 'memberKey', o.memberKey, 'name', t?.displayName ?? (o.body as { displayName?: string }).displayName, 'users', JSON.stringify(t?.conditions?.users ?? null))
}
const bind = packageBindings(step, ctx, b.contract)
console.log('memberBindings', JSON.stringify(memberBindings(step, f.snapshot)))
console.log('policy.target.excludeUsers', JSON.stringify(bind['policy.target.excludeUsers'] ?? '(unbound)'), '| policy.target.displayName', JSON.stringify(bind['policy.target.displayName'] ?? '(unbound)'))
console.log('preview note', JSON.stringify(b.previewNote?.lines ?? null))
