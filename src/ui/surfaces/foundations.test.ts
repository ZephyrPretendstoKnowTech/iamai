// Emergency access is a foundation: on every plan, In place when every bg.*
// check passes, Ready otherwise, never removed by a pick or a detection. A
// change to an existing policy carries a Dates line and a calendar entry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { RoadmapInput } from '../../roadmap/generate.ts'
import { buildIcs } from '../../roadmap/ics.ts'
import { stepExportView } from './stepExport.ts'
import type { StepVarContext } from './stepVars.ts'

const BG = 's-prereq-break-glass'

test('emergency access is on every plan: Ready with one failing check on the demo, In place on week two, present on GetIAMAI, never removed', () => {
  const day1 = runFixture(fixture('demo'))
  const bg1 = day1.steps.find((s) => s.id === BG)!
  assert.ok(bg1, 'present on day one')
  assert.equal(bg1.status, 'ready', 'Ready: the second account sits inside one report-only policy')
  assert.equal(bg1.checks?.failing, 1, `one failing check (${bg1.checks?.items.map((i) => i.fix).join(', ')})`)
  assert.equal(bg1.checks?.items[0]?.fix, 'excluded-everywhere', 'the second account is inside one enabled policy')
  const week2 = runFixture(fixture('demo-week2'))
  const bg2 = week2.steps.find((s) => s.id === BG)!
  assert.equal(bg2.status, 'done', 'In place on week two')
  assert.equal(bg2.checks?.failing, 0)
  const f = fixture('getiamai')
  assert.ok(runFixture(f).steps.some((s) => s.id === BG), 'present on GetIAMAI')
  // Never removed by a pick: with no accounts picked the step stays, Ready, with its create instructions' check.
  const none = { ...f.mapping, breakGlassUserIds: [] }
  const bare = runFixture({ ...f, mapping: none }, { mapping: none }).steps.find((s) => s.id === BG)!
  assert.ok(bare && bare.status === 'ready', 'stays, Ready, with nothing picked')
  // Nothing that can deny access is offered while it is Ready.
  for (const s of day1.steps) if (s.kind === 'create' && s.status !== 'done' && s.status !== 'skipped') assert.ok(s.blockedBy.includes(BG) || s.status === 'blocked', `${s.id} waits while emergency access is unverified`)
})

test('a change step carries Announce and Change dates and a calendar entry, on the demo and GetIAMAI', () => {
  const cases: { name: 'demo' | 'getiamai'; stepId: string; snapshot?: (f: ReturnType<typeof fixture>) => ReturnType<typeof fixture>['snapshot'] }[] = [
    { name: 'demo', stepId: 's-goal-admins-phishing-resistant' },
    {
      name: 'getiamai',
      stepId: 's-goal-token-protection',
      snapshot: (f) => {
        const exclusions = f.mapping.records['__globalExclusion']?.resolvedId
        const policy = { id: 'p-token', displayName: 'Core - Require - Token Protection (Windows)', state: 'enabled', createdDateTime: '2026-01-10T00:00:00Z', conditions: { users: { includeUsers: ['All'], excludeUsers: [...f.mapping.breakGlassUserIds], excludeGroups: exclusions ? [exclusions] : [] }, applications: { includeApplications: ['00000002-0000-0ff1-ce00-000000000000', '00000003-0000-0ff1-ce00-000000000000'] }, platforms: { includePlatforms: ['windows'] }, clientAppTypes: ['mobileAppsAndDesktopClients'] }, grantControls: null, sessionControls: { secureSignInSession: { isEnabled: true } } }
        const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
        return { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [...(ca.rows ?? []), policy] } } }
      },
    },
  ]
  for (const c of cases) {
    const f = fixture(c.name)
    const snapshot = c.snapshot ? c.snapshot(f) : f.snapshot
    const r = c.snapshot ? runFixture({ ...f, snapshot }, { snapshot } as Partial<RoadmapInput>) : runFixture(f)
    const step = r.steps.find((s) => s.id === c.stepId)!
    assert.equal(step.kind, 'adjust', `${c.name}: a change step`)
    assert.ok(step.events, `${c.name}: the change is dated`)
    assert.ok(step.events!.announce && step.events!.announce.at < step.events!.enforce.at, `${c.name}: announce, then change`)
    const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null }
    const view = stepExportView(step, ctx)
    assert.ok(view.dates && /^Announce .+ · Change .+$/.test(view.dates), `${c.name}: the Dates line (${view.dates})`)
    const ics = buildIcs(r.steps, 'Tenant', 'plan-1', (s) => stepExportView(s, ctx))
    assert.ok(ics.includes(`UID:plan-1-${step.id}@iamai`), `${c.name}: in the calendar`)
  }
})
