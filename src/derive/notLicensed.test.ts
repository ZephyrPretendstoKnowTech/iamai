// Prompt 52 Part 3: the licence ladder as Not licensed rows (target-state §5).
// One row per goal the baseline holds that the tenant's tier cannot, in the
// content file's words — the step's title and the licence it needs — with the
// one sentence under the group; never a tier's benefits; the print page carries
// the count and the sentence only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { PINNED_GOAL_MAP } from '../roadmap/goalMap.ts'
import { notLicensedNote, notLicensedPrintLine, notLicensedRows, notLicensedSummary } from './notLicensed.ts'
import { pages, stepById } from '../content/content.ts'

test('the demo (P1) lists its P2 goals as Not licensed rows, from content', () => {
  const r = runFixture(fixture('demo'))
  const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
  const ids = rows.map((x) => x.goalId).sort()
  assert.deepEqual(ids, ['pim-activation-reauth', 'sign-in-risk', 'sign-in-risk-medium', 'user-risk', 'user-risk-medium'])
  for (const row of rows) {
    const cs = stepById[row.goalId]
    assert.equal(row.title, cs.title, `${row.goalId}: the content step's title`)
    assert.equal(row.licence, cs.licence, `${row.goalId}: the content step names the licence`)
    assert.equal(row.text, `${cs.title}: needs a licence this tenant does not hold: ${cs.licence}`)
    assert.doesNotMatch(row.text, /unlock|upgrade|benefit/i, 'never a tier\'s benefits')
  }
  assert.equal(notLicensedSummary(rows.length), 'Not licensed (5)')
  assert.equal(notLicensedNote(), (pages.plan as { footer: { notLicensedNote: string } }).footer.notLicensedNote)
  assert.equal(notLicensedPrintLine(rows.length), '5 baseline controls need a licence the tenant does not hold; nothing in the plan waits on them.')
})

test('a goal the baseline does not hold never appears, whatever its licence', () => {
  const r = runFixture(fixture('demo'))
  const narrow = { 'sign-in-risk': PINNED_GOAL_MAP['sign-in-risk'] }
  const rows = notLicensedRows(r.coverage, narrow)
  assert.deepEqual(rows.map((x) => x.goalId), ['sign-in-risk'])
})

test('a goal whose content step names no licence falls back to the tier the control needs', () => {
  // The free tier: every Conditional Access goal is out of reach, and most
  // content steps name no licence, so the tier name stands in.
  const f = fixture('micro')
  const r = runFixture(f)
  const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
  assert.ok(rows.length > 0, 'micro has no P1, so goals are licence-limited')
  for (const row of rows) {
    assert.ok(row.licence.length > 0, `${row.goalId}: a licence is named`)
    assert.equal(row.text, `${row.title}: needs a licence this tenant does not hold: ${row.licence}`)
  }
})
