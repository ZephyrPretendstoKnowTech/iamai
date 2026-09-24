// The action column's Next milestone headline (owner, 2026-09-23: "Uniformity
// is a BIG deal"). Every step leads its action column with what its next
// milestone IS, in words: Completed on a finished step, and otherwise the
// step's own sentence for it. Never a day — the row's When column carries the
// day — and never a lane word, which is the badge's.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { app, pages } from '../../content/content.ts'
import { SNAPSHOT_FIXTURES, stepSnapshotsOf } from '../../testing/stepSnapshots.ts'
import type { StepVarContext } from './stepVars.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { milestoneHeadlineOf } from './stepContract.ts'
import { stepBodyOf } from './stepBody.ts'

/** A day anywhere in the headline, bare or as an estimate ("Sep 23, 2026", "Est. Aug 31, 2026"). */
const DAY = /\b[A-Z][a-z]{2} \d{1,2}, \d{4}\b/
/** The lane words, and the When column's own words: the badge's and the row's, never the rail's. */
const WHEN = (pages.plan as unknown as { when: Record<string, string> }).when
const NOT_A_HEADLINE = new Set(['Ready', 'Up Next', 'On Hold', 'Deferred', "Doesn't apply", ...Object.entries(WHEN).filter(([k, v]) => !k.startsWith('$') && !v.includes('{')).map(([, v]) => v)])

test('the headline is Completed on a finished step, and otherwise the first of the step’s own words', () => {
  assert.equal(milestoneHeadlineOf('Completed', ['Choose your two emergency access accounts.']), 'Completed')
  assert.equal(milestoneHeadlineOf(null, [null, undefined, '  ', 'Select the group containing your emergency accounts for policy exclusions.', 'Finish the steps this one waits on first.']), 'Select the group containing your emergency accounts for policy exclusions.')
  assert.equal(milestoneHeadlineOf(null, [' Prepare affected passkeys ']), 'Prepare affected passkeys')
  assert.equal(milestoneHeadlineOf(null, [null]), '')
})

test('every step of every fixture leads its action column with words: never a day, never a lane word', () => {
  let checked = 0
  for (const name of SNAPSHOT_FIXTURES) {
    for (const [id, s] of Object.entries(stepSnapshotsOf(name))) {
      const where = `${name}/${id}`
      checked++
      if (s.lane === 'Completed') {
        assert.equal(s.rail, 'Completed', `${where}: a finished step does not read Completed`)
        continue
      }
      assert.notEqual(s.rail.trim(), '', `${where}: an empty milestone`)
      assert.doesNotMatch(s.rail, DAY, `${where}: a day on the rail: "${s.rail}"`)
      assert.equal(NOT_A_HEADLINE.has(s.rail), false, `${where}: a lane or When word on the rail: "${s.rail}"`)
      assert.notEqual(s.rail, s.badge, `${where}: the rail repeats the badge`)
      assert.notEqual(s.rail, s.when, `${where}: the rail repeats the When column`)
    }
  }
  assert.ok(checked > 200, `steps checked: ${checked}`)
})

/** A step of a fixture, opened as the Plan opens it. */
function opened(name: Parameters<typeof fixture>[0], id: string, edit: (value: Fixture) => void = () => {}) {
  const value = structuredClone(fixture(name))
  edit(value)
  const run = runFixture(value, {}, null, value.snapshot.asOf)
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
  // Configure Emergency Exclusions: its group line is the milestone and the decision's help is the instruction, never the same line twice.
  const group = opened('demo', 's-prereq-exclusion-group').body.rail
  assert.equal(group.headline, T.exclusionsGroupRailSub)
  assert.ok(group.instruction !== null && group.instruction !== '' && group.instruction !== group.headline, `1.2's instruction: ${group.instruction}`)
  // Configure Passkey Settings takes no control of its own and still leads with words.
  const passkeys = opened('demo', 's-prereq-passkey-settings').body.rail
  assert.equal(passkeys.instruction, null)
  assert.doesNotMatch(passkeys.headline, DAY)
  assert.notEqual(passkeys.headline, '')
})
