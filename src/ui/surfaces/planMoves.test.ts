// After a scan or an approval, the page stays with the step and the line saying
// what changed is beside it, whole (F-028, F-040).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { changeLinePlace, observePlan, planChangeLine, planChangeWhole } from './planChanges.ts'
import { pages } from '../../content/content.ts'

const row = (id: string, lane: string) => ({ id, title: `Step ${id}`, lane })

test('a cut list can be read whole: Show all names every title (F-028)', () => {
  const before = ['a', 'b', 'c', 'd', 'e'].map((id) => row(id, 'Ready'))
  const after = ['a', 'b', 'c', 'd', 'e'].map((id) => row(id, 'Completed'))
  assert.equal(planChangeLine(before, after), 'Updated: Step a, Step b, Step c and 2 more completed.')
  assert.equal(planChangeWhole(before, after), 'Updated: Step a, Step b, Step c, Step d and Step e completed.')
  // A line that cut nothing has nothing more to show.
  assert.equal(planChangeWhole([row('a', 'Ready')], [row('a', 'Completed')]), null)
  // The Plan's comparison hands the whole line over beside the short one.
  const seen = observePlan(null, 't1', 'scan|1|0', before)
  const next = observePlan(seen.seen, 't1', 'scan|2|0', after)
  assert.equal(next.line, 'Updated: Step a, Step b, Step c and 2 more completed.')
  assert.equal(next.whole, 'Updated: Step a, Step b, Step c, Step d and Step e completed.')
  assert.equal((pages.plan as unknown as { changes: { showAll: string } }).changes.showAll, 'Show all')
})

test('the line sits at the step the page moved to while it is open, above the board otherwise (F-028, F-040)', () => {
  assert.equal(changeLinePlace('s-goal-block-device-code', 's-goal-block-device-code'), 'step')
  assert.equal(changeLinePlace('s-direction-accounts', 's-direction-accounts'), 'step')
  // The person opened another step, or closed it: back above the board.
  assert.equal(changeLinePlace('s-direction-accounts', 's-goal-mfa-all-users'), 'board')
  assert.equal(changeLinePlace('s-direction-accounts', null), 'board')
  assert.equal(changeLinePlace(null, 's-direction-accounts'), 'board')
})

test('the Plan returns to the open step after a scan, moves focus with the page, and draws the line just above its row', () => {
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  // A new snapshot from a scan started in the open step: the page goes back to it (F-028),
  // and only then — another tab's scan, or a step opened since, leaves the page where it is.
  assert.match(plan, /const onScan = \(returnTo: string\): void => \{\n\s+scanFrom\.current = stepFromPlanHash\(returnTo\)\n\s+setChangeLine\(null\)\n\s+setChangeWhole\(null\)/)
  assert.match(plan, /if \(asOf === seenAsOf\.current\) return\n\s+seenAsOf\.current = asOf\n\s+const from = scanFrom\.current\n\s+scanFrom\.current = null\n\s+if \(open === null \|\| from !== open\) return\n\s+moveTo\.current = open\n\s+focusAfterMove\.current = true\n\s+setLineAt\(open\)/)
  // Approve answers opens the next decision and takes the line and focus with it (F-040).
  assert.match(plan, /onOpen=\{\(next\) => \{ moveTo\.current = next; focusAfterMove\.current = true; setLineAt\(next\); setOpen\(next\);/)
  // Focus lands on the step's row once it is drawn.
  assert.match(plan, /if \(focusAfterMove\.current\) \{\n\s+focusAfterMove\.current = false\n\s+;\(row as HTMLElement\)\.focus\(\{ preventScroll: true \}\)/)
  // The line is drawn just above the row, and the page shows it.
  assert.match(plan, /\{open && lead\}\n\s+<PlanRow\n\s+stepId=\{step\.id\}/)
  assert.match(plan, /classList\.contains\('plan-change-line'\) \? line : row\)\.scrollIntoView/)
  // A row press or a link puts it back above the board.
  // Either one also drops a move still waiting for its row, so the page never jumps back to it.
  assert.match(plan, /const openStep = \(id: string \| null\): void => \{\n\s+linked\.current = false\n\s+noticeLeft\.current = null\n\s+setLineAt\(null\)\n\s+moveTo\.current = null\n\s+focusAfterMove\.current = false/)
  assert.match(plan, /const onHash = \(\) => \{ setChangeLine\(null\); setLineAt\(null\); moveTo\.current = null; focusAfterMove\.current = false;/)
})
