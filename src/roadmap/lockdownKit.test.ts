// Prepare the Lockdown Kit (T2-LK; owner, 2026-10-03; docs/plans/v1.1/plan.md D3):
// Jon's three ZTCA incident switches, each created Off, never Report-only and
// never turned on by the plan, with the emergency access exclusions group the
// only people a switch leaves online. One step in Ongoing Checks and Cleanup,
// complete when all three exist with exact controls and are Off.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from './fixtures/run.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { LOCKDOWN_KIT_GOAL, LOCKDOWN_SWITCHES, switchSource } from './lockdownKit.ts'
import { REVIEWED_SOURCES, baselineConflicts } from './baselineConflict.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { LOCKDOWN_KIT_STEP_ID, REPORT_ONLY_STEP_ID } from './stepIds.ts'
import { groupOf } from './stepGroups.ts'
import { batchMemberOf } from './reportOnlyBatch.ts'
import { buildSchedule } from './schedule.ts'
import { heldRequired } from '../derive/finish.ts'
import { isHeld } from './holds.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import { lockdownKitMilestoneOf, lockdownKitTilesOf } from '../ui/surfaces/lockdownKitStep.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'

type Json = Record<string, unknown>
const SWITCH_NAMES = ['IAC - ZTCA - GLOBAL – BLOCK – Admin Portal', 'IAC - ZTCA - INTUNE - BLOCK - AllApps - ExcludeTrustedLocation', 'IAC- ZTCA - GLOBAL - BLOCK - AllApps -Exclude CA-Global']
/** Jon's own excluded groups, his environment's, which no switch carries. */
const AUTHOR_GROUPS = ['62d67e66-2bc9-43cd-b00c-6326dae53d18', 'e663a7ce-daec-4062-88b8-5970bfec8019']

const kitOf = (steps: readonly Step[]): Step => {
  const kit = steps.find((s) => s.id === LOCKDOWN_KIT_STEP_ID)
  assert.ok(kit, 'the plan has no lockdown kit')
  return kit
}
const usersOf = (body: Json): Json => ((body.conditions as Json).users as Json)

/** The tenant the plan was asked of, with the three switches it creates already there, each as `edit` leaves it. */
function withSwitches(f: Fixture, edit: (body: Json, i: number) => Json | null = (b) => b): Fixture {
  const next = structuredClone(f)
  const ops = kitOf(runFixture(f).steps).action.resolution!.policies
  const rows = (next.snapshot.config.caPolicies as { rows: Json[] }).rows
  ops.forEach((op, i) => {
    const row = edit({ ...structuredClone(op.body), id: `kit-${i}`, createdDateTime: '2026-09-01T09:00:00.000Z', modifiedDateTime: '2026-09-01T09:00:00.000Z' }, i)
    if (row) rows.push(row)
  })
  return next
}

function ctxOf(f: Fixture, r: ReturnType<typeof runFixture>): StepVarContext {
  return { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
}

test('the pinned map hands the three ZTCA switches to the kit and to no other goal, and no reviewed conflict is left', () => {
  assert.deepEqual(PINNED_GOAL_MAP[LOCKDOWN_KIT_GOAL], LOCKDOWN_SWITCHES.map((s) => s.key))
  for (const [goal, keys] of Object.entries(PINNED_GOAL_MAP)) {
    if (goal === LOCKDOWN_KIT_GOAL) continue
    for (const s of LOCKDOWN_SWITCHES) assert.equal(keys.includes(s.key), false, `${goal} still claims ${s.reviewedName}`)
  }
  assert.equal(PINNED_GOAL_MAP['admin-portals-protected'], undefined)
  // The Admin Portal block is a switch now (owner, 2026-10-03): the conflict entry is gone, the mechanism stays.
  assert.deepEqual(REVIEWED_SOURCES, [])
  assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, pinnedPackage()).keys()], [])
})

test('one step in Ongoing Checks and Cleanup creates each switch Off, as Jon wrote it, with only the exclusions group left online', () => {
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const kit = kitOf(r.steps)
  assert.equal(groupOf(kit.id)?.key, 'ongoing')
  assert.equal(kit.kind, 'prerequisite', 'the kit is no policy step: nothing reads it as one to watch or turn on')
  const ops = kit.action.resolution!.policies
  assert.deepEqual(ops.map((o) => o.mode), ['create', 'create', 'create'])
  assert.deepEqual(ops.map((o) => o.body.displayName), SWITCH_NAMES, "the switches keep Jon's names, in escalation order")
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId
  assert.ok(exclusions, 'the premise: the fixture recognises an exclusions group')
  for (const op of ops) {
    const name = String(op.body.displayName)
    assert.equal(op.body.state, 'disabled', `${name}: not created Off`)
    assert.deepEqual(usersOf(op.body).excludeGroups, [exclusions], `${name}: someone other than the exclusions group stays online`)
    for (const g of AUTHOR_GROUPS) assert.equal(JSON.stringify(op.body).includes(g), false, `${name}: carries Jon's own group ${g}`)
    assert.deepEqual((op.body.grantControls as Json).builtInControls, ['block'])
  }
  // Jon's Admin Portal clause names partner tenants it never lists: no form of it can be built, so it goes.
  assert.equal(usersOf(ops[0].body).excludeGuestsOrExternalUsers, undefined)
  // His unmanaged-devices clause names every service provider and stays, as he wrote it.
  assert.deepEqual(usersOf(ops[1].body).excludeGuestsOrExternalUsers, { externalTenants: { membershipKind: 'all' }, guestOrExternalUserTypes: 'serviceProvider' })
  assert.deepEqual((ops[1].body.conditions as Json).locations, { excludeLocations: ['AllTrusted'], includeLocations: ['All'] })
  // switchSource leaves every other policy as it is.
  const intune = pinnedPackage().policies.find((p) => p.displayName === SWITCH_NAMES[1])!
  assert.equal(switchSource(intune as never), intune)
})

test('the kit is not in Create the Policies in Report-only and has no turn-on', () => {
  for (const name of ['demo', 'demo-week2', 'small'] as const) {
    const r = runFixture(withRecoveryTested(withFoundationSettled(fixture(name))))
    const kit = kitOf(r.steps)
    assert.equal(batchMemberOf(kit), null, `${name}: the kit joined the report-only batch`)
    const batch = r.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)
    assert.equal([...(batch?.reportOnlyBatch?.create ?? []), ...(batch?.reportOnlyBatch?.created ?? [])].includes(kit.id), false, `${name}: 3.8 lists the kit`)
    const f = withRecoveryTested(withFoundationSettled(fixture(name)))
    const tasks = stepBodyOf(kit, ctxOf(f, r)).emergencyAccountTasks?.tasks ?? []
    assert.equal(tasks.some((t) => t.steps.includes('Set **Enable policy** to **Report-only** and select **Create**.')), false, `${name}: a switch is created in Report-only`)
    assert.equal(tasks.filter((t) => t.required).some((t) => t.steps.includes('Set **Enable policy** to **On** and select **Save**.')), false, `${name}: the plan asks for a switch to be turned on`)
  }
})

test('every create is the whole procedure turned off, and the runbook says when, who stays online, how, and how to stand down', () => {
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const body = stepBodyOf(kitOf(r.steps), ctxOf(f, r))
  const tasks = body.emergencyAccountTasks!.tasks
  const group = r.input.names!.label(f.mapping.records['__globalExclusion']!.resolvedId!)
  const creates = tasks.filter((t) => t.id.startsWith('create:'))
  assert.deepEqual(creates.map((t) => t.title), SWITCH_NAMES.map((n) => `Create ${n}, turned off`))
  for (const t of creates) {
    assert.equal(t.required, true)
    assert.ok(t.steps.includes(`Name: **${t.title.slice('Create '.length, -', turned off'.length)}**.`), t.steps.join('\n'))
    assert.ok(t.steps.some((l) => l.includes(`exclude`) && l.includes(group)), `${t.title}: the exclusions group is not named\n${t.steps.join('\n')}`)
    assert.equal(t.steps.at(-2), 'Set **Enable policy** to **Off** and select **Create**.')
  }
  assert.equal(body.emergencyAccountTasks!.recommendedTaskId, creates[0].id)
  const flip = tasks.find((t) => t.id === 'flip')!
  assert.equal(flip.title, 'Turn a switch on during an incident')
  assert.equal(flip.required, false)
  for (const label of ['Admin portals switch', 'Unmanaged devices switch', 'Full lockdown switch']) assert.ok(flip.steps.some((l) => l.startsWith(`**${label}**`)), `${label}: no runbook line`)
  assert.ok(flip.steps.some((l) => l.includes(`emergency access account in **${group}**`)), 'the runbook does not say who stays online')
  assert.equal(flip.steps.at(-1), 'Set **Enable policy** to **On** and select **Save**.')
  const stand = tasks.find((t) => t.id === 'stand-down')!
  assert.equal(stand.required, false)
  assert.deepEqual(stand.steps.slice(-2), ['Set **Enable policy** to **Off** and select **Save**.', 'Return to IAMAI and select **Scan to update the plan**.'])
  // The export and AI Info carry the same tasks, the runbook included.
  const exported = stepExportView(kitOf(r.steps), ctxOf(f, r)).whatToDo
  for (const line of ['Turn a switch on during an incident', 'Stand down after the incident', ...creates.map((t) => t.title)]) assert.ok(exported.includes(line), `the export lacks "${line}"`)
  assert.ok(exported.some((l) => /Set Enable policy to Off and select Create\.$/.test(l)), exported.join('\n'))
  // While none exists, the rail counts the switches still to prepare and each is a card.
  assert.equal(lockdownKitMilestoneOf(kitOf(r.steps)), '3 lockdown switches to prepare')
  assert.deepEqual(lockdownKitTilesOf(kitOf(r.steps)).map((t) => [t.label, t.value]), [['Admin portals switch', 'Create turned off'], ['Unmanaged devices switch', 'Create turned off'], ['Full lockdown switch', 'Create turned off']])
})

test('Completed when all three exist with exact controls and Off; a switch found On, in Report-only or not exact keeps it open', () => {
  const base = withRecoveryTested(withFoundationSettled(fixture('demo-week2')))
  // All three, Off and exact: Completed, its cards the three switches' facts.
  {
    const r = runFixture(withSwitches(base))
    const kit = kitOf(r.steps)
    assert.equal(kit.status, 'done')
    assert.equal(kit.state.satisfied, true)
    assert.deepEqual(kit.satisfiedFacts?.map((x) => x.title), SWITCH_NAMES)
    assert.deepEqual(lockdownKitTilesOf(kit), [])
    assert.equal(lockdownKitMilestoneOf(kit), null)
    // The procedure stands in every state: the creates stay, none required.
    const tasks = stepBodyOf(kit, ctxOf(base, r)).emergencyAccountTasks!.tasks
    assert.equal(tasks.filter((t) => t.id.startsWith('create:')).length, 3)
    assert.equal(tasks.some((t) => t.required), false)
  }
  // Found by name alone, with no plan tag: the same.
  {
    const r = runFixture(withSwitches(base, (b) => ({ ...b, description: '' })))
    assert.equal(kitOf(r.steps).status, 'done', 'a switch created by hand under its name is not found')
  }
  // One switch On: not done; the card says it is blocking sign-ins and the task stands it down.
  {
    const f = withSwitches(base, (b, i) => (i === 2 ? { ...b, state: 'enabled' } : b))
    const r = runFixture(f)
    const kit = kitOf(r.steps)
    assert.notEqual(kit.status, 'done', 'a switch that is On reads as prepared')
    assert.equal(lockdownKitMilestoneOf(kit), 'A lockdown switch is On')
    const [tile] = lockdownKitTilesOf(kit)
    assert.deepEqual([tile.label, tile.value, tile.names], ['Full lockdown switch', 'On', [SWITCH_NAMES[2]]])
    assert.match(tile.note ?? '', /blocking sign-ins.*set it Off/)
    const off = stepBodyOf(kit, ctxOf(f, r)).emergencyAccountTasks!.tasks.find((t) => t.required)!
    assert.equal(off.title, `Set ${SWITCH_NAMES[2]} Off`)
    assert.ok(off.steps.includes('Set **Enable policy** to **Off** and select **Save**.'))
  }
  // One in Report-only (as Jon's export ships them): set it Off.
  {
    const r = runFixture(withSwitches(base, (b, i) => (i === 0 ? { ...b, state: 'enabledForReportingButNotEnforced' } : b)))
    const kit = kitOf(r.steps)
    assert.notEqual(kit.status, 'done')
    assert.deepEqual(lockdownKitTilesOf(kit).map((t) => t.value), ['In Report-only: set it Off'])
  }
  // One whose settings differ (an author group kept): correct it.
  {
    const f = withSwitches(base, (b, i) => (i === 1 ? { ...b, conditions: { ...(b.conditions as Json), users: { ...usersOf(b), excludeGroups: [...(usersOf(b).excludeGroups as string[]), AUTHOR_GROUPS[0]] } } } : b))
    const r = runFixture(f)
    const kit = kitOf(r.steps)
    assert.notEqual(kit.status, 'done', 'a switch with another group excluded reads as prepared')
    assert.deepEqual(lockdownKitTilesOf(kit).map((t) => t.value), ['Correct its settings'])
    assert.equal(kit.impactCount, 1)
    const correct = stepBodyOf(kit, ctxOf(f, r)).emergencyAccountTasks!.tasks.find((t) => t.id.startsWith('correct:'))
    assert.ok(correct, 'no correction task')
    assert.equal(correct.title, `Correct ${SWITCH_NAMES[1]}`)
  }
  // One missing: the other two count as prepared, the row counts what is left.
  {
    const r = runFixture(withSwitches(base, (b, i) => (i === 0 ? null : b)))
    const kit = kitOf(r.steps)
    assert.notEqual(kit.status, 'done')
    assert.equal(kit.impactCount, 1)
    assert.equal(lockdownKitMilestoneOf(kit), '1 lockdown switch to prepare')
  }
})

test('the kit moves no other date and never holds the finish', () => {
  const r = runFixture(fixture('demo'))
  const kit = kitOf(r.steps)
  // Dated with the preparation work, but never making Day 0 longer: alone, it adds no day; another prerequisite would.
  const other = { ...structuredClone(kit), id: 's-prereq-something-else' }
  const alone = buildSchedule([structuredClone(kit)], r.schedule.start, r.schedule.activeUsers)
  const withOther = buildSchedule([structuredClone(kit), other], r.schedule.start, r.schedule.activeUsers)
  assert.equal(alone.placement!.context.day0Days, 0, 'the kit lengthened Day 0')
  assert.ok(withOther.placement!.context.day0Days > 0, 'the premise: a prerequisite lengthens Day 0')
  // On the demo it waits on Emergency Access, as every policy the plan creates does, and that wait holds no finish.
  assert.equal(isHeld(kit), true, 'the premise: the kit is held on the demo')
  assert.equal(heldRequired(r.steps).some((s) => s.id === kit.id), false, 'the finish waits on the lockdown kit')
})
