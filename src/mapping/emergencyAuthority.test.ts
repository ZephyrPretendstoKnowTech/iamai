// The emergency-access set is the operator's, end to end (task 001). Detection
// recommends; confirmation decides. These are the downstream halves of that
// boundary: what the prerequisite consumes, what the exclusions group is checked
// against, what happens when a confirmed account stops being readable, and that
// all three surfaces still read one population.
//
// Foundation C (mapping/safetyChoice.ts) and Foundation A
// (roadmap/operations.ts) are dependencies here, not subjects.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, allFixtures } from '../roadmap/fixtures/index.ts'
import type { Fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { emergencySelection, migrateEmergencySelection } from './emergencyChoice.ts'
import { recommendedEmergencyAccess } from './emergencyAccess.ts'
import type { MappingState } from './types.ts'
import { applyStepDecisions } from '../roadmap/decisions.ts'
import { BREAK_GLASS_STEP_ID } from '../roadmap/stepIds.ts'
import { blockerStepId } from '../roadmap/blockerSteps.ts'
import { isOpenPolicy } from '../roadmap/operations.ts'
import { implementationOffered } from '../ui/surfaces/stepJson.ts'
import { facts } from '../derive/facts.ts'
import { todayView } from '../derive/today.ts'
import { ladder } from '../derive/ladder.ts'
import { factsOf } from '../derive/facts.ts'
import { notPeopleIds } from '../derive/sets.ts'
import type { FixtureRun } from '../roadmap/fixtures/run.ts'
import type { Step } from '../roadmap/types.ts'
import { EXCLUSION_GROUP_STEP_ID } from '../roadmap/stepIds.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { fillText } from '../content/render.ts'
import { stepById } from '../content/content.ts'

const BG_BLOCKER = blockerStepId('breakGlass')
const bgStep = (r: FixtureRun) => r.steps.find((s) => s.id === BG_BLOCKER || s.id === BREAK_GLASS_STEP_ID)
/** The fix lines the emergency step renders: one per failing check (validation/checkFixes.ts). */
const failingFixes = (r: FixtureRun): string[] => (bgStep(r)?.checks?.items ?? []).map((i) => i.fix)
/** Every deny-capable step held behind the emergency prerequisite. */
const heldByEmergency = (r: FixtureRun): string[] => r.steps.filter((s) => (s.blockedBy ?? []).includes(BG_BLOCKER)).map((s) => s.id).sort()
const offeredPolicies = (r: FixtureRun): string[] => r.steps.filter((s) => isOpenPolicy(s) && implementationOffered(s)).map((s) => s.id).sort()
const XG_BLOCKER = blockerStepId('exclusionGroup')
const xgStep = (r: FixtureRun) => r.steps.find((s) => s.id === XG_BLOCKER || s.id === EXCLUSION_GROUP_STEP_ID)
/** The exclusions-group fix lines as the step renders them: the content template filled with the check's own values. */
function fixLines(step: Step, f: Fixture): [string, string][] {
  const cs = stepById['s-prereq-exclusion-group'] as unknown as { whatToDo: { checkFixes: Record<string, string> } }
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const ex = stepVars(step, ctx) as Record<string, unknown>
  return ((ex.failingChecks as [string, Record<string, unknown>][]) ?? []).map(([key, vals]) => [key, fillText(cs.whatToDo.checkFixes[key], { ...ex, ...vals })] as [string, string])
}

/** The same tenant with its emergency ids as an older auto-application left them: in the field, with nothing saying a person chose them. */
function unconfirmed(f: Fixture): Fixture {
  const legacy: MappingState = { ...f.mapping, assumed: { ...(f.mapping.assumed ?? {}), breakGlass: 'detected' } }
  return { ...f, mapping: migrateEmergencySelection(legacy) }
}

test('3+9. before confirmation the recommendation is inert; after it, the confirmed set is exactly what the prerequisite and the exclusions group consume', () => {
  const f = fixture('small')
  const chosen = f.mapping.breakGlassUserIds
  assert.ok(chosen.length >= 2, 'the fixture has emergency accounts to confirm')
  const before = unconfirmed(f)
  assert.deepEqual(before.mapping.breakGlassUserIds, [], 'nothing is authoritative yet')
  assert.deepEqual(before.mapping.breakGlassPriorIds, [...chosen], 'the ids are kept as prior context')
  // The scan still recommends them, on the same evidence as ever.
  assert.ok(recommendedEmergencyAccess(f.snapshot, f.snapshot.config.caPolicies?.rows ?? []).length > 0, 'the accounts are still recommended')

  const r0 = runFixture(before, { mapping: before.mapping })
  // The prerequisite fails closed on the rule that already exists, and holds every deny-capable step.
  assert.ok(failingFixes(r0).includes('second-account'), 'bg.count is what says there is no emergency access')
  assert.notEqual(bgStep(r0)?.status, 'done', 'the step is an operator action, not a finding')
  assert.ok(heldByEmergency(r0).length >= 10, 'every deny-capable step waits on it')
  assert.deepEqual(offeredPolicies(r0), [], 'and no policy operation is offered at all: unconfirmed fails closed')
  // A recommended-but-unconfirmed account is not a required member of the exclusions group.
  const xg0 = r0.steps.flatMap((s) => s.checks?.items ?? []).filter((i) => i.fix === 'all-emergency-accounts')
  assert.deepEqual(xg0, [], 'a nomination is not a missing member of the exclusions group')
  for (const id of chosen) {
    assert.ok(!JSON.stringify(r0.steps.map((s) => s.action)).includes(id), `${id}: no policy operation carries an unconfirmed emergency id`)
  }

  // The operator confirms, through the decision path a Save uses.
  const decided = applyStepDecisions(before.mapping, { [BREAK_GLASS_STEP_ID]: { picked: [...chosen], at: f.snapshot.asOf } })
  assert.deepEqual(decided.breakGlassUserIds, [...chosen])
  const r1 = runFixture({ ...f, mapping: decided }, { mapping: decided })
  assert.equal(r1.input.mapping.breakGlassUserIds.length, chosen.length, 'the prerequisite consumes the confirmed set')
  assert.ok(!failingFixes(r1).includes('second-account'), 'the confirmed set satisfies bg.count')
  assert.ok(offeredPolicies(r1).length > 0, 'confirming is what unblocks the work')
  assert.deepEqual(heldByEmergency(r1), [], 'and nothing waits on the prerequisite once it is met')
  // And the exclusions group is now checked against exactly that set.
  assert.deepEqual([...notPeopleIds(decided)].filter((id) => chosen.includes(id)).sort(), [...chosen].sort(), 'the confirmed accounts are the ones that leave the population')
})

test('7. a confirmed account that this scan cannot read: the choice stands, the step does not, and no candidate inherits it', () => {
  const f = fixture('small')
  const chosen = [...f.mapping.breakGlassUserIds]
  const gone = chosen[0]
  // The same tenant with one confirmed account no longer in the directory, and a
  // fresh obvious candidate standing right beside it.
  const snapshot = structuredClone(f.snapshot)
  snapshot.users = snapshot.users.filter((u) => u.id !== gone)
  delete snapshot.roles.active[gone]
  const stand = snapshot.users.find((u) => !chosen.includes(u.id))!
  stand.displayName = 'Breakglass Spare'
  stand.userPrincipalName = `breakglass-spare@contoso.onmicrosoft.com`
  stand.assignedPlans = []
  const mapping = applyStepDecisions(f.mapping, { [BREAK_GLASS_STEP_ID]: { picked: chosen, at: f.snapshot.asOf } })

  const sel = emergencySelection({ snapshot, mapping })
  assert.deepEqual(sel.confirmedIds, chosen, 'the stored choice is not silently replaced')
  assert.ok(sel.recommendedIds.includes(stand.id), 'the new account is recommended')
  assert.ok(!sel.confirmedIds.includes(stand.id), 'and inherits no confirmation from the one that vanished')

  const r = runFixture({ ...f, snapshot, mapping }, { snapshot, mapping })
  assert.notEqual(bgStep(r)?.status, 'done', 'the emergency prerequisite is unresolved')
  assert.ok((bgStep(r)?.checks?.failing ?? 0) > 0, 'and says so through its own checks')
  // Nothing became available because a candidate could have stood in: every
  // deny-capable step is held behind the prerequisite, where a healthy tenant
  // holds none, and no operation anywhere names the stand-in.
  const healthy = runFixture(f)
  assert.deepEqual(heldByEmergency(healthy), [], 'a tenant whose confirmed accounts are all readable holds nothing')
  assert.ok(heldByEmergency(r).length >= 10, 'the unreadable account holds every deny-capable step')
  assert.ok(!JSON.stringify(r.steps.map((s) => s.action)).includes(stand.id), 'and no policy operation carries the stand-in candidate')
  assert.ok(!(bgStep(r)?.deliveredBy ?? []).includes(stand.id), 'nor does the prerequisite claim it delivered one')
})

test('10. one population: Today, the Plan strip and the campaign lists read the same facts, confirmed or not', () => {
  const cases: [string, Fixture][] = [['demo', fixture('demo')], ['small unconfirmed', unconfirmed(fixture('small'))]]
  for (const [name, f] of cases) {
    const F = facts(f.snapshot, f.mapping)
    assert.deepEqual(todayView(f.snapshot, f.snapshot.asOf, f.mapping).facts, F, `${name}: Today reads the facts`)
    assert.deepEqual(factsOf(ladder(f.snapshot, f.mapping, f.snapshot.asOf)), F, `${name}: the Plan strip and Connect's tile read the same ones`)
    assert.equal(F.kinds.emergency, f.mapping.breakGlassUserIds.length, `${name}: the emergency kind is the confirmed set and nothing else`)
    assert.equal(F.accounts, f.snapshot.users.length, `${name}: every account is counted once`)
  }
  assert.equal(facts(cases[1][1].snapshot, cases[1][1].mapping).kinds.emergency, 0, 'an unconfirmed tenant has no emergency accounts, and its administrators are people')
})

test('9b. an exclusions group that already holds the recommended accounts is never told to remove them', () => {
  const f = fixture('small')
  const chosen = [...f.mapping.breakGlassUserIds]
  const before = unconfirmed(f)
  const group = [...f.groups.values()].find((g) => chosen.every((id) => g.memberIds.includes(id)))
  assert.ok(group, 'the fixture ships the tenant a Breakglass account already in the exclusions group')

  // Nothing is confirmed: the emergency step recommends these accounts, and the
  // exclusions group holds them and no one else.
  const r0 = runFixture(before, { mapping: before.mapping })
  assert.ok(
    recommendedEmergencyAccess(before.snapshot, before.snapshot.config.caPolicies?.rows ?? []).map((c) => c.id).some((id) => chosen.includes(id)),
    'the same accounts are what the emergency step recommends',
  )
  const xg0 = xgStep(r0)
  const fixes0 = (xg0?.checks?.items ?? []).map((i) => i.fix)
  assert.ok(fixes0.includes('members-only-emergency-unconfirmed'), 'the member check says confirm-or-remove, not remove')
  assert.ok(fixes0.includes('no-admin-members-unconfirmed'), 'and so does the admin check')
  assert.ok(!fixes0.includes('members-only-emergency') && !fixes0.includes('no-admin-members'), 'neither unconditional removal line is rendered')
  // The words on screen, through the same fill the step renders with.
  const memberLines = fixLines(xg0!, before).filter(([key]) => key.startsWith('members-only') || key.startsWith('no-admin'))
  assert.equal(memberLines.length, 2, 'both member checks render a line')
  for (const [, line] of memberLines) {
    assert.doesNotMatch(line, /^Remove /, 'no fix line opens by telling the operator to remove them')
    assert.match(line, /Create or Correct Emergency Access Accounts first/i, 'the line offers confirmation first')
    assert.doesNotMatch(line, /\{[a-zA-Z]/, 'and renders with no hole')
  }
  // The check still fails and the group is still blocked: a recommendation
  // approves nobody.
  assert.ok((xg0?.checks?.failing ?? 0) >= 2, 'the member checks still fail')
  assert.notEqual(xg0?.status, 'done', 'the exclusions group is not cleared by a recommendation')
  assert.deepEqual(offeredPolicies(r0), [], 'and no policy operation is offered')

  // The operator confirms exactly those accounts, and the same members are accepted.
  const decided = applyStepDecisions(before.mapping, { [BREAK_GLASS_STEP_ID]: { picked: chosen, at: f.snapshot.asOf } })
  const r1 = runFixture({ ...f, mapping: decided }, { mapping: decided })
  const fixes1 = (xgStep(r1)?.checks?.items ?? []).map((i) => i.fix)
  for (const key of ['members-only-emergency', 'members-only-emergency-unconfirmed', 'no-admin-members', 'no-admin-members-unconfirmed']) {
    assert.ok(!fixes1.includes(key), `${key}: confirmation accepts the members the group already had`)
  }
})

test('no fixture depends on a detection to classify: every emergency account in this repo says a person chose it', () => {
  for (const f of allFixtures()) {
    if (f.mapping.breakGlassUserIds.length === 0) continue
    assert.equal(f.mapping.assumed?.breakGlass, 'confirmed', `${f.name}: the fixture claims emergency accounts nobody chose`)
  }
})
