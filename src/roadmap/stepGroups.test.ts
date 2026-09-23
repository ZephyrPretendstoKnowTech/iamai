// The step-group registry (stepGroups.ts): Emergency Access is one entry, and a
// second entry is partitioned and drawn as its own pinned group with no code
// beyond the entry itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DIRECTION_GROUP, EMERGENCY_ACCESS_GROUP, STEP_GROUPS, anatomyOf, groupOf, groupPositions, groupTotals, isGroupMember, membersOf, pinnedGroups, positionInGroup, usesDecisionAnatomy, usesTaskAnatomy } from './stepGroups.ts'
import type { StepGroup } from './stepGroups.ts'
import { EMERGENCY_STEP_IDS, applyFocus, groupTitleOf, groupsFor, partitionPinnedGroups, pinnedBoardGroups, splitPinned } from '../ui/surfaces/planBoard.ts'
import type { BoardItem } from '../ui/surfaces/planBoard.ts'
import { DECISION_HEAD, TASK_HEAD, decisionHeadingsOf, taskHeadingsOf } from '../ui/surfaces/stepHeadings.ts'
import { PINNED_GOAL_MAP, goalInMap, goalMapFor } from './goalMap.ts'
import { isFloorGoal } from './floor.ts'
import { stepIdForGoal } from './stepIds.ts'
import { CONTENT_ALIAS } from '../content/stepTitle.ts'
import { stepById } from '../content/content.ts'
import goalsData from '../../data/goals.json' with { type: 'json' }
import pinnedBaseline from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import type { CaPolicy } from '../baseline/types.ts'
import { cleanupRows } from './cleanup.ts'

/** Every kind roadmap/cleanup.ts can render, read from the module rather than restated. */
const CLEANUP_KINDS = cleanupRows({ emergencyAccounts: ['a'], renames: ['b'], overlaps: ['c'], hardening: ['d'] }).map((r) => String(r.kind))

const pinnedPolicies = pinnedBaseline.policies as unknown as CaPolicy[]

const EA_TITLE = 'pages.app.plan.groups.emergencyAccess.title'
const EA = ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings', 'cleanup-drill']
const DIRECTION = ['s-direction-use', 's-direction-accounts', 's-direction-devices']
const item = (id: string, lane: BoardItem['lane'] = 'Ready'): BoardItem => ({ id, title: id, lane, laneLabel: lane, workType: 'setup', order: 0 })

test('the registry lists the four Emergency Access steps in order, pinned, with the task anatomy', () => {
  assert.deepEqual(STEP_GROUPS.slice(0, 2).map((g) => g.key), [EMERGENCY_ACCESS_GROUP, DIRECTION_GROUP], 'the two pinned groups lead the registry')
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
  // A step outside the two pinned groups is in one of the rollout's own groups,
  // and every one of those groups draws the task anatomy too (owner, 2026-09-19:
  // every step that carries work reads the same way; step-redundancy-analysis.md
  // finding 15). The registry answers it once, for the board and the interior.
  for (const id of ['s-ladder-security-defaults', 's-confirm-workloads', 'cleanup-alerting', 's-goal-block-legacy-auth', 's-review-baseline-anything', 's-prereq-trusted-location', 's-verify-mfa', 's-check-dormant-accounts']) {
    assert.notEqual(groupOf(id), null, `${id} is in no group`)
    assert.equal(isGroupMember(id, EMERGENCY_ACCESS_GROUP), false, id)
    assert.equal(isGroupMember(id, DIRECTION_GROUP), false, id)
    assert.equal(usesTaskAnatomy(id), true, `${id}: the group's anatomy`)
    assert.equal(usesDecisionAnatomy(id), false, id)
    assert.equal(anatomyOf(id), 'task', id)
    assert.equal(taskHeadingsOf(id), TASK_HEAD, id)
    assert.equal(decisionHeadingsOf(id), null, id)
  }
  // A Cleanup row is a board row, not a step: the owner left the Cleanup rows out
  // of the uniformity rule, and CleanupStep.tsx keeps the recovery drill — the one
  // row that draws the task anatomy — on the task headings by its own kind.
  const cleanup = readFileSync('src/ui/surfaces/CleanupStep.tsx', 'utf8')
  assert.match(cleanup, /const taskHead = row\.kind === 'drill' \? TASK_HEAD : null/)
})

test('every step is in exactly one group: a listed id beats a prefix, a prefix beats the catch-all, and only the last entry is the catch-all', () => {
  const seen = new Map<string, string>()
  for (const g of STEP_GROUPS) {
    for (const id of g.members) {
      assert.equal(seen.has(id), false, `${id} is listed by both ${seen.get(id)} and ${g.key}`)
      seen.set(id, g.key)
    }
  }
  const catchAlls = STEP_GROUPS.filter((g) => g.catchAll === true)
  assert.equal(catchAlls.length, 1, 'there is not exactly one catch-all')
  assert.equal(catchAlls[0].key, STEP_GROUPS.at(-1)!.key, 'the catch-all is not the last group')
  assert.equal(catchAlls[0].pinned, false, 'the catch-all is pinned above the lanes')

  // The three ways of claiming a step, in order.
  assert.equal(groupOf('s-goal-block-legacy-auth')!.key, 'close-doors', 'a listed id')
  assert.equal(groupOf('s-review-baseline-iac-app-block-avd-nontrustedlocations-1qsycmx')!.key, catchAlls[0].key, 'a prefix family')
  assert.equal(groupOf('s-something-nobody-placed')!.key, catchAlls[0].key, 'the catch-all')
  // Every group the Plan can draw has both of its title keys in content.json.
  for (const g of STEP_GROUPS) for (const complete of [false, true]) assert.ok(groupTitleOf(g, complete).length > 0, `${g.key}: no title`)
  // Every group carries an anatomy: the steps that carry work draw the task one
  // and the Direction steps draw the decision one, so no group leaves a member
  // to a third set of headings (owner, 2026-09-19).
  for (const g of STEP_GROUPS) assert.equal(g.anatomy, g.key === DIRECTION_GROUP ? 'decision' : 'task', `${g.key}: anatomy`)
})

// Ids the registry listed that a person can no longer meet on the board: five the
// engine could never build (docs/plans/step-redundancy-analysis.md finding 4), the
// unassessed-policies row that duplicated the review steps (finding 8), and the
// partner follow-up that pointed at two other steps (finding 5).
const GONE = ['s-prereq-device-plan', 's-question-travel', 's-goal-mobile-app-protection', 's-goal-azure-management-mfa', 's-goal-unmanaged-browser', 'cleanup-notAssessed', 's-question-partner']

test('no group lists a step the board can never draw', () => {
  const listed = STEP_GROUPS.flatMap((g) => [...g.members])
  for (const id of GONE) assert.equal(listed.includes(id), false, `${id} is still a registry member`)

  // The general rule behind the five phantoms: an `s-goal-` member names a goal the
  // pinned baseline maps or the floor supplies. Anything else renders nothing.
  const goalIds = new Set((goalsData.goals as { id: string }[]).map((g) => g.id))
  for (const id of listed.filter((m) => m.startsWith('s-goal-'))) {
    const goalId = id.slice('s-goal-'.length)
    assert.equal(goalIds.has(goalId), true, `${id}: ${goalId} is not a goal in data/goals.json`)
    assert.equal(goalInMap(PINNED_GOAL_MAP, goalId) || isFloorGoal(goalId), true, `${id}: the pinned baseline does not map ${goalId} and the floor does not supply it`)
  }

  // A cleanup- member names a row roadmap/cleanup.ts can build.
  for (const id of listed.filter((m) => m.startsWith('cleanup-'))) {
    assert.ok(CLEANUP_KINDS.includes(id.slice('cleanup-'.length)), `${id}: not a CleanupKind roadmap/cleanup.ts renders`)
  }

  // Require Healthy Devices lists what it actually draws; the other two shrank by one each.
  assert.deepEqual([...membersOf('devices')], ['s-goal-require-managed-device', 's-goal-intune-enrollment-reauth', 's-ladder-phone-access-restriction', 's-shared-devices'])
  assert.equal(membersOf('protect-admins').length, 5)
  assert.equal(membersOf('mfa-everyone').includes('s-question-partner'), false, 'the partner follow-up folded into the guests policy')
  // The objects a Direction answer asks for are their own group straight after
  // Direction (owner, 2026-09-20), so the policy group holds policies. The
  // countries location left it in Stage 3: it is the countries policy's own task.
  assert.deepEqual([...membersOf('prepare-objects')], ['s-prereq-trusted-location', 's-prereq-service-accounts-group'])
  assert.equal(membersOf('where-people-sign-in').length, 3)
  assert.equal(STEP_GROUPS.findIndex((g) => g.key === 'prepare-objects'), STEP_GROUPS.findIndex((g) => g.key === DIRECTION_GROUP) + 1, 'the objects are not read straight after the answers that ask for them')
  // The settings to retire and the foundation's own prerequisites are not objects an answer creates.
  assert.equal(groupOf('s-prereq-per-user-mfa')!.key, 'mfa-everyone')
  assert.equal(groupOf('s-prereq-security-defaults')!.key, 'mfa-everyone')
  assert.equal(groupOf('s-prereq-auth-strength')!.key, 'protect-admins')
  for (const id of EA) assert.equal(groupOf(id)!.key, EMERGENCY_ACCESS_GROUP, id)
})

test('the two browser goals can never render as two steps with one title', () => {
  // `unmanaged-browser` is a content entry, not a goal: two goals alias to it, so
  // if both could be mapped the plan would draw two rows with one title, one why
  // and one Completion Criteria. The merge is what makes that impossible — the
  // anchor maps to the ordered pair and the partner is never a key of its own —
  // so the only browser step id the engine can build is the anchor's.
  assert.equal(new Set((goalsData.goals as { id: string }[]).map((g) => g.id)).has('unmanaged-browser'), false, 'unmanaged-browser is a content id, never a goal id')
  assert.equal(stepById['unmanaged-browser']?.title, 'Limit Unmanaged Devices in the Browser')
  for (const goalId of ['byod-session-controls', 'block-downloads-unmanaged']) assert.equal(CONTENT_ALIAS[goalId], 'unmanaged-browser', goalId)
  for (const map of [PINNED_GOAL_MAP, goalMapFor(pinnedPolicies, new Map()).map]) {
    assert.equal(goalInMap(map, 'block-downloads-unmanaged'), false, 'the merged partner took a mapping of its own — two rows would draw one title')
  }
  assert.equal(stepIdForGoal('byod-session-controls'), 's-goal-byod-session-controls')
})

test('a number is a place among the group’s own rows, in registry order, and the whole row set decides it', () => {
  const ids = ['s-goal-block-auth-transfer', 's-goal-block-legacy-auth', 's-review-baseline-one', 's-review-baseline-two', 's-goal-mfa-all-users']
  const all = groupPositions(ids)
  // Registry order, whatever order they arrive in — and no gap for a member this
  // set does not carry, because the board would draw no row there.
  assert.equal(all.get('s-goal-block-legacy-auth'), 1)
  assert.equal(all.get('s-goal-block-auth-transfer'), 2)
  assert.equal(positionInGroup('s-goal-block-auth-transfer'), 3, 'the registry position is still the registry’s')
  assert.equal(all.get('s-goal-mfa-all-users'), 1)
  // A prefix member has no registry position: it numbers after every listed one, by id.
  assert.equal(positionInGroup('s-review-baseline-one'), null)
  assert.equal(all.get('s-review-baseline-one'), 1)
  assert.equal(all.get('s-review-baseline-two'), 2)
  // The set handed in is the WHOLE board, so a tab filtering afterwards keeps
  // these numbers and its gaps are rows on another tab.
  assert.deepEqual([...groupTotals(ids)].sort(), [['close-doors', 2], ['mfa-everyone', 1], ['ongoing', 2]].sort())
  assert.equal(positionInGroup('s-goal-nobody-placed-this'), null, 'a catch-all member has no registry position either')
})

test("(a) Decide Your Tenant's Direction is the second pinned group: its three steps in order, with the decision anatomy", () => {
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

  // Direction completes: it leaves the top and is drawn in the aside only when asked for or opened.
  const done = partitionPinnedGroups(items.map((i) => (i.id.startsWith('d-') ? { ...i, lane: 'Completed' as const } : i)), groups).pinned
  assert.deepEqual(pinnedBoardGroups(done, { completed: false, open: null }).active.map((g) => g.key), [EMERGENCY_ACCESS_GROUP])
  assert.deepEqual(pinnedBoardGroups(done, { completed: false, open: null }).completed, [])
  assert.deepEqual(pinnedBoardGroups(done, { completed: true, open: null }).completed.map((g) => [g.key, g.secondary]), [['direction-complete', true]])
  assert.deepEqual(pinnedBoardGroups(done, { completed: false, open: 'd-two' }).completed.map((g) => g.key), ['direction-complete'])
})

test('a lane tab filters a pinned group like every other group, and the tab still draws it first (owner, 2026-09-20)', () => {
  const direction: StepGroup = { key: 'direction', titleKey: EA_TITLE, completedTitleKey: EA_TITLE, members: ['d-one', 'd-two'], pinned: true, anatomy: 'decision' }
  const unpinned: StepGroup = { key: 'later', titleKey: EA_TITLE, completedTitleKey: EA_TITLE, members: ['l-one', 'l-two'], pinned: false, anatomy: 'task' }
  const groups = [direction, unpinned]
  const items = [item('d-one', 'Ready'), item('d-two', 'On Hold'), item('l-one', 'Ready'), item('l-two', 'On Hold')]
  const NONE = { search: '', workType: null, showCompleted: false, showDeferred: false }
  // Ready leaves one row of each group, and On Hold the other: a pinned group is
  // no longer whole under a lane tab, which is what the All work tab is for.
  const ready = splitPinned(groupsFor('ready', applyFocus(items, 'ready', NONE), groups), groups)
  assert.deepEqual(ready.pinned.map((g) => g.items.map((i) => i.id)), [['d-one']], 'the pinned group ignored the lane filter')
  assert.deepEqual(ready.rest.map((g) => g.items.map((i) => i.id)), [['l-one']])
  const hold = splitPinned(groupsFor('onHold', applyFocus(items, 'onHold', NONE), groups), groups)
  assert.deepEqual(hold.pinned.map((g) => g.items.map((i) => i.id)), [['d-two']], 'On Hold showed a Ready row of the pinned group')
  // And a lane that leaves the pinned group empty draws no pinned board at all.
  const upNext = splitPinned(groupsFor('upNext', applyFocus(items, 'upNext', NONE), groups), groups)
  assert.deepEqual(upNext.pinned, [])
  assert.deepEqual(upNext.rest, [])
  // The Plan lifts what the tab left of the pinned groups, and reads no lane of its own.
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.match(plan, /const split = splitPinned\(drawn\)/)
  assert.equal(plan.includes('openInActivePinnedGroup'), false, 'a pinned member is still exempt from the tabs')
})
