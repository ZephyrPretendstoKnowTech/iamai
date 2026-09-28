// The Plan page after the owner's walk of step 1.1 (2026-09-23): what the page
// says and does around the board, each item held by its own test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pages } from '../../content/content.ts'
import { heldPlan, observePlan, planChangeLine } from './planChanges.ts'
import type { ChangeRow } from './planChanges.ts'
import { boardOf } from './planBoard.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withEmergencyAccessSettled } from '../../roadmap/fixtures/run.ts'
import { lockedStart } from '../../derive/planStart.ts'

// Item 9: "How to use this plan" loses one sentence and keeps the rest word for word.
test('How to use this plan does not ask for a hands-on test record, and the rest reads as it did', () => {
  const intro = (pages.plan as unknown as { howTo: { intro: string } }).howTo.intro
  assert.equal(intro, 'Start at the top of All work and open a step to see its findings, instructions and next action. Once the first two sections are done, every policy marked Ready · Create can be created in report-only straight away. Turn each one on when its own row reads Ready · Turn on. Save your choices, make the changes in Entra or the service named in the instructions, then scan again to check the result. Estimated dates adjust as the plan changes.')
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

// Item 8: when a Save or a scan changes the plan, one short line above the board
// says what changed (steps completed, added, removed, by title), then nothing
// more. It compares the plan before the change with the plan after it, for the
// same tenant, and the next change or navigation replaces it.
test('completing a step produces one line naming it', () => {
  const rowsOf = (f: ReturnType<typeof fixture>): ChangeRow[] => {
    const r = runFixture(f)
    return boardOf(r.steps, r.schedule.cleanup ?? null, f.mapping.breakGlassAnswers ?? null).rows.map(({ item }) => ({ id: item.id, title: item.title, lane: item.lane }))
  }
  // The demo, before and after its emergency access is settled.
  const line = planChangeLine(rowsOf(fixture('demo')), rowsOf(withEmergencyAccessSettled(fixture('demo'))))
  assert.match(line ?? '', /^Updated: Prepare Emergency Access Accounts, .* completed( · .*)?\.$/, line ?? 'no line')
  // The owner's own example, word for word; at most three names, then how many more.
  const row = (id: string, lane: string): ChangeRow => ({ id, title: `Step ${id}`, lane })
  assert.equal(planChangeLine([{ id: 'ea', title: 'Prepare Emergency Access Accounts', lane: 'Ready' }], [{ id: 'ea', title: 'Prepare Emergency Access Accounts', lane: 'Completed' }, { id: 'named', title: 'Remove Emergency Accounts Excluded by Name', lane: 'Ready' }]),
    'Updated: Prepare Emergency Access Accounts completed · 1 step added: Remove Emergency Accounts Excluded by Name.')
  assert.equal(planChangeLine(['a', 'b', 'c', 'd', 'e'].map((id) => row(id, 'Ready')), ['a', 'b', 'c', 'd', 'e'].map((id) => row(id, 'Completed'))), 'Updated: Step a, Step b, Step c and 2 more completed.')
  assert.equal(planChangeLine([row('a', 'Ready'), row('b', 'Ready')], [row('b', 'On Hold')]), 'Updated: 1 step removed: Step a.')
  assert.equal(planChangeLine([row('a', 'Ready')], [row('a', 'On Hold')]), null, 'a move between open lanes is not named')
  // Around a Save: the first plan says nothing; the Save's plan says what it
  // changed, and the plan settling under the same Save still reads from before
  // it; the next change starts again, and another tenant starts afresh.
  const before = [row('a', 'Ready'), row('b', 'Up Next')]
  let seen = observePlan(null, 't1', 'scan|visit|0', before)
  assert.equal(seen.line, null, 'the first plan has nothing before it')
  seen = observePlan(seen.seen, 't1', 'scan|visit|1', before)
  assert.equal(seen.line, undefined, 'the Save, before its plan lands, leaves the line as it was')
  seen = observePlan(seen.seen, 't1', 'scan|visit|1', [row('a', 'Completed'), row('b', 'Up Next')])
  assert.equal(seen.line, 'Updated: Step a completed.')
  seen = observePlan(seen.seen, 't1', 'scan|visit|1', [row('a', 'Completed'), row('b', 'Completed')])
  assert.equal(seen.line, 'Updated: Step a and Step b completed.', 'settling under the same Save is still that one change')
  seen = observePlan(seen.seen, 't1', 'scan|visit|2', [row('a', 'Completed'), row('b', 'Completed')])
  assert.equal(seen.line, undefined, 'a Save that changes nothing keeps the line about the change before it (Done after a chip already saved)')
  seen = observePlan(seen.seen, 't1', 'scan|visit|3', [row('a', 'Ready'), row('b', 'Completed')])
  assert.equal(seen.line, 'Updated: Step a reopened.', 'a step that leaves Completed is a change the line names')
  assert.equal(observePlan(seen.seen, 't2', 'scan|visit|2', before).line, null, 'another tenant is not compared')
  // The page draws it above the board (or just above the step a scan or an approval moved to, F-028),
  // and a navigation clears it.
  const page = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  // Focusable, so Show all can take focus to it (Round 4 review).
  assert.match(page, /<p className="reason no-print plan-change-line" role="status" ref=\{ref\} tabIndex=\{-1\}>/)
  assert.match(page, /\{!lineOnStep && lineView\}/)
  assert.match(page, /const onHash = \(\) => \{ setChangeLine\(null\);/)
})

// OWN-W1: the tiles counted "Ready now 10, Needs your input 6…" and nothing
// named a step to start on. One link under them names the first Ready row in
// All work order, by the number and title the board shows, and opens it.
test('the Plan names its next step: the first Ready row in All work order, by its number, and nothing where nothing is Ready', async () => {
  const { nextReadyOf, rowNumbersOf, sectionNumbersOf, allWorkGroups } = await import('./planBoard.ts')
  const { customerPlanSteps } = await import('./customerPlanSteps.ts')
  const { fillText } = await import('../../content/render.ts')
  const f = fixture('demo')
  const r = runFixture(f)
  const items = boardOf(customerPlanSteps(r.steps), r.schedule.cleanup ?? null, f.mapping.breakGlassAnswers ?? null).rows.map((row) => row.item)
  const next = nextReadyOf(items, rowNumbersOf(items), sectionNumbersOf(items))
  const first = allWorkGroups(items, items).flatMap((g) => g.items).find((i) => i.lane === 'Ready')
  assert.ok(first && next, 'the premise: the demo has a Ready row')
  assert.equal(next.id, first.id)
  assert.deepEqual({ number: next.number, title: next.title }, { number: '1.1', title: 'Prepare Emergency Access Accounts' })
  assert.equal(fillText((pages.plan.progress as { next: string }).next, { step: `${next.number} ${next.title}` }), 'Next: 1.1 Prepare Emergency Access Accounts →')
  // Nothing Ready: no line.
  assert.equal(nextReadyOf(items.map((i) => (i.lane === 'Ready' ? { ...i, lane: 'Up Next' as const } : i)), rowNumbersOf(items), sectionNumbersOf(items)), null)
  // The page draws it under the tiles, as a link to the step, only when there is one.
  const page = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(page, /const nextReady = nextReadyOf\(items, rowNumbers, sectionNumbers\)/)
  assert.match(page, /\{nextReady && \(\s*<p className="line no-print plan-next">\s*<a href=\{`#\/plan\/\$\{encodeURIComponent\(nextReady\.id\)\}`\}>/)
  assert.ok(page.indexOf('plan-next') > page.indexOf('plan-progress-tiles') && page.indexOf('plan-next') < page.indexOf('plan-links'), 'under the tiles, above Plan settings')
  // A tile closes the open step and the address with it, so the link opens that step again (review, 2026-09-27),
  // as a history entry of its own when a step was open, so Back reopens it (F-051, Round 3 review).
  assert.match(page, /const selectSummary = [^\n]*if \(open !== null\) visitStep\(window\.history, null\); else if \(stepFromPlanHash\(window\.location\.hash\) !== null\) window\.history\.replaceState\(null, '', '#\/plan'\); setOpen\(null\) \}/)
  // Back to the bare Plan keeps the tile the person was looking through; a link to a step clears it.
  assert.match(page, /const onHash = \(\) => \{ setChangeLine\(null\);[^\n]*const id = stepFromPlanHash\(window\.location\.hash\); if \(id !== null\) setSummaryFilter\(null\); setOpen\(id\) \}/)
})

// F-003, OWN-W3: the legend defined only the five lane words, while rows also
// read Ready · Correct, Create, Decision, Review and Turn on and carry the
// tenant fact Report-only or Enforced; and the "Observing" tile named a state
// no row shows. Every word a row carries is in the legend, and the tile says
// it in the chip's own word.
test('the legend explains every word a row carries, and the report-only tile uses the chip\'s word', async () => {
  const { SUBSTATUS_WORD, BOARD } = await import('./planBoard.ts')
  const { CONTRACT } = await import('./stepContract.ts')
  const { structuralWords } = await import('../../content/content.ts')
  const how = (pages.plan as unknown as { howTo: { legend: { label: string }[]; legendHeading: string } }).howTo
  const labels = how.legend.flatMap((e) => e.label.split(', '))
  for (const w of [...Object.values(BOARD.lanes).filter((w) => ['Ready', 'Up Next', 'On Hold', 'Completed', 'Deferred'].includes(w)), ...new Set(Object.values(SUBSTATUS_WORD)), CONTRACT.lifecycle['report-only'], CONTRACT.lifecycle.enforced]) {
    assert.ok(labels.includes(w), `the legend has no entry for "${w}"`)
  }
  const observing = (structuralWords as unknown as { summary: { observing: string } }).summary.observing
  assert.equal(observing, 'In report-only')
  assert.ok(observing.toLowerCase().includes(CONTRACT.lifecycle['report-only'].toLowerCase()), 'the tile says the chip\'s word')
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /<h3>\{PP\.howTo\.legendHeading\}<\/h3>/)
})

// OWN-W2: rows held on a decision step's answers read "Waiting on your answers"
// and never said which of the three decision steps to open. The board row now
// names it; the step's own screens keep their words (the opened step's
// Readiness tile already heads the wait with the decision step's title).
test('a row waiting on answers names the decision step, and only the row does', async () => {
  const { readinessBlockersOf } = await import('./planBoard.ts')
  const { customerPlanSteps } = await import('./customerPlanSteps.ts')
  const { directionWords } = await import('../../content/content.ts')
  const { isDirectionStep } = await import('../../roadmap/directionAnswers.ts')
  const { fillText } = await import('../../content/render.ts')
  const f = fixture('demo')
  const r = runFixture(f)
  const board = boardOf(customerPlanSteps(r.steps), r.schedule.cleanup ?? null, f.mapping.breakGlassAnswers ?? null)
  const waiting = board.rows.filter((row) => row.lane.waitingFor === directionWords.waiting)
  assert.ok(waiting.length >= 3, `the premise: demo rows wait on answers (${waiting.length})`)
  const titleOf = (id: string): string | null => board.titleOf(id)
  for (const row of waiting) {
    const on = row.reading && row.reading.reason && isDirectionStep(row.reading.reason.id) ? row.reading.reason.id : null
    assert.ok(on, `${row.item.id}: held on a decision step`)
    assert.equal(row.lane.waitingIn, fillText(directionWords.waitingIn, { step: titleOf(on) ?? '' }), row.item.id)
    // The step's own screens are unchanged: each decision tile keeps the plain words under the decision step's title.
    for (const tile of readinessBlockersOf(row.reading, titleOf).filter((b) => isDirectionStep(b.id))) assert.equal(tile.label, directionWords.waiting, `${row.item.id}: ${tile.id}`)
    assert.equal(row.lane.waitingFor, directionWords.waiting, 'and the step screens read waitingFor, unchanged')
  }
  assert.ok(waiting.some((row) => row.lane.waitingIn === 'Waiting on your answers in Confirm What You Use'))
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /waitingFor=\{lane\.waitingIn \?\? lane\.waitingFor\}/)
})

// Review, 2026-09-27 (F-003): the tile says "In report-only", the row chip's word,
// so it counts what the chip says: a policy held in report-only, its week over
// (Ready · Turn on) or not. It counted only the week still running.
test('the In report-only tile counts every step whose chip reads Report-only', async () => {
  const { CONTRACT, factOf } = await import('./stepContract.ts')
  for (const lifecycle of ['report-only', 'ready-to-enforce'] as const) assert.equal(factOf({ state: { lifecycle } } as never), CONTRACT.lifecycle['report-only'], lifecycle)
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /const observingIds = new Set\(c\.steps\.filter\(\(s\) => !s\.doesntApply && s\.status !== 'skipped' && factOf\(s\) === CONTRACT\.lifecycle\['report-only'\]\)/)
  const legend = (pages.plan as unknown as { howTo: { legend: { label: string; description: string }[] } }).howTo.legend
  assert.match(legend.find((e) => e.label.startsWith('Create'))?.description ?? '', /create something new \(a policy, group, location, account or alert\), correct something that already exists/)
})
