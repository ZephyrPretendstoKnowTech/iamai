// The one policy step piloted on the Establish Emergency Access anatomy (owner,
// 2026-09-19): it draws the task headings, the Tasks Remaining cards and the
// Implementation task frame, from its own Readiness tiles and its own Entra
// procedure — and no other step moves.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { TASK_HEAD, taskHeadingsOf } from './stepHeadings.ts'
import { POLICY_TASK_STEP_IDS, policyCardsOf, policySubjectsOf, portalProcedureOf, usesPolicyTaskAnatomy } from './policyTasks.ts'
import type { ContractReadiness, ReadinessTile } from './stepContract.ts'

const PILOT = 's-goal-admin-session'

function bodyOf(stepId: string, name: FixtureName = 'demo') {
  const value = fixture(name)
  const run = runFixture(value)
  const step = run.steps.find((row) => row.id === stepId)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { step, body: stepBodyOf(step, ctx) }
}

test('the pilot is one step, and it is the only policy step drawn with the task anatomy', () => {
  assert.deepEqual([...POLICY_TASK_STEP_IDS], [PILOT])
  assert.equal(usesPolicyTaskAnatomy(PILOT), true)
  assert.equal(usesPolicyTaskAnatomy('s-goal-mfa-all-users'), false)
})

test('the pilot draws the four task headings; another policy step keeps its defaults', () => {
  assert.deepEqual(taskHeadingsOf(PILOT), TASK_HEAD)
  assert.equal(taskHeadingsOf('s-goal-mfa-all-users'), null)
  // The Emergency Access group's own steps are untouched.
  assert.deepEqual(taskHeadingsOf('s-prereq-break-glass'), TASK_HEAD)
})

test('the pilot projects one Implementation Task, and it is the Entra procedure the step already drew', () => {
  const { body } = bodyOf(PILOT)
  const tasks = body.emergencyAccountTasks
  assert.ok(tasks, 'the pilot step has a task projection')
  assert.equal(tasks.tasks.length, 1)
  const [task] = tasks.tasks
  assert.equal(task.title, 'Create the policy in Report-only')
  assert.equal(tasks.recommendedTaskId, task.id)
  // Every step of the task is a line of the step's own portal channel.
  const portal = body.artifacts.find((a) => a.id === 'portal')!
  const procedure = portalProcedureOf(portal.text())
  assert.deepEqual(task.steps, procedure.steps)
  assert.ok(task.steps.length > 1, 'the whole procedure is carried, not its first line')
  assert.ok(task.steps.some((line) => /Report-only/.test(line)))
  // The resolved settings the procedure lists below it are the task's facts.
  assert.ok((task.facts ?? []).some((fact) => fact.label === 'Name'))
})

test('no other policy step gains a task projection', () => {
  assert.equal(bodyOf('s-goal-mfa-all-users').body.emergencyAccountTasks, null)
  assert.equal(bodyOf('s-goal-block-legacy-auth').body.emergencyAccountTasks, null)
})

test('the Entra procedure is read back as its numbered steps and the settings under its heading', () => {
  const { steps, facts } = portalProcedureOf('1. Open **Entra ID**.\n2. Name it.\n\n### Settings for This Action\n\n- Name: Core - Session\n- Target resources → All resources\n')
  assert.deepEqual(steps, ['Open **Entra ID**.', 'Name it.'])
  assert.deepEqual(facts, [{ label: 'Name', value: 'Core - Session' }, { label: 'Setting', value: 'Target resources → All resources' }])
})

test('a satisfied Readiness tile is a satisfied card, and a tile keeps its own link', () => {
  const tile = (key: string, extra: Partial<ReadinessTile> = {}): ReadinessTile => ({ key, label: key, tone: 'warn', value: key, note: null, ...extra })
  const readiness: ContractReadiness = {
    tiles: [tile('before', { link: { label: 'Open it', href: '#/plan/s-prereq-break-glass' } }), tile('mappings', { link: { label: 'Open mappings', mappings: true } })],
    satisfied: [tile('done', { tone: 'good' }), tile('reach')],
    bar: { key: 'bar', main: 'Ready now' },
  }
  const { body } = bodyOf(PILOT)
  const cards = policySubjectsOf(body.contract, readiness, null).slice(1)
  assert.deepEqual(cards.map((card) => card.satisfied), [false, false, true, true])
  assert.deepEqual(cards[0].link, { label: 'Open it', href: '#/plan/s-prereq-break-glass' })
  // A mappings link has no href, so it is not offered as the card's action.
  assert.equal(cards[1].link, undefined)
})

test('the pilot step reads its Readiness tiles as cards, keeping the prerequisite link', () => {
  const { body } = bodyOf(PILOT)
  const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks).slice(1)
  assert.ok(cards.length > 0)
  assert.deepEqual(cards.map((card) => card.heading), [...body.readiness.tiles, ...body.readiness.satisfied].map((tile) => tile.label))
  for (const tile of body.readiness.tiles) {
    const link = tile.link
    if (link && 'href' in link) assert.ok(cards.some((card) => card.link?.href === link.href), `${tile.key} keeps its link`)
  }
})

test('the policy has a card of its own: its name, its rollout stages, the next one, and the task that reaches it', () => {
  const { body } = bodyOf(PILOT)
  const [card, ...rest] = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  assert.equal(card.heading, 'Conditional Access policy')
  assert.equal(card.upn, body.contract.members[0].name, 'the subject is the policy this step delivers')
  // The checks are the step's own track: three stages ahead of a policy nobody has created.
  assert.equal(card.remainingCount, 3)
  assert.deepEqual(card.completed, [])
  assert.equal(card.title, 'Report-only', 'the next stage is the next check')
  assert.equal(card.detail, body.contract.milestone.label, 'what that stage means is the contract’s own milestone')
  assert.equal(card.instruction, 'Follow Create the policy in Report-only in Implementation Tasks.')
  assert.equal(card.satisfied, false)
  assert.ok(rest.length > 0, 'the Readiness tiles still follow the policy’s own card')
})

test('the step’s own work is in Tasks Remaining on the follow-up scan, where no Readiness tile is left', () => {
  const { body } = bodyOf(PILOT, 'demo-week2')
  assert.deepEqual(body.readiness.tiles, [], 'the premise: nothing unresolved is left in Readiness')
  assert.ok(body.emergencyAccountTasks?.tasks.length, 'the premise: Implementation Tasks still lists the policy’s own task')
  const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  const remaining = cards.filter((card) => !card.satisfied)
  assert.equal(remaining.length, 1, '"No tasks remaining" cannot be shown over a task Implementation Tasks lists')
  assert.equal(remaining[0].title, 'Report-only')
  assert.equal(remaining[0].instruction, 'Follow Create the policy in Report-only in Implementation Tasks.')
})

test('a policy that has reached its last stage with nothing left to submit is a satisfied card', () => {
  const contract = {
    members: [{ key: 'sole', label: null, name: 'Core - Grant - MFA for all users', lifecycle: 'enforced' as const, reviewRequired: false, since: null, line: '' }],
    track: (['not-deployed', 'report-only', 'ready-to-enforce', 'enforced'] as const).map((key, i) => ({ key, label: ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced'][i], reached: true, current: key === 'enforced' })),
    state: { lifecycle: 'enforced' as const, stage: 'In place', word: 'Completed' },
    milestone: { label: 'No change needed.' },
    existing: null,
  } as unknown as Parameters<typeof policyCardsOf>[0]
  const [card] = policyCardsOf(contract, null)
  assert.equal(card.satisfied, true)
  assert.equal(card.title, 'In place')
  assert.deepEqual(card.completed, ['Report-only', 'Ready to enforce', 'Enforced'])
  assert.equal(card.remainingCount, null)
  assert.equal(card.instruction, '')
  // The same policy with a task left to do is not satisfied, whatever stage it is at.
  const withTask = policyCardsOf(contract, { tasks: [{ id: 'policy-procedure', accountId: null, title: 'Update the policy settings', targetUpn: null, required: true, readinessKey: '', evidence: null, actionLabel: '', facts: [], steps: ['Open it.'] }], recommendedTaskId: 'policy-procedure' })
  assert.equal(withTask[0].satisfied, false)
  assert.equal(withTask[0].instruction, 'Follow Update the policy settings in Implementation Tasks.')
})
