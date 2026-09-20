// Every policy step on the Establish Emergency Access anatomy (owner,
// 2026-09-19): it draws the task headings, the Tasks Remaining cards — its own
// policy first, then its Readiness tiles — and the Implementation task frame,
// from its own Entra procedure. A step of another kind does not move.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDirectionApproved } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { TASK_HEAD, taskHeadingsOf } from './stepHeadings.ts'
import { POLICY_SETTINGS_STEP_IDS, drawsPolicySettings, policyBarOf, policyCardsOf, policySubjectsOf, portalProcedureOf, usesPolicyTaskAnatomy } from './policyTasks.ts'
import type { ContractReadiness, ReadinessTile } from './stepContract.ts'

const PILOT = 's-goal-admin-session'

/** `settled` approves every Direction answer, so the plan's foundation no longer holds the step (roadmap/foundations.ts). */
function bodyOf(stepId: string, name: FixtureName = 'demo', settled = false) {
  const value = settled ? withDirectionApproved(fixture(name)) : fixture(name)
  const run = runFixture(value)
  const step = run.steps.find((row) => row.id === stepId)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { step, body: stepBodyOf(step, ctx) }
}

test('every policy step draws the task anatomy, and no other step does', () => {
  for (const name of ['demo', 'demo-week2', 'midflight', 'messy', 'hostile', 'large', 'mid', 'small'] as FixtureName[]) {
    const value = fixture(name)
    for (const step of runFixture(value).steps) {
      const kind = (contentStepFor(step) as { kind?: string } | undefined)?.kind ?? null
      assert.equal(usesPolicyTaskAnatomy(step.id), kind === 'policy', `${name}/${step.id} (kind ${kind})`)
    }
  }
  assert.equal(usesPolicyTaskAnatomy(PILOT), true)
  assert.equal(usesPolicyTaskAnatomy('s-goal-mfa-all-users'), true)
  assert.equal(usesPolicyTaskAnatomy('s-shared-devices'), true)
  assert.equal(usesPolicyTaskAnatomy('s-check-dormant-accounts'), false)
  assert.equal(usesPolicyTaskAnatomy('s-direction-use'), false)
})

test('every policy step draws the four task headings; a step of another kind keeps its defaults', () => {
  assert.deepEqual(taskHeadingsOf(PILOT), TASK_HEAD)
  assert.deepEqual(taskHeadingsOf('s-goal-mfa-all-users'), TASK_HEAD)
  assert.equal(taskHeadingsOf('s-check-dormant-accounts'), null)
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

test('another policy step gains its own task projection, from its own Entra procedure', () => {
  for (const id of ['s-goal-mfa-all-users', 's-goal-block-legacy-auth', 's-goal-token-protection']) {
    const { body } = bodyOf(id)
    assert.equal(body.emergencyAccountTasks?.tasks.length, 1, `${id} projects its one procedure`)
    const portal = body.artifacts.find((a) => a.id === 'portal')!
    assert.deepEqual(body.emergencyAccountTasks!.tasks[0].steps, portalProcedureOf(portal.text()).steps, `${id} carries its own lines`)
  }
  // A step whose baseline contradicts itself has no task: nothing done in the portal resolves it.
  const conflict = bodyOf('s-goal-admin-portals-protected')
  assert.equal(conflict.body.contract.state.condition, 'baseline-conflict', 'the premise')
  assert.equal(conflict.body.emergencyAccountTasks, null)
  const [card] = policySubjectsOf(conflict.body.contract, conflict.body.readiness, conflict.body.emergencyAccountTasks)
  assert.equal(card.instruction, '', 'a step with nothing to do points at no task')
})

test('a goal the tenant already delivers has a satisfied policy card and no tasks remaining', () => {
  const { body } = bodyOf('s-goal-mfa-all-users', 'demo-week2')
  assert.equal(body.contract.state.satisfied, true, 'the premise: nothing to create; keep it as it is')
  const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  assert.equal(cards.every((item) => item.satisfied), true)
  assert.equal(cards[0].title, 'In place')
  assert.equal(cards[0].instruction, '')
  assert.deepEqual(cards[0].completed, ['Report-only', 'Ready to enforce', 'Enforced'])
  assert.equal(policyBarOf(cards), 'Every task on this step is complete.')
})

test('a policy in report-only states the stage it has reached and the one it has not', () => {
  const { body } = bodyOf('s-goal-token-protection', 'demo-week2', true)
  const [card] = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  assert.equal(card.title, 'Enforced', 'the next stage')
  assert.deepEqual(card.completed, ['Report-only', 'Ready to enforce'])
  assert.equal(card.remainingCount, 1)
  assert.equal(card.instruction, 'Follow Turn the policy on in Implementation Tasks.')
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
  assert.equal(card.detail, body.contract.whatToDo.text, 'what that stage means is the step’s own one action')
  assert.equal(card.instruction, 'Follow Create the policy in Report-only in Implementation Tasks.')
  assert.equal(card.satisfied, false)
  assert.ok(rest.length > 0, 'the Readiness tiles still follow the policy’s own card')
})

test('the step’s own work is in Tasks Remaining on the follow-up scan, where no Readiness tile is left', () => {
  const { body } = bodyOf(PILOT, 'demo-week2', true)
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
    whatToDo: { kind: 'preserve' as const, text: 'This is in place already: nothing to create. Keep the policy as it is.' },
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

const read = (p: string): string => readFileSync(p, 'utf8')

test('one label for one control: finished work folds under Completed checks wherever the task anatomy draws it', () => {
  const contentStep = read('src/ui/surfaces/ContentStep.tsx')
  assert.equal(/Satisfied · \{/.test(contentStep), false, 'the task anatomy still has a second word for finished work')
  assert.equal((contentStep.match(/Completed checks · \{/g) ?? []).length, 2, 'the card’s fold and the section’s fold do not read alike')
})

test('the bar over the evidence link instructs, as Prepare Emergency Access Accounts does', () => {
  const card = (satisfied: boolean) => ({ key: 'policy', accountId: null, heading: 'Conditional Access policy', upn: null, title: satisfied ? 'In place' : 'Report-only', instruction: '', completed: [], remainingCount: null, satisfied })
  assert.equal(policyBarOf([card(false)]), 'Complete the next task shown for each item.')
  assert.equal(policyBarOf([card(true)]), 'Every task on this step is complete.')
  // Not the status word the bar used to show, which the step's badge already says.
  assert.match(read('src/ui/surfaces/ContentStep.tsx'), /barMain=\{isPolicyTaskStep \? policyBarOf\(taskSubjects\) : displayedReadiness\.bar\.main\}/)
})

test('the resolved settings stand under the Entra procedure of one policy, folded, in a disclosure the file already draws', () => {
  assert.deepEqual([...POLICY_SETTINGS_STEP_IDS], [PILOT], 'the approved deviation is one policy')
  assert.equal(drawsPolicySettings(PILOT), true)
  assert.equal(drawsPolicySettings('s-goal-mfa-all-users'), false)
  const contentStep = read('src/ui/surfaces/ContentStep.tsx')
  assert.match(contentStep, /taskSettings && !!taskFacts\.length && <details className="approved-model-disclosure">/, 'the settings are not in the existing disclosure')
  assert.match(contentStep, /<summary>\{SHARED\.policySettingsForAction\}<\/summary>/, 'the heading is not the artifact’s own')
  // Collapsed by default: no `open` on this disclosure.
  assert.equal(/taskSettings && !!taskFacts\.length && <details className="approved-model-disclosure" open/.test(contentStep), false)
  // What it folds is the task's own facts — the settings the procedure was written against.
  const { body } = bodyOf(PILOT)
  const facts = body.emergencyAccountTasks!.tasks[0].facts ?? []
  assert.ok(facts.some((fact) => fact.label === 'Name'))
  assert.ok(facts.some((fact) => /Session →/.test(fact.value) || /Session →/.test(fact.label)))
})

test('one card fills the row, on every step that draws these cards', () => {
  assert.match(read('src/ui/app.css'), /\.emergency-account-status-grid:has\(> \.emergency-account-status:only-child\) \{\n {2}grid-template-columns: minmax\(0, 1fr\);/)
})
