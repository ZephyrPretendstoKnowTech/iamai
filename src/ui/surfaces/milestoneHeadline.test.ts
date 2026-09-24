// The action column's Next milestone headline (owner, 2026-09-23: "Uniformity
// is a BIG deal"). Every step leads its action column with what its next
// milestone IS, in words: Completed on a finished step, and otherwise the
// step's own sentence for it. Never a day — the row's When column carries the
// day — and never a lane word, which is the badge's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDirectionApproved } from '../../roadmap/fixtures/run.ts'
import { app, engine, pages } from '../../content/content.ts'
import { usesDecisionAnatomy } from '../../roadmap/stepGroups.ts'
import { SNAPSHOT_FIXTURES, fixtureStepSnapshotsOf } from '../../testing/stepSnapshots.ts'
import type { StepVarContext } from './stepVars.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { milestoneHeadlineOf, readinessLeadOf } from './stepContract.ts'
import { stepBodyOf } from './stepBody.ts'
import { isPolicyProcedureTask } from './policyTasks.ts'
import { EXCLUSIONS_RECORD_KEY } from '../../mapping/safetyChoice.ts'

/** A day anywhere in the headline, bare or as an estimate ("Sep 23, 2026", "Est. Aug 31, 2026"). */
const DAY = /\b[A-Z][a-z]{2} \d{1,2}, \d{4}\b/
/** The lane words, and the When column's own words: the badge's and the row's, never the rail's. */
const WHEN = (pages.plan as unknown as { when: Record<string, string> }).when
const NOT_A_HEADLINE = new Set(['Ready', 'Up Next', 'On Hold', 'Deferred', "Doesn't apply", ...Object.entries(WHEN).filter(([k, v]) => !k.startsWith('$') && !v.includes('{')).map(([, v]) => v)])
/** The engine's all-clear milestones: true of a finished step only, never the headline of an open one. */
const ALL_CLEAR = new Set([engine.milestone.preserve, engine.milestone.none])
/** How many sentences a line holds. */
const sentences = (s: string): number => (s.match(/[.!?](?=\s|$)/g) ?? []).length

/** Every fixture as it is, and with Define Your Rollout Scope approved: the state the smoke drives on demo-week2, where the engine's milestones carry their days. */
const TENANTS = SNAPSHOT_FIXTURES.flatMap((name) => [{ name, value: () => fixture(name) }, { name: `${name}+direction`, value: () => withDirectionApproved(fixture(name)) }])

test('the headline is Completed on a finished step, and otherwise the first of the step’s own words', () => {
  assert.equal(milestoneHeadlineOf('Completed', ['Choose your two emergency access accounts.']), 'Completed')
  assert.equal(milestoneHeadlineOf(null, [null, undefined, '  ', 'Select the group containing your emergency accounts for policy exclusions.', 'Finish the steps this one waits on first.']), 'Select the group containing your emergency accounts for policy exclusions.')
  assert.equal(milestoneHeadlineOf(null, [' Prepare affected passkeys ']), 'Prepare affected passkeys')
  assert.equal(milestoneHeadlineOf(null, [null]), '')
  // A sentence carrying a day, or the step's own day as this display writes it, is passed over; so is an all-clear.
  assert.equal(milestoneHeadlineOf(null, ['Create the policy in report-only on Aug 31, 2026 (estimated).', 'Create the policy in Report-only']), 'Create the policy in Report-only')
  assert.equal(milestoneHeadlineOf(null, ['Continue observation and collect the missing evidence. Review from 29 Aug 2026.', 'Block Authentication Transfer'], ['29 Aug 2026']), 'Block Authentication Transfer')
  assert.equal(milestoneHeadlineOf(null, [engine.milestone.preserve, engine.milestone.none, 'Block Legacy Authentication']), 'Block Legacy Authentication')
  assert.equal(milestoneHeadlineOf('Completed', [engine.milestone.none]), 'Completed')
})

test('every step of every fixture leads its action column with words: never a day, never a lane word, never an all-clear on open work', () => {
  let checked = 0
  for (const { name, value } of TENANTS) {
    for (const [id, s] of Object.entries(fixtureStepSnapshotsOf(value()))) {
      const where = `${name}/${id}`
      checked++
      if (s.lane === 'Completed') {
        assert.equal(s.rail, 'Completed', `${where}: a finished step does not read Completed`)
        continue
      }
      assert.notEqual(s.rail.trim(), '', `${where}: an empty milestone`)
      assert.doesNotMatch(s.rail, DAY, `${where}: a day on the rail: "${s.rail}"`)
      assert.equal(NOT_A_HEADLINE.has(s.rail), false, `${where}: a lane or When word on the rail: "${s.rail}"`)
      assert.equal(ALL_CLEAR.has(s.rail), false, `${where}: an open ${s.lane} ${s.substatus ?? ''} row heads with an all-clear: "${s.rail}"`)
      assert.notEqual(s.rail, s.badge, `${where}: the rail repeats the badge`)
      assert.notEqual(s.rail, s.when, `${where}: the rail repeats the When column`)
    }
  }
  assert.ok(checked > 400, `steps checked: ${checked}`)
})

test('an open step heads its column with words it already draws: never an engine sentence of its own, never a lead of several sentences', () => {
  // Steps after 5.1 are frozen: their words do not change, only where they
  // stand. The engine's milestone sentence ("Finish the steps this one waits on
  // first.", "Confirm and save the required decision.") is on a step's screen
  // only where its Readiness bar draws the step's one action, and a lead of
  // several sentences is an explanation, not a headline (messy 4.5's 588 characters).
  let checked = 0
  for (const { name, value } of TENANTS) {
    const f = value()
    const run = runFixture(f, {}, null, f.snapshot.asOf)
    const onBoard = laneReadings(run.steps)
    for (const step of run.steps.filter((s) => onBoard.has(s.id))) {
      const { lane, body } = openedIn(f, run, step.id)
      if (lane.lane === 'Completed') continue
      const where = `${name}/${step.id}`
      const c = body.contract
      const lead = readinessLeadOf(c)
      // A policy step whose tasks are all done draws its own action, as a step with no task list does (stepBody.ts).
      const tasks = body.emergencyAccountTasks?.tasks ?? []
      const noTask = tasks.some(isPolicyProcedureTask) ? !tasks.some((t) => t.required) : !body.instructed && body.emergencyAccountTasks === null
      const drawn = noTask && !usesDecisionAnatomy(step.id) ? lead : null
      const { headline, barLead } = body.rail
      checked++
      if (headline === c.milestone.label) assert.equal(headline, drawn, `${where}: heads with the engine's sentence, which the step does not draw: "${headline}"`)
      if (lead !== null && sentences(lead) > 1) assert.notEqual(headline, lead, `${where}: heads with a lead of ${sentences(lead)} sentences`)
      // The one action said once: what the headline took, the bar no longer says.
      if (drawn !== null && barLead !== null) assert.equal(barLead.includes(headline), false, `${where}: the Readiness bar repeats the headline: "${headline}"`)
      if (drawn !== null && !drawn.includes(headline)) assert.equal(barLead, drawn, `${where}: the bar lost a lead the headline did not take`)
    }
  }
  assert.ok(checked > 300, `steps checked: ${checked}`)
})

test('a dated plan and a long explanation each head with the step’s own words', () => {
  // Once Direction is approved the engine dates its milestones; the column does not.
  const approved = withDirectionApproved(fixture('demo-week2'))
  const run = runFixture(approved, {}, null, approved.snapshot.asOf)
  for (const id of ['s-goal-register-info-protected', 's-goal-block-auth-transfer', 's-goal-token-protection']) {
    const { lane, body } = openedIn(approved, run, id)
    assert.notEqual(lane.lane, 'Completed', `the premise: ${id} is open`)
    assert.match(body.contract.milestone.label, DAY, `the premise: ${id}'s engine milestone carries its day`)
    assert.doesNotMatch(body.rail.headline, DAY, `${id}: "${body.rail.headline}"`)
  }
  // Turn Off Security Defaults' lead stays whole in its step, under the headline its task gives.
  const defaults = opened('messy', 's-prereq-security-defaults').body
  assert.equal(defaults.rail.headline, defaults.emergencyAccountTasks?.tasks[0]?.title)
  assert.equal(defaults.rail.barLead, readinessLeadOf(defaults.contract))
  // A step on hold for its baseline's contradiction heads with the first of its bar's two sentences, and the bar keeps the other.
  const portals = opened('demo', 's-goal-admin-portals-protected').body.rail
  assert.equal(portals.headline, 'This step is on hold until the baseline author resolves a contradiction.')
  assert.equal(portals.barLead, 'There is nothing for you to do.')
})

/** A step of a fixture, opened as the Plan opens it. */
function opened(name: Parameters<typeof fixture>[0], id: string, edit: (value: Fixture) => void = () => {}) {
  const value = structuredClone(fixture(name))
  edit(value)
  return openedIn(value, runFixture(value, {}, null, value.snapshot.asOf), id)
}

/** A step of a run, opened as the Plan opens it. */
function openedIn(value: Fixture, run: ReturnType<typeof runFixture>, id: string) {
  const step = run.steps.find((s) => s.id === id)!
  const titleOf = (x: string): string | null => run.steps.find((s) => s.id === x)?.title ?? null
  const lane = laneViewOf(laneReadings(run.steps).get(id)!, titleOf)
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { lane, body: stepBodyOf(step, ctx, { lane }) }
}

test('1.1 and 1.2 read their milestone in words over their instruction line, and say each once', () => {
  const T = (app.plan as unknown as { emergencyTasks: { chooseAccounts: string; chooseSecondAccount: string }; exclusionsGroupRailSub: string })
  // Prepare Emergency Access Accounts: the choice while it is still to make, then its checks; the decision's help under it in every state.
  const none = opened('small', 's-prereq-break-glass', (f) => { f.mapping.breakGlassUserIds = [] }).body.rail
  const one = opened('small', 's-prereq-break-glass', (f) => { f.mapping.breakGlassUserIds = f.mapping.breakGlassUserIds.slice(0, 1) }).body.rail
  assert.equal(none.headline, T.emergencyTasks.chooseAccounts)
  assert.equal(one.headline, T.emergencyTasks.chooseSecondAccount)
  assert.equal(none.instruction, 'Select the accounts dedicated to emergency access, then select Done.')
  const accounts = opened('demo', 's-prereq-break-glass')
  assert.equal(accounts.lane.lane === 'Completed', false, 'the premise: 1.1 is open on the initial scan')
  assert.doesNotMatch(accounts.body.rail.headline, DAY)
  assert.equal(accounts.body.rail.instruction, 'Select the accounts dedicated to emergency access, then select Done.')
  assert.equal(opened('demo-week2', 's-prereq-break-glass').body.rail.headline, 'Completed')
  // Configure Emergency Exclusions (owner audit 1.2 #1, #2): the group line is the
  // instruction under the bar in every state, as 1.1's picker line is; the
  // milestone above it names what is left, moving on once a group is chosen.
  const G = (app.plan as unknown as { emergencyTasks: Record<string, string> }).emergencyTasks
  const unchosen = opened('demo', 's-prereq-exclusion-group', (f) => { f.mapping.records = Object.fromEntries(Object.entries(f.mapping.records ?? {}).filter(([k]) => k !== EXCLUSIONS_RECORD_KEY)) }).body.rail
  assert.equal(unchosen.headline, G.chooseExclusionsGroup)
  assert.equal(unchosen.instruction, T.exclusionsGroupRailSub)
  // demo: Core - Exclusions is chosen and four policies do not exclude it yet.
  const group = opened('demo', 's-prereq-exclusion-group').body.rail
  assert.equal(group.headline, 'Exclude Core - Exclusions from 4 policies.')
  assert.equal(group.instruction, T.exclusionsGroupRailSub)
  // messy: the chosen group holds members that are not the emergency accounts.
  assert.equal(opened('messy', 's-prereq-exclusion-group').body.rail.headline, "Remove the members that aren't emergency access accounts from Core - Exclusions.")
  assert.equal(opened('demo-week2', 's-prereq-exclusion-group').body.rail.headline, 'Completed')
  // Configure Passkey Settings takes no control of its own and still leads with words.
  const passkeys = opened('demo', 's-prereq-passkey-settings').body.rail
  assert.equal(passkeys.instruction, null)
  assert.doesNotMatch(passkeys.headline, DAY)
  assert.notEqual(passkeys.headline, '')
})
