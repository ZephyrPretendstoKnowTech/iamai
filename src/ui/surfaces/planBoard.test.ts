// The board's three lenses are three GROUPINGS of one row set, and this file is
// the guard on that sentence.
//
// The failure it exists to stop is the one that would be invisible on screen:
// a lens that quietly becomes a second Plan. A view that filters a row out, or
// reorders a group, or re-derives a readiness of its own, looks perfectly
// reasonable in a screenshot and means the operator is reading two different
// plans depending on which tab they last pressed.
//
// So the invariants below are set-equality and order-equality across the lenses,
// measured over every fixture, plus the two rules about where a grouping is
// allowed to get its answer from.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { stepById } from '../../content/content.ts'
import {
  BOARD,
  CLOSED_BY_DEFAULT,
  NO_FOCUS,
  STATUS_ORDER,
  TYPE_ORDER,
  VIEWS,
  applyFocus,
  boardWhen,
  focusCounts,
  groupSummary,
  groupsFor,
  statusGroupOf,
  workTypeOf,
  WORK_TYPE_IDS,
} from './planBoard.ts'
import type { BoardItem, View } from './planBoard.ts'

const FIXTURES = ['demo', 'getiamai'] as const

/**
 * One exported function's body, by name: from its declaration to the first line
 * that closes it at column 0.
 *
 * The source guards below read this rather than a slice between two exports,
 * because a slice picks up the NEXT function's doc comment — and a doc comment
 * explaining why a rule exists naturally contains the very words the rule
 * forbids. That is a guard failing on its own explanation.
 */
function bodyOf(src: string, name: string): string {
  const at = src.indexOf(`export function ${name}`)
  assert.ok(at > 0, `${name} is not exported from planBoard.ts`)
  const end = src.indexOf('\n}', at)
  assert.ok(end > at, `${name} has no body`)
  return src.slice(at, end)
}

/**
 * The board's rows for a fixture, built the way Plan.tsx builds them: one item
 * per step, in the engine's own order, carrying the group the Plan draws it in.
 *
 * The roadmap group here is deliberately coarse — this file is not testing which
 * wave a step is in (planRows.ts already owns that and roadmap.test.ts proves
 * it); it is testing that whatever grouping the surface hands over, the three
 * lenses agree about the ROWS.
 */
function itemsFor(name: (typeof FIXTURES)[number]): BoardItem[] {
  const f = fixture(name)
  const r = runFixture(f)
  // The Plan's own next marker, reproduced exactly as Plan.tsx sets it: the
  // first ready step in the roadmap's order, and nothing else. This is a copy of
  // the rule, not a second rule — `the Up next group is the next marker` below
  // holds Plan.tsx to the same line.
  let marked = false
  return r.steps.map((s, i) => {
    const isNext = !marked && s.status === 'ready'
    if (isNext) marked = true
    return {
      id: s.id,
      title: contentTitle(s),
      roadmap: { key: s.status === 'done' ? 'complete' : `wave-${s.phase}`, label: `Phase ${s.phase}`, date: null, secondary: s.status === 'done', start: null },
      status: statusGroupOf(s, isNext),
      workType: workTypeOf(s.id, (contentStepFor(s) as { kind?: string } | undefined)?.kind ?? null),
      isNext,
      order: i,
    }
  })
}

const ids = (items: readonly BoardItem[]): string[] => items.map((i) => i.id)
const allIds = (view: View, items: readonly BoardItem[]): string[] => groupsFor(view, items).flatMap((g) => ids(g.items))

// ------------------------------------------------- one row set, three lenses

test('every lens shows exactly the same rows: a grouping never adds or drops one', () => {
  for (const name of FIXTURES) {
    // Completed work is hidden by default, so the comparison is made with it
    // shown — otherwise all three lenses would agree by hiding the same rows.
    const items = applyFocus(itemsFor(name), { ...NO_FOCUS, showCompleted: true })
    assert.ok(items.length > 10, `${name}: only ${items.length} rows, so this proves little`)
    const expected = [...ids(items)].sort()
    for (const view of VIEWS) {
      const got = [...allIds(view, items)].sort()
      assert.deepEqual(got, expected, `${name}/${view}: the lens does not show the same rows as the row set`)
    }
  }
})

test('a row appears exactly once in every lens: no step is in two groups', () => {
  for (const name of FIXTURES) {
    const items = applyFocus(itemsFor(name), { ...NO_FOCUS, showCompleted: true })
    for (const view of VIEWS) {
      const seen = allIds(view, items)
      assert.equal(seen.length, new Set(seen).size, `${name}/${view}: a row is drawn in more than one group`)
    }
  }
})

test('no lens reorders production: within a group, rows keep the order the engine gave them', () => {
  for (const name of FIXTURES) {
    const items = applyFocus(itemsFor(name), { ...NO_FOCUS, showCompleted: true })
    const position = new Map(items.map((i, n) => [i.id, n]))
    for (const view of VIEWS) {
      for (const g of groupsFor(view, items)) {
        const seen = ids(g.items).map((id) => position.get(id)!)
        assert.deepEqual(seen, [...seen].sort((a, b) => a - b), `${name}/${view}/${g.key}: the group reordered production's sequence`)
      }
    }
  }
})

// --------------------------------------------------------------- the focuses

test('a focus filters and never reorders, and search reads the title and nothing else', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const shown = applyFocus(items, { ...NO_FOCUS, showCompleted: true })
    for (const f of [
      { ...NO_FOCUS, attention: true, showCompleted: true },
      { ...NO_FOCUS, upNext: true, showCompleted: true },
      { ...NO_FOCUS, search: 'a', showCompleted: true },
    ]) {
      const got = applyFocus(items, f)
      // A subsequence of the unfiltered list: same order, fewer rows.
      let at = 0
      for (const i of got) {
        at = shown.findIndex((x, n) => n >= at && x.id === i.id)
        assert.ok(at >= 0, `${name}: a focus produced a row the board does not have, or moved one`)
        at += 1
      }
    }
    // The search matches the title, and a string that is in no title matches nothing.
    const none = applyFocus(items, { ...NO_FOCUS, search: 'zzzzz-not-a-title', showCompleted: true })
    assert.deepEqual(none, [], `${name}: search matched something no title contains`)
  }
})

test('the focus counts are counted off the board, so a count cannot disagree with what pressing it shows', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const counts = focusCounts(items)
    assert.equal(applyFocus(items, { ...NO_FOCUS, attention: true, showCompleted: true }).length, counts.attention, `${name}: the Needs attention count is not what it shows`)
    assert.equal(applyFocus(items, { ...NO_FOCUS, upNext: true, showCompleted: true }).length, counts.upNext, `${name}: the Up next count is not what it shows`)
    assert.equal(items.filter((i) => i.status === 'complete').length, counts.complete)
  }
})

test('completed work is hidden until Show completed, and showing it is the only difference', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const hidden = applyFocus(items, NO_FOCUS)
    const shown = applyFocus(items, { ...NO_FOCUS, showCompleted: true })
    assert.ok(shown.length >= hidden.length)
    assert.deepEqual(
      ids(shown).filter((id) => !ids(hidden).includes(id)).sort(),
      ids(items).filter((id) => items.find((i) => i.id === id)!.status === 'complete').sort(),
      `${name}: Show completed reveals something other than the completed rows`,
    )
    // And the rows it reveals are the same rows: the toggle is visibility, not state.
    for (const id of ids(shown)) {
      const a = items.find((i) => i.id === id)!
      const b = shown.find((i) => i.id === id)!
      assert.deepEqual(a, b, `${name}/${id}: a row changed by being shown`)
    }
  }
})

// ------------------------------------------------------- where answers come from

test('the Status lens reads Foundation B and computes no readiness of its own', () => {
  const src = readFileSync('src/ui/surfaces/planBoard.ts', 'utf8')
  // The only fields the projection may read.
  const body = bodyOf(src, 'statusGroupOf')
  for (const forbidden of ['blockers', 'readiness', 'evidence', 'schedule', 'population', 'Date', 'coverage']) {
    assert.equal(body.includes(forbidden), false, `the status projection reads ${forbidden}: it may only restate status and condition`)
  }
  // Every status a step can carry lands somewhere, and `done` is always Complete.
  for (const name of FIXTURES) {
    const f = fixture(name)
    for (const s of runFixture(f).steps) {
      const g = statusGroupOf(s, false)
      assert.ok(STATUS_ORDER.includes(g), `${name}/${s.id}: ${g} is not a status group`)
      if (s.status === 'done') assert.equal(g, 'complete', `${name}/${s.id}: a done step is not Complete`)
      if (g === 'complete') assert.equal(s.status, 'done', `${name}/${s.id}: Complete holds a step the engine has not finished`)
    }
  }
})

test('the Work type lens reads the content kind and an explicit id list, never a title', () => {
  const src = readFileSync('src/ui/surfaces/planBoard.ts', 'utf8')
  // The failure this stops: `title.includes('MFA')`. A classifier over prose
  // mis-files the first step somebody renames, and nothing fails when it does.
  for (const forbidden of ['title.includes', 'title.match', '.title', 'toLowerCase().includes']) {
    const at = src.indexOf('export function workTypeOf')
    assert.equal(src.slice(at, at + 400).includes(forbidden), false, `the work-type projection reads ${forbidden}`)
  }
  // Every id in the explicit list is a real content step, so the list cannot rot
  // into a set of names for steps that no longer exist. It is checked against
  // the CONTENT file and not against a fixture: a tenant only produces the steps
  // it needs, so a fixture proves an id is used, never that it is valid.
  for (const id of Object.keys(WORK_TYPE_IDS)) {
    assert.ok(stepById[id] !== undefined, `${id} is in the work-type list but is not a step in docs/design/content.json`)
  }
  // And the list earns its place: each id is one the content kind alone would
  // have filed somewhere else. An entry that agrees with the base rule is dead
  // weight, and the next reader cannot tell which entries are load-bearing.
  for (const [id, want] of Object.entries(WORK_TYPE_IDS)) {
    const kind = (stepById[id] as { kind?: string } | undefined)?.kind ?? null
    assert.notEqual(workTypeOf('not-in-the-list', kind), want, `${id} is listed explicitly but its content kind (${kind}) already answers ${want}`)
  }
  for (const name of FIXTURES) {
    for (const s of runFixture(fixture(name)).steps) {
      const t = workTypeOf(s.id, (contentStepFor(s) as { kind?: string } | undefined)?.kind ?? null)
      assert.ok(TYPE_ORDER.includes(t), `${name}/${s.id}: ${t} is not a work type`)
    }
  }
})

test('every policy step is Conditional Access work, and the campaign is authentication work', () => {
  for (const name of FIXTURES) {
    let policies = 0
    for (const s of runFixture(fixture(name)).steps) {
      const kind = (contentStepFor(s) as { kind?: string } | undefined)?.kind ?? null
      if (kind !== 'policy') continue
      policies += 1
      assert.equal(workTypeOf(s.id, kind), 'ca', `${name}/${s.id}: a policy step is not Conditional Access work`)
    }
    assert.ok(policies > 3, `${name}: only ${policies} policy steps, so this proves little`)
  }
})

// -------------------------------------------------- Up next is the next MARKER

test('Up next is the Plan\u2019s next marker, and ready work that is not the recommendation is not in it', () => {
  for (const name of FIXTURES) {
    const items = applyFocus(itemsFor(name), { ...NO_FOCUS, showCompleted: true })
    const upnext = items.filter((i) => i.status === 'upnext')
    const marked = items.filter((i) => i.isNext)
    assert.deepEqual(upnext.map((i) => i.id), marked.map((i) => i.id), `${name}: Up next is not the next marker`)
    // The defect this replaced: Up next held every ready step, so it meant
    // "actionable" and told the operator a dozen things were the next thing.
    const ready = items.filter((i) => !i.isNext && (i.status === 'ready' || i.status === 'upnext'))
    assert.ok(ready.length > 0, `${name}: no ready-but-not-next rows, so this proves nothing`)
    for (const i of ready) assert.notEqual(i.status, 'upnext', `${name}/${i.id}: a ready step that is not next is still in Up next`)
  }
})

test('a Ready step and a Ready-to-enforce step are only Up next when the marker says so', () => {
  const base = { state: { condition: 'healthy' as const }, operatorSafe: true }
  const ready = { ...base, status: 'ready' as const }
  const toEnforce = { ...base, status: 'ready-to-enforce' as const }
  // The status alone decides nothing about Up next any more.
  assert.equal(statusGroupOf(ready, false), 'ready', 'a Ready step that is not next is in Up next')
  assert.equal(statusGroupOf(toEnforce, false), 'ready', 'a Ready-to-enforce step that is not next is in Up next')
  assert.equal(statusGroupOf(ready, true), 'upnext', 'the marked step is not Up next')
  assert.equal(statusGroupOf(toEnforce, true), 'upnext', 'the marked step is not Up next')
  // And the marker never outranks the two states that come before it: a step the
  // operator is blocking on, or one that is already delivered, is not Up next
  // however the marker falls.
  assert.equal(statusGroupOf({ ...base, status: 'done' as const }, true), 'complete')
  assert.equal(statusGroupOf({ status: 'blocked' as const, state: { condition: 'needs-decision' as const }, operatorSafe: true }, true), 'attention')
})

test('the Up next count and the Up next group are the same rows, so the button cannot promise more than it shows', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const counts = focusCounts(items)
    assert.equal(counts.upNext, items.filter((i) => i.isNext).length, `${name}: the count is not the marker`)
    for (const view of VIEWS) {
      const shown = groupsFor(view, applyFocus(items, { ...NO_FOCUS, upNext: true, showCompleted: true })).flatMap((g) => g.items)
      assert.equal(shown.length, counts.upNext, `${name}/${view}: the focus shows a different number of rows than the count`)
      for (const i of shown) assert.ok(i.isNext, `${name}/${view}/${i.id}: the Up next focus showed a row the marker did not mark`)
    }
    // The Status lens's own group, from the same signal.
    const group = groupsFor('status', applyFocus(items, { ...NO_FOCUS, showCompleted: true })).find((g) => g.key === 'upnext')
    assert.deepEqual((group?.items ?? []).map((i) => i.id), items.filter((i) => i.isNext).map((i) => i.id), `${name}: the Status lens's Up next group is not the marker`)
  }
})

test('the marker is handed in, never re-derived: the projection cannot invent a next step', () => {
  const src = readFileSync('src/ui/surfaces/planBoard.ts', 'utf8')
  const body = bodyOf(src, 'statusGroupOf')
  // The failure this stops is the projection quietly guessing, which is how Up
  // next became a synonym for ready in the first place.
  for (const forbidden of ['phase', 'order', 'rings', 'events', 'wave', 'sort', 'find(']) {
    assert.equal(body.includes(forbidden), false, `the status projection reads ${forbidden} to decide what is next`)
  }
  // And Plan.tsx sets the marker the one way it always has: the first ready step
  // in the roadmap's order, which is also the row that draws the "next" pill.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const isNext = !nextMarked && step\.status === 'ready'/, 'the next marker moved or changed its rule')
  // With the one hold reading beside it (roadmap/holds.ts), handed in the same way.
  assert.match(plan, /statusGroupOf\(step, isNext, isHeld\(step\)\)/, 'the board no longer groups by the marker')
  assert.match(plan, /nextLabel=\{isNext \? PP\.next : null\}/, 'the pill and the group no longer read the same boolean')
})

// -------------------------------------------------- the board's timing column

test('the generic now reads the day its phase begins, or Not scheduled, and the column is never blank', () => {
  // Every prerequisite and check carries the same `now`. Repeated down nine
  // Preparation rows it said nothing, and blank said less (owner, 2026-09-11):
  // the board reads the day the row's phase begins. A real date and a real
  // reason both survive.
  assert.equal(boardWhen('now', { genericNow: true, held: false, carriesReason: false, groupDay: 'Sep 11, 2026' }), 'Sep 11, 2026')
  assert.equal(boardWhen('now', { genericNow: true, held: false, carriesReason: false }), 'Not scheduled', 'a group with no first day of its own dates nothing')
  assert.equal(boardWhen('now', { genericNow: true, held: true, carriesReason: false }), 'Not scheduled', 'the generic now wins over Held: there is no date to mislead with')
  assert.equal(boardWhen('', { genericNow: false, held: false, carriesReason: false, complete: true }), 'Complete')
  assert.equal(boardWhen('', { genericNow: false, held: false, carriesReason: false }), 'Not scheduled', 'no value is never a blank cell')
  assert.equal(boardWhen('', { genericNow: false, held: false, carriesReason: false, waitsOn: 'After prerequisites' }), 'After prerequisites')
  assert.equal(boardWhen('Sep 22, 2026', { genericNow: false, held: false, carriesReason: false }), 'Sep 22, 2026')
  assert.equal(boardWhen('ready Sep 17, 2026', { genericNow: false, held: false, carriesReason: false }), 'ready Sep 17, 2026')
  assert.equal(boardWhen('ready now', { genericNow: false, held: false, carriesReason: false }), 'ready now', 'a policy that may be enforced now is not the generic now')
})

test('a held row reads Held instead of borrowing its wave\u2019s date, unless it already says why', () => {
  assert.equal(boardWhen('Sep 10, 2026', { genericNow: false, held: true, carriesReason: false }), BOARD.held)
  // …or the step it waits on, where the hold names one.
  assert.equal(boardWhen('', { genericNow: false, held: true, carriesReason: false, waitsOn: 'After Exclusions Group' }), 'After Exclusions Group')
  // A column that already carries a REASON keeps it: it is more specific than
  // Held, and it is the fact the operator needs.
  assert.equal(boardWhen('when MFA readiness reaches 90% (now 42%)', { genericNow: false, held: true, carriesReason: true }), 'when MFA readiness reaches 90% (now 42%)')
  assert.equal(boardWhen('held until reviewed', { genericNow: false, held: true, carriesReason: true }), 'held until reviewed')
  // Not held: the date stands.
  assert.equal(boardWhen('Sep 10, 2026', { genericNow: false, held: false, carriesReason: false }), 'Sep 10, 2026')
})

test('the board reads the timing value and never writes it: no date is recalculated', () => {
  const src = readFileSync('src/ui/surfaces/planBoard.ts', 'utf8')
  const body = bodyOf(src, 'boardWhen')
  for (const forbidden of ['Date', 'absoluteDate', 'toISOString', 'parse', 'schedule', 'rings', 'events']) {
    assert.equal(body.includes(forbidden), false, `the board's timing projection reads ${forbidden}: it may only choose what to show`)
  }
  // The underlying value is still rowWhen's, and every other surface still asks
  // rowWhen directly. The board is the only caller of boardWhen.
  const callers = ['src/ui/surfaces/PrintPlan.tsx', 'src/ui/surfaces/stepExport.ts']
    .filter((f) => existsSync(f))
    .filter((f) => readFileSync(f, 'utf8').includes('boardWhen'))
  assert.deepEqual(callers, [], 'a surface outside the board took the board\u2019s reading of the date')
})

// ------------------------------------------------------------------ the groups

test('the roadmap keeps the future open: only the non-sequence groups start collapsed', () => {
  // The roadmap's job is to show what is coming. A numbered phase that starts
  // folded to save vertical space is the board hiding its own subject.
  for (const key of ['wave-0', 'wave-1', 'wave-2', 'cleanup']) {
    assert.equal(CLOSED_BY_DEFAULT.has(key), false, `${key} starts collapsed`)
  }
  // Both lenses' keys for the same two ideas: held work and optional
  // recommendations. `held` is the Roadmap lens's key and `waiting` the Status
  // lens's; missing one of them was a real defect — the Waiting group rendered
  // open on the roadmap while its Status twin folded.
  for (const key of ['held', 'waiting', 'floor']) {
    assert.equal(CLOSED_BY_DEFAULT.has(key), true, `${key} does not start collapsed`)
  }
  // Finished work is drawn only while Show completed is on, so it opens with the
  // control: collapsed as well, pressing Show completed showed no row at all.
  assert.equal(CLOSED_BY_DEFAULT.has('complete'), false, 'Show completed reveals a folded group and no rows')
  const shown = groupsFor('roadmap', applyFocus(itemsFor(FIXTURES[0]), { ...NO_FOCUS, showCompleted: true })).find((g) => g.key === 'complete')
  const hidden = groupsFor('roadmap', applyFocus(itemsFor(FIXTURES[0]), NO_FOCUS)).find((g) => g.key === 'complete')
  assert.ok(shown && shown.items.length > 0, 'the premise: a fixture with finished work')
  assert.equal(hidden, undefined, 'and the group is not drawn until the control asks for it')
})

test('a group summary counts the rows under it, so the heading cannot disagree with the group', () => {
  for (const name of FIXTURES) {
    const items = applyFocus(itemsFor(name), { ...NO_FOCUS, showCompleted: true })
    for (const view of VIEWS) {
      for (const g of groupsFor(view, items)) {
        const n = g.items.length
        assert.match(groupSummary(g), new RegExp(`^${n} step${n === 1 ? '' : 's'}`), `${view}/${g.key}: the summary does not count its own rows`)
        const attention = g.items.filter((i) => i.status === 'attention').length
        if (g.key !== 'attention' && attention > 0) assert.match(groupSummary(g), new RegExp(`${attention} need`), `${view}/${g.key}: the summary drops its attention count`)
      }
    }
  }
})

test('an empty group is not drawn, and the lens orders its groups the way the reference does', () => {
  for (const name of FIXTURES) {
    const items = applyFocus(itemsFor(name), { ...NO_FOCUS, showCompleted: true })
    for (const [view, order] of [
      ['status', STATUS_ORDER],
      ['type', TYPE_ORDER],
    ] as const) {
      const keys = groupsFor(view, items).map((g) => g.key)
      assert.deepEqual(keys, order.filter((k) => keys.includes(k)), `${view}: the groups are not in the reference's order`)
      for (const g of groupsFor(view, items)) assert.ok(g.items.length > 0, `${view}/${g.key}: an empty group is drawn`)
    }
  }
})

test('the board vocabulary is one record, and Roadmap is the default lens', () => {
  assert.deepEqual([...VIEWS], ['roadmap', 'status', 'type'], 'the lens order moved')
  assert.equal(VIEWS[0], 'roadmap', 'Roadmap is no longer the default')
  assert.deepEqual(Object.keys(BOARD.status), STATUS_ORDER, 'the status labels and the status order disagree')
  assert.deepEqual(Object.keys(BOARD.type), TYPE_ORDER, 'the work-type labels and the work-type order disagree')
  // The four zones are named, and the two on the right say what they hold:
  // Impact is a population and When is a date.
  assert.deepEqual(Object.values(BOARD.columns), ['State', 'Step', 'Impact', 'When'])
})
