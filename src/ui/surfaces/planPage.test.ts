// The Plan page after the owner's walk of step 1.1 (2026-09-23): what the page
// says and does around the board, each item held by its own test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pages } from '../../content/content.ts'
import { heldPlan } from './planChanges.ts'

// Item 9: "How to use this plan" loses one sentence and keeps the rest word for word.
test('How to use this plan does not ask for a hands-on test record, and the rest reads as it did', () => {
  const intro = (pages.plan as unknown as { howTo: { intro: string } }).howTo.intro
  assert.equal(intro, 'Start at the top of All work and open a step to see its findings, instructions and next action. Once the first two sections are done, every policy marked Ready · Create can be created in report-only straight away. Turn each one on when its own row reads Ready · Ready to enforce. Save your choices, make the changes in Entra or the service named in the instructions, then scan again to check the result. Estimated dates adjust as the plan changes.')
})

// Item 1: the "#" heading and each row's number sit in the same 28px track. The
// heading read from the start and the numbers from the right, so they never lined
// up; both are centred, in every section.
test('the # heading and the row numbers share one alignment', () => {
  const css = readFileSync('src/ui/app.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const alignOf = (selector: string): string[] =>
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((m) => m[1].split(',').map((x) => x.trim()).includes(selector))
      .flatMap((m) => [...m[2].matchAll(/text-align:\s*([a-z-]+)/g)].map((a) => a[1]))
  assert.deepEqual(alignOf('.plan-column-head > span:first-child'), ['center'], 'the # heading')
  assert.deepEqual(alignOf('.plan-row-number'), ['center'], 'the row numbers')
})

// Item 7: a Save (any step decision) blanked the whole Plan to "Loading…" and
// jumped to the top, because the computed plan is null while the groups are
// read again for the new decision. The last plan for the same snapshot stays on
// screen until the new one lands; a new snapshot is another plan, and loads.
test('after a decision save the plan on screen is never null for the same snapshot', () => {
  const snapshot = { asOf: 'scan 1' }
  // The hook's own sequence around a Save: the plan, the plan with the new
  // decision, nothing while the groups are read again, then the settled plan.
  let held: { snapshot: unknown; plan: string } | null = null
  const shown: (string | null)[] = []
  for (const fresh of ['before', 'saved', null, null, 'after']) {
    shown.push(heldPlan(fresh, held, snapshot))
    if (fresh !== null) held = { snapshot, plan: fresh }
  }
  assert.deepEqual(shown, ['before', 'saved', 'saved', 'saved', 'after'])
  assert.equal(heldPlan(null, held, { asOf: 'scan 2' }), null, 'a new snapshot loads')
  assert.equal(heldPlan(null, held, null), null, 'nothing is held once the tenant is gone')
  // And the hook hands every surface the held plan.
  const hook = readFileSync('src/ui/surfaces/planData.ts', 'utf8')
  assert.match(hook, /const shown = heldPlan\(computed, held\.current, snapshot\)/)
  assert.match(hook, /\n    computed: shown,\n/)
})
