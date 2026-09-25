// The step-group registry (stepGroups.ts): Emergency Access is one entry, and a
// second entry is drawn as its own section, in its registry place, with no code
// beyond the entry itself. No section is lifted above the tabs or sunk below
// them (owner, roadmap flow V2): the registry order is the order on screen.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DIRECTION_GROUP, DIRECTION_STEP_IDS, EMERGENCY_ACCESS_GROUP, STEP_GROUPS, anatomyOf, groupOf, groupPositions, groupTotals, isGroupMember, membersOf, positionInGroup, usesDecisionAnatomy, usesTaskAnatomy } from './stepGroups.ts'
import type { StepGroup } from './stepGroups.ts'
import { ALL_WORK_TAB, EMERGENCY_STEP_IDS, NO_FOCUS, allWorkGroups, applyFocus, groupSummary, groupTitleOf, groupsFor } from '../ui/surfaces/planBoard.ts'
import type { BoardItem } from '../ui/surfaces/planBoard.ts'
import { DECISION_HEAD, TASK_HEAD, decisionHeadingsOf, taskHeadingsOf } from '../ui/surfaces/stepHeadings.ts'
import { PINNED_GOAL_MAP, goalInMap, goalMapFor } from './goalMap.ts'
import { isFloorGoal } from './floor.ts'
import { BREAK_GLASS_STEP_ID, EXCLUSION_GROUP_STEP_ID, OBJECT_TASK, PREREQ_STEP_ID, SEPARATE_ADMIN_ACCOUNTS_STEP_ID, objectTaskOwner, stepIdForGoal } from './stepIds.ts'
import { CONTENT_ALIAS } from '../content/stepTitle.ts'
import { content, stepById, steps as contentSteps } from '../content/content.ts'
import goalsData from '../../data/goals.json' with { type: 'json' }
import pinnedBaseline from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import type { CaPolicy } from '../baseline/types.ts'
import { cleanupRows } from './cleanup.ts'
import dependencyData from '../actionability/dependency-data.json' with { type: 'json' }
import { DIRECTION_QUESTIONS, directionBlockerStep, directionStepOf } from './directionAnswers.ts'
import { QUESTION_STEP } from './answers.ts'
import { ANSWERED_IN, directionDependenciesOf } from './direction.ts'
import { graphConditions } from './graphConditions.ts'
import { COVERED_BY_STEP, LADDER_ITEMS, ladderStepId } from './ladder.ts'
import { OPERATOR_PASSKEY_STEP_ID, PASSKEY_SETTINGS_STEP_ID } from './passkeySettings.ts'
import { curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture, FixtureName } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { boardOf, chainStartOf } from '../ui/surfaces/planBoard.ts'
import { customerPlanSteps } from '../ui/surfaces/customerPlanSteps.ts'

/** Every kind roadmap/cleanup.ts can render, read from the module rather than restated. */
const CLEANUP_KINDS = cleanupRows({ emergencyAccounts: ['a'], renames: ['b'], overlaps: ['c'], hardening: ['d'] }).map((r) => String(r.kind))

const pinnedPolicies = pinnedBaseline.policies as unknown as CaPolicy[]

const EA_TITLE = 'pages.app.plan.groups.emergencyAccess.title'
const EA = ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings', 'cleanup-drill']
const DIRECTION = ['s-direction-use', 's-direction-accounts', 's-direction-devices']
const item = (id: string, lane: BoardItem['lane'] = 'Ready'): BoardItem => ({ id, title: id, lane, laneLabel: lane, workType: 'setup', order: 0 })

test('the registry leads with the four Emergency Access steps (task anatomy) and the three Direction steps (decision anatomy), answers membership and anatomy by id, and is the only place the Plan names the Emergency Access ids', () => {
  assert.deepEqual(STEP_GROUPS.slice(0, 2).map((g) => g.key), [EMERGENCY_ACCESS_GROUP, DIRECTION_GROUP], 'Emergency Access and Direction do not lead the registry')
  assert.deepEqual([...membersOf(EMERGENCY_ACCESS_GROUP)], EA)
  assert.deepEqual([...EMERGENCY_STEP_IDS], EA, 'the board reads its emergency ids from the registry')
  const g = groupOf('s-prereq-exclusion-group')
  assert.equal(g?.key, EMERGENCY_ACCESS_GROUP)
  // Pinning is gone: a section's place is its registry position and nothing else.
  for (const group of STEP_GROUPS) assert.equal('pinned' in group, false, `${group.key} still says whether it is pinned`)
  assert.equal(groupTitleOf(g!, false), 'Establish Emergency Access')
  assert.equal(groupTitleOf(g!, true), 'Establish Emergency Access')
  assert.deepEqual(membersOf('no-such-group'), [])

  // GroupOf, isGroupMember and usesTaskAnatomy answer by id.
  {
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
    // A step outside Emergency Access and Direction (the foundation) is in one of the rollout's own groups,
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
  }

  // (a) Define Your Rollout Scope (the Direction steps) is the second section: its three steps in order, with the decision anatomy.
  {
    assert.equal(STEP_GROUPS[1].key, DIRECTION_GROUP, 'Direction is not right after Emergency Access')
    assert.deepEqual([...membersOf(DIRECTION_GROUP)], DIRECTION)
    const g = groupOf('s-direction-devices')!
    assert.equal(g.key, DIRECTION_GROUP)
    assert.equal(g.anatomy, 'decision')
    assert.equal(groupTitleOf(g, false), 'Define Your Rollout Scope')
    for (const id of DIRECTION) {
      assert.equal(usesDecisionAnatomy(id), true, id)
      assert.equal(usesTaskAnatomy(id), false, id)
      assert.equal(taskHeadingsOf(id), null, id)
      assert.deepEqual(decisionHeadingsOf(id), { why: 'About this Step', questions: 'Questions', doneWhen: 'Completion Criteria' }, id)
    }
    assert.equal(DECISION_HEAD.why, TASK_HEAD.why, 'both anatomies open with About this Step')

    // All work draws the Direction rows as the second section, in place, with no code of its own.
    const items = [item('ordinary'), ...DIRECTION.map((id) => item(id)), ...EA.map((id) => item(id))]
    const drawn = allWorkGroups(items, items)
    assert.deepEqual(drawn.map((d) => d.key), [`${ALL_WORK_TAB}-${EMERGENCY_ACCESS_GROUP}`, `${ALL_WORK_TAB}-${DIRECTION_GROUP}`, `${ALL_WORK_TAB}-ongoing`])
    assert.deepEqual(drawn[1].items.map((i) => i.id), DIRECTION)
  }

  // The registry is the only place the Plan names the Emergency Access ids.
  {
    for (const file of ['src/ui/surfaces/Plan.tsx', 'src/ui/surfaces/planBoard.ts', 'src/ui/surfaces/stepHeadings.ts']) {
      const src = readFileSync(file, 'utf8')
      assert.equal(src.includes("'cleanup-drill'"), false, `${file} names the drill`)
      assert.equal(src.includes('Establish Emergency Access'), false, `${file} writes the group title`)
    }
  }
})

// Ids the registry listed that a person can no longer meet on the board: three the
// engine could never build (docs/plans/step-redundancy-analysis.md finding 4), the
// unassessed-policies row that duplicated the review steps (finding 8), and the
// partner follow-up that pointed at two other steps (finding 5).
const GONE = ['s-prereq-device-plan', 's-question-travel', 's-goal-unmanaged-browser', 'cleanup-notAssessed', 's-question-partner']

test('every step is in exactly one group, no group lists a step the board can never draw, and the two browser goals can never render as two steps with one title', () => {
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

  // The three ways of claiming a step, in order.
  assert.equal(groupOf('s-goal-block-legacy-auth')!.key, 'core', 'a listed id')
  assert.equal(groupOf('s-review-baseline-iac-app-block-avd-nontrustedlocations-1qsycmx')!.key, catchAlls[0].key, 'a prefix family')
  assert.equal(groupOf('s-something-nobody-placed')!.key, catchAlls[0].key, 'the catch-all')
  // Every group the Plan can draw has both of its title keys in content.json.
  for (const g of STEP_GROUPS) for (const complete of [false, true]) assert.ok(groupTitleOf(g, complete).length > 0, `${g.key}: no title`)
  // Every group carries an anatomy: the steps that carry work draw the task one
  // and the Direction steps draw the decision one, so no group leaves a member
  // to a third set of headings (owner, 2026-09-19).
  for (const g of STEP_GROUPS) assert.equal(g.anatomy, g.key === DIRECTION_GROUP ? 'decision' : 'task', `${g.key}: anatomy`)

  // No group lists a step the board can never draw.
  {
    const listed = STEP_GROUPS.flatMap((g) => [...g.members])
    for (const id of GONE) assert.equal(listed.includes(id), false, `${id} is still a registry member`)

    // The general rule behind the phantoms: an `s-goal-` member names a catalogue
    // goal a baseline can hold, the pinned one or an uploaded one. A goal merged
    // into another goal's step (content mergesGoals) never maps alone, and renders nothing.
    const goalIds = new Set((goalsData.goals as { id: string }[]).map((g) => g.id))
    const mergedAway = new Set(contentSteps.flatMap((s) => (s.mergesGoals ?? []).slice(1)))
    for (const id of listed.filter((m) => m.startsWith('s-goal-'))) {
      const goalId = id.slice('s-goal-'.length)
      assert.equal(goalIds.has(goalId), true, `${id}: ${goalId} is not a goal in data/goals.json`)
      assert.equal(mergedAway.has(goalId), false, `${id}: ${goalId} merges into another goal's step and is never built alone`)
    }
    // Three of them only an uploaded baseline builds: the pinned one maps none of
    // them and the floor supplies none, so on the pinned baseline they draw nothing.
    for (const goalId of ['azure-management-mfa', 'mobile-app-protection', 'byod-session-controls']) {
      assert.equal(listed.includes(stepIdForGoal(goalId)), true, `${goalId}: not listed`)
      assert.equal(goalInMap(PINNED_GOAL_MAP, goalId) || isFloorGoal(goalId), false, `${goalId}: the pinned baseline builds it now`)
    }

    // A cleanup- member names a row roadmap/cleanup.ts can build.
    const kinds = cleanupRows({ emergencyAccounts: ['a'], renames: ['b'], overlaps: ['c'], hardening: ['d'], namedExclusions: ['e'] }).map((r) => String(r.kind))
    for (const id of listed.filter((m) => m.startsWith('cleanup-'))) {
      assert.ok(kinds.includes(id.slice('cleanup-'.length)), `${id}: not a CleanupKind roadmap/cleanup.ts renders`)
    }
    assert.ok(CLEANUP_KINDS.every((k) => kinds.includes(k)))
  }

  // The two browser goals can never render as two steps with one title.
  {
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
  }
})

// The roadmap flow's outline (docs/plans/roadmap-flow/v1-proposal-full.md
// section 2), with V2's names (owner, 2026-09-23). Two rows hold an interim
// place until Stage 4 merges them: each medium-risk step after its partner.
// Stage 3 merged the other two: Direction has three steps, and the countries
// location is Block Sign-ins From Countries Not Allowed's own first task.
const OUTLINE: readonly [key: string, title: string, members: readonly string[]][] = [
  ['emergency-access', 'Establish Emergency Access', EA],
  ['direction', 'Define Your Rollout Scope', DIRECTION],
  ['prepare', 'Prepare Accounts and Objects', ['s-check-dormant-accounts', 's-check-separate-admin-accounts', 's-ladder-operator-passkey', 's-verify-mfa', 's-prereq-auth-strength', 's-prereq-trusted-location', 's-prereq-service-accounts-group', 's-create-report-only']],
  ['core', 'Turn On MFA for Everyone', ['s-goal-block-legacy-auth', 's-goal-block-device-code', 's-goal-admins-phishing-resistant', 's-goal-mfa-all-users', 's-prereq-security-defaults', 's-prereq-per-user-mfa']],
  ['extend-mfa', 'Extend MFA Coverage', ['s-goal-register-info-protected', 's-goal-device-registration-mfa', 's-goal-guests-mfa', 's-goal-pim-activation-reauth', 's-goal-inforcer-mfa', 's-goal-sign-in-risk', 's-goal-sign-in-risk-medium', 's-goal-user-risk', 's-goal-user-risk-medium', 's-goal-azure-management-mfa']],
  ['remaining-doors', 'Close the Doors Nobody Should Use', ['s-goal-block-auth-transfer', 's-goal-block-unsupported-platforms', 's-goal-geo-restriction', 's-goal-service-accounts-trusted-network', 's-goal-workload-identity-block', 's-goal-admin-portals-protected']],
  ['devices-sessions', 'Limit Sessions and Require Healthy Devices', ['s-goal-admin-session', 's-goal-all-users-no-persistence', 's-goal-intune-enrollment-reauth', 's-goal-require-managed-device', 's-ladder-phone-access-restriction', 's-goal-token-protection', 's-goal-mobile-app-protection', 's-goal-byod-session-controls']],
  ['ongoing', 'Ongoing Checks and Cleanup', ['cleanup-alerting', 'cleanup-hardening', 'cleanup-namedExclusions', 'cleanup-consolidation', 'cleanup-naming']],
]

test('the Plan has eight sections, in the roadmap flow’s order, with its names and members', () => {
  assert.deepEqual(STEP_GROUPS.map((g) => g.key), OUTLINE.map(([key]) => key))
  for (const [key, title, members] of OUTLINE) {
    const g = STEP_GROUPS.find((x) => x.key === key)!
    assert.deepEqual([...g.members], [...members], `${key}: members`)
    // A finished section keeps its name: it collapses in place, it is not renamed.
    assert.equal(groupTitleOf(g, false), title, `${key}: title`)
    assert.equal(groupTitleOf(g, true), title, `${key}: completed title`)
  }
  // Where a title is reused, so is its content key.
  assert.equal(STEP_GROUPS.find((g) => g.key === 'core')!.titleKey, 'pages.app.plan.groups.mfaEveryone.title')
  assert.equal(STEP_GROUPS.find((g) => g.key === 'remaining-doors')!.titleKey, 'pages.app.plan.groups.closeDoors.title')
  // The retired sections' words are gone with them.
  const groupsWords = (content as unknown as { pages: { app: { plan: { groups: Record<string, unknown> } } } }).pages.app.plan.groups
  for (const retired of ['prepareObjects', 'protectAdmins', 'whereSignIn', 'devices', 'riskAndSessions']) assert.equal(retired in groupsWords, false, `${retired} is still in content.json`)
  assert.deepEqual(Object.keys(groupsWords).filter((k) => !k.startsWith('$comment')).sort(), STEP_GROUPS.map((g) => g.titleKey.split('.').at(-2)!).sort(), 'content.json holds a section title no section reads')
})

test('a number is a place among the group’s own rows, in registry order, and the whole row set decides it', () => {
  const ids = ['s-goal-mfa-all-users', 's-goal-block-legacy-auth', 's-review-baseline-one', 's-review-baseline-two', 's-goal-geo-restriction']
  const all = groupPositions(ids)
  // Registry order, whatever order they arrive in — and no gap for a member this
  // set does not carry, because the board would draw no row there.
  assert.equal(all.get('s-goal-block-legacy-auth'), 1)
  assert.equal(all.get('s-goal-mfa-all-users'), 2)
  assert.equal(positionInGroup('s-goal-mfa-all-users'), 4, 'the registry position is still the registry’s')
  assert.equal(all.get('s-goal-geo-restriction'), 1)
  // A prefix member has no registry position: it numbers after every listed one, by id.
  assert.equal(positionInGroup('s-review-baseline-one'), null)
  assert.equal(all.get('s-review-baseline-one'), 1)
  assert.equal(all.get('s-review-baseline-two'), 2)
  // The set handed in is the WHOLE board, so a tab filtering afterwards keeps
  // these numbers and its gaps are rows on another tab.
  assert.deepEqual([...groupTotals(ids)].sort(), [['core', 2], ['ongoing', 2], ['remaining-doors', 1]].sort())
  assert.equal(positionInGroup('s-goal-nobody-placed-this'), null, 'a catch-all member has no registry position either')
})

test('a second registry entry is drawn as its own section, in its place, finishing it collapses it there, and a lane tab filters every section alike in registry order (owner, 2026-09-20)', () => {
  const direction: StepGroup = { key: 'direction', titleKey: EA_TITLE, completedTitleKey: EA_TITLE, members: ['d-one', 'd-two'], anatomy: 'decision' }
  const later: StepGroup = { key: 'later', titleKey: EA_TITLE, completedTitleKey: EA_TITLE, members: ['l-one'], anatomy: 'decision' }
  const groups = [...STEP_GROUPS.filter((g) => g.key === EMERGENCY_ACCESS_GROUP), direction, later]
  assert.equal(groupOf('d-two', groups)?.key, 'direction')
  assert.equal(usesTaskAnatomy('d-two', groups), false)

  const items = [item('d-two', 'Up Next'), ...EA.map((id) => item(id)), item('d-one'), item('l-one')]
  const open = allWorkGroups(items, items, groups)
  assert.deepEqual(open.map((g) => [g.key, g.closed]), [[`${ALL_WORK_TAB}-${EMERGENCY_ACCESS_GROUP}`, false], [`${ALL_WORK_TAB}-direction`, false], [`${ALL_WORK_TAB}-later`, false]])
  assert.deepEqual(open[1].items.map((i) => i.id), ['d-one', 'd-two'], 'members come out in the registry order')

  // Direction completes: it stays second, collapsed to its title and one line.
  const done = items.map((i) => (i.id.startsWith('d-') ? { ...i, lane: 'Completed' as const } : i))
  const closed = allWorkGroups(done, done, groups)
  assert.deepEqual(closed.map((g) => [g.key, g.closed]), [[`${ALL_WORK_TAB}-${EMERGENCY_ACCESS_GROUP}`, false], [`${ALL_WORK_TAB}-direction`, true], [`${ALL_WORK_TAB}-later`, false]], 'the finished section moved or stayed open')
  assert.equal(groupSummary(closed[1]), 'All 2 completed')
  assert.equal(new Set(closed.flatMap((g) => g.items.map((i) => i.id))).size, items.length, 'a row is dropped or drawn twice')

  // A lane tab filters every section alike and keeps the registry order (owner, 2026-09-20).
  {
    const direction: StepGroup = { key: 'direction', titleKey: EA_TITLE, completedTitleKey: EA_TITLE, members: ['d-one', 'd-two'], anatomy: 'decision' }
    const later: StepGroup = { key: 'later', titleKey: EA_TITLE, completedTitleKey: EA_TITLE, members: ['l-one', 'l-two'], anatomy: 'task' }
    const groups = [direction, later]
    const items = [item('d-one', 'Ready'), item('d-two', 'On Hold'), item('l-one', 'Ready'), item('l-two', 'On Hold')]
    // Ready leaves one row of each section, and On Hold the other, each under its
    // own heading in registry order: a section is whole on All work, not here.
    assert.deepEqual(groupsFor('ready', applyFocus(items, 'ready', NO_FOCUS), groups).map((g) => g.items.map((i) => i.id)), [['d-one'], ['l-one']])
    assert.deepEqual(groupsFor('onHold', applyFocus(items, 'onHold', NO_FOCUS), groups).map((g) => g.items.map((i) => i.id)), [['d-two'], ['l-two']])
    // And a lane that leaves a section empty draws no heading for it.
    assert.deepEqual(groupsFor('upNext', applyFocus(items, 'upNext', NO_FOCUS), groups), [])
  }
})

// ---------------------------------------------------------------------------
// The roadmap flow's two structural checks (docs/plans/roadmap-flow/
// v1-proposal-full.md section 6 and Stage 2). The order is only worth having
// while every wait points up the page and no step reaches the catch-all by
// accident; each check fails the day a change breaks it.
// ---------------------------------------------------------------------------

type Edge = { step: string; action: string; prerequisite: string; prerequisiteKind: string; condition: string | null }
const EDGES = (dependencyData as { edges: Edge[] }).edges

/** Every id a section lists, in the order All work draws them: section by section, member by member. */
const LISTED: readonly string[] = STEP_GROUPS.flatMap((g) => [...g.members])

/**
 * The graph's nodes the plan never draws, at the row that asks their question:
 * the usage and device questions are Direction's (directionAnswers.ts
 * DIRECTION_QUESTIONS), and the travel answer is stored on the countries
 * location (answers.ts QUESTION_STEP), which since Stage 3 is the countries
 * policy's own task (stepIds.ts OBJECT_TASK), so it is asked on that row.
 */
const ASKED_AT: Readonly<Record<string, string>> = {
  's-question-mail-devices': DIRECTION_QUESTIONS.mailDevices.step,
  's-question-partner': DIRECTION_QUESTIONS.partner.step,
  's-prereq-device-plan': DIRECTION_QUESTIONS.computers.step,
  's-question-travel': objectTaskOwner(QUESTION_STEP.travel) ?? QUESTION_STEP.travel,
}

/**
 * The designed hand-off, the only wait allowed to point down, keyed by the
 * step that does both halves. Turn Off Security Defaults starts once the four
 * core policies are ready to turn on, and those four turn on as it finishes.
 * (Give Shared Devices Their Own Policy was the second; it left in Phase 2a.)
 * What points down is only the turn-on: in the graph, a hand-off is an
 * `enforce` edge, and any other wait between the same two rows still points up.
 */
const HAND_OFFS: ReadonlyMap<string, readonly string[]> = new Map([
  ['s-prereq-security-defaults', ['s-goal-block-legacy-auth', 's-goal-block-device-code', 's-goal-admins-phishing-resistant', 's-goal-mfa-all-users']],
])
const isHandOff = (from: string, to: string): boolean => (HAND_OFFS.get(to) ?? []).includes(from)

test('every wait in the dependency graph points up the page, except the hand-off', () => {
  const placeOf = (id: string): number => LISTED.indexOf(ASKED_AT[id] ?? id)
  const stepEdges = EDGES.filter((e) => e.prerequisiteKind === 'step')
  // Every node has a numbered place: listed by a section, or asked on a row that is.
  const unplaced = [...new Set(stepEdges.flatMap((e) => [e.step, e.prerequisite]))].filter((id) => placeOf(id) === -1)
  assert.deepEqual(unplaced, [], 'a graph node has no place on the page')
  const down = stepEdges
    .filter((e) => placeOf(e.prerequisite) > placeOf(e.step) && !(e.action === 'enforce' && isHandOff(e.step, e.prerequisite)))
    .map((e) => `${e.step} (${e.action}) waits on ${e.prerequisite}, which is drawn below it`)
  assert.deepEqual(down, [])
  // A hand-off stays inside one section, so the step that does both halves is read beside the rows it hands off.
  for (const [step, partners] of HAND_OFFS) for (const p of partners) assert.equal(groupOf(p)?.key, groupOf(step)?.key, `${p} and ${step} are in different sections`)
})

/** A confirmed countries list with nothing in it: every policy that names a place waited on the countries location (generate.ts, countries-unsafe). */
const emptyCountries = (f: Fixture): Fixture => ({ ...f, mapping: { ...f.mapping, allowedCountries: [], wizardAnswered: { ...f.mapping.wizardAnswered, countries: true } } })
const settled = (name: FixtureName): Fixture => withFoundationSettled(curatedFixture(name))

/** The tenants the proposal's dependency check ran, and the case none of them reaches. */
const SCENARIOS: readonly { name: string; make: () => Fixture }[] = [
  { name: 'getiamai, curated, settled', make: () => settled('getiamai') },
  { name: 'demo', make: () => fixture('demo') },
  { name: 'demo-week2', make: () => fixture('demo-week2') },
  ...(['small', 'mid', 'large', 'messy', 'midflight'] as const).flatMap((n) => [
    { name: n, make: () => fixture(n) },
    { name: `${n}, curated, settled`, make: () => settled(n) },
  ]),
  { name: 'getiamai, curated, settled, empty countries list', make: () => emptyCountries(settled('getiamai')) },
]
const scenarioRuns = new Map<string, ReturnType<typeof runFixture>>()
const runOf = (s: (typeof SCENARIOS)[number]): ReturnType<typeof runFixture> => {
  if (!scenarioRuns.has(s.name)) scenarioRuns.set(s.name, runFixture(s.make()))
  return scenarioRuns.get(s.name)!
}

/**
 * Every wait the product reads between two rows of one board, as [the waiting
 * row, the row it waits on, why], with the rows in the order All work draws
 * them. The waits are the ones the proposal counted: the graph's edges with this
 * tenant's conditions resolved, the lane readings' blockers and reasons, the
 * engine's blockedBy and step blockers, the turn-on waits, the Direction answers
 * a step reads and its "Answered in" links, the readiness gate's route and the
 * work that route starts from, and the steps that make a missing object.
 */
function boardWaitsOf(run: ReturnType<typeof runFixture>): { order: string[]; waits: [string, string, string][] } {
  const steps = customerPlanSteps(run.steps)
  const board = boardOf(steps, run.schedule.cleanup, run.input.mapping.breakGlassAnswers ?? null)
  const items = board.rows.map((r) => r.item)
  const order = allWorkGroups(items, items).flatMap((g) => g.items.map((i) => i.id))
  const drawn = new Set(order)
  const conditions = graphConditions(new Map(steps.map((s) => [s.id, s])), run.input.mapping)
  const waits: [string, string, string][] = []
  const add = (from: string, to: string, why: string): void => { if (from !== to && drawn.has(to)) waits.push([from, to, why]) }
  for (const row of board.rows) {
    const id = row.item.id
    for (const e of EDGES) if (e.step === id && e.prerequisiteKind === 'step' && (e.condition === null || conditions[e.condition] !== 'not-applicable')) add(id, e.prerequisite, `graph, ${e.action}`)
    for (const b of row.reading.blockers) add(id, b.id, `lane blocker, ${b.kind}`)
    if (row.reading.reason) add(id, row.reading.reason.id, `lane reason, ${row.reading.reason.kind}`)
    const step = row.step
    if (step === null) continue
    for (const b of step.blockedBy) add(id, b, 'blockedBy')
    for (const b of step.blockers) {
      if (b.kind === 'step') add(id, b.stepId, 'step blocker')
      const d = directionBlockerStep(b)
      if (d !== null) add(id, d, 'Direction answer')
    }
    for (const w of step.action.enforceWaitsOn ?? []) add(id, w.id, 'turn-on wait')
    for (const k of [...directionDependenciesOf(step), ...(ANSWERED_IN[id] ?? [])]) add(id, directionStepOf(k), `Direction question ${k}`)
    const gate = step.action.readinessGate
    if (gate?.routeId) {
      add(id, gate.routeId, 'readiness route')
      const start = chainStartOf(board.readings, gate.routeId)
      if (start !== null) add(id, start, 'readiness route, where its work starts')
    }
    for (const m of step.action.missing ?? []) if (m.stepId) add(id, m.stepId, `makes ${m.token}`)
  }
  return { order, waits }
}

test('on every tenant the fixtures build, no row waits on a row drawn below it, except the two hand-offs', () => {
  const found: string[] = []
  for (const s of SCENARIOS) {
    const { order, waits } = boardWaitsOf(runOf(s))
    assert.ok(waits.length > 0, `${s.name}: no waits were read, so this proves nothing`)
    for (const [from, to, why] of waits) {
      if (order.indexOf(to) > order.indexOf(from) && !isHandOff(from, to)) found.push(`${s.name}: ${from} waits on ${to} (${why}), which is drawn below it`)
    }
  }
  assert.deepEqual([...new Set(found)], [])
  // The empty list is a real case only while it holds a policy on the countries location.
  const empty = runOf(SCENARIOS[SCENARIOS.length - 1]).steps.filter((s) => s.blockers.some((b) => b.kind === 'readiness' && b.label === 'countries-unsafe'))
  assert.ok(empty.length > 0, 'the empty countries list holds nothing on the countries location, so the case proves nothing')
})

test('every step the engine can build is listed by a section, so none reaches Ongoing by accident', () => {
  const generate = readFileSync('src/roadmap/generate.ts', 'utf8')
  // The goal steps: every catalogue goal a baseline can hold, the pinned one or
  // an uploaded one, which is every goal but one merged into another goal's step
  // (content mergesGoals: the first goal is the step, the rest never map alone).
  const mergedAway = new Set(contentSteps.flatMap((s) => (s.mergesGoals ?? []).slice(1)))
  const goals = (goalsData.goals as { id: string }[]).map((g) => g.id).filter((id) => !mergedAway.has(id)).map(stepIdForGoal)
  // The steps generate.ts builds by name: a literal id, or one of its constants.
  const named = [...generate.matchAll(/prereq\('([^']+)'/g)].map((m) => m[1])
  // The countries location is not among them: since Stage 3 it is a task of the
  // countries policy (stepIds.ts OBJECT_TASK), and no tenant builds it as a step.
  const constants = [BREAK_GLASS_STEP_ID, EXCLUSION_GROUP_STEP_ID, PREREQ_STEP_ID.trustedLocation, PREREQ_STEP_ID.authStrength, PREREQ_STEP_ID.serviceAccountsGroup, SEPARATE_ADMIN_ACCOUNTS_STEP_ID, PASSKEY_SETTINGS_STEP_ID, OPERATOR_PASSKEY_STEP_ID]
  const cleanup = cleanupRows({ emergencyAccounts: ['a'], renames: ['b'], overlaps: ['c'], hardening: ['d'], namedExclusions: ['e'] }).map((r) => `cleanup-${r.kind}`)
  // And whatever the tenants actually build.
  const built = SCENARIOS.flatMap((s) => runOf(s).steps.map((x) => x.id))
  assert.ok(goals.includes('s-goal-azure-management-mfa') && named.includes('s-goal-inforcer-mfa') && cleanup.includes('cleanup-namedExclusions'), 'the collection read nothing')

  // Two exceptions, by design. The baseline-review rows are a family, one per
  // baseline policy the plan has no goal for, and Ongoing claims them by prefix.
  // The free-tier ladder is built only for a tenant without P1, a path that is
  // switched off: switched back on, it needs a place of its own first.
  assert.match(generate, /const FREE_TIER_LADDER = false\b/, 'the free-tier ladder is on: give its rows a section, then drop this exception')
  const ladder = new Set(LADDER_ITEMS.filter((i) => !(i.id in COVERED_BY_STEP)).map((i) => ladderStepId(i.id)))
  const unlisted = [...new Set([...goals, ...named, ...constants, ...DIRECTION_STEP_IDS, ...cleanup, ...built])]
    .filter((id) => !id.startsWith('s-review-baseline-') && !ladder.has(id) && !LISTED.includes(id))
  assert.deepEqual(unlisted, [], 'a step the engine builds is placed only by the catch-all')
  // An object task is drawn on its step's row: no tenant builds it as a row of its own.
  for (const task of Object.values(OBJECT_TASK)) assert.equal(built.includes(task), false, `${task}: an object task is built as a step`)
})
