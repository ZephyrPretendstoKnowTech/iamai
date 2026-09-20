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
import { readFileSync } from 'node:fs'
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
  assert.deepEqual(pkg.meta.baselineAuthority?.members?.map((m) => m.role), ['browser'], 'the package declares a member the pin does not name')
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
  // The create body carries the resolved target's own session controls, not a number this package wrote.
  const session = (JSON.parse(json.text) as { sessionControls: { signInFrequency: { value: number; type: string }; persistentBrowser: { mode: string } } }).sessionControls
  assert.deepEqual([session.signInFrequency.type, session.signInFrequency.value, session.persistentBrowser.mode], ['hours', 12, 'never'])
  assert.match(ps.text, /-BrowserSessionControlsJson '\{/)
})

// S4-10, at the source: the package holds one policy, and no channel states an interval of its own.
test('the session package has no unmanaged-device block, request body or script mode, and no channel writes an interval as a literal', () => {
  const { pkg } = opened()
  const ids = Object.keys(pkg.blocks).filter((id) => /unmanaged/i.test(id))
  assert.deepEqual(ids, [], 'an unmanaged-device block is still in the package')
  assert.deepEqual(Object.keys((pkg.meta.projection as { partial: { mismatches: Record<string, unknown> } }).partial.mismatches), ['browser.missing', 'browser.conditions', 'browser.session', 'browser.grant-none'])
  // One create body in the whole package, and it is the browser policy's.
  const creates = Object.entries(pkg.blocks).filter(([, b]) => b.meta.channel === 'json' && String(b.meta.method ?? '').toUpperCase() === 'POST')
  assert.deepEqual(creates.map(([id]) => id), ['json.browser.create'])
  // The script an admin reads whole: no Unmanaged parameter, mode or branch, and no hardcoded interval.
  const script = pkg.blocks['powershell.run'].text
  assert.doesNotMatch(script, /Unmanaged/)
  assert.doesNotMatch(script, /New-Session|value=\$Hours|frequencyInterval='|type='hours'|mode='never'/)
  const modes = /\[ValidateSet\(([^)]*)\)\]/.exec(script)![1]
  assert.deepEqual(modes.split(',').map((m) => m.trim().replace(/'/g, '')), ['CreateBrowser', 'CorrectBrowserConditions', 'CorrectBrowserSession', 'CorrectBrowserGrant', 'ReportOnlyBrowser', 'VerifyBrowser', 'Enforce'])
  // The only value the pin owns reaches the deployable channels as a binding, and the
  // human-facing ones point at the target instead of restating it.
  const source = readFileSync('docs/implementation-content/s-goal-session-lifetime/CONTENT.md', 'utf8')
  assert.equal(source.includes('"type":"hours"'), false, 'a channel still writes the interval as a literal')
  for (const id of ['json.browser.create', 'json.browser.session']) assert.match(pkg.blocks[id].text, /\{\{json:policies\.session\.browser\.target\.sessionControls\}\}/, id)
  assert.equal(pkg.blocks['powershell.run'].meta.invocation?.parameters?.BrowserSessionControlsJson?.binding, 'policies.session.browser.target.sessionControls')
  // Only the ReadinessApproved attestation withholds a mode now; there is no companion to withhold.
  assert.deepEqual(Object.keys(pkg.blocks['powershell.run'].meta.invocation?.withheldModes ?? {}), ['Enforce'])
})
