// Prompt 52 Part 3: the licence ladder as Not licensed rows (target-state §5).
// One row per goal the baseline holds that the tenant's tier cannot, in the
// content file's words — the step's title and the licence it needs — with the
// one sentence under the group; never a tier's benefits; the print page carries
// the count and the sentence only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import type { Fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { DIR_SYNC_ROLE } from '../coverage/applicability.ts'
import { PINNED_GOAL_MAP, goalInMap } from '../roadmap/goalMap.ts'
import { readFileSync } from 'node:fs'
import { conditionalAccessLicenceLine, notLicensedCount, notLicensedLines, notLicensedNote, notLicensedPrintLine, notLicensedRows, notLicensedSummary } from './notLicensed.ts'
import { notInPlanRows } from './notInPlan.ts'
import { pages, stepById } from '../content/content.ts'

test('Not licensed rows are the goals the baseline holds and the tier cannot, named from content with the licence they need, never a tier\'s benefits', () => {
  // the demo (P1) lists its P2 goals as Not licensed rows, from content
  {
    const r = runFixture(fixture('demo'))
    const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
    const ids = rows.map((x) => x.goalId).sort()
    // The workload goal joins as a licence-facet row (no Workload Identities Premium licence);
    // Block Risky Users From Registering Sign-in Methods since Phase 2c.
    assert.deepEqual(ids, ['pim-activation-reauth', 'risky-users-register-block', 'sign-in-risk', 'sign-in-risk-medium', 'user-risk', 'user-risk-medium', 'workload-identity-block'])
    for (const row of rows) {
      const cs = stepById[row.goalId]
      assert.equal(row.title, cs.title, `${row.goalId}: the content step's title`)
      if (cs.licence) assert.equal(row.licence, cs.licence, `${row.goalId}: the content step names the licence`)
    }
    for (const line of notLicensedLines(rows)) assert.doesNotMatch(line.text, /unlock|upgrade|benefit/i, 'never a tier\'s benefits')
    assert.equal(notLicensedSummary(rows), 'Not licensed (7)')

  }
  // a goal the baseline does not hold never appears, whatever its licence
  {
    const r = runFixture(fixture('demo'))
    const narrow = { 'sign-in-risk': PINNED_GOAL_MAP['sign-in-risk'] }
    const rows = notLicensedRows(r.coverage, narrow)
    assert.deepEqual(rows.map((x) => x.goalId), ['sign-in-risk'])
  }
  // a goal whose content step names no licence falls back to the tier the control needs
  {
    // The free tier: every Conditional Access goal is out of reach, and most
    // content steps name no licence, so the tier name stands in.
    const f = fixture('micro')
    const r = runFixture(f)
    const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
    assert.ok(rows.length > 0, 'micro has no P1, so goals are licence-limited')
    for (const row of rows) {
      assert.ok(row.licence.length > 0, `${row.goalId}: a licence is named`)
    }
    // The device steps are one shared line (E2), in its own words; every other line names its licence.
    for (const line of notLicensedLines(rows)) assert.match(line.text, line.key === 'devices' ? /Intune Plan 1/ : /^Needs .+, which this tenant does not hold:$/)
  }
})

// The count is of the baseline controls left out, not of the lines that list
// them: without Intune the device goals share one line (E2), and small said
// "Not licensed (6)" over 7 goals (v2-research/licensing.md, problem 1).
test('the count is of goals, not lines: a shared device line counts each goal it names', () => {
  const r = runFixture(fixture('small'))
  const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
  const goals = r.coverage.results.filter((x) => goalInMap(PINNED_GOAL_MAP, x.goal.id) && (x.status === 'licence-limited' || (x.status === 'not-applicable' && / licence$/.test(x.applicability?.reason ?? '')))).map((x) => x.goal.id)
  // Seven lines and eight goals since Block Risky Users From Registering Sign-in Methods (Phase 2c).
  assert.equal(rows.length, 7, 'the premise: seven lines')
  assert.equal(goals.length, 8, 'the premise: eight goals, two of them on the shared device line')
  assert.deepEqual(rows.flatMap((x) => x.goalIds).sort(), [...goals].sort(), 'every goal is on exactly one line')
  assert.equal(notLicensedCount(rows), 8)
  assert.equal(notLicensedSummary(rows), 'Not licensed (8)')
  assert.match(notLicensedPrintLine(rows), /^8 baseline controls need a licence/)
})

test('the workload goal exists only where someone holds the Directory Synchronization Accounts role: never planned or listed without a sync account (B7)', () => {
  const WORKLOAD = 'workload-identity-block'
  const licensed = (f: Fixture, enabled: boolean): Fixture => ({ ...f, snapshot: { ...f.snapshot, capabilities: { ...f.snapshot.capabilities, workloadIdPremium: { enabled, seats: enabled ? 25 : 0, consumed: 0 } } } })
  const read = (f: Fixture) => {
    const r = runFixture(f, { snapshot: f.snapshot } as never)
    return { planned: r.steps.some((s) => s.goalId === WORKLOAD), listed: notLicensedRows(r.coverage, PINNED_GOAL_MAP).some((x) => x.goalId === WORKLOAD) }
  }
  const holdsSync = (f: Fixture): boolean => Object.values(f.snapshot.roles.active).some((roles) => roles.includes(DIR_SYNC_ROLE))
  const small = fixture('small')
  assert.equal(holdsSync(small), false, 'the premise: small has no sync account')
  assert.deepEqual(read(licensed(small, false)), { planned: false, listed: false })
  assert.deepEqual(read(licensed(small, true)), { planned: false, listed: false }, 'a licence does not make a step with nothing to restrict')
  const mid = fixture('mid')
  assert.equal(holdsSync(mid), true, 'the premise: mid has a sync account')
  assert.deepEqual(read(licensed(mid, false)), { planned: false, listed: true })
  assert.deepEqual(read(licensed(mid, true)), { planned: true, listed: false })
})

test('without Entra ID P1 the Plan says first that Conditional Access needs it; with P1 it says nothing (owner, 2026-09-19)', () => {
  const free = fixture('micro')
  assert.equal(free.snapshot.capabilities.entraP1.enabled, false, 'micro is the no-P1 tenant')
  const line = conditionalAccessLicenceLine(free.snapshot)
  assert.equal(line, (pages.plan as { conditionalAccessNeedsP1: string }).conditionalAccessNeedsP1, 'the words are the content key')
  assert.match(line ?? '', /^Conditional Access needs Entra ID P1\b/)
  for (const name of ['small', 'demo'] as const) assert.equal(conditionalAccessLicenceLine(fixture(name).snapshot), null, `${name} holds P1`)
  // Since 2026-09-20 the line is not the Plan's first sentence, it is the Plan's
  // ONLY content: the engine builds no steps for this tenant, and an empty board
  // of tiles, tabs and waves would read as a plan. So the page returns early.
  const src = readFileSync(new URL('../ui/surfaces/Plan.tsx', import.meta.url), 'utf8')
  const early = src.indexOf('if (licenceLine) return (')
  const drawn = src.indexOf('<Callout kind="info">{licenceLine}</Callout>')
  assert.ok(early > 0 && drawn > early, 'the licence line is drawn from the early return')
  assert.ok(drawn < src.indexOf('className="plan-progress"'), 'and the progress tiles are never reached')
  assert.equal(src.split('<Callout kind="info">{licenceLine}</Callout>').length - 1, 1, 'one place draws it')
  assert.equal(runFixture(free).steps.length, 0, 'and there is nothing else to draw')
  assert.match(src, /const licenceLine = conditionalAccessLicenceLine\(scan\.snapshot\)/)
})

test('N-008: where the plan also leaves baseline policies out for other reasons, the print line says so, and the Plan says it under its own group', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
  const others = notInPlanRows(f.baseline.policies, r.steps, r.coverage, PINNED_GOAL_MAP).length
  assert.ok(rows.length > 0 && others > 0, 'the premise: the demo has Not licensed rows and policies left out for other reasons')
  const print = notLicensedPrintLine(rows, others)
  assert.match(print, new RegExp(`the plan leaves out ${others} more for other reasons`))
  assert.doesNotMatch(print, /as far as the tenant's licences reach/)
  assert.match(notLicensedPrintLine(rows, 0), /as far as the tenant's licences reach, not all of it/)
  // The Plan's sentence is one line (owner, 2026-10-04): its group, In the baseline, not in this plan, sits beside it.
  assert.equal(notLicensedNote(), 'Nothing in the plan waits on these.')
  assert.match(readFileSync('src/ui/surfaces/PlanFooter.tsx', 'utf8'), /notLicensedNote\(\)/)
  assert.match(readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8'), /notLicensedPrintLine\(notLicensed, notInPlanCount\)/)
  assert.match(readFileSync('src/ui/surfaces/Export.tsx', 'utf8'), /notInPlanCount=\{notInPlanRows\(/)
})

test('the Plan lists Not licensed steps under the licence each needs: P2 once, every step under it, the count unchanged (owner, 2026-10-04)', () => {
  const r = runFixture(fixture('demo'))
  const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
  const lines = notLicensedLines(rows)
  const p2 = rows.filter((x) => x.licence === 'Microsoft Entra ID P2')
  assert.ok(p2.length >= 2, 'the premise: the demo lacks P2 for several steps')
  const p2Lines = lines.filter((l) => l.text.includes('Microsoft Entra ID P2,'))
  assert.equal(p2Lines.length, 1, 'P2 is said once')
  assert.equal(p2Lines[0].text, 'Needs Microsoft Entra ID P2, which this tenant does not hold:')
  assert.deepEqual(p2Lines[0].steps, p2.map((x) => x.title))
  assert.equal(lines.reduce((n, l) => n + (l.steps.length || 1), 0), rows.length, 'every row is on a line')
  assert.equal(notLicensedSummary(rows), `Not licensed (${notLicensedCount(rows)})`)
})
