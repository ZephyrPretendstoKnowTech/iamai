// Communications (comms-and-bridges.md §1), the bridges (§2) and the watch
// and effort (§3): bundling rules, solo messages, named audiences, monthly
// warnings, prompts that carry the facts, a redacted bundle, and a watch
// that reads per-day failures against a threshold.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { audiencesFor, bulletinsFor, commsPlanRows, monthlyWarnings, recipientRows } from './comms.ts'
import type { CommsContext } from './comms.ts'
import { groundingBundle, promptFor, promptPack, stepContext } from './prompts.ts'
import { effortFor, planEffort, watchFor } from './watch.ts'
import { buildIcs } from './ics.ts'
import { adminUserIds } from '../roles.ts'
import type { Step } from './types.ts'

function ctxFor(name: 'small' | 'mid' | 'large'): { ctx: CommsContext; steps: Step[]; run: ReturnType<typeof runFixture>; f: ReturnType<typeof fixture> } {
  const f = fixture(name)
  const run = runFixture(f)
  const users = new Map(f.snapshot.users.map((u) => [u.id, u]))
  const ctx: CommsContext = {
    enabledUsers: f.snapshot.users.filter((u) => u.accountEnabled !== false).length,
    adminIds: adminUserIds(f.snapshot.roles),
    guestIds: new Set(f.snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id)),
    departmentOf: new Map(f.snapshot.users.filter((u) => u.department).map((u) => [u.id, u.department as string])),
    nameOf: (id) => users.get(id)?.displayName ?? id,
    upnOf: (id) => users.get(id)?.userPrincipalName ?? null,
    tenantName: 'Fixture',
    timeZone: 'Australia/Sydney',
  }
  return { ctx, steps: run.steps, run, f }
}

/** Twelve steps enforcing in one week for everyone. */
function sameWeek(steps: Step[], n: number): Step[] {
  const base = steps.find((s) => s.events?.enforce && s.readiness.family === 'mfa' && !s.safeToday) ?? steps.find((s) => s.events?.enforce)!
  return Array.from({ length: n }, (_, i) => ({
    ...base,
    id: `${base.id}-${i}`,
    title: `${base.title} ${i}`,
    plainTitle: `${base.plainTitle} ${i}`,
    safeToday: false,
    comms: 'Hi everyone, a change lands on {DATE}.',
    score: { ...(base.score ?? { domain: 'Identity' as const, value: 3, effort: 1, priority: 5 }), disruption: 2 },
    events: { ...base.events!, enforce: { ...base.events!.enforce, at: '2026-09-09T00:00:00.000Z', day: 'Wednesday' } },
  }))
}

test('twelve steps in one week for the same audience produce one bulletin with one block per change, in date order', () => {
  const { ctx, steps } = ctxFor('mid')
  const twelve = sameWeek(steps, 12)
  const bulletins = bulletinsFor(twelve, ctx)
  const broadcast = bulletins.filter((b) => b.kind === 'bulletin')
  assert.equal(broadcast.length, 1)
  assert.equal(broadcast[0].steps.length, 12)
  assert.equal(broadcast[0].audience.kind, 'everyone')
  assert.match(broadcast[0].subject, /^12 sign-in changes this week/)
  const email = broadcast[0].channels.email
  assert.ok(email.startsWith('Hi everyone,'))
  assert.ok((email.match(/What to do/g) ?? []).length === 1, 'one what-to-do list')
  assert.equal(commsPlanRows(broadcast).filter((r) => r.kind === 'remind').length, 1, 'one reminder per bulletin')
})

test('a high-disruption step claims its own message and the weekly bulletin references it', () => {
  const { ctx, steps } = ctxFor('mid')
  const week = sameWeek(steps, 3)
  week[0] = { ...week[0], score: { ...week[0].score!, disruption: 5 } }
  const bulletins = bulletinsFor(week, ctx)
  const solo = bulletins.find((b) => b.kind === 'solo')
  const weekly = bulletins.find((b) => b.kind === 'bulletin')
  assert.ok(solo, 'a solo message')
  assert.ok(weekly, 'and the weekly bulletin')
  assert.equal(weekly!.steps.length, 2)
  assert.equal(weekly!.references.length, 1)
  assert.match(weekly!.channels.email, /A separate note, ".*", went out on/)
})

test('a week with only named-audience steps produces no broadcast; named people get individual notes at the earliest notice', () => {
  const { ctx, steps } = ctxFor('small')
  const admins = steps.filter((s) => s.events?.enforce && s.population.total > 0 && s.population.total < 10 && s.readiness.family !== 'admin' && !s.safeToday)
  const named = admins.length > 0 ? admins : steps.filter((s) => s.events?.enforce && !s.safeToday).slice(0, 1).map((s) => ({ ...s, population: { ...s.population, ids: s.population.ids.slice(0, 3), total: 3 }, readiness: { ...s.readiness, family: 'mfa' as const } }))
  const bulletins = bulletinsFor(named, ctx)
  assert.equal(bulletins.filter((b) => b.kind === 'bulletin' || b.kind === 'solo').length, 0, 'no broadcast')
  assert.ok(bulletins.length > 0 && bulletins.every((b) => b.kind === 'individual'))
  assert.match(bulletins[0].channels.email, /^Hi \{NAME\},/)
  assert.ok(recipientRows(bulletins[0], ctx).length === bulletins[0].recipients.length)
  const a = audiencesFor(named[0], ctx)
  assert.equal(a[0].kind, 'named')
  assert.equal(a.at(-1)?.kind, 'helpdesk')
})

test('more than three messages to one audience in a month raise a warning naming the change that could move', () => {
  const { ctx, steps } = ctxFor('mid')
  const four = [0, 1, 2, 3].flatMap((w) => sameWeek(steps, 1).map((s) => ({ ...s, id: `${s.id}-w${w}`, events: { ...s.events!, enforce: { ...s.events!.enforce, at: `2026-09-${String(2 + w * 7).padStart(2, '0')}T00:00:00.000Z` }, announce: { ...s.events!.announce!, at: `2026-09-${String(1 + w * 7).padStart(2, '0')}T00:00:00.000Z` } } })))
  const warnings = monthlyWarnings(bulletinsFor(four, ctx))
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /^4 messages to Everyone in September 2026; consider moving .* into next month's bulletin\.$/)
})

test('prompts carry the facts and the no-invent rule; the grounding bundle is redacted by default', () => {
  const { ctx, steps, run, f } = ctxFor('small')
  const step = steps.find((s) => s.events?.enforce)!
  const p = promptFor('announcement', ctx.tenantName, stepContext(step), 'Hi everyone, ...')
  assert.match(p, /Do not invent facts/)
  // The context is fenced now rather than inline after the label (audit
  // prompt-01), so the assertion is on the block rather than on one line.
  assert.match(p, /Context[^\n]*\n`{3}\n[\s\S]*Takes effect: /)
  const pack = promptPack({ tenant: ctx.tenantName, steps, schedule: run.schedule, changeRecord: 'record', planSummary: 'summary', announcement: 'draft' })
  assert.equal(pack.length, 8)
  for (const it of pack) assert.match(it.prompt, /Do not invent facts/)
  const redacted = groundingBundle({ tenant: 'Fixture small', snapshot: f.snapshot, coverage: run.coverage, steps, schedule: run.schedule, redacted: true, generated: '2026-08-28' })
  const text = JSON.stringify(redacted)
  for (const u of f.snapshot.users.slice(0, 10)) {
    assert.ok(!text.includes(u.userPrincipalName!), 'no sign-in names')
    assert.ok(!text.includes(u.displayName!), 'no display names')
  }
  assert.ok(!text.includes(f.snapshot.tenantId), 'no tenant id')
  const plain = groundingBundle({ tenant: 'Fixture small', snapshot: f.snapshot, coverage: run.coverage, steps, schedule: run.schedule, redacted: false, generated: '2026-08-28' })
  assert.ok(JSON.stringify(plain).includes(f.snapshot.tenantId))
})

test('the watch reads per-day failures after enforcement against the threshold; effort and contacts are estimated per step and in total', () => {
  const { steps, f } = ctxFor('mid')
  const done = steps.find((s) => s.status === 'done' && s.tracking?.enforcedAt)
  if (done) {
    const enforcedDay = done.tracking!.enforcedAt!.slice(0, 10)
    const pr = { policyId: done.tracking!.policyId, displayName: done.tracking!.policyName, counts: { reportOnlyFailure: 0, reportOnlyInterrupted: 0, reportOnlySuccess: 0, enforcedFailure: 12, enforcedSuccess: 100 }, affectedUserIds: { reportOnlyFailure: [], reportOnlyInterrupted: [], reportOnlySuccess: [], enforcedFailure: ['a', 'b'], enforcedSuccess: [] }, byDay: { [enforcedDay]: { failures: 12, userIds: ['a', 'b'] } } }
    f.snapshot.evidencePolicyResults.push(pr)
    try {
      const w = watchFor(done, f.snapshot, (id) => id, 5, new Date(Date.parse(done.tracking!.enforcedAt!) + 48 * 3_600_000).toISOString())
      assert.ok(w && w.hasEvidence)
      assert.equal(w!.failuresAfter, 12)
      assert.match(w!.sentence, /12 failures in 48 hours/)
      assert.ok(w!.threshold.includes('Revert threshold'))
    } finally {
      f.snapshot.evidencePolicyResults.pop()
    }
  }
  const e = effortFor(steps.find((s) => s.kind === 'create' && s.status !== 'done')!)
  assert.ok(e.minutes >= 15 && /about \d+ minutes of admin time/.test(e.sentence))
  const total = planEffort(steps)
  assert.ok(total.minutes > 0 && /The whole plan: about/.test(total.sentence))
  const ics = buildIcs(steps, 'Fixture', f.planId, 5)
  assert.match(ics, /Rollback: /)
  assert.match(ics, /Watch: more than 5% of the affected people/)
  assert.doesNotMatch(ics, /Owner:/)
})

const FIXTURE_NAMES = ['small', 'mid', 'large'] as const

test('one bulletin per audience per week, and one reminder per bulletin', () => {
  // The bundling rules existed and were correct; the calendar simply did not
  // read them (prompt 37 §14, §15). These assert the properties the calendar
  // now depends on, so a regression in either shows up here rather than as
  // fifteen announcements in one Wednesday cell (S1, S2).
  for (const name of FIXTURE_NAMES) {
    const { ctx, steps } = ctxFor(name)
    const bulletins = bulletinsFor(steps, ctx)
    const seen = new Map<string, number>()
    for (const b of bulletins) {
      if (b.kind !== 'bulletin') continue
      const key = `${b.audience.kind}|${b.audience.label}|${b.weekKey}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    }
    for (const [key, n] of seen) assert.equal(n, 1, `${name}: ${n} bulletins for ${key}; the rule is one per audience per week`)

    for (const b of bulletins) {
      assert.ok(b.steps.length > 0, `${name}: ${b.id} covers no steps`)
      // One reminder, or none. Never one per step.
      assert.ok(b.remindAt === null || typeof b.remindAt === 'string', `${name}: ${b.id} has more than one reminder`)
      if (b.remindAt) assert.ok(b.remindAt > b.sendAt, `${name}: ${b.id} reminds before it announces`)
    }

    // A bulletin repeats across weeks only if its steps do.
    const bySubject = new Map<string, Set<string>>()
    for (const b of bulletins) {
      const set = bySubject.get(b.subject) ?? new Set<string>()
      set.add(b.weekKey)
      bySubject.set(b.subject, set)
    }
    for (const [subject, weeks] of bySubject) {
      if (weeks.size <= 1) continue
      const stepSets = bulletins.filter((b) => b.subject === subject).map((b) => b.steps.map((s) => s.stepId).sort().join(','))
      assert.equal(new Set(stepSets).size, stepSets.length, `${name}: "${subject}" repeats across ${weeks.size} weeks with the same steps`)
    }
  }
})
