// Review 6 queue 2: Limit How Long Sessions Last required a name for its unmanaged-device
// companion, a member the package itself records with no stable id, and the pinned goal
// maps to one policy. So every render was a preview, its Create call passed a stand-in
// companion name, and the browser policy the pin does name was never offered. The create
// is now the browser policy alone; the companion is said to be not offered, with why.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PINNED_GOAL_MAP } from '../../roadmap/goalMap.ts'
import { NO_RUNTIME, projectSafely } from '../../content/implementation/project.ts'
import { implementationPackageFor, memberBindings, packageBindings } from './stepPackage.ts'
import { stepContract } from './stepContract.ts'
import { stepBodyOf } from './stepBody.ts'

// Editorial batch C: the companion is no longer named; the create says the baseline has one session policy.
const NOT_OFFERED = 'The baseline has one session policy for this step: the browser policy below.'

function opened() {
  const f = curatedFixture('demo-week2')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.goalId === 'all-users-no-persistence' && s.kind !== 'verify')!
  const pkg = implementationPackageFor(step)!
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as never
  const bindings = { ...packageBindings(step, ctx, stepContract(step, ctx)), ...memberBindings(step, f.snapshot, (ctx as { nameOf: (id: string) => string }).nameOf) }
  return { step, pkg, ctx, bindings }
}

test('the session create is the pinned browser policy alone, and the unmanaged companion is said to be not offered', () => {
  const { step, pkg, ctx, bindings } = opened()
  // Premises: the pin names one policy for the goal, and the package's companion has no stable id.
  assert.deepEqual(PINNED_GOAL_MAP['all-users-no-persistence'], ['ea9459a9-91b6-4d2b-b929-03781ac81d54'])
  assert.equal(pkg.meta.baselineAuthority?.members?.find((m) => m.role === 'unmanaged')?.memberStableId, null)
  assert.equal(bindings['policies.session.browser.operation'], 'create')
  assert.equal(Object.keys(bindings).some((k) => k.startsWith('policies.session.unmanaged.')), false)
  const body = stepBodyOf(step, ctx)
  const tab = (id: string): string => {
    const a = body.artifacts.find((x) => x.id === id)
    assert.ok(a && !a.unavailable, id)
    return a.text()
  }
  const entra = tab('portal')
  assert.ok(entra.includes(NOT_OFFERED), entra)
  assert.ok(entra.includes('1. Name: `Core - Session - Non-persistent browser sessions`.'), entra)
  assert.doesNotMatch(entra, /device\.isCompliant|‹unmanaged/)
  assert.ok(tab('ai').includes('there is no second policy to create, correct or enable.'))
  const calls = tab('ps').split(String.fromCharCode(10)).filter((l) => l.startsWith('Invoke-IAMAIStep'))
  assert.equal(calls.length, 1, calls.join(' | '))
  assert.match(calls[0], /^Invoke-IAMAIStep -Mode 'CreateBrowser' -BrowserPolicyDisplayName 'Core - Session - Non-persistent browser sessions' /)
  assert.doesNotMatch(calls[0], /Unmanaged/)
  const json = tab('json')
  assert.match(json, /"displayName":"Core - Session - Non-persistent browser sessions"/)
  assert.doesNotMatch(json, /device\.isCompliant|unmanaged/i)
  // The target's excluded accounts are an empty list, and that is the target's own "none" (consolidated
  // batch): the create used to preview on it as a missing value; it is now handed over carrying the empty list.
  assert.equal(body.previewNote, null, JSON.stringify(body.previewNote))
  assert.match(calls[0], /-ExcludeUserIds @\(\)$/)
  assert.match(json, /"excludeUsers":\[\]/)
})

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
  // The script's two-policy Create is withheld with the reason; the unmanaged correction modules stay in the package.
  const withheld = pkg.blocks['powershell.run'].meta.invocation?.withheldModes ?? {}
  assert.match(withheld.Create ?? '', /no unmanaged-device session policy/)
  assert.ok((pkg.meta.projection as { partial: { mismatches: Record<string, unknown> } }).partial.mismatches['unmanaged.missing'])
})
