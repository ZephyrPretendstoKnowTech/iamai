// The Plan page after the owner's walk of step 1.1 (2026-09-23): what the page
// says and does around the board, each item held by its own test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pages } from '../../content/content.ts'
import { heldPlan } from './planChanges.ts'
import { lockedStart } from '../../derive/planStart.ts'

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

// Item 6: there is no Start the plan button and no Start date field. The start
// locks itself the first time the plan is computed for a tenant, with the first
// deployment anchored beside it exactly as pressing Start anchored it, so the
// dates never slide from one day's visit to the next. Plan settings changes it.
test('a fresh plan has a locked start without any press, and its dates do not move on a later visit', () => {
  type Saved = { planId?: string; skips?: Record<string, unknown>; checkpoints?: unknown[]; startDate?: string; firstDeployment?: string; startedAt?: string }
  const lock = (saved: Saved, zone: string | null, now: Date): Saved => lockedStart(saved, zone, now)
  const wednesday = new Date('2026-09-23T15:00:00Z')
  const fresh = lock({ planId: 'p', skips: {}, checkpoints: [] }, null, wednesday)
  assert.equal(fresh.startDate, '2026-09-23T12:00:00.000Z', 'the start is today')
  assert.equal(fresh.firstDeployment, '2026-09-24T12:00:00.000Z', 'deployment is anchored on the eligible workday after it')
  assert.equal(fresh.startedAt, wednesday.toISOString(), 'and it is locked')
  // A later visit reads the locked record back and changes nothing.
  assert.equal(lock(fresh, null, new Date('2026-10-02T15:00:00Z')), fresh)
  // A weekend locks the Monday after it, and deployment the Tuesday.
  const saturday = lock({}, null, new Date('2026-09-26T15:00:00Z'))
  assert.deepEqual([saturday.startDate, saturday.firstDeployment], ['2026-09-28T12:00:00.000Z', '2026-09-29T12:00:00.000Z'])
  // Today is the display zone's day: at 02:00 UTC on the 24th it is still the 23rd in Denver.
  assert.equal(lock({}, 'America/Denver', new Date('2026-09-24T02:00:00Z')).startDate, '2026-09-23T12:00:00.000Z')
  // A start already saved keeps its day, and a first deployment saved beside it stands.
  const saved = lock({ startDate: '2026-09-14T12:00:00.000Z', firstDeployment: '2026-09-21T12:00:00.000Z' }, null, wednesday)
  assert.deepEqual([saved.startDate, saved.firstDeployment, saved.startedAt], ['2026-09-14T12:00:00.000Z', '2026-09-21T12:00:00.000Z', wednesday.toISOString()])
  // The hook locks the record as it loads; the page has no press and no field,
  // and Plan settings' Plan starts is where the start changes.
  const hook = readFileSync('src/ui/surfaces/planData.ts', 'utf8')
  assert.match(hook, /setSaved\(lockedStart\(/)
  assert.doesNotMatch(hook, /startPlan|startedFrom/)
  // Every plan is locked, so a cleared first deployment is anchored on the workday after the start, never read as the old deploy-from-the-start.
  assert.match(hook, /firstDeployment: iso \?\? \(start \? proposedFirstDeployment\(start\) : undefined\)/)
  const page = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.doesNotMatch(page, /startPlan|startControl|plan-start/)
  assert.match(page, /\{PP\.settings\.planStarts\}<\/span>\s*<input type="date"[^>]*onChange=\{\(e\) => \{ if \(e\.currentTarget\.value\) data\.setStart\(/)
  assert.ok(!('startControl' in (pages.plan as Record<string, unknown>)), 'the button\'s words went with it')
})
