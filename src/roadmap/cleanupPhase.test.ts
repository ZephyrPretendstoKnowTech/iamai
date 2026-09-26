// Prompt 52 Part 3: the Cleanup phase renders with its rows and the finish date
// includes it (target-state §5, §9). Cleanup is dated after the last enforcement
// window, one working day per row, no notice, no rings; a Cleanup with nothing
// to say does not exist; the header's finish is the end of the last phase.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, curatedFixture, fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { planFinish } from '../derive/finish.ts'
import { isHeld } from './holds.ts'
import { isWorkingDay } from './timing.ts'
import { cleanup as cleanupContent } from '../content/content.ts'

const ORDER = ['drill', 'alerting', 'hardening', 'namedExclusions', 'naming', 'consolidation', 'notAssessed']

test('recovery testing is scheduled early and on its own, and optional hygiene follows the last enforcement, in order, on working days', () => {
  // emergency tests are early while optional hygiene follows enforcement
  {
    const f = fixture('demo')
    const r = runFixture(f)
    const c = r.schedule.cleanup
    assert.ok(c, 'the demo has emergency accounts and unassessed baseline policies, so Cleanup has rows')
    assert.ok(c.rows.length >= 2)
    const kinds: string[] = c.rows.map((x) => x.kind)
    assert.deepEqual(kinds, ORDER.filter((k) => kinds.includes(k)), 'rows keep the §5 order')
    assert.ok(kinds.includes('alerting') && kinds.includes('drill'), 'the emergency accounts give alerting and the drill')
    assert.equal(kinds.includes('notAssessed'), false, 'individual workflow reviews replace the catch-all')
    assert.ok(c.rows.find(row => row.kind === 'drill')!.day <= r.schedule.targetEnd, 'recovery testing is early')
    // Alerting closes Establish Emergency Access, the day after the drill (owner, 2026-09-25).
    assert.ok(c.rows.find(row => row.kind === 'alerting')!.day <= r.schedule.targetEnd, 'alerting is early')
    assert.ok(c.rows.find(row => row.kind === 'alerting')!.day > c.rows.find(row => row.kind === 'drill')!.day, 'alerting follows the drill')
    const ctx = r.schedule.rhythm ? { rhythm: r.schedule.rhythm } : undefined
    for (const [i, row] of c.rows.entries()) {
      assert.ok(ctx ? isWorkingDay(row.day, ctx) : true, `${row.kind} lands on a working day`)
      if (i > 0) assert.ok(row.day > c.rows[i - 1].day, `${row.kind} follows ${c.rows[i - 1].kind}`)
      assert.ok((cleanupContent as Record<string, unknown>)[row.kind], `${row.kind} has its prose in content.cleanup`)
    }
    assert.equal(c.start, c.rows[0].day)
    assert.equal(c.end, [r.schedule.targetEnd, ...c.rows.map(row => row.day)].sort().at(-1))
    // The alert rule lists sign-in names; the drill lists accounts by name.
    const alerting = c.rows.find((x) => x.kind === 'alerting')!
    assert.equal(alerting.lists.emergencyAccountUpns.length, f.mapping.breakGlassUserIds.length)
    for (const upn of alerting.lists.emergencyAccountUpns) assert.match(upn, /@/, 'a sign-in name, not a display name')
    assert.deepEqual(c.accountIds, f.mapping.breakGlassUserIds)
  }

  // every fixture with emergency accounts schedules their tests independently of last enforcement
  {
    for (const f of allFixtures()) {
      const r = runFixture(f)
      const c = r.schedule.cleanup
      if (f.mapping.breakGlassUserIds.length === 0) continue
      // A tenant that cannot use Conditional Access is given no plan at all
      // (owner, 2026-09-20), so it has no enforcement for recovery testing to be
      // independent OF. The rule is about a schedule, and there is no schedule.
      if (r.steps.length === 0) continue
      assert.ok(c, `${f.name}: emergency accounts give Cleanup at least the alerting and drill rows`)
      assert.equal(c.start, c.rows.find(row => row.kind === 'drill')!.day, `${f.name}: recovery testing starts independently of last enforcement`)
      // The drill and alerting are Establish Emergency Access's; the rest follows the last enforcement.
      for (const row of c.rows.filter(row => row.kind !== 'drill' && row.kind !== 'alerting')) assert.ok(row.day > r.schedule.targetEnd, `${f.name}: ${row.kind}`)
      assert.ok(c.end >= c.start)
    }
  }
})

test('the finish date is the end of the last phase, Cleanup included; a held plan stays undated', () => {
  // Week two: its policies name nothing the tenant lacks, so they are on the
  // calendar. A tenant whose Preparation work is still to do has nothing dated.
  // On the curated baseline, where the week-two plan has policies the calendar dates.
  const r = runFixture(withFoundationSettled(curatedFixture('demo-week2')))
  const c = r.schedule.cleanup!
  // The week-two plan still holds work it requires, so it finishes on no date,
  // and Cleanup — which follows that work — gives it none (roadmap/holds.ts).
  assert.equal(planFinish(r.steps, c.end).finish, null, 'a plan holding required work has no finish')
  assert.equal(planFinish(r.steps, c.end).held, true)
  // The same plan without the held work: what the calendar dates, then Cleanup.
  const dated = r.steps.filter((s) => !isHeld(s))
  const without = planFinish(dated)
  const withCleanup = planFinish(dated, c.end)
  assert.ok(without.finish, 'the demo enforces something on the calendar')
  assert.equal(withCleanup.finish, c.end, 'Cleanup ends the plan')
  assert.ok(withCleanup.finish! > without.finish!, 'later than the last enforcement')
  assert.deepEqual(withCleanup.waiting, without.waiting, 'what waits on readiness is unchanged')
  // Nothing dated by the calendar: Cleanup does not invent a finish.
  const held = planFinish([], c.end)
  assert.equal(held.finish, null)
})
