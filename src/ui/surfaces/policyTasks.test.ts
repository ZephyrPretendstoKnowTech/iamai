// Every step that carries work, on the Establish Emergency Access anatomy
// (owner, 2026-09-19): it draws the task headings, the Tasks Remaining cards —
// its own work first, then its Readiness tiles — and the Implementation task
// frame, from its own portal procedure. Only the four Establish Emergency Access
// steps (their own producers, frozen) and the four Direction steps (the decision
// anatomy) are outside it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { TASK_HEAD, taskHeadingsOf } from './stepHeadings.ts'
import { cardWordsOf, drawsTaskAnatomy, policyBarOf, policyCardsOf, policySubjectsOf, portalProcedureOf, taskSubjectOf } from './policyTasks.ts'
import { DIRECTION_STEP_IDS, EMERGENCY_ACCESS_GROUP, isGroupMember, usesTaskAnatomy } from '../../roadmap/stepGroups.ts'
import type { ContractReadiness, ReadinessTile } from './stepContract.ts'

const PILOT = 's-goal-admin-session'

/** `settled` settles the plan's foundation, so nothing holds the step (roadmap/foundations.ts). */
function bodyOf(stepId: string, name: FixtureName = 'demo', settled = false) {
  const value = settled ? withFoundationSettled(fixture(name)) : fixture(name)
  const run = runFixture(value)
  const step = run.steps.find((row) => row.id === stepId)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { step, body: stepBodyOf(step, ctx) }
}

test('every step that carries work draws the task anatomy; only the Direction steps do not', () => {
  const direction = new Set<string>(DIRECTION_STEP_IDS)
  for (const name of ['demo', 'demo-week2', 'midflight', 'messy', 'hostile', 'large', 'mid', 'small'] as FixtureName[]) {
    const value = fixture(name)
    for (const step of runFixture(value).steps) {
      const kind = (contentStepFor(step) as { kind?: string } | undefined)?.kind ?? null
      assert.equal(usesTaskAnatomy(step.id), !direction.has(step.id), `${name}/${step.id} (kind ${kind})`)
      // This module produces the subjects and the tasks for all of them but the
      // four Establish Emergency Access steps, which have their own and are frozen.
      assert.equal(drawsTaskAnatomy(step.id), !direction.has(step.id) && !isGroupMember(step.id, EMERGENCY_ACCESS_GROUP), `${name}/${step.id}`)
    }
  }
  for (const id of [PILOT, 's-goal-mfa-all-users', 's-shared-devices', 's-check-dormant-accounts', 's-prereq-trusted-location', 's-verify-mfa', 's-review-baseline-anything']) assert.equal(drawsTaskAnatomy(id), true, id)
  for (const id of ['s-direction-use', 's-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings']) assert.equal(drawsTaskAnatomy(id), false, id)
})

test('every step that carries work draws the four task headings; a Direction step keeps the decision anatomy', () => {
  for (const id of [PILOT, 's-goal-mfa-all-users', 's-check-dormant-accounts', 's-prereq-trusted-location', 's-prereq-allowed-countries', 's-prereq-service-accounts-group', 's-verify-mfa', 's-ladder-operator-passkey', 's-review-baseline-anything']) {
    assert.deepEqual(taskHeadingsOf(id), TASK_HEAD, id)
  }
  // The Emergency Access group's own steps are untouched.
  assert.deepEqual(taskHeadingsOf('s-prereq-break-glass'), TASK_HEAD)
  assert.equal(taskHeadingsOf('s-direction-use'), null)
})

test('a step with no policy of its own heads its card with the thing the card is about, and checks it by what the scan found', () => {
  // The card shape (owner, 2026-09-20): subject, then what the scan found. The
  // eyebrow says what kind of step it is, which is not what the card is about,
  // and the step's own title is not a check — three of the card's four lines
  // used to be the step's name (quality audit 2.1).
  for (const [id, subject, check] of [
    ['s-prereq-trusted-location', 'Trusted network', 'Not created yet'],
    ['s-check-dormant-accounts', 'Dormant accounts', 'Not reviewed yet'],
    ['s-verify-mfa', 'Sign-in method setup', 'Not prepared yet'],
    ['s-ladder-operator-passkey', 'Your passkey', 'Not registered yet'],
  ] as const) {
    const { step, body } = bodyOf(id)
    assert.equal(taskSubjectOf(step, body.eyebrow, body.title), subject, id)
    assert.notEqual(subject, body.eyebrow, `${id}: the card is headed by the step's kind`)
    const [card] = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, subject, cardWordsOf(step)?.check ?? null)
    assert.equal(card.heading, subject, id)
    assert.equal(card.detail, body.contract.whatToDo.text, id)
    if (!card.satisfied) assert.equal(card.title, check, id)
    assert.notEqual(card.title, body.title, `${id}: the next check is the step's own title`)
  }
  // A policy step still names the policy it delivers, and takes no card words.
  const { step, body } = bodyOf(PILOT)
  assert.equal(taskSubjectOf(step, body.eyebrow, body.title), 'Conditional Access policy')
  assert.equal(cardWordsOf(step), null)
})

test('an object step, the campaign and a check each project their own portal procedure as the Implementation Task', () => {
  for (const [id, title, first] of [
    ['s-prereq-trusted-location', 'Create the trusted location', /Named locations/],
    ['s-prereq-allowed-countries', 'Create the countries location', /Named locations/],
    ['s-prereq-service-accounts-group', 'Create the group', /Groups/],
    ['s-verify-mfa', 'Run the preparation', /aka\.ms\/mfasetup/],
    ['s-check-dormant-accounts', 'Review each account', /Review each account/],
  ] as const) {
    const { step, body } = bodyOf(id)
    const tasks = body.emergencyAccountTasks
    assert.ok(tasks, `${id} projects a task`)
    assert.equal(tasks.tasks.length, 1, id)
    // A step that submits no operation is named by what it asks the reader to
    // do, not by the step's own title (quality audit 2.1).
    assert.equal(tasks.tasks[0].title, title, id)
    assert.notEqual(tasks.tasks[0].title, body.title, id)
    assert.match(tasks.tasks[0].steps[0], first, id)
    // Every line is the step's own portal channel, read back.
    const portal = body.artifacts.find((a) => a.id === 'portal')!
    assert.deepEqual(tasks.tasks[0].steps, portalProcedureOf(portal.text()).steps, id)
    // One task needs no pointer sentence (owner, 2026-09-20): the section below
    // the card carries the same words.
    const [card] = policySubjectsOf(body.contract, body.readiness, tasks, taskSubjectOf(step, body.eyebrow, body.title), cardWordsOf(step)?.check ?? null)
    assert.equal(card.instruction, '', id)
  }
})

test('a baseline-review step reads its reference, and what it waits on is a card of its own', () => {
  const { step, body } = bodyOf('s-review-baseline-iac-app-block-avd-exclude-allowedavdusers-1cq4mc9')
  assert.equal(body.emergencyAccountTasks?.tasks[0].title, 'Read the baseline definition')
  assert.match(body.emergencyAccountTasks!.tasks[0].steps[0], /Baseline reference:/)
  const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, taskSubjectOf(step, body.eyebrow, body.title), cardWordsOf(step)?.check ?? null)
  assert.equal(cards[0].heading, 'Baseline policy')
  assert.ok(cards.length > 1, 'what the step waits on follows as its own card')
  assert.equal(cards.slice(1).every((card) => !card.satisfied), true)
})

test('"No tasks remaining" is shown only where nothing is left', () => {
  // A step the tenant already satisfies: its own card and its tiles are all satisfied.
  const { step: secDefaults, body: inPlace } = bodyOf('s-prereq-security-defaults')
  const done = policySubjectsOf(inPlace.contract, inPlace.readiness, inPlace.emergencyAccountTasks, taskSubjectOf(secDefaults, inPlace.eyebrow, inPlace.title), cardWordsOf(secDefaults)?.check ?? null)
  assert.equal(done.some((card) => !card.satisfied), false)
  assert.equal(policyBarOf(done), 'Every task on this step is complete.')
  // An object step with no Readiness tile at all still has its own work to show.
  const { step: trusted, body: open } = bodyOf('s-prereq-trusted-location')
  assert.deepEqual(open.readiness.tiles, [], 'the premise: no tile stands in this step’s way')
  const cards = policySubjectsOf(open.contract, open.readiness, open.emergencyAccountTasks, taskSubjectOf(trusted, open.eyebrow, open.title), cardWordsOf(trusted)?.check ?? null)
  assert.equal(cards.filter((card) => !card.satisfied).length, 1, '"No tasks remaining" cannot stand over work Implementation Tasks lists')
  assert.equal(policyBarOf(cards), 'Complete the next task shown for each item.')
})

test('the pilot projects one Implementation Task, and it is the Entra procedure the step already drew', () => {
  // The foundation settled, so the step is directed into its procedure
  // (roadmap/foundations.ts): until it is, nothing is handed over.
  const { body } = bodyOf(PILOT, 'demo', true)
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
  assert.equal(card.instruction, '', 'one task needs no pointer sentence')
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
  // The foundation settled, so the card's one action is the procedure it names.
  const { body } = bodyOf(PILOT, 'demo', true)
  const [card, ...rest] = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  assert.equal(card.heading, 'Conditional Access policy')
  assert.equal(card.upn, body.contract.members[0].name, 'the subject is the policy this step delivers')
  // The checks are the step's own track: three stages ahead of a policy nobody has created.
  assert.equal(card.remainingCount, 3)
  assert.deepEqual(card.completed, [])
  assert.equal(card.title, 'Report-only', 'the next stage is the next check')
  assert.equal(card.detail, body.contract.whatToDo.text, 'what that stage means is the step’s own one action')
  // One task needs no pointer (owner, 2026-09-20): the Implementation Tasks
  // section below carries the same words.
  assert.equal(body.emergencyAccountTasks?.tasks.length, 1, 'the premise: this step projects one task')
  assert.equal(card.instruction, '')
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
  assert.equal(remaining[0].instruction, '', 'one task needs no pointer sentence')
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
  const task = { id: 'policy-procedure', accountId: null, title: 'Update the policy settings', targetUpn: null, required: true, readinessKey: '', evidence: null, actionLabel: '', facts: [], steps: ['Open it.'] }
  const withTask = policyCardsOf(contract, { tasks: [task], recommendedTaskId: 'policy-procedure' })
  assert.equal(withTask[0].satisfied, false)
  assert.equal(withTask[0].instruction, '', 'one task needs no pointer sentence')
  // Two tasks, and the card picks one, the way an Emergency Access card does.
  const twoTasks = policyCardsOf(contract, { tasks: [task, { ...task, id: 'second', title: 'Move the mail devices' }], recommendedTaskId: 'policy-procedure' })
  assert.equal(twoTasks[0].instruction, 'Follow Update the policy settings in Implementation Tasks.')
})

const read = (p: string): string => readFileSync(p, 'utf8')

test('the folds read as Emergency Access reads them: a card’s finished checks, and the satisfied subjects', () => {
  // The Emergency Access steps are frozen (owner, 2026-09-19), so the words are
  // theirs and a policy step takes them: the card’s own finished checks fold
  // under "Completed checks · N", and the subjects with nothing left fold under
  // "Satisfied · N". One control, one word, on every step that draws the anatomy.
  const contentStep = read('src/ui/surfaces/ContentStep.tsx')
  assert.equal((contentStep.match(/Completed checks · \{/g) ?? []).length, 1, 'the card fold is drawn more than once, or not at all')
  assert.equal((contentStep.match(/Satisfied · \{/g) ?? []).length, 1, 'the satisfied fold is drawn more than once, or not at all')
})

test('the bar over the evidence link instructs, as Prepare Emergency Access Accounts does', () => {
  const card = (satisfied: boolean) => ({ key: 'policy', accountId: null, heading: 'Conditional Access policy', upn: null, title: satisfied ? 'In place' : 'Report-only', instruction: '', completed: [], remainingCount: null, satisfied })
  assert.equal(policyBarOf([card(false)]), 'Complete the next task shown for each item.')
  assert.equal(policyBarOf([card(true)]), 'Every task on this step is complete.')
  // Not the status word the bar used to show, which the step's badge already says.
  assert.match(read('src/ui/surfaces/ContentStep.tsx'), /barMain=\{isOwnTaskStep \? policyBarOf\(taskSubjects\) : displayedReadiness\.bar\.main\}/)
})

test('the resolved settings stand under the Entra procedure of every step that draws the anatomy, folded, in a disclosure the file already draws', () => {
  // The approved deviation now runs on the one gate the anatomy runs on, so
  // there is no second list and no step can draw one without the other.
  const contentStep = read('src/ui/surfaces/ContentStep.tsx')
  assert.match(contentStep, /taskSettings=\{isOwnTaskStep\}/, 'the settings fold has a gate of its own again')
  assert.match(contentStep, /taskSettings && !!taskFacts\.length && <details className="approved-model-disclosure">/, 'the settings are not in the existing disclosure')
  assert.match(contentStep, /<summary>\{SHARED\.policySettingsForAction\}<\/summary>/, 'the heading is not the artifact’s own')
  // Collapsed by default: no `open` on this disclosure.
  assert.equal(/taskSettings && !!taskFacts\.length && <details className="approved-model-disclosure" open/.test(contentStep), false)
  // What it folds is the task's own facts — the settings the procedure was written against.
  const factsOf = (stepId: string) => bodyOf(stepId).body.emergencyAccountTasks?.tasks[0]?.facts ?? []
  const facts = factsOf(PILOT)
  assert.ok(facts.some((fact) => fact.label === 'Name'))
  assert.ok(facts.some((fact) => /Session →/.test(fact.value) || /Session →/.test(fact.label)))
  // A long settings list and a short one, on policy steps that were not the
  // pilot: each is the resolved policy, named, and nothing is composed here.
  const long = factsOf('s-goal-register-info-protected')
  assert.ok(long.length >= 8, `a long settings list stays long (${long.length})`)
  assert.ok(long.some((fact) => fact.label === 'Name'))
  // An update to a policy that already exists names no Name or Description —
  // the policy is not being created — so its fold is the two lines it changes.
  const few = factsOf('s-goal-mfa-all-users')
  assert.ok(few.length > 0 && few.length <= 4, `a policy with few settings keeps only those (${few.length})`)
  assert.equal(few.some((fact) => fact.label === 'Name'), false)
  assert.ok(few.some((fact) => /^Users → /.test(fact.label)))
  // A procedure that carries no settings heading folds nothing: the guard is the
  // facts, so those steps read exactly as they did.
  assert.deepEqual(factsOf('s-goal-guests-mfa'), [])
})

test('one card fills the row, on every step that draws these cards', () => {
  assert.match(read('src/ui/app.css'), /\.emergency-account-status-grid:has\(> \.emergency-account-status:only-child\) \{\n {2}grid-template-columns: minmax\(0, 1fr\);/)
})
