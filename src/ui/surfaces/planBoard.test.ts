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
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { directionWords, stepById } from '../../content/content.ts'
import { laneReadings } from './planLanes.ts'
import { STEP_GROUPS, groupOf } from '../../roadmap/stepGroups.ts'
import {
  ALL_WORK_TAB,
  BOARD,
  LANES,
  TABS,
  allWorkGroups,
  NO_FOCUS,
  TAB_OF,
  TYPE_ORDER,
  WHEN,
  applyFocus,
  asideGroupsFor,
  boardWhen,
  focusCounts,
  groupKeyOf,
  groupSummary,
  groupTotalsOf,
  groupsFor,
  laneLabelOf,
  waitingForOf,
  workTypeOf,
  WORK_TYPE_IDS,
  EMERGENCY_STEP_IDS,
  groupTitleOf,
  partitionEmergencyItems,
  rowNumbersOf,
  nothingReadyLine,
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
function itemsFor(name: FixtureName): BoardItem[] {
  const f = fixture(name)
  const r = runFixture(f)
  const readings = laneReadings(r.steps)
  const byId = new Map(r.steps.map((s) => [s.id, s]))
  const titleOf = (id: string): string | null => byId.get(id)?.plainTitle ?? null
  return r.steps.filter((s) => readings.has(s.id)).map((s) => {
    const reading = readings.get(s.id)!
    return {
      id: s.id,
      title: contentTitle(s),
      lane: reading.lane,
      laneLabel: laneLabelOf(reading, titleOf),
      workType: workTypeOf(s.id, (contentStepFor(s) as { kind?: string } | undefined)?.kind ?? null),
      order: reading.order,
    }
  })
}

const ids = (items: readonly BoardItem[]): string[] => items.map((i) => i.id)
const ALL = { ...NO_FOCUS, showCompleted: true, showDeferred: true }

test('the emergency foundation partitions the canonical rows once and stays active until all four are completed', () => {
  const extra = (id: string, lane: BoardItem['lane']): BoardItem => ({ id, title: id, lane, laneLabel: lane, workType: 'setup', order: 0 })
  const items = [...EMERGENCY_STEP_IDS.map((id, index) => extra(id, index === 0 ? 'Completed' : index === 1 ? 'Ready' : index === 2 ? 'Up Next' : 'On Hold')), extra('ordinary', 'Ready')]
  const partitioned = partitionEmergencyItems(items)
  assert.deepEqual(ids(partitioned.emergency), [...EMERGENCY_STEP_IDS])
  assert.equal(partitioned.complete, false)
  assert.equal(new Set([...ids(partitioned.emergency), ...ids(partitioned.remaining)]).size, items.length)
  assert.equal(partitioned.remaining.some(item => EMERGENCY_STEP_IDS.includes(item.id as typeof EMERGENCY_STEP_IDS[number])), false)
  const complete = partitionEmergencyItems(items.map(item => EMERGENCY_STEP_IDS.includes(item.id as typeof EMERGENCY_STEP_IDS[number]) ? { ...item, lane: 'Completed' } : item))
  assert.equal(complete.complete, true)
})
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
      const hidden = asideGroupsFor(applyFocus(items, tab, NO_FOCUS)).map((g) => g.key)
      assert.deepEqual(hidden, [], `${name}/${tab}: finished or deferred work is drawn with its toggle off`)
      const inTab = groupsFor(tab, applyFocus(items, tab, ALL)).map((g) => g.key)
      assert.equal(inTab.includes('complete') || inTab.includes('deferred'), false, `${name}/${tab}: finished or deferred work is drawn inside the tab`)
      const shown = asideGroupsFor(applyFocus(items, tab, ALL))
      const complete = shown.find((g) => g.key === 'complete')
      assert.deepEqual(ids(complete?.items ?? []), ids(items.filter((i) => i.lane === 'Completed').sort((a, b) => a.order - b.order)), `${name}/${tab}: Show completed reveals something other than the completed rows`)
      const deferred = shown.find((g) => g.key === 'deferred')
      assert.deepEqual(ids(deferred?.items ?? []), ids(items.filter((i) => i.lane === 'Deferred').sort((a, b) => a.order - b.order)), `${name}/${tab}: Show deferred reveals something other than the deferred rows`)
    }
  }
})

test('A6: on the Follow-up demo the Ready tab holds no Completed row, with or without Show completed, and the aside groups sit outside the tab panel', () => {
  const items = itemsFor('demo-week2')
  assert.ok(items.some((i) => i.lane === 'Completed'), 'the premise: the Follow-up demo has completed work')
  for (const focus of [NO_FOCUS, ALL]) {
    const inReady = groupsFor('ready', applyFocus(items, 'ready', focus)).flatMap((g) => g.items)
    assert.ok(inReady.length > 0, 'the premise: the Ready tab draws rows')
    assert.equal(inReady.filter((i) => i.lane === 'Completed').length, 0, `the Ready tab holds a Completed row (showCompleted=${focus.showCompleted})`)
  }
  assert.equal(asideGroupsFor(applyFocus(items, 'ready', ALL)).find((g) => g.key === 'complete')?.items.length, items.filter((i) => i.lane === 'Completed').length)
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  const panelAt = plan.indexOf('{...onePanelProps(boardBase, tab)}>')
  const panel = plan.slice(panelAt, plan.indexOf('</div>', panelAt))
  assert.ok(panelAt > 0 && !/aside\.map/.test(panel), 'the Completed and Deferred groups are drawn inside the tab panel')
  assert.match(plan.slice(plan.indexOf('</div>', panelAt)), /aside\.map\(drawGroup/, 'Plan.tsx does not draw the aside groups after the panel')
})

test('no tab sequences a group of its own: a group draws its registry order under every tab, and the aside keeps the engine’s', () => {
  // A tab decides which of a group's rows it SHOWS and never their order. The
  // order inside a group is the registry's, which is the order its numbers
  // count in — the same under all three tabs, so no tab can become a second
  // plan. The Completed and Deferred groups are not registry groups and keep
  // the engine's own sequence, as they always did.
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const tab of LANES) {
      const shown = applyFocus(items, tab, ALL)
      const numbers = rowNumbersOf(items)
      for (const g of groupsFor(tab, shown)) {
        const seen = g.items.map((i) => numbers.get(i.id)!)
        assert.deepEqual(seen, [...seen].sort((a, b) => a - b), `${name}/${tab}/${g.key}: the numbers do not ascend`)
      }
      for (const g of asideGroupsFor(shown)) {
        const seen = g.items.map((i) => i.order)
        assert.deepEqual(seen, [...seen].sort((a, b) => a - b), `${name}/${tab}/${g.key}: the aside reordered the engine's sequence`)
      }
    }
    // And the order a group draws is the same order whichever tab draws it.
    for (const g of STEP_GROUPS) {
      const perTab = LANES.map((tab) => groupsFor(tab, applyFocus(items, tab, ALL)).find((x) => x.key === `${tab}-${g.key}`)?.items.map((i) => i.id) ?? [])
      const together = perTab.flat()
      const registry = [...together].sort((a, b) => (STEP_GROUPS.find((x) => x.key === g.key)!.members.indexOf(a) + 1 || Infinity) - (STEP_GROUPS.find((x) => x.key === g.key)!.members.indexOf(b) + 1 || Infinity))
      assert.equal(perTab.every((t) => t.every((id, at) => at === 0 || registry.indexOf(t[at - 1]) < registry.indexOf(id))), true, `${name}/${g.key}: a tab drew the group in an order of its own`)
    }
  }
})

test('every tab groups by the step group and nothing else, in the registry order, and the same heading means the same run of work in all three', () => {
  // The heading is now a property of the STEP (roadmap/stepGroups.ts), not of
  // the lane: a step moving lane keeps its heading, which is what lets the
  // three tabs read as one plan. Where a row is held, and by what, is still
  // said once — in the row's own lane label (`On Hold · Baseline conflict`).
  const registry = STEP_GROUPS.map((g) => g.key)
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    for (const tab of LANES) {
      const drawn = groupsFor(tab, applyFocus(items, tab, NO_FOCUS))
      const keys = drawn.map((g) => g.key)
      assert.deepEqual(keys, [...keys].sort((a, b) => registry.indexOf(a.slice(tab.length + 1)) - registry.indexOf(b.slice(tab.length + 1))), `${name}/${tab}: the groups are not in the registry's order`)
      for (const g of drawn) {
        const key = g.key.slice(tab.length + 1)
        assert.ok(registry.includes(key), `${name}/${tab}: "${g.key}" is not a registry group`)
        assert.equal(g.label, groupTitleOf(STEP_GROUPS.find((x) => x.key === key)!, false), `${name}/${tab}/${g.key}: the heading is not the group's own title`)
        for (const i of g.items) assert.equal(groupOf(i.id)?.key, key, `${name}/${i.id}: drawn under "${g.label}" while the registry puts it elsewhere`)
      }
    }
    // Every row is in exactly one group: the catch-all entry is why no lane can
    // leave one unheaded, and the tab keys are why no row is drawn twice.
    for (const i of items) assert.ok(groupOf(i.id) !== null, `${name}/${i.id}: no group claims this row`)
  }
})

test('a row is numbered by its place in its group and keeps that number when a tab filters the list', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const numbers = rowNumbersOf(items)
    // Every row that has a group has a number, and no two rows of one group share one.
    const byGroup = new Map<string, number[]>()
    for (const i of items) {
      const key = groupOf(i.id)!.key
      const n = numbers.get(i.id)
      assert.ok(typeof n === 'number' && n >= 1, `${name}/${i.id}: no number`)
      byGroup.set(key, [...(byGroup.get(key) ?? []), n!])
    }
    for (const [key, ns] of byGroup) assert.equal(new Set(ns).size, ns.length, `${name}/${key}: two rows share a number`)
    // The registry decides the ORDER; the board's own rows decide the numbers,
    // so a group's numbers run 1..n over the rows it has and the highest is its
    // row count. A registry member this tenant does not carry leaves no gap:
    // "1 step" under a row numbered 5 was a promise of four rows that were not
    // anywhere in the plan.
    for (const [key, ns] of byGroup) assert.deepEqual([...ns].sort((a, b) => a - b), ns.map((_, i) => i + 1), `${name}/${key}: the numbers do not run 1..n over the group's rows`)
    for (const g of STEP_GROUPS) {
      const present = g.members.filter((id) => items.some((i) => i.id === id))
      present.forEach((id, at) => assert.equal(numbers.get(id), at + 1, `${name}/${id}: not its place among the group's rows`))
    }
    // And a filtered tab does not renumber: the gaps are the rows the tab left out.
    for (const tab of LANES) {
      for (const g of groupsFor(tab, applyFocus(items, tab, NO_FOCUS))) {
        for (const i of g.items) assert.equal(numbers.get(i.id), rowNumbersOf(items).get(i.id), `${name}/${tab}/${i.id}: the tab renumbered the row`)
      }
    }
    // The premise this exists for: at least one tab shows a gap.
    const gapped = LANES.some((tab) => groupsFor(tab, applyFocus(items, tab, NO_FOCUS)).some((g) => g.items.some((i, at) => at > 0 && numbers.get(i.id)! !== numbers.get(g.items[at - 1].id)! + 1)))
    assert.ok(gapped, `${name}: no filtered tab showed a gap, so this proves nothing`)
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
  // Through the one board construction every surface reads (R4-22: the Export
  // page built its own readings without the Cleanup rows and stated other lanes).
  assert.match(plan, /const \{ readings, titleOf, cleanupRows \} = boardReadingsOf\(c\.steps, /, 'the Plan no longer reads the engine for its lanes')
  assert.match(plan, /lane: reading\.lane,/, 'a row carries a lane the engine did not read')
  assert.match(plan, /const laneView = laneViewOf\(reading, titleOf\)/, 'the board no longer reads the one lane view')
  assert.equal(plan.includes('planStateOf('), false, 'the Plan reads the legacy presentation state beside the lane (A1b)')
  assert.equal(plan.includes('phaseRows('), false, 'the Plan still groups by phase')
  assert.equal(plan.includes('undatedRows('), false, 'the Plan still draws the undated group')
})

test('the row label is Lane · substatus or reason, from one function', () => {
  const titleOf = (id: string): string | null => (id === 's-prereq-break-glass' ? 'Emergency Access Accounts' : null)
  const ready = { lane: 'Ready' as const, substatus: 'Observing' as const, reason: null, blockers: [], gates: [], order: 0, fromEngine: true }
  assert.equal(laneLabelOf(ready, titleOf), 'Ready · Review')
  // The wait while report-only collects evidence is On Hold, in the lane's own word for watching.
  const collecting = { lane: 'On Hold' as const, substatus: null, reason: { kind: 'evidence' as const, id: 'evidence:observation', milestone: null, condition: null, abnormal: false, ordinal: 1 }, blockers: [], gates: [], order: 0, fromEngine: true }
  assert.equal(laneLabelOf(collecting, titleOf), 'On Hold')
  const blocker = { kind: 'step' as const, id: 's-prereq-break-glass', milestone: null, condition: null, abnormal: false, ordinal: 5 }
  const upNext = { lane: 'Up Next' as const, substatus: null, reason: blocker, blockers: [blocker], gates: [], order: 0, fromEngine: true }
  assert.equal(laneLabelOf(upNext, titleOf), 'Up Next')
  const held = { lane: 'On Hold' as const, substatus: null, reason: { ...blocker, kind: 'sourceMapping' as const, id: 'sourceMapping:62d67e66', abnormal: true }, blockers: [], gates: [], order: 0, fromEngine: true }
  assert.equal(laneLabelOf(held, titleOf), 'On Hold')
  assert.equal(waitingForOf(held, titleOf), BOARD.blockers.sourceMapping, 'the held row names the unmapped reference')
  const heldOnStep = { ...held, reason: { ...blocker, abnormal: true } }
  assert.equal(laneLabelOf(heldOnStep, titleOf), 'On Hold')
  assert.equal(waitingForOf(heldOnStep, titleOf), BOARD.blockers.step + ': Emergency Access Accounts', 'a prerequisite on hold names the step by title')
  // A deeper healthy prerequisite holds without anything abnormal, and reads as the wait it is.
  const heldBehind = { ...held, reason: blocker }
  assert.equal(laneLabelOf(heldBehind, titleOf), 'On Hold')
  assert.equal(waitingForOf(heldBehind, titleOf), 'After Emergency Access Accounts', 'a healthy prerequisite names the step to go and do')
  assert.equal(laneLabelOf({ ...ready, lane: 'Completed', substatus: null }, titleOf), BOARD.lanes.completed)
  assert.equal(laneLabelOf({ ...ready, lane: 'Deferred', substatus: null }, titleOf), BOARD.lanes.deferred)
  for (const name of FIXTURES) {
    for (const i of itemsFor(name)) {
      assert.ok(i.laneLabel.startsWith(BOARD.lanes[TAB_OF[i.lane] ?? (i.lane === 'Completed' ? 'completed' : 'deferred')]), `${name}/${i.id}: "${i.laneLabel}" does not lead with its lane`)
      if (i.lane === 'Ready') assert.match(i.laneLabel, / · /, `${name}/${i.id}: "${i.laneLabel}" says no substatus or reason`)
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

// -------------------------------------------------- no next pill

test('no plan row carries a "next" pill: the Ready tab’s order already says which step is next (RUN-CONTEXT-B decision 10)', () => {
  const sources = {
    'StepSections.tsx': readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8'),
    'Plan.tsx': readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'),
    'planBoard.ts': readFileSync('src/ui/surfaces/planBoard.ts', 'utf8'),
  }
  for (const [where, src] of Object.entries(sources)) {
    for (const marker of ['next-mark', 'nextLabel', 'isNext']) assert.equal(src.includes(marker), false, `${where} still carries ${marker}`)
  }
  assert.equal(readFileSync('src/ui/app.css', 'utf8').includes('.next-mark'), false, 'a style for the removed pill remains')
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    assert.ok(items.some((i) => i.lane === 'Ready'), `${name}: no Ready row, so this proves little`)
    for (const item of items) assert.equal('isNext' in item, false, `${name}/${item.id}: a board row still marks next`)
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
  for (const word of ['Held', 'Complete', 'Deferred', 'After prerequisites']) assert.notEqual(WHEN.none, word)
})

test('the board reads the timing value and never writes it: no date is recalculated', () => {
  const src = readFileSync('src/ui/surfaces/planBoard.ts', 'utf8')
  const body = bodyOf(src, 'boardWhen').replace(/\/\/[^\n]*/g, '')
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

test('a group summary counts the rows under it, and says so when a tab left some of the group elsewhere', () => {
  let filtered = 0
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const totals = groupTotalsOf(items)
    for (const tab of LANES) {
      const shown = applyFocus(items, tab, ALL)
      for (const g of [...groupsFor(tab, shown), ...asideGroupsFor(shown)]) {
        const n = g.items.length
        const total = groupKeyOf(g) !== null ? totals.get(groupKeyOf(g)!) ?? null : null
        // Never a count of anything but rows (A1b: no attention count), and
        // never its own selection presented as the whole run.
        assert.equal(groupSummary(g, total), total !== null && total > n ? `${n} of ${total} steps` : `${n} step${n === 1 ? '' : 's'}`, `${tab}/${g.key}`)
        assert.ok(g.items.length > 0, `${tab}/${g.key}: an empty group is drawn`)
        if (total !== null && total > n) filtered += 1
      }
    }
  }
  assert.ok(filtered > 0, 'no tab showed part of a group, so this proves nothing')
})

// ----------------------------------------------------------- the fourth tab

test('All work lists every unfinished group whole, in registry order, with every one of its rows', () => {
  for (const name of [...FIXTURES, 'demo-week2'] as const) {
    const items = itemsFor(name)
    const drawn = allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), { completed: false, open: null })
    const registry = STEP_GROUPS.map((g) => g.key)
    const keyOf = (g: (typeof drawn.active)[number]): string => g.key.slice(`${ALL_WORK_TAB}-`.length)
    // Registry order, and every group on the board that still has work in it.
    assert.deepEqual(drawn.active.map(keyOf), drawn.active.map(keyOf).slice().sort((a, b) => registry.indexOf(a) - registry.indexOf(b)), `${name}: the groups are not in the registry's order`)
    for (const g of drawn.active) {
      const key = keyOf(g)
      // The WHOLE group: every row of it the board has, no lane filtering inside.
      assert.deepEqual(ids(g.items).sort(), ids(items.filter((i) => groupOf(i.id)?.key === key)).sort(), `${name}/${key}: the tab left a row of the group out`)
      assert.ok(g.items.some((i) => i.lane !== 'Completed'), `${name}/${key}: an entirely complete group is in the list`)
      assert.equal(g.progress, true, `${name}/${key}: the group does not read as a whole group`)
    }
    // Nothing is lost and nothing is drawn twice: active plus completed is the board.
    const everywhere = [...drawn.active, ...allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), { completed: true, open: null }).completed].flatMap((g) => ids(g.items))
    assert.equal(everywhere.length, new Set(everywhere).size, `${name}: a row is drawn twice`)
    assert.deepEqual([...everywhere].sort(), ids(items).sort(), `${name}: the tab and the row set disagree`)
    // An entirely complete group is out of the list and under the completed fold,
    // revealed by Show completed or by holding the open step — the board's own
    // mechanism for finished work, not a second one.
    const complete = STEP_GROUPS.map((g) => g.key).filter((key) => { const mine = items.filter((i) => groupOf(i.id)?.key === key); return mine.length > 0 && mine.every((i) => i.lane === 'Completed') })
    assert.deepEqual(drawn.completed, [], `${name}: a finished group is folded away with Show completed off`)
    const asked = allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), { completed: true, open: null })
    assert.deepEqual(asked.completed.map((g) => g.key), complete.map((key) => `${ALL_WORK_TAB}-${key}-complete`), `${name}: Show completed did not reveal the finished groups`)
    for (const g of asked.completed) assert.equal(g.secondary, true, `${name}/${g.key}: a finished group is not drawn as an aside`)
    for (const key of complete) {
      const held = allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), { completed: false, open: items.find((i) => groupOf(i.id)?.key === key)!.id })
      assert.deepEqual(held.completed.map((g) => g.key), [`${ALL_WORK_TAB}-${key}-complete`], `${name}/${key}: opening a step of a finished group did not unfold it`)
    }
  }
})

test('All work does not renumber: a row keeps its place in its group, and the numbers run with no gap', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const numbers = rowNumbersOf(items)
    for (const g of allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), { completed: true, open: null }).active) {
      const seen = g.items.map((i) => numbers.get(i.id)!)
      assert.deepEqual(seen, seen.map((_, at) => at + 1), `${name}/${g.key}: the whole group does not read 1..n`)
    }
  }
})

test('the tab reads how much of each group is done, in the words content.json holds', () => {
  const g = { key: 'k', label: 'K', secondary: false, closed: false, progress: true, items: [
    { id: 'a', title: 'a', lane: 'Completed' as const, laneLabel: 'Completed', workType: 'setup' as const, order: 0 },
    { id: 'b', title: 'b', lane: 'Completed' as const, laneLabel: 'Completed', workType: 'setup' as const, order: 1 },
    { id: 'c', title: 'c', lane: 'Ready' as const, laneLabel: 'Ready', workType: 'setup' as const, order: 2 },
  ] }
  assert.equal(groupSummary(g), '2 of 3 completed')
  // A lane tab's group still counts rows, not progress: the two lines are the
  // same mechanism answering the two different questions a heading can be asked.
  assert.equal(groupSummary({ ...g, progress: false }, 6), '3 of 6 steps')
  assert.equal(BOARD.allWorkTab, 'All work')
})

test('the fourth tab shows every lane and neither toggle hides a row inside a group', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    // Nothing a lane tab or a toggle would drop: All work is the whole row set.
    assert.deepEqual(ids(applyFocus(items, ALL_WORK_TAB, NO_FOCUS)).sort(), ids(items).sort(), `${name}: the fourth tab filtered by lane`)
    assert.deepEqual(ids(applyFocus(items, ALL_WORK_TAB, ALL)).sort(), ids(items).sort(), `${name}: the toggles changed what the fourth tab shows`)
    // Search and work type are still filters over it.
    for (const i of applyFocus(items, ALL_WORK_TAB, { ...NO_FOCUS, workType: 'ca' })) assert.equal(i.workType, 'ca', `${name}/${i.id}: the Work type filter let another kind through`)
    assert.deepEqual(applyFocus(items, ALL_WORK_TAB, { ...NO_FOCUS, search: 'zzzzz-not-a-title' }), [], `${name}: search matched something no title contains`)
  }
})

test('the board vocabulary is one record, and Ready is the default tab', () => {
  assert.deepEqual([...LANES], ['ready', 'upNext', 'onHold'], 'the tab order moved')
  assert.deepEqual([...TABS], ['ready', 'upNext', 'onHold', ALL_WORK_TAB], 'the four tabs moved')
  assert.equal(LANES[0], 'ready', 'Ready is no longer the default')
  assert.deepEqual(Object.values(BOARD.lanes), ['Ready', 'Up Next', 'On Hold', 'Completed', 'Deferred', "Doesn't apply"])
  assert.deepEqual(Object.keys(BOARD.type), TYPE_ORDER, 'the work-type labels and the work-type order disagree')
  assert.equal(BOARD.showCompleted, 'Show completed')
  assert.equal(BOARD.showDeferred, 'Show deferred')
  // The five zones are named: the group position leads, and the two on the
  // right say what they hold — Impact is a population and When is a date.
  assert.deepEqual(Object.values(BOARD.columns), ['#', 'State', 'Step', 'Impact', 'When'])
  const tabs: LaneTab[] = ['ready', 'upNext', 'onHold']
  for (const t of tabs) assert.ok(BOARD.lanes[t])
})

// An empty Ready tab that says what it means.
//
// "Nothing in this lane." was read on a board whose counts were
// byte-identical across three scans three weeks apart. It is true and it is
// not an answer: a reader who has done everything they can do needs to be
// told that is what they are looking at, what the rest waits on, and that
// declining a step is theirs to do.
test('an empty Ready tab with work left elsewhere says so, and where nothing is left it does not', () => {
  const none = { ready: 0, upNext: 3, onHold: 9 }
  const said = nothingReadyLine('ready', none)
  assert.ok(said, 'an empty Ready tab beside twelve waiting rows says nothing')
  assert.match(said, /12 steps are/)
  assert.match(said, /Doesn't apply here/, 'the reader is not told the one thing that is theirs to do')

  // One waiting row reads as one.
  assert.match(String(nothingReadyLine('ready', { ready: 0, upNext: 0, onHold: 1 })), /1 step is/)

  // Never where the board has work to offer, never on another tab, and never
  // on a plan with nothing left at all.
  assert.equal(nothingReadyLine('ready', { ready: 2, upNext: 3, onHold: 9 }), null)
  assert.equal(nothingReadyLine('onHold', none), null)
  assert.equal(nothingReadyLine('upNext', none), null)
  assert.equal(nothingReadyLine('ready', { ready: 0, upNext: 0, onHold: 0 }), null)
})
