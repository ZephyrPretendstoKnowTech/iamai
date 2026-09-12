// The board's three lanes are three READINGS over one row set, and this file is
// the guard on that sentence.
//
// The failure it exists to stop is the one that would be invisible on screen:
// a tab that quietly becomes a second Plan. A tab that drops a row, that draws
// one twice, that reorders the engine's sequence, or that derives a lane of its
// own, looks perfectly reasonable in a screenshot and means the operator is
// reading two different plans depending on which tab they last pressed.
//
// So the invariants below are set-equality and order-equality across the tabs,
// measured over every fixture, plus the rules about where a grouping is allowed
// to get its answer from.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { stepById } from '../../content/content.ts'
import { laneReadings } from './planLanes.ts'
import {
  BOARD,
  LANES,
  NO_FOCUS,
  TAB_OF,
  TYPE_ORDER,
  WHEN,
  applyFocus,
  boardWhen,
  focusCounts,
  groupSummary,
  groupsFor,
  holdGroupOf,
  laneLabelOf,
  workTypeOf,
  WORK_TYPE_IDS,
} from './planBoard.ts'
import type { BoardItem, LaneTab } from './planBoard.ts'

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
  const end = src.indexOf('\n}\n', at)
  return src.slice(at, end)
}

/**
 * The board's rows for a fixture, built the way Plan.tsx builds them: one item
 * per step, with the lane the engine read for it (planLanes.ts), which is the
 * row's one state (A1b).
 */
function itemsFor(name: (typeof FIXTURES)[number]): BoardItem[] {
  const f = fixture(name)
  const r = runFixture(f)
  const readings = laneReadings(r.steps)
  const byId = new Map(r.steps.map((s) => [s.id, s]))
  const titleOf = (id: string): string | null => byId.get(id)?.plainTitle ?? null
  const nextId = r.steps.filter((s) => readings.get(s.id)?.lane === 'Ready').sort((a, b) => readings.get(a.id)!.order - readings.get(b.id)!.order)[0]?.id ?? null
  return r.steps.filter((s) => readings.has(s.id)).map((s) => {
    const reading = readings.get(s.id)!
    return {
      id: s.id,
      title: contentTitle(s),
      lane: reading.lane,
      laneLabel: laneLabelOf(reading, titleOf),
      hold: reading.lane === 'On Hold' ? holdGroupOf(reading) : null,
      workType: workTypeOf(s.id, (contentStepFor(s) as { kind?: string } | undefined)?.kind ?? null),
      isNext: s.id === nextId,
      order: reading.order,
    }
  })
}

const ids = (items: readonly BoardItem[]): string[] => items.map((i) => i.id)
const ALL = { ...NO_FOCUS, showCompleted: true, showDeferred: true }
/** Every row the three tabs draw between them, with both toggles on, each tab's own lane only. */
const acrossTabs = (items: readonly BoardItem[]): string[] =>
  LANES.flatMap((tab) => groupsFor(tab, applyFocus(items, tab, ALL)).filter((g) => g.key !== 'complete' && g.key !== 'deferred').flatMap((g) => ids(g.items)))

// ------------------------------------------------- one row set, three lanes

test('the three tabs draw exactly the rows of the three lanes between them, and each row once', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    assert.ok(items.length > 10, `${name}: only ${items.length} rows, so this proves little`)
    const seen = acrossTabs(items)
    assert.equal(seen.length, new Set(seen).size, `${name}: a row is drawn in more than one tab`)
    const expected = ids(items.filter((i) => TAB_OF[i.lane] !== null)).sort()
    assert.deepEqual([...seen].sort(), expected, `${name}: the tabs do not show the same rows as the row set`)
  }
})

test('the Completed and Deferred groups are the two toggles and never a tab, drawn the same under every tab', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const tab of LANES) {
      const hidden = groupsFor(tab, applyFocus(items, tab, NO_FOCUS)).map((g) => g.key)
      assert.equal(hidden.includes('complete') || hidden.includes('deferred'), false, `${name}/${tab}: finished or deferred work is drawn with its toggle off`)
      const shown = groupsFor(tab, applyFocus(items, tab, ALL))
      const complete = shown.find((g) => g.key === 'complete')
      assert.deepEqual(ids(complete?.items ?? []), ids(items.filter((i) => i.lane === 'Completed').sort((a, b) => a.order - b.order)), `${name}/${tab}: Show completed reveals something other than the completed rows`)
      const deferred = shown.find((g) => g.key === 'deferred')
      assert.deepEqual(ids(deferred?.items ?? []), ids(items.filter((i) => i.lane === 'Deferred').sort((a, b) => a.order - b.order)), `${name}/${tab}: Show deferred reveals something other than the deferred rows`)
    }
  }
})

test('no tab reorders the engine: within a group, rows keep the order the lane gave them', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const tab of LANES) {
      for (const g of groupsFor(tab, applyFocus(items, tab, ALL))) {
        const seen = g.items.map((i) => i.order)
        assert.deepEqual(seen, [...seen].sort((a, b) => a - b), `${name}/${tab}/${g.key}: the group reordered the engine's sequence`)
      }
    }
  }
})

test('On Hold groups by the primary blocker label and nothing else; the other two tabs are one group each', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const g of groupsFor('onHold', applyFocus(items, 'onHold', NO_FOCUS))) {
      assert.match(g.key, /^hold-\d+$/)
      for (const i of g.items) assert.equal(i.hold, g.label, `${name}/${i.id}: grouped under "${g.label}" while its blocker reads "${i.hold}"`)
      assert.ok(Object.values(BOARD.blockers).includes(g.label as never) || g.label === BOARD.lanes.onHold, `${name}: "${g.label}" is not a blocker label`)
    }
    for (const tab of ['ready', 'upNext'] as const) {
      const keys = groupsFor(tab, applyFocus(items, tab, NO_FOCUS)).map((g) => g.key)
      assert.ok(keys.length <= 1 && (keys.length === 0 || keys[0] === tab), `${name}/${tab}: ${keys.join(',')}`)
    }
  }
})

// --------------------------------------------------------------- the focuses

test('a focus filters and never reorders, and search reads the title and nothing else', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const tab of LANES) {
      const shown = applyFocus(items, tab, ALL)
      for (const f of [
        { ...ALL, workType: 'ca' as const },
        { ...ALL, search: 'a' },
      ]) {
        const got = applyFocus(items, tab, f)
        // A subsequence of the unfiltered list: same order, fewer rows.
        let at = 0
        for (const i of got) {
          at = shown.findIndex((x, n) => n >= at && x.id === i.id)
          assert.ok(at >= 0, `${name}/${tab}: a focus produced a row the board does not have, or moved one`)
          at += 1
        }
      }
      const none = applyFocus(items, tab, { ...ALL, search: 'zzzzz-not-a-title' })
      assert.deepEqual(none, [], `${name}/${tab}: search matched something no title contains`)
    }
  }
})

test('work type is a filter over the showing lane, never a lane: every row keeps its tab under every type', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const t of TYPE_ORDER) {
      const seen: string[] = []
      for (const tab of LANES) {
        for (const i of applyFocus(items, tab, { ...ALL, workType: t })) {
          assert.equal(i.workType, t, `${name}/${tab}/${i.id}: the Work type filter let another kind through`)
          assert.ok(TAB_OF[i.lane] === tab || TAB_OF[i.lane] === null, `${name}/${tab}/${i.id}: the filter moved a row to another tab`)
          if (TAB_OF[i.lane] === tab) seen.push(i.id)
        }
      }
      assert.deepEqual(seen.sort(), ids(items.filter((i) => i.workType === t && TAB_OF[i.lane] !== null)).sort(), `${name}/${t}: the filter and the row set disagree`)
    }
  }
})

test('the counts are counted off the board, so a control cannot promise more than it shows', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const counts = focusCounts(items)
    for (const tab of LANES) {
      assert.equal(applyFocus(items, tab, NO_FOCUS).length, counts.lanes[tab], `${name}/${tab}: the tab's count is not its rows`)
    }
    assert.equal(items.filter((i) => i.lane === 'Completed').length, counts.complete)
    assert.equal(items.filter((i) => i.lane === 'Deferred').length, counts.deferred)
    assert.deepEqual(Object.keys(counts), ['complete', 'deferred', 'lanes'], 'the counts carry something other than lane counts (A1b)')
    assert.ok(counts.lanes.ready > 0, `${name}: nothing Ready, so this proves little`)
  }
})

test('showing completed or deferred work is a visibility control: the rows it reveals are the same rows', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const tab of LANES) {
      const hidden = applyFocus(items, tab, NO_FOCUS)
      const shown = applyFocus(items, tab, ALL)
      assert.ok(shown.length >= hidden.length)
      assert.deepEqual(
        ids(shown).filter((id) => !ids(hidden).includes(id)).sort(),
        ids(items.filter((i) => i.lane === 'Completed' || i.lane === 'Deferred')).sort(),
        `${name}/${tab}: the toggles reveal something other than the completed and deferred rows`,
      )
      for (const id of ids(shown)) {
        const a = items.find((i) => i.id === id)!
        const b = shown.find((i) => i.id === id)!
        assert.deepEqual(a, b, `${name}/${id}: a row changed by being shown`)
      }
    }
  }
})

// ------------------------------------------------------- where answers come from

test('the board decides no lane: it reads planLanes.ts and re-derives nothing', () => {
  const src = readFileSync('src/ui/surfaces/planBoard.ts', 'utf8')
  for (const name of ['applyFocus', 'groupsFor', 'focusCounts']) {
    const body = bodyOf(src, name)
    for (const forbidden of ['deriveLane', 'status', 'condition', 'lifecycle', 'blockers', 'readiness', 'schedule', 'phase', 'wave']) {
      assert.equal(body.includes(forbidden), false, `${name} reads ${forbidden}: it may only read the lane the engine handed it`)
    }
  }
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const readings = laneReadings\(c\.steps, /, 'the Plan no longer reads the engine for its lanes')
  assert.match(plan, /lane: reading\.lane,/, 'a row carries a lane the engine did not read')
  assert.match(plan, /const laneView = laneViewOf\(reading, titleOf\)/, 'the board no longer reads the one lane view')
  assert.equal(plan.includes('planStateOf('), false, 'the Plan reads the legacy presentation state beside the lane (A1b)')
  assert.match(plan, /nextLabel=\{isNext \? PP\.next : null\}/, 'the pill and the marker no longer read the same boolean')
  assert.equal(plan.includes('phaseRows('), false, 'the Plan still groups by phase')
  assert.equal(plan.includes('undatedRows('), false, 'the Plan still draws the undated group')
})

test('the row label is Lane · substatus or reason, from one function', () => {
  const titleOf = (id: string): string | null => (id === 's-prereq-break-glass' ? 'Emergency Access Accounts' : null)
  const ready = { lane: 'Ready' as const, substatus: 'Observing' as const, reason: null, blockers: [], gates: [], order: 0, fromEngine: true }
  assert.equal(laneLabelOf(ready, titleOf), 'Ready · Observing')
  const blocker = { kind: 'step' as const, id: 's-prereq-break-glass', milestone: null, condition: null, abnormal: false, ordinal: 5 }
  const upNext = { lane: 'Up Next' as const, substatus: null, reason: blocker, blockers: [blocker], gates: [], order: 0, fromEngine: true }
  assert.equal(laneLabelOf(upNext, titleOf), 'Up Next · After Emergency Access Accounts')
  const held = { lane: 'On Hold' as const, substatus: null, reason: { ...blocker, kind: 'sourceMapping' as const, id: 'sourceMapping:62d67e66', abnormal: true }, blockers: [], gates: [], order: 0, fromEngine: true }
  assert.equal(laneLabelOf(held, titleOf), `On Hold · ${BOARD.blockers.sourceMapping}`)
  assert.equal(holdGroupOf(held), BOARD.blockers.sourceMapping)
  const heldOnStep = { ...held, reason: { ...blocker, abnormal: true } }
  assert.equal(laneLabelOf(heldOnStep, titleOf), `On Hold · ${BOARD.blockers.step}: Emergency Access Accounts`)
  assert.equal(holdGroupOf(heldOnStep), BOARD.blockers.step, 'rows held by the same kind of thing group together')
  assert.equal(laneLabelOf({ ...ready, lane: 'Completed', substatus: null }, titleOf), BOARD.lanes.completed)
  assert.equal(laneLabelOf({ ...ready, lane: 'Deferred', substatus: null }, titleOf), BOARD.lanes.deferred)
  for (const name of FIXTURES) {
    for (const i of itemsFor(name)) {
      assert.ok(i.laneLabel.startsWith(BOARD.lanes[TAB_OF[i.lane] ?? (i.lane === 'Completed' ? 'completed' : 'deferred')]), `${name}/${i.id}: "${i.laneLabel}" does not lead with its lane`)
      if (TAB_OF[i.lane] !== null) assert.match(i.laneLabel, / · /, `${name}/${i.id}: "${i.laneLabel}" says no substatus or reason`)
    }
  }
})

test('the Work type filter reads the content kind and an explicit id list, never a title', () => {
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

// -------------------------------------------------- the next marker

test('the next marker is the first Ready step in the engine’s order, and exactly one row carries it', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const marked = items.filter((i) => i.isNext)
    assert.equal(marked.length, 1, `${name}: ${marked.length} rows marked next`)
    const ready = items.filter((i) => i.lane === 'Ready').sort((a, b) => a.order - b.order)
    assert.equal(marked[0]!.id, ready[0]!.id, `${name}: the marker is not the first Ready row`)
    assert.ok(ready.length > 1, `${name}: only one Ready row, so the marker proves little`)
  }
})

// -------------------------------------------------- the board's timing column

test('the column is a day or the placeholder: a dated value stands, words read the scheduled day, and nothing is blank', () => {
  // A row's own dated value stands. A value that is words — the generic `now`
  // every prerequisite carries, a threshold, "held until reviewed", "ready now"
  // — reads the day the plan schedules the step where it schedules one (for
  // preparation work the day its phase begins), and the placeholder otherwise:
  // the reason a row cannot move is its lane label's and its reason line's
  // (A1b, RUN-CONTEXT-A decision 1). A finished or deferred row reads the placeholder.
  assert.equal(boardWhen('Sep 22, 2026', { dated: true }), 'Sep 22, 2026')
  assert.equal(boardWhen('now', { dated: false, day: 'Sep 11, 2026' }), 'Sep 11, 2026')
  assert.equal(boardWhen('now', { dated: false }), WHEN.none, 'a row with no scheduled day dates nothing')
  assert.equal(boardWhen('when MFA readiness reaches 90% (now 42%)', { dated: false }), WHEN.none, 'a threshold is the lane label’s and the reason line’s, never the column’s')
  assert.equal(boardWhen('held until reviewed', { dated: false }), WHEN.none)
  assert.equal(boardWhen('ready now', { dated: false, day: 'Sep 17, 2026' }), 'Sep 17, 2026', 'a policy that may be enforced reads the day the plan schedules the enforcement')
  assert.equal(boardWhen('', { dated: false }), WHEN.none, 'no value is never a blank cell')
  assert.equal(boardWhen('', { dated: false, settled: true }), WHEN.none)
  assert.equal(boardWhen('Sep 10, 2026', { dated: true, settled: true }), WHEN.none, 'a finished or deferred row reads the placeholder whatever it was dated')
  // The column never says a state: none of the words it used to carry is the placeholder.
  for (const word of ['Held', 'Not scheduled', 'Complete', 'Deferred', 'After prerequisites']) assert.notEqual(WHEN.none, word)
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
  assert.deepEqual(callers, [], 'a surface outside the board took the board’s reading of the date')
})

// ------------------------------------------------------------------ the groups

test('a group summary counts the rows under it, so the heading cannot disagree with the group', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const tab of LANES) {
      for (const g of groupsFor(tab, applyFocus(items, tab, ALL))) {
        const n = g.items.length
        assert.equal(groupSummary(g), `${n} step${n === 1 ? '' : 's'}`, `${tab}/${g.key}: the summary says more than its own row count (A1b: no attention count)`)
        assert.ok(g.items.length > 0, `${tab}/${g.key}: an empty group is drawn`)
      }
    }
  }
})

test('the board vocabulary is one record, and Ready is the default tab', () => {
  assert.deepEqual([...LANES], ['ready', 'upNext', 'onHold'], 'the tab order moved')
  assert.equal(LANES[0], 'ready', 'Ready is no longer the default')
  assert.deepEqual(Object.values(BOARD.lanes), ['Ready', 'Up Next', 'On Hold', 'Completed', 'Deferred', "Doesn't apply"])
  assert.deepEqual(Object.keys(BOARD.type), TYPE_ORDER, 'the work-type labels and the work-type order disagree')
  assert.equal(BOARD.showCompleted, 'Show completed')
  assert.equal(BOARD.showDeferred, 'Show deferred')
  // The four zones are named, and the two on the right say what they hold:
  // Impact is a population and When is a date.
  assert.deepEqual(Object.values(BOARD.columns), ['State', 'Step', 'Impact', 'When'])
  const tabs: LaneTab[] = ['ready', 'upNext', 'onHold']
  for (const t of tabs) assert.ok(BOARD.lanes[t])
})
