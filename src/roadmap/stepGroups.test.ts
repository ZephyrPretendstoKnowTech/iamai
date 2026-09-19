// The step-group registry (stepGroups.ts): Emergency Access is one entry, and a
// second entry is partitioned and drawn as its own pinned group with no code
// beyond the entry itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DIRECTION_GROUP, EMERGENCY_ACCESS_GROUP, STEP_GROUPS, anatomyOf, groupOf, isGroupMember, membersOf, pinnedGroups, usesDecisionAnatomy, usesTaskAnatomy } from './stepGroups.ts'
import type { StepGroup } from './stepGroups.ts'
import { EMERGENCY_STEP_IDS, groupTitleOf, openInActivePinnedGroup, partitionPinnedGroups, pinnedBoardGroups } from '../ui/surfaces/planBoard.ts'
import type { BoardItem } from '../ui/surfaces/planBoard.ts'
import { DECISION_HEAD, TASK_HEAD, decisionHeadingsOf, taskHeadingsOf } from '../ui/surfaces/stepHeadings.ts'

const EA_TITLE = 'pages.app.plan.groups.emergencyAccess.title'
const EA = ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings', 'cleanup-drill']
const DIRECTION = ['s-direction-use', 's-direction-accounts', 's-direction-devices', 's-direction-locations']
const item = (id: string, lane: BoardItem['lane'] = 'Ready'): BoardItem => ({ id, title: id, lane, laneLabel: lane, hold: null, workType: 'setup', order: 0 })

test('the registry lists the four Emergency Access steps in order, pinned, with the task anatomy', () => {
  assert.deepEqual(STEP_GROUPS.map((g) => g.key), [EMERGENCY_ACCESS_GROUP, DIRECTION_GROUP])
  assert.deepEqual([...membersOf(EMERGENCY_ACCESS_GROUP)], EA)
  assert.deepEqual([...EMERGENCY_STEP_IDS], EA, 'the board reads its emergency ids from the registry')
  const g = groupOf('s-prereq-exclusion-group')
  assert.equal(g?.key, EMERGENCY_ACCESS_GROUP)
  assert.equal(g?.pinned, true)
  assert.equal(groupTitleOf(g!, false), 'Establish Emergency Access')
  assert.equal(groupTitleOf(g!, true), 'Establish Emergency Access')
  assert.deepEqual(membersOf('no-such-group'), [])
})

test('groupOf, isGroupMember and usesTaskAnatomy answer by id', () => {
  for (const id of EA) {
    assert.equal(groupOf(id)?.key, EMERGENCY_ACCESS_GROUP, id)
    assert.equal(isGroupMember(id), true, id)
    assert.equal(isGroupMember(id, EMERGENCY_ACCESS_GROUP), true, id)
    assert.equal(isGroupMember(id, 'direction'), false, id)
    assert.equal(usesTaskAnatomy(id), true, id)
    assert.equal(usesDecisionAnatomy(id), false, id)
    assert.equal(anatomyOf(id), 'task', id)
    assert.equal(taskHeadingsOf(id), TASK_HEAD, id)
    assert.equal(decisionHeadingsOf(id), null, id)
  }
  for (const id of ['s-ladder-break-glass-accounts', 's-confirm-workloads', 'cleanup-alerting']) {
    assert.equal(groupOf(id), null, id)
    assert.equal(isGroupMember(id), false, id)
    assert.equal(usesTaskAnatomy(id), false, id)
    assert.equal(anatomyOf(id), null, id)
    assert.equal(taskHeadingsOf(id), null, id)
    assert.equal(decisionHeadingsOf(id), null, id)
  }
})

test("(a) Decide Your Tenant's Direction is the second pinned group: its four steps in order, with the decision anatomy", () => {
  assert.deepEqual(pinnedGroups().map((g) => g.key), [EMERGENCY_ACCESS_GROUP, DIRECTION_GROUP], 'pinned right after Emergency Access')
  assert.deepEqual([...membersOf(DIRECTION_GROUP)], DIRECTION)
  const g = groupOf('s-direction-devices')!
  assert.equal(g.key, DIRECTION_GROUP)
  assert.equal(g.pinned, true)
  assert.equal(g.anatomy, 'decision')
  assert.equal(groupTitleOf(g, false), "Decide Your Tenant's Direction")
  for (const id of DIRECTION) {
    assert.equal(usesDecisionAnatomy(id), true, id)
    assert.equal(usesTaskAnatomy(id), false, id)
    assert.equal(taskHeadingsOf(id), null, id)
    assert.deepEqual(decisionHeadingsOf(id), { why: 'About this Step', questions: 'Questions', doneWhen: 'Completion Criteria' }, id)
  }
  assert.equal(DECISION_HEAD.why, TASK_HEAD.why, 'both anatomies open with About this Step')

  // The Plan partitions the Direction rows out of the lanes with no code of its own.
  const items = [item('ordinary'), ...DIRECTION.map((id) => item(id)), ...EA.map((id) => item(id))]
  const { pinned, remaining } = partitionPinnedGroups(items)
  assert.deepEqual(pinned.map((p) => p.group.key), [EMERGENCY_ACCESS_GROUP, DIRECTION_GROUP])
  assert.deepEqual(pinned[1].items.map((i) => i.id), DIRECTION)
  assert.deepEqual(remaining.map((i) => i.id), ['ordinary'])
})

test('the registry is the only place the Plan names the Emergency Access ids', () => {
  for (const file of ['src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/planBoard.ts', 'src/ui/surfaces/stepHeadings.ts']) {
    const src = readFileSync(file, 'utf8')
    assert.equal(src.includes("'cleanup-drill'"), false, `${file} names the drill`)
    assert.equal(src.includes('Establish Emergency Access'), false, `${file} writes the group title`)
  }
  // The Plan draws every open pinned group the board hands it, one board each, and every completed one in the aside.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /pinnedActive\.map\(\(g\) => <div key=\{g\.key\} className="plan-board plan-board-foundation">/)
  assert.match(plan, /pinnedCompleted\.map\(drawGroup\('aside'\)\)/)
})

test('a second registry entry is partitioned and drawn as its own pinned group', () => {
  const direction: StepGroup = { key: 'direction', titleKey: EA_TITLE, completedTitleKey: EA_TITLE, members: ['d-one', 'd-two'], pinned: true, anatomy: 'decision' }
  const unpinned: StepGroup = { key: 'later', titleKey: EA_TITLE, completedTitleKey: EA_TITLE, members: ['l-one'], pinned: false, anatomy: 'decision' }
  const groups = [...STEP_GROUPS.filter((g) => g.key === EMERGENCY_ACCESS_GROUP), direction, unpinned]
  assert.deepEqual(pinnedGroups(groups).map((g) => g.key), [EMERGENCY_ACCESS_GROUP, 'direction'])
  assert.equal(groupOf('d-two', groups)?.key, 'direction')
  assert.equal(usesTaskAnatomy('d-two', groups), false)

  const items = [item('ordinary'), item('d-two', 'Up Next'), ...EA.map((id) => item(id)), item('d-one'), item('l-one')]
  const { pinned, remaining } = partitionPinnedGroups(items, groups)
  assert.deepEqual(pinned.map((p) => p.group.key), [EMERGENCY_ACCESS_GROUP, 'direction'])
  assert.deepEqual(pinned[1].items.map((i) => i.id), ['d-one', 'd-two'], 'members come out in the registry order')
  assert.deepEqual(remaining.map((i) => i.id), ['ordinary', 'l-one'], 'an unpinned group stays in the lanes')
  assert.equal(new Set([...pinned.flatMap((p) => p.items), ...remaining].map((i) => i.id)).size, items.length, 'a row is dropped or drawn twice')

  const drawn = pinnedBoardGroups(pinned, { completed: false, open: null })
  assert.deepEqual(drawn.active.map((g) => [g.key, g.secondary]), [[EMERGENCY_ACCESS_GROUP, false], ['direction', false]])
  assert.deepEqual(drawn.completed, [])
  assert.equal(openInActivePinnedGroup(pinned, 'd-one'), true, 'a member of an open pinned group is in no tab')
  assert.equal(openInActivePinnedGroup(pinned, 'ordinary'), false)

  // Direction completes: it leaves the top and is drawn in the aside only when asked for or opened.
  const done = partitionPinnedGroups(items.map((i) => (i.id.startsWith('d-') ? { ...i, lane: 'Completed' as const } : i)), groups).pinned
  assert.deepEqual(pinnedBoardGroups(done, { completed: false, open: null }).active.map((g) => g.key), [EMERGENCY_ACCESS_GROUP])
  assert.deepEqual(pinnedBoardGroups(done, { completed: false, open: null }).completed, [])
  assert.deepEqual(pinnedBoardGroups(done, { completed: true, open: null }).completed.map((g) => [g.key, g.secondary]), [['direction-complete', true]])
  assert.deepEqual(pinnedBoardGroups(done, { completed: false, open: 'd-two' }).completed.map((g) => g.key), ['direction-complete'])
  assert.equal(openInActivePinnedGroup(done, 'd-one'), false, 'a completed group follows its lane tab again')
})
