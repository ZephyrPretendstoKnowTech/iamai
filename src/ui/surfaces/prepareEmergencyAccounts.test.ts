// Step 1.1 Prepare Emergency Access Accounts, as the owner walked it on a real
// tenant (2026-09-23), and the shared step layout every step draws with it.
// One test per item the owner approved; each names the item it holds.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { badgeLabel } from './stepContract.ts'
import { stepBodyOf } from './stepBody.ts'

const STEP = 's-prereq-break-glass'

/** The opened step as the board hands it over, on a fixture edited first. */
function opened(name: Parameters<typeof fixture>[0], edit: (value: Fixture) => void = () => {}, id = STEP) {
  const value = structuredClone(fixture(name))
  edit(value)
  const run = runFixture(value)
  const step = run.steps.find((s) => s.id === id)!
  const reading = laneReadings(run.steps).get(id)!
  const titleOf = (x: string): string | null => run.steps.find((s) => s.id === x)?.title ?? null
  const lane = laneViewOf(reading, titleOf)
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { value, run, step, lane, ctx, body: stepBodyOf(step, ctx, { lane }) }
}

const noAccounts = (value: Fixture): void => { value.mapping.breakGlassUserIds = [] }

test('#11 with no account chosen, the row and the badge say the person decides', () => {
  const { lane, body } = opened('small', noAccounts)
  assert.equal(lane.lane, 'Ready')
  assert.equal(lane.substatus, 'Decision', 'choosing the accounts is the next action, not creating one')
  assert.equal(lane.label, 'Ready · Decision')
  assert.equal(badgeLabel(body.contract), 'Ready · Decision')
  // Chosen accounts keep the reading they had.
  assert.notEqual(opened('demo').lane.substatus, 'Decision')
})

test('#11 with no account chosen, AI Info says none is chosen yet, not that one needs correction', () => {
  const { body, step } = opened('small', noAccounts)
  const identity = (step.configurationFindings ?? []).find((f) => f.key === 'account-setup')!
  assert.equal(identity.value, 'No accounts chosen yet')
  const ai = body.artifacts.find((a) => a.id === 'ai')!.text()
  assert.match(ai, /Accounts and identity: No accounts chosen yet/)
  assert.doesNotMatch(ai, /Needs correction/)
})

test('#24 the account cards are numbered by the account display name, not by the order they were picked', () => {
  // Breakglass2 picked first read as "Emergency access account 1".
  const { body, value } = opened('demo', (f) => { f.mapping.breakGlassUserIds = [...f.mapping.breakGlassUserIds].reverse() })
  const nameOf = (id: string | null) => value.snapshot.users.find((u) => u.id === id)?.displayName
  const cards = body.emergencyAccountTasks!.accounts!
  assert.deepEqual(cards.map((c) => [c.heading, nameOf(c.accountId)]), [['Emergency access account 1', 'Break-glass 1'], ['Emergency access account 2', 'Break-glass 2']])
})
