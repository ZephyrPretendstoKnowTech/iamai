// Emergency access is a foundation: on every plan, In place when every bg.*
// check passes, Ready otherwise, never removed by a pick or a detection. A
// change to an existing policy carries a Dates line and a calendar entry, and
// which dates it carries is Foundation B's: a policy already in report-only,
// with nothing left to submit but the enforcement its window has not earned,
// carries the days it has — the day it entered report-only and its review
// milestone — not "Announce · Change" (roadmap/forecast.ts enforcementUnearned).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { adminsAtRung5, runFixture } from '../../roadmap/fixtures/run.ts'
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
  // Day one: the second account is inside one enabled policy, and both accounts
  // signed in ten days before the scan with no drill recorded (E3): who and why.
  assert.deepEqual(bg1.checks?.items.map((i) => i.fix).sort(), ['excluded-everywhere', 'recent-sign-in', 'recent-sign-in'], `the failing checks (${bg1.checks?.items.map((i) => i.fix).join(', ')})`)
  const week2 = runFixture(fixture('demo-week2'))
  const bg2 = week2.steps.find((s) => s.id === BG)!
  assert.equal(bg2.status, 'done', 'In place on week two: the group is excluded and the sign-in is a recorded drill')
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

test('a change step carries a Dates line and a calendar entry, on the demo and GetIAMAI', () => {
  const cases: { name: 'demo-week2' | 'getiamai'; stepId: string; dates: RegExp; adminsReady?: boolean; snapshot?: (f: ReturnType<typeof fixture>) => ReturnType<typeof fixture>['snapshot'] }[] = [
    // Week two, with its admins policy back in report-only: a change the plan can
    // write, so it is dated. A policy naming an object the tenant lacks is not —
    // and neither is one whose readiness prerequisite is unmet, which is why the
    // admins here are at the rung their own policy asks for (roadmap/operations.ts
    // readinessGate; the held counterpart is roadmap/readinessGate.test.ts).
    //
    // The policy is in report-only and meets the baseline, so the only thing the
    // step has left to submit is `{"state":"enabled"}` — the enforcement. Its
    // window has not closed, so the days it states are the ones it has.
    {
      name: 'demo-week2',
      stepId: 's-goal-admins-phishing-resistant',
      dates: /^Report-only since .+ · Review .+ · Enforcement is dated once the observation window closes$/,
      adminsReady: true,
      snapshot: (f) => {
        const ca = f.snapshot.config.caPolicies!
        const rows = (ca.rows as Record<string, unknown>[]).map((p) => (/Admins phishing-resistant/.test(String(p.displayName)) ? { ...p, state: 'enabledForReportingButNotEnforced' } : p))
        return { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } }
      },
    },
    // GetIAMAI's token-protection policy is already enabled and short of the
    // baseline: the change is live the moment it lands, so it announces and
    // changes on the schedule's own days.
    {
      name: 'getiamai',
      stepId: 's-goal-token-protection',
      dates: /^Announce .+ · Change .+$/,
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
    const first = c.snapshot ? runFixture({ ...f, snapshot }, { snapshot } as Partial<RoadmapInput>) : runFixture(f)
    const over = { ...(c.snapshot ? { snapshot } : {}), ...(c.adminsReady ? { viability: adminsAtRung5(first.viability, f.snapshot.asOf) } : {}) }
    const r = Object.keys(over).length > 0 ? runFixture({ ...f, snapshot }, over as Partial<RoadmapInput>) : first
    const step = r.steps.find((s) => s.id === c.stepId)!
    assert.equal(step.kind, 'adjust', `${c.name}: a change step`)
    // The three dates the plan drew for the step. A policy already in report-only
    // whose only remaining submission is its enforcement carries none of them:
    // the plan keeps that rollout apart from the step's milestones
    // (roadmap/forecast.ts settleForecast), which is why its Dates line below is
    // the observation line rather than "Announce · Change".
    const events = step.events ?? r.schedule.forecastOnly?.[step.id]?.events ?? null
    assert.ok(events, `${c.name}: the change is dated`)
    assert.ok(events.announce && events.announce.at < events.enforce.at, `${c.name}: announce, then change`)
    const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null }
    const view = stepExportView(step, ctx)
    assert.ok(view.dates && c.dates.test(view.dates), `${c.name}: the Dates line (${view.dates})`)
    const ics = buildIcs(r.steps, 'Tenant', 'plan-1', (s) => stepExportView(s, ctx))
    assert.ok(ics.includes(`UID:plan-1-${step.id}@iamai`), `${c.name}: in the calendar`)
  }
})
