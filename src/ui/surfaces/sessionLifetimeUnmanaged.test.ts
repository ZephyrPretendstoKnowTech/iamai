// Review 6 queue 2: Limit How Long Sessions Last required a name for its unmanaged-device
// companion, a member the package itself records with no stable id, and the pinned goal
// maps to one policy. So every render was a preview, its Create call passed a stand-in
// companion name, and the browser policy the pin does name was never offered. The create
// is now the browser policy alone; the companion is said to be not offered, with why.
//
// V1 audit S4-10: withholding the companion left its words in the package — a second
// create body in the JSON channel, a two-policy Create/Verify/Enforce in the script an
// admin reads whole, and a 9-hour interval on a step whose one pinned policy is 12. The
// pin maps this goal to one member (`all-users-no-persistence` → ea9459a9) and the
// content entry's own reference reads "One policy, as the pinned baseline has it", so the
// companion is gone from the source, not hidden at runtime. The interval it shipped is
// gone with it: every channel takes the resolved target's own session controls.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { NO_RUNTIME, projectSafely } from '../../content/implementation/project.ts'
import { implementationPackageFor, memberBindings, packageBindings } from './stepPackage.ts'
import { stepContract } from './stepContract.ts'

function opened() {
  const f = curatedFixture('demo-week2')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.goalId === 'all-users-no-persistence' && s.kind !== 'verify')!
  const pkg = implementationPackageFor(step)!
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as never
  const bindings = { ...packageBindings(step, ctx, stepContract(step, ctx)), ...memberBindings(step, f.snapshot, (ctx as { nameOf: (id: string) => string }).nameOf) }
  return { pkg, bindings }
}

test('with the excluded accounts held, the browser create is handed over in every channel', () => {
  const { pkg, bindings } = opened()
  const p = projectSafely(pkg, 'missing', { ...bindings, 'policy.target.excludeUsers': ['c0100000-0000-4000-8000-0000000000aa'] }, NO_RUNTIME)
  assert.equal(p.hold, null, JSON.stringify(p.hold))
  assert.equal(p.degraded, undefined, JSON.stringify(p.degraded))
  assert.deepEqual(p.channels.map((c) => c.channel), ['entra', 'powershell', 'json', 'aiInfo'])
  const ps = p.channels.find((c) => c.channel === 'powershell')!
  assert.deepEqual(ps.runs.map((r) => r.mode), ['CreateBrowser'])
  assert.match(ps.text, /-ExcludeUserIds @\('c0100000-0000-4000-8000-0000000000aa'\)$/m)
  const json = p.channels.find((c) => c.channel === 'json')!
  assert.deepEqual(json.requests, [{ method: 'POST', endpoint: 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies' }])
  const created = JSON.parse(json.text) as { displayName: string; state: string; conditions: { clientAppTypes: string[]; users: { excludeUsers: string[] } } }
  assert.deepEqual([created.displayName, created.state, created.conditions.clientAppTypes, created.conditions.users.excludeUsers], ['Core - Session - Non-persistent browser sessions', 'enabledForReportingButNotEnforced', ['browser'], ['c0100000-0000-4000-8000-0000000000aa']])
  for (const c of p.channels) assert.doesNotMatch(c.text, /‹|\{\{|\[omit /, c.channel)
  // The create body carries the resolved target's own session controls, not a number this package wrote.
  const session = (JSON.parse(json.text) as { sessionControls: { signInFrequency: { value: number; type: string }; persistentBrowser: { mode: string } } }).sessionControls
  assert.deepEqual([session.signInFrequency.type, session.signInFrequency.value, session.persistentBrowser.mode], ['hours', 12, 'never'])
  assert.match(ps.text, /-BrowserSessionControlsJson '\{/)
})
