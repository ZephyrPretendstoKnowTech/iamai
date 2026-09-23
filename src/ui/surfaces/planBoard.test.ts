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
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { contentStepFor, contentTitle } from '../../content/stepTitle.ts'
import { directionWords, pages, stepById } from '../../content/content.ts'
import { laneReadings } from './planLanes.ts'
import { fillText } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { STEP_GROUPS, groupOf } from '../../roadmap/stepGroups.ts'
import {
  ALL_WORK_TAB,
  BOARD,
  DEFAULT_TAB,
  LANES,
  TABS,
  allWorkGroups,
  NO_FOCUS,
  SUBSTATUS_WORD,
  TAB_OF,
  TYPE_ORDER,
  WHEN,
  applyFocus,
  asideGroupsFor,
  boardWhen,
  boardWhenOf,
  drawsCompact,
  finishedDayOf,
  laneViewOf,
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
  rowNumbersOf,
  sectionProgressOf,
  tileSections,
  readyToCreateOf,
  boardOf,
  followOpenStep,
  followLaneChange,
  groupClosed,
  pressKeyOf,
  releaseFor,
  togglesOf,
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

const row = (id: string, lane: BoardItem['lane']): BoardItem => ({ id, title: id, lane, laneLabel: lane, workType: 'setup', order: 0 })

test('with Emergency Access finished, section 1 stays first and collapses to one line: its title and "All 4 completed"', () => {
  // Owner, roadmap flow V2 decision B: sections never move. A finished section
  // is not lifted above the tabs while open and sunk below them once done; it
  // keeps its place and folds to its title and one line.
  const items = [...EMERGENCY_STEP_IDS.map((id) => row(id, 'Completed')), row('s-direction-use', 'Ready'), row('s-direction-accounts', 'Completed'), row('s-goal-block-legacy-auth', 'Up Next')]
  const drawn = allWorkGroups(items, items)
  assert.deepEqual(drawn.map((g) => g.key), [`${ALL_WORK_TAB}-emergency-access`, `${ALL_WORK_TAB}-direction`, `${ALL_WORK_TAB}-close-doors`], 'a section moved')
  const [emergency, direction] = drawn
  assert.equal(emergency.closed, true, 'the finished section is drawn open')
  assert.equal(emergency.label, groupTitleOf(STEP_GROUPS[0], true))
  assert.equal(groupSummary(emergency), 'All 4 completed')
  assert.deepEqual(ids(emergency.items), [...EMERGENCY_STEP_IDS], 'the collapsed section lost its rows: selecting it opens them')
  // An open section says what is left of it.
  assert.equal(direction.closed, false)
  assert.equal(groupSummary(direction), '1 of 2 remaining')
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
  assert.match(plan, /const board = boardOf\(c\.steps, cleanupPhase, answers\)\n\s*const \{ readings, titleOf, cleanupRows, prerequisiteLabel, enforceWaits \} = board/, 'the Plan no longer reads the engine for its lanes')
  // Its rows are built once, on the engine's readings (planBoard.ts boardOf).
  const producer = readFileSync('src/ui/surfaces/planBoard.ts', 'utf8')
  assert.match(producer, /lane: reading\.lane,/, 'a row carries a lane the engine did not read')
  assert.match(producer, /const lane = laneViewOf\(reading, titleOf\)/, 'the board no longer reads the one lane view')
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

test('All work draws every section in its registry place, whole, and a finished one collapsed there', () => {
  for (const name of [...FIXTURES, 'demo-week2'] as const) {
    const items = itemsFor(name)
    const drawn = allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), items)
    const registry = STEP_GROUPS.map((g) => g.key)
    const keyOf = (g: (typeof drawn)[number]): string => g.key.slice(`${ALL_WORK_TAB}-`.length)
    // Registry order, each section once, and every section the board has rows for.
    assert.deepEqual(drawn.map(keyOf), registry.filter((key) => items.some((i) => groupOf(i.id)?.key === key)), `${name}: a section moved, or is missing`)
    for (const g of drawn) {
      const key = keyOf(g)
      const mine = items.filter((i) => groupOf(i.id)?.key === key)
      // The WHOLE section: every row of it the board has, no lane filtering inside.
      assert.deepEqual(ids(g.items).sort(), ids(mine).sort(), `${name}/${key}: the tab left a row of the section out`)
      const finished = mine.every((i) => i.lane === 'Completed' || i.lane === 'Deferred')
      assert.equal(g.closed, finished, `${name}/${key}: ${finished ? 'a finished section is drawn open' : 'a section with work left is collapsed'}`)
      assert.equal(g.label, groupTitleOf(STEP_GROUPS.find((x) => x.key === key)!, finished), `${name}/${key}: not the section's own title`)
      assert.match(groupSummary(g), finished ? /^(All \d+ completed|1 of 1 completed|\d+ of \d+ completed, \d+ deferred)$/ : /^\d+ of \d+ remaining$/, `${name}/${key}`)
    }
    // Nothing is lost and nothing is drawn twice.
    const everywhere = drawn.flatMap((g) => ids(g.items))
    assert.equal(everywhere.length, new Set(everywhere).size, `${name}: a row is drawn twice`)
    assert.deepEqual([...everywhere].sort(), ids(items).sort(), `${name}: the tab and the row set disagree`)
  }
  // The premise: some fixture finishes a section, so a collapsed one is drawn at all.
  const week2 = itemsFor('demo-week2')
  assert.ok(allWorkGroups(week2, week2).some((g) => g.closed), 'no fixture finished a section, so this proves little')
})

test('All work does not renumber: a row keeps its place in its section, and the numbers run with no gap', () => {
  for (const name of FIXTURES) {
    const items = itemsFor(name)
    const numbers = rowNumbersOf(items)
    for (const g of allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), items)) {
      const seen = g.items.map((i) => numbers.get(i.id)!)
      assert.deepEqual(seen, seen.map((_, at) => at + 1), `${name}/${g.key}: the whole section does not read 1..n`)
    }
  }
})

test('a section heading on All work says what is left, and a finished one what became of it, in the words content.json holds', () => {
  const g = (lanes: BoardItem['lane'][]) => {
    const items = lanes.map((lane, at) => ({ ...row(`s-goal-block-${at}`, lane), order: at }))
    return { key: 'k', label: 'K', secondary: false, closed: false, progress: sectionProgressOf(items).get('ongoing')!, items }
  }
  assert.equal(groupSummary(g(['Completed', 'Completed', 'Ready'])), '1 of 3 remaining')
  assert.equal(groupSummary(g(['Completed', 'Deferred', 'On Hold', 'Up Next', 'Ready', 'Completed'])), '3 of 6 remaining', 'a deferred row is not left to do')
  assert.equal(groupSummary(g(['Completed', 'Completed', 'Completed'])), 'All 3 completed')
  assert.equal(groupSummary(g(['Completed'])), '1 of 1 completed')
  assert.equal(groupSummary(g(['Completed', 'Deferred', 'Completed'])), '2 of 3 completed, 1 deferred')
  // The count is the section's, over the whole board: a filter that leaves one
  // row of it does not change what the heading says is left.
  const whole = g(['Completed', 'Ready', 'Ready'])
  assert.equal(groupSummary({ ...whole, items: whole.items.slice(1, 2) }), '2 of 3 remaining')
  // A lane tab's group still counts rows, not progress: the two lines answer the
  // two different questions a heading can be asked.
  const { progress: _p, ...filtered } = g(['Completed', 'Completed', 'Ready'])
  assert.equal(groupSummary(filtered, 6), '3 of 6 steps')
  assert.equal(BOARD.allWorkTab, 'All work')
})

test('Show completed and Show deferred start pressed on All work, and turning one off hides that work there; a lane tab keeps them off until pressed', () => {
  // Owner, roadmap flow V2: the two toggles stay until the finished product has
  // been seen. All work shows finished work in its sections by default, and a
  // toggle turned off hides it; a lane tab keeps its own behaviour, the
  // finished work drawn after the panel only while a toggle is pressed.
  assert.deepEqual(togglesOf(NO_FOCUS, ALL_WORK_TAB), { completed: true, deferred: true }, 'All work does not show finished work by default')
  for (const tab of LANES) assert.deepEqual(togglesOf(NO_FOCUS, tab), { completed: false, deferred: false }, `${tab} shows finished work by default`)
  // A press is the person's, and it holds whichever tab is showing.
  assert.deepEqual(togglesOf({ ...NO_FOCUS, showCompleted: false }, ALL_WORK_TAB), { completed: false, deferred: true })
  assert.deepEqual(togglesOf({ ...NO_FOCUS, showDeferred: true }, 'ready'), { completed: false, deferred: true })
  let finished = 0
  for (const name of [...FIXTURES, 'demo-week2'] as const) {
    const items = itemsFor(name)
    finished += items.filter((i) => i.lane === 'Completed' || i.lane === 'Deferred').length
    // Unpressed by anyone, All work is the whole row set.
    assert.deepEqual(ids(applyFocus(items, ALL_WORK_TAB, NO_FOCUS)).sort(), ids(items).sort(), `${name}: All work filtered by lane`)
    // Turned off, each toggle hides its own work and nothing else.
    assert.deepEqual(ids(applyFocus(items, ALL_WORK_TAB, { ...NO_FOCUS, showCompleted: false })).sort(), ids(items.filter((i) => i.lane !== 'Completed')).sort(), `${name}: Show completed off did not hide exactly the completed rows`)
    assert.deepEqual(ids(applyFocus(items, ALL_WORK_TAB, { ...NO_FOCUS, showDeferred: false })).sort(), ids(items.filter((i) => i.lane !== 'Deferred')).sort(), `${name}: Show deferred off did not hide exactly the deferred rows`)
    // A section whose rows were all completed is not drawn with Show completed off.
    const hidden = allWorkGroups(applyFocus(items, ALL_WORK_TAB, { ...NO_FOCUS, showCompleted: false }), items)
    for (const g of hidden) assert.ok(g.items.every((i) => i.lane !== 'Completed'), `${name}/${g.key}: a completed row is drawn with Show completed off`)
    // Search and work type are still filters over it.
    for (const i of applyFocus(items, ALL_WORK_TAB, { ...NO_FOCUS, workType: 'ca' })) assert.equal(i.workType, 'ca', `${name}/${i.id}: the Work type filter let another kind through`)
    assert.deepEqual(applyFocus(items, ALL_WORK_TAB, { ...NO_FOCUS, search: 'zzzzz-not-a-title' }), [], `${name}: search matched something no title contains`)
  }
  assert.ok(finished > 0, 'no fixture has finished work, so this proves little')
  // The controls say the state the board is drawn with, not the saved press alone.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const shows = togglesOf\(focus, tab\)/, 'the toggles do not read the tab\'s default')
  assert.match(plan, /aria-pressed=\{shows\.completed\}/)
  assert.match(plan, /aria-pressed=\{shows\.deferred\}/)
})

test('a step opened from a link or a tile stays on the tab that shows it, and otherwise opens on All work in its own section', () => {
  // Owner, roadmap flow V2: a link used to switch the board to the step's own
  // lane tab. Now it keeps the view the person chose when the step is on it,
  // and otherwise goes to All work, where every row is, with the step's
  // section open.
  const items = itemsFor('demo-week2')
  const ready = items.find((i) => i.lane === 'Ready')!
  const held = items.find((i) => i.lane === 'On Hold' || i.lane === 'Up Next')!
  const done = items.find((i) => i.lane === 'Completed')!
  assert.ok(ready && held && done, 'the premise: the Follow-up demo has Ready, waiting and completed rows')
  // On the tab that shows it: stay.
  assert.equal(followOpenStep(ready.id, applyFocus(items, 'ready', NO_FOCUS)), null, 'a link to a Ready step moved the Ready tab')
  assert.equal(followOpenStep(held.id, applyFocus(items, ALL_WORK_TAB, NO_FOCUS)), null, 'a link moved All work')
  assert.equal(followOpenStep(done.id, applyFocus(items, 'ready', { ...NO_FOCUS, showCompleted: true })), null, 'a completed step drawn after the Ready panel moved the tab')
  // Not on it: All work, whatever lane the step is in.
  assert.equal(followOpenStep(held.id, applyFocus(items, 'ready', NO_FOCUS)), ALL_WORK_TAB, 'a link to a waiting step kept Ready, which does not show it')
  assert.equal(followOpenStep(done.id, applyFocus(items, 'onHold', NO_FOCUS)), ALL_WORK_TAB)
  assert.equal(followOpenStep(done.id, applyFocus(items, ALL_WORK_TAB, { ...NO_FOCUS, showCompleted: false })), ALL_WORK_TAB, 'a completed step hidden by the toggle stayed hidden')
  // There, with the focus cleared, the step is drawn in its own section, and
  // that section is open even where it is finished and would otherwise fold.
  for (const target of [held, done]) {
    const drawn = allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), items)
    const section = drawn.find((g) => g.items.some((i) => i.id === target.id))
    assert.ok(section, `${target.id}: All work does not draw the step`)
    assert.equal(groupKeyOf(section), groupOf(target.id)!.key, `${target.id}: drawn outside its own section`)
    assert.equal(groupClosed(section, target.id, undefined, false), false, `${target.id}: its section stays folded over it`)
    assert.equal(groupClosed({ ...section, closed: true }, target.id, undefined, false), false, 'a finished section folds over the open step')
  }
  // A finished section folds unless something opens it: the open step, a
  // search, or the person's own press, which outranks both while it stands —
  // folding the section of the step one is reading folds it.
  const finished = allWorkGroups(items, items).find((g) => g.closed)!
  assert.ok(finished, 'the premise: the Follow-up demo has a finished section')
  assert.equal(groupClosed(finished, null, undefined, false), true)
  assert.equal(groupClosed(finished, null, undefined, true), false, 'a search matched rows in a section nobody can see')
  assert.equal(groupClosed(finished, finished.items[0].id, true, false), true, 'the person\'s press did not outrank the step they had open')
  // A link or a tile lets go of that press (releaseFor): it asks to see the
  // step, and a step opened inside a section the person folded opened out of
  // sight — the row read expanded inside a hidden block, and the page could
  // not move to it. Only the press over that step goes; every other stays.
  const drawnAll = allWorkGroups(applyFocus(items, ALL_WORK_TAB, NO_FOCUS), items)
  const section = drawnAll.find((g) => g.items.some((i) => i.id === held.id))!
  const other = drawnAll.find((g) => g !== section)!
  const onReady = groupsFor('ready', applyFocus(items, 'ready', NO_FOCUS))[0]
  const pressed = { [pressKeyOf(ALL_WORK_TAB, section)]: true, [pressKeyOf(ALL_WORK_TAB, other)]: true, [pressKeyOf('ready', onReady)]: true }
  assert.equal(groupClosed(section, held.id, pressed[pressKeyOf(ALL_WORK_TAB, section)], false), true, 'the premise: the person folded the section that holds the step')
  const released = releaseFor(pressed, held.id, drawnAll.map((g) => [ALL_WORK_TAB, g] as const))
  assert.equal(groupClosed(section, held.id, released[pressKeyOf(ALL_WORK_TAB, section)], false), false, 'a link opened a step inside a section the person folded, out of sight')
  assert.equal(released[pressKeyOf(ALL_WORK_TAB, other)], true, 'a link unfolded a section that does not hold the step')
  assert.equal(released[pressKeyOf('ready', onReady)], true, 'a link unfolded a section under another tab')
  // The same on a lane tab and in its aside: the press is let go under the view that draws the step.
  const readyRow = onReady.items[0]
  assert.equal(releaseFor({ [pressKeyOf('ready', onReady)]: true }, readyRow.id, [['ready', onReady]])[pressKeyOf('ready', onReady)], undefined)
  const aside = asideGroupsFor(applyFocus(items, 'ready', { ...NO_FOCUS, showCompleted: true })).find((g) => g.items.some((i) => i.id === done.id))!
  assert.equal(releaseFor({ [pressKeyOf('aside', aside)]: true }, done.id, [['aside', aside]])[pressKeyOf('aside', aside)], undefined)
  // The Plan wires it: the rows the view draws decide, the switch goes to All
  // work with the focus cleared, and the page moves to the step. A link on the
  // view that draws it lets go of the fold over it, and the page moves to the
  // row only once it is out from under a folded section.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const follow = open !== null \? followOpenStep\(open, shown\) : null/)
  assert.match(plan, /setTab\(follow\); setFocus\(NO_FOCUS\); setToggled\(\{\}\); moveTo\.current = open/)
  assert.match(plan, /const closed = groupClosed\(g, open, toggled\[key\], focusActive\(focus\)\)/)
  assert.match(plan, /const key = pressKeyOf\(scope, g\)/, 'a fold is kept under a key of its own making')
  assert.match(plan, /setToggled\(\(t\) => releaseFor\(t, open, drawn\)\)/, 'a link does not let go of the fold over its step')
  assert.match(plan, /if \(!row \|\| row\.closest\('\[hidden\]'\) !== null\) return/, 'the page moves to a row still folded out of sight, which moves nothing')
  assert.equal(plan.includes('const openTab'), false, 'a link still switches to the step\'s lane tab')
})

test('a step finished, deferred or moved while open keeps the tab the person is on, and presses the toggle that shows it', () => {
  // Before roadmap flow V2, finishing the open step on a lane tab kept the
  // person on that tab and pressed Show completed, so the step was drawn after
  // the panel. Stage 1 sent the whole board to All work instead, with the
  // search, the work type and every fold cleared, so someone working through
  // Ready was taken off it after each completion. A link still follows
  // followOpenStep; a lane change under the person does not.
  const items = itemsFor('demo-week2')
  const ready = items.find((i) => i.lane === 'Ready')!
  assert.ok(ready, 'the premise: the Follow-up demo has a Ready row')
  const as = (lane: BoardItem['lane']): BoardItem[] => items.map((i) => (i.id === ready.id ? { ...i, lane } : i))
  const search = { ...NO_FOCUS, search: ready.title.slice(0, 4) }
  // Finished on Ready: Ready stays, Show completed is pressed, the search stays, and the step is drawn after the panel.
  const done = followLaneChange('Completed', 'ready', search)
  assert.equal(done.tab, 'ready', 'finishing the open step took the person off Ready')
  assert.equal(done.focus.showCompleted, true, 'the finished step is not shown')
  assert.equal(done.focus.search, search.search, 'finishing a step cleared the search')
  assert.ok(asideGroupsFor(applyFocus(as('Completed'), done.tab, done.focus)).some((g) => g.items.some((i) => i.id === ready.id)), 'the finished step is not drawn after the Ready panel')
  // Deferred the same way, under its own toggle.
  const deferred = followLaneChange('Deferred', 'ready', NO_FOCUS)
  assert.deepEqual([deferred.tab, deferred.focus.showDeferred, deferred.focus.showCompleted], ['ready', true, null])
  assert.ok(applyFocus(as('Deferred'), deferred.tab, deferred.focus).some((i) => i.id === ready.id))
  // Moved to another lane on a lane tab: that lane's tab, as before.
  assert.equal(followLaneChange('Up Next', 'ready', NO_FOCUS).tab, 'upNext')
  assert.equal(followLaneChange('On Hold', 'upNext', NO_FOCUS).tab, 'onHold')
  // On All work with Show completed turned off, finishing the step presses it again and stays.
  const off = followLaneChange('Completed', ALL_WORK_TAB, { ...NO_FOCUS, showCompleted: false })
  assert.deepEqual([off.tab, off.focus.showCompleted], [ALL_WORK_TAB, true])
  assert.ok(applyFocus(as('Completed'), off.tab, off.focus).some((i) => i.id === ready.id))
  // The Plan wires it: a change of lane alone, not from a link, keeps the view
  // where that draws the step, and goes to All work only where it cannot.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const moved = open !== null && open === was\.current && !linked\.current/, 'a lane change is not told from a newly opened step')
  assert.match(plan, /if \(follow !== null\) \{ if \(moved\) onMoved\(\); else onFollow\(follow\) \}/)
  assert.match(plan, /const keep = lane !== undefined && summaryFilter === null \? followLaneChange\(lane, tab, focus\) : null/)
  assert.match(plan, /applyFocus\(items, keep\.tab, keep\.focus\)\.some\(\(i\) => i\.id === open\)\) \{ setTab\(keep\.tab\); setFocus\(keep\.focus\) \} else onFollow\(ALL_WORK_TAB\)/)
})

test('a row press is never a link, so it does not move the page to its row', () => {
  // A hash link to the step already open changes nothing, so the effect that
  // reads and clears `linked` never ran; the next ordinary row press then read
  // as a link and scrolled the page to that row. A row press clears it first.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const openStep = \(id: string \| null\): void => \{\s*linked\.current = false/, 'a row press after a link to the open step reads as a link')
})

test('a header tile draws one list in section order: each section heading once, and each row once', () => {
  // The Needs your input, Observing and Completed tiles filter the one list.
  // They used to draw it lane by lane, so a section with rows in three lanes
  // read its heading three times, and the Completed rows sat loose after it.
  let spread = 0
  for (const name of [...FIXTURES, 'demo-week2'] as const) {
    const items = itemsFor(name)
    const picks: Record<string, BoardItem[]> = { all: items, completed: items.filter((i) => i.lane === 'Completed'), alternate: items.filter((_, at) => at % 2 === 0) }
    for (const [pick, rows] of Object.entries(picks)) {
      const drawn = tileSections(rows)
      const keys = drawn.map((g) => groupKeyOf(g))
      assert.equal(new Set(keys).size, keys.length, `${name}/${pick}: a section heading is drawn twice`)
      const registry = STEP_GROUPS.map((g) => g.key)
      assert.deepEqual(keys, [...keys].sort((x, y) => registry.indexOf(x!) - registry.indexOf(y!)), `${name}/${pick}: the sections are not in registry order`)
      const seen = drawn.flatMap((g) => ids(g.items))
      assert.equal(seen.length, new Set(seen).size, `${name}/${pick}: a row is drawn twice`)
      assert.deepEqual([...seen].sort(), ids(rows).sort(), `${name}/${pick}: the tile lost or added a row`)
      for (const g of drawn) assert.equal(g.label, groupTitleOf(STEP_GROUPS.find((x) => x.key === groupKeyOf(g))!, false), `${name}/${g.key}: not the section's own title`)
    }
    // The premise: a section with rows in more than one lane, which lane by lane drew twice.
    spread += STEP_GROUPS.filter((g) => new Set(items.filter((i) => groupOf(i.id)?.key === g.key).map((i) => i.lane)).size > 1).length
  }
  assert.ok(spread > 0, 'no section spans two lanes, so this proves nothing')
  // The Plan draws a tile's view through it, with nothing loose after the list.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const groups = summaryFilter \? tileSections\(shown\)/, 'a tile does not draw the one list')
  assert.equal(plan.includes('LANES.flatMap('), false, 'a tile still draws the list lane by lane')
  assert.match(plan, /const aside = summaryFilter \|\| laneTab === null \? \[\] : asideGroupsFor\(shown\)/, 'a tile still draws finished rows loose after the list')
})

test('a Completed or Deferred row is one compact line: number, title, its lane word and the day where one was recorded', () => {
  // Owner, roadmap flow V2: finished work shrinks in place. The row keeps its
  // number, its title and its lane word, and says the day it was completed or
  // deferred when the plan recorded one; who it touches, the tenant chip and a
  // reason line are for work still to do. Selecting it opens the step as before.
  for (const lane of ['Completed', 'Deferred'] as const) assert.equal(drawsCompact(lane), true, lane)
  for (const lane of ['Ready', 'Up Next', 'On Hold'] as const) assert.equal(drawsCompact(lane), false, lane)
  const r = runFixture(fixture('demo-week2'))
  const readings = laneReadings(r.steps)
  const done = r.steps.find((s) => readings.get(s.id)?.lane === 'Completed' && s.history.some((h) => h.to === 'done'))
  assert.ok(done, 'the premise: the Follow-up demo has a step completed on a recorded day')
  const at = done.manualReview?.confirmedAt ?? done.history.filter((h) => h.to === 'done').at(-1)!.at
  assert.equal(finishedDayOf(done, 'Completed'), absoluteDate(at), 'a completed row does not say the day it was completed')
  // The same day the When column has always read for it (boardWhenOf), from one reading.
  assert.equal(boardWhenOf(done, null, laneViewOf(readings.get(done.id)!, () => null)), absoluteDate(at))
  const skipped = { ...done, manualReview: undefined, history: [...done.history, { at: '2026-09-22T12:00:00.000Z', from: 'ready' as const, to: 'skipped' as const, note: 'not now' }] }
  assert.equal(finishedDayOf(skipped, 'Deferred'), absoluteDate('2026-09-22T12:00:00.000Z'), 'a deferred row does not say the day it was deferred')
  // No recorded day: the line says none rather than a word in its place.
  assert.equal(finishedDayOf({ ...done, manualReview: undefined, history: [] }, 'Completed'), null)
  assert.equal(finishedDayOf(done, 'Ready'), null, 'work still to do has no finished day')
  // The Plan draws every step row and every Cleanup row through the one compact rule.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.equal(plan.match(/compact=\{drawsCompact\(lane(View)?\.lane\)\}/g)?.length, 2, 'a row kind decides its own shape')
  const row = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
  assert.match(row, /data-compact=\{compact \|\| undefined\}/, 'the compact row is not marked for its style')
  assert.match(row, /\{!compact && <span className="who">/, 'a compact row still says who it touches')
})

test('the how-to starts at the top of All work, says every Ready · Create policy can be created in report-only once the first two sections are done, and turns each on by its own row, not its section', () => {
  // Owner, roadmap flow V2 decision H: the plan already lets every policy that
  // can be written be created in report-only on the same day, and only the
  // turn-on is ordered. A top-to-bottom All work view would make it look
  // sequential, so the how-to says it.
  const howTo = (pages.plan as unknown as { howTo: Record<string, unknown> }).howTo
  const intro = String(howTo.intro)
  assert.match(intro, /^Start at the top of All work\b/, 'the how-to still starts somewhere else')
  assert.ok(intro.includes(`${BOARD.lanes.ready} · ${SUBSTATUS_WORD.Create}`), 'the how-to does not name the Ready · Create label a row reads')
  assert.match(intro, /first two sections/)
  assert.match(intro, /in report-only/)
  // The turn-on is the row's own reading, never its section's place: section
  // position gates nothing (roadmap flow V2 research), and a later section's
  // policy can read Ready · Ready to enforce while an earlier section is on hold.
  assert.ok(intro.includes(`${BOARD.lanes.ready} · ${SUBSTATUS_WORD['Ready to enforce']}`), 'the how-to does not say a policy is turned on when its own row reads Ready · Ready to enforce')
  assert.doesNotMatch(intro, /order[^.]*section|section[^.]*order|follows/i, 'the how-to says turning a policy on follows its section, which gates nothing')
  assert.equal(JSON.stringify(howTo).includes('Start with Ready'), false, 'a how-to line still starts with Ready')
  // One copy of the words: the intro and the legend. `items` repeated both.
  assert.equal('items' in howTo, false, 'the how-to keeps a second copy of its words')
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /<p>\{PP\.howTo\.intro\}<\/p>/)
})

test('the line above the board counts the policies ready to create in report-only, off the board, and names none', () => {
  // Owner, roadmap flow V2 decision H, tried as a visible line: it appears only
  // while there are such rows, counts the board's own Ready · Create rows of
  // Conditional Access work — never a row the board holds — and its control
  // shows exactly those rows.
  // With the first two sections settled (withFoundationSettled): until then no
  // policy is Ready (roadmap/foundations.ts), so there is nothing to count.
  let counted = 0
  for (const name of [...FIXTURES, 'demo-week2', 'small', 'mid'] as const) {
    const r = runFixture(withFoundationSettled(fixture(name)))
    const board = boardOf(r.steps, r.schedule.cleanup, r.input.mapping.breakGlassAnswers ?? null)
    const ids = readyToCreateOf(board.rows)
    const expected = board.rows.filter((row) => row.lane.lane === 'Ready' && row.lane.substatus === 'Create' && row.item.workType === 'ca').map((row) => row.item.id)
    assert.deepEqual(ids, expected, `${name}: the line counts something other than the Ready · Create policies`)
    for (const id of ids) {
      const row = board.rows.find((x) => x.item.id === id)!
      assert.equal(row.lane.lane, 'Ready', `${name}/${id}: a row the board holds is counted`)
      assert.equal((contentStepFor(row.step!) as { kind?: string } | undefined)?.kind, 'policy', `${name}/${id}: not a policy`)
    }
    counted += ids.length
  }
  assert.ok(counted > 0, 'no fixture has a policy ready to create, so this proves little')
  // The words, counted through fillText: never a hand-built plural.
  assert.equal(fillText(BOARD.createNow, { n: 12 }), '12 policies are ready to create in report-only now.')
  assert.equal(fillText(BOARD.createNow, { n: 1 }), '1 policy is ready to create in report-only now.')
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const createIds = new Set\(readyToCreateOf\(board\.rows\)\)/, 'the line does not count off the board')
  assert.match(plan, /\{createIds\.size > 0 && summaryFilter !== 'create' && \(/, 'the line is drawn where there is nothing to create')
  assert.match(plan, /summaryFilter === 'create' \? items\.filter\(\(i\) => createIds\.has\(i\.id\)\)/, 'its control shows something other than the rows it counted')
  assert.match(plan, /onClick=\{\(\) => selectSummary\('create'\)\}>\{BOARD\.createNowShow\}/)
})

test('the board vocabulary is one record, and All work is the leftmost tab and the one the Plan opens on', () => {
  // Owner, 2026-09-23 (roadmap flow V2): the default view is leftmost, as a
  // default view usually is, and the lane tabs are filters a person chooses.
  assert.deepEqual([...LANES], ['ready', 'upNext', 'onHold'], 'the lane order moved')
  assert.deepEqual([...TABS], [ALL_WORK_TAB, 'ready', 'upNext', 'onHold'], 'All work is not the leftmost tab')
  assert.equal(DEFAULT_TAB, ALL_WORK_TAB, 'the Plan does not open on All work')
  assert.match(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8'), /useState<BoardTab>\(DEFAULT_TAB\)/, 'the Plan opens on a tab of its own choosing')
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
