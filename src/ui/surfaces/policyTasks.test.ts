// Every step that carries work, on the Establish Emergency Access anatomy
// (owner, 2026-09-19): it draws the task headings, the Tasks Remaining cards —
// its own work first, then its Readiness tiles — and the Implementation task
// frame, from its own portal procedure. Only the four Establish Emergency Access
// steps (their own producers, frozen) and the four Direction steps (the decision
// anatomy) are outside it.
import { test } from 'node:test'
import type { RoadmapInput } from '../../roadmap/generate.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from '../../roadmap/fixtures/run.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { cleanupEntry } from './cleanupExport.ts'
import { laneReadings } from './planLanes.ts'
import { readinessBlockersOf } from './planBoard.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { TASK_HEAD, taskHeadingsOf } from './stepHeadings.ts'
import { cardCheckOf, cardWordsOf, drawsTaskAnatomy, isPolicyProcedureTask, policyBarOf, policyCardsOf, policySubjectsOf, portalProcedureOf, taskSubjectOf } from './policyTasks.ts'
import { unavailableReason } from '../../roadmap/operations.ts'
import { DIRECTION_STEP_IDS, EMERGENCY_ACCESS_GROUP, isGroupMember, usesTaskAnatomy } from '../../roadmap/stepGroups.ts'
import { CONTRACT, FINISHED_READING } from './stepContract.ts'
import type { ContractReadiness, ReadinessTile, StepContract } from './stepContract.ts'
import { SNAPSHOT_FIXTURES } from '../../testing/stepSnapshots.ts'

const PILOT = 's-goal-admin-session'

/** `settled` settles the plan's foundation, so nothing holds the step (roadmap/foundations.ts). */
function bodyOf(stepId: string, name: FixtureName = 'demo', settled = false, over: Partial<RoadmapInput> = {}) {
  const value = settled ? withRecoveryTested(withFoundationSettled(fixture(name))) : fixture(name)
  const run = runFixture(value, over)
  // An object a step makes itself is that step's task, not a step (Stage 3): found on its owner.
  const step = run.steps.find((row) => row.id === stepId) ?? run.steps.map((row) => row.objectTask).find((task) => task?.id === stepId)!
  const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
  return { step, body: stepBodyOf(step, ctx) }
}

test('every step that carries work draws the task anatomy and its four headings; only the Direction steps keep the decision anatomy, and the frozen runs draw no policy card', () => {
  {
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
  }
  {
    for (const id of [PILOT, 's-goal-mfa-all-users', 's-check-dormant-accounts', 's-prereq-trusted-location', 's-prereq-allowed-countries', 's-prereq-service-accounts-group', 's-verify-mfa', 's-ladder-operator-passkey', 's-review-baseline-anything']) {
      assert.deepEqual(taskHeadingsOf(id), TASK_HEAD, id)
    }
    // The Emergency Access group's own steps are untouched.
    assert.deepEqual(taskHeadingsOf('s-prereq-break-glass'), TASK_HEAD)
    assert.equal(taskHeadingsOf('s-direction-use'), null)
  }
  {
    // The four Establish Emergency Access steps have their own producers, and the
    // four Direction steps draw the decision anatomy. Neither reaches
    // `policyCardsOf`, so S4-3, S4-4 and S4-5 cannot change a word of them.
    for (const id of ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings', 'cleanup-drill', ...DIRECTION_STEP_IDS]) {
      assert.equal(drawsTaskAnatomy(id), false, id)
    }
  }
})

test('a step with no policy of its own heads its card with the thing the card is about, and checks it by what the scan found', () => {
  // The card shape (owner, 2026-09-20): subject, then what the scan found. The
  // eyebrow says what kind of step it is, which is not what the card is about,
  // and the step's own title is not a check — three of the card's four lines
  // used to be the step's name (quality audit 2.1).
  for (const [id, subject, check] of [
    ['s-prereq-trusted-location', 'Trusted network', 'Not in place'],
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

test('every step projects its own Entra procedure as its Implementation Task, and a baseline conflict projects none', () => {
  {
    for (const [id, title, first] of [
      ['s-prereq-allowed-countries', 'Set up the allowed countries location', /Named locations/],
      // The push-back line comes first: those people are set up before the email reaches them (owner, 2026-09-24).
      ['s-verify-mfa', 'Help each person set up their method', /Anyone likely to push back/],
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
  }
  {
    const { step, body } = bodyOf('s-review-baseline-iac-app-block-avd-exclude-allowedavdusers-1cq4mc9')
    assert.equal(body.emergencyAccountTasks?.tasks[0].title, 'Review this baseline policy')
    assert.match(body.emergencyAccountTasks!.tasks[0].steps[0], /Baseline reference:/)
    const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, taskSubjectOf(step, body.eyebrow, body.title), cardWordsOf(step)?.check ?? null)
    assert.equal(cards[0].heading, 'Baseline policy')
    assert.ok(cards.length > 1, 'what the step waits on follows as its own card')
    assert.equal(cards.slice(1).every((card) => !card.satisfied), true)
  }
  {
    // The foundation settled, so the step is directed into its procedure
    // (roadmap/foundations.ts): until it is, nothing is handed over.
    const { body } = bodyOf(PILOT, 'demo', true)
    const tasks = body.emergencyAccountTasks
    assert.ok(tasks, 'the pilot step has a task projection')
    // A policy step's tasks are its procedures, the same in every state (walk
    // list section 4 item 18): the create and the turn-on.
    assert.deepEqual(tasks.tasks.map((t) => t.title), ['Create the policy in Report-only', 'Turn the policy on'])
    const [task, turnOn] = tasks.tasks
    assert.equal(tasks.recommendedTaskId, task.id)
    // The Entra tab carries the same words.
    const portal = body.artifacts.find((a) => a.id === 'portal')!
    for (const line of [...task.steps, ...turnOn.steps]) assert.ok(portal.text().includes(line), line)
    assert.ok(task.steps.length > 1, 'the whole procedure is carried, not its first line')
    assert.ok(task.steps.some((line) => /Report-only/.test(line)))
    // No settings fold: the procedure names its values itself (item 19).
    assert.deepEqual(task.facts ?? [], [])
    assert.equal(turnOn.steps.length, 2, 'the turn-on is two lines (item 17)')
  }
  {
    for (const id of ['s-goal-mfa-all-users', 's-goal-block-legacy-auth', 's-goal-token-protection']) {
      const { body } = bodyOf(id)
      const titles = body.emergencyAccountTasks?.tasks.map((t) => t.title) ?? []
      assert.equal(titles[0], 'Create the policy in Report-only', `${id} projects its create`)
      assert.ok(titles.includes('Turn the policy on'), `${id} projects its turn-on`)
      const portal = body.artifacts.find((a) => a.id === 'portal')!
      for (const line of body.emergencyAccountTasks!.tasks.flatMap((t) => t.steps)) assert.ok(portal.text().includes(line), `${id} carries its own lines: ${line}`)
    }
    // A step whose baseline contradicts itself has no task: nothing done in the portal resolves it.
    const conflict = bodyOf('s-goal-admin-portals-protected')
    assert.equal(conflict.body.contract.state.condition, 'baseline-conflict', 'the premise')
    assert.equal(conflict.body.emergencyAccountTasks, null)
    const [card] = policySubjectsOf(conflict.body.contract, conflict.body.readiness, conflict.body.emergencyAccountTasks)
    assert.equal(card.instruction, '', 'a step with nothing to do points at no task')
  }
  {
    const { steps, facts } = portalProcedureOf('1. Open **Entra ID**.\n2. Name it.\n\n### Settings for This Action\n\n- Name: Core - Session\n- Target resources → All resources\n')
    assert.deepEqual(steps, ['Open **Entra ID**.', 'Name it.'])
    assert.deepEqual(facts, [{ label: 'Name', value: 'Core - Session' }, { label: 'Setting', value: 'Target resources → All resources' }])
  }
})

test('"No tasks remaining" is shown only where nothing is left, and never over a task Implementation Tasks lists', () => {
  {
    // A step the tenant already satisfies: its own card and its tiles are all satisfied.
    // Security defaults seen on by this plan and now off (V1 decision 6: never seen on, it does not apply).
    const { step: secDefaults, body: inPlace } = bodyOf('s-prereq-security-defaults', 'demo', false, { securityDefaultsSeenOnAt: '2026-08-01T00:00:00.000Z' })
    const done = policySubjectsOf(inPlace.contract, inPlace.readiness, inPlace.emergencyAccountTasks, taskSubjectOf(secDefaults, inPlace.eyebrow, inPlace.title), cardWordsOf(secDefaults)?.check ?? null)
    assert.equal(done.some((card) => !card.satisfied), false)
    assert.equal(policyBarOf(done), 'Every task on this step is complete.')
  }
  {
    const { body } = bodyOf(PILOT, 'demo-week2', true)
    assert.deepEqual(body.readiness.tiles, [], 'the premise: nothing unresolved is left in Readiness')
    assert.ok(body.emergencyAccountTasks?.tasks.length, 'the premise: Implementation Tasks still lists the policy’s own task')
    const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
    const remaining = cards.filter((card) => !card.satisfied)
    assert.equal(remaining.length, 1, '"No tasks remaining" cannot be shown over a task Implementation Tasks lists')
    assert.equal(remaining[0].title, 'Create the policy in Report-only')
    assert.equal(remaining[0].instruction, '', 'one task needs no pointer sentence')
  }
})

test('a policy in place, or at its last stage with nothing to submit, is a satisfied card; one with a task left is not', () => {
  {
    const { body } = bodyOf('s-goal-mfa-all-users', 'demo-week2')
    assert.equal(body.contract.state.satisfied, true, 'the premise: nothing to create; keep it as it is')
    const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
    // Every card: this policy is enforced over a tenant where eleven of
    // thirty-three cannot satisfy it, and that reading is a fact of the finished
    // step under Satisfied, never an open card (walk list 4.x item 2).
    assert.equal(cards.filter((item) => !item.satisfied).length, 0)
    assert.ok(cards.some((item) => item.key === FINISHED_READING && item.satisfied))
    // A finished policy in Turn On MFA for Everyone states its fact (walk list 4.x item 22).
    assert.equal(cards[0].title, 'On')
    assert.equal(cards[0].detail, 'Requires MFA for All users except Core - Exclusions')
    assert.equal(cards[0].instruction, '')
    // The stages it passed through are not checks anybody completed (S4-5): this
    // policy was found in place, on a scan that recorded no date, no evidence and
    // no actor for any stage of it.
    assert.deepEqual(cards[0].completed, [])
    assert.equal(policyBarOf(cards), 'Every task on this step is complete.')
  }
  {
    const contract = {
      members: [{ key: 'sole', label: null, name: 'Core - Grant - MFA for all users', lifecycle: 'enforced' as const, reviewRequired: false, since: null, line: '' }],
      track: (['not-deployed', 'report-only', 'ready-to-enforce', 'enforced'] as const).map((key, i) => ({ key, label: ['Not deployed', 'Report-only', 'Ready to enforce', 'Enforced'][i], reached: true, current: key === 'enforced' })),
      state: { lifecycle: 'enforced' as const, condition: 'healthy' as const, stage: 'In place', word: 'Completed' },
      milestone: { label: 'No change needed.' },
      whatToDo: { kind: 'preserve' as const, text: 'This is in place already: nothing to create. Keep the policy as it is.' },
      existing: null,
    } as unknown as Parameters<typeof policyCardsOf>[0]
    const [card] = policyCardsOf(contract, null)
    assert.equal(card.satisfied, true)
    assert.equal(card.title, 'In place')
    assert.deepEqual(card.completed, [])
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
  }
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

test('the policy has a card of its own: its name, the next check, and the task that passes it', () => {
  // The foundation settled, so the card's one action is the procedure it names.
  const { body } = bodyOf(PILOT, 'demo', true)
  const [card] = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  assert.equal(card.heading, 'Conditional Access policy')
  assert.equal(card.upn, body.contract.members[0].name, 'the subject is the policy this step delivers')
  // The rollout stages are not the card's checks, so there is no count of them
  // and no list of them (S4-5).
  assert.equal(card.remainingCount, null)
  assert.deepEqual(card.completed, [])
  // The card names the task (walk list section 4 item 20): no second line, no pointer.
  assert.equal(card.title, 'Create the policy in Report-only', 'the next check is the task that passes it')
  assert.equal(card.detail, '')
  assert.equal(card.instruction, '')
  assert.equal(card.satisfied, false)
})

/** The words the rollout lifecycle is drawn with (pages.app.plan.stepContract.lifecycle). A card's check is never one of them while the card is open. */
const STAGE_WORDS = Object.values(CONTRACT.lifecycle)

/** Every card this module produces, over the whole snapshot corpus, with the contract that produced it. */
function corpus(): { where: string; contract: StepContract; card: ReturnType<typeof policySubjectsOf>[number] }[] {
  const rows: { where: string; contract: StepContract; card: ReturnType<typeof policySubjectsOf>[number] }[] = []
  for (const name of SNAPSHOT_FIXTURES) {
    const value = structuredClone(fixture(name))
    const run = runFixture(value)
    for (const step of run.steps) {
      if (!drawsTaskAnatomy(step.id)) continue
      const ctx: StepVarContext = { snapshot: value.snapshot, mapping: value.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: value.operatorId, now: value.snapshot.asOf, groups: value.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
      const body = stepBodyOf(step, ctx)
      const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, taskSubjectOf(step, body.eyebrow, body.title), cardWordsOf(step)?.check ?? null)
      for (const card of cards.filter((row) => row.key.startsWith('policy'))) rows.push({ where: `${name}/${step.id}`, contract: body.contract, card })
    }
  }
  return rows
}

test('a policy card states no stage it is not at, and no check the plan never recorded (S4-3, S4-4, S4-5)', () => {
  {
    // The shipped demo: the step's own policy is gone from the plan, and the card
    // read `Enforced` over three completed checks and "This step has no policy for
    // IAMAI to write in this plan". An admin ticked "device code is blocked" off
    // their list and had blocked nothing.
    const { step, body } = bodyOf('s-goal-inforcer-mfa', 'demo-week2')
    assert.equal(body.contract.members.length, 0, 'the premise: no policy member is resolved')
    assert.equal(body.contract.existing, null, 'the premise: no tenant policy delivers it either')
    assert.equal(body.contract.state.lifecycle, 'enforced', 'the premise: the lifecycle still reads enforced')
    const [card] = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, taskSubjectOf(step, body.eyebrow, body.title), cardWordsOf(step)?.check ?? null)
    // The card must not read as delivered: what it has to say is that nothing is
    // coming. The sentence was a paragraph and is now two clauses (owner,
    // 2026-09-22), so this reads for the claim and not the old wording.
    assert.match(card.detail ?? '', /IAMAI writes no policy here/)
    assert.doesNotMatch(card.detail ?? '', /again to rebuild it/, 'the false remedy is back')
    assert.equal(card.title, 'Blocked', 'the check is what holds the step, never the stage it is not at')
    assert.deepEqual(card.completed, [])
    assert.equal(card.remainingCount, null)
    // No card with no policy of its own draws a stage anywhere in the corpus.
    const none = corpus().filter((row) => row.contract.members.length === 0 && row.contract.existing === null && !row.card.satisfied)
    assert.ok(none.length >= 20, `the corpus still holds these cards (${none.length})`)
    for (const row of none) assert.equal(STAGE_WORDS.includes(row.card.title), false, `${row.where}: ${row.card.title}`)
  }
  {
    const open = corpus().filter((row) => !row.card.satisfied)
    assert.ok(open.length > 150, `the corpus still holds these cards (${open.length})`)
    for (const row of open) {
      assert.equal(STAGE_WORDS.includes(row.card.title), false, `${row.where}: the check is the stage word "${row.card.title}"`)
      assert.notEqual(row.card.title, row.contract.state.stage, `${row.where}: the check is the stage the policy is at`)
    }
    // The two cards the audit named: one read `Ready to enforce` over a policy
    // report-only and blocked, the other `Enforced` over one needing correction.
    const held = bodyOf('s-goal-admins-phishing-resistant', 'demo')
    assert.equal(held.body.contract.state.lifecycle, 'report-only', 'the premise: the policy is sitting in report-only')
    const firstTask = (b: typeof held.body): string => b.emergencyAccountTasks!.tasks.find((t) => t.required)!.title
    // Emergency access is not proven: the procedure still stands, and its
    // turn-on names what it waits for and hands over no On line (walk list 4.x
    // items 18 and 44). The card names the task, never Blocked (item 20).
    assert.equal(unavailableReason(held.step), 'escape-hatch-unverified', 'the premise: the way back in holds the policy')
    const turnOn = held.body.emergencyAccountTasks?.tasks.find((t) => t.id === 'turn-on')
    assert.ok(turnOn, 'the turn-on is gone while emergency access is unproven')
    assert.doesNotMatch(turnOn.steps.join(' '), /\*\*On\*\*/, 'the turn-on is handed over while emergency access is unproven')
    assert.match(turnOn.steps.join(' '), /^Wait for .*Configure Emergency Exclusions/)
    const [heldCard] = policySubjectsOf(held.body.contract, held.body.readiness, held.body.emergencyAccountTasks)
    assert.equal(heldCard.title, 'Turn the policy on')
    assert.match(heldCard.detail ?? '', /Configure Emergency Exclusions/)
    // The exclusions edit is Configure Emergency Exclusions' own (item 7): the
    // enforced legacy policy asks for no correction, and its card says who makes it.
    const correction = bodyOf('s-goal-block-legacy-auth', 'demo')
    assert.equal(correction.body.contract.state.stage, 'Enforced', 'the premise: the policy is enforced and lacks the exclusions group')
    assert.equal((correction.body.emergencyAccountTasks?.tasks ?? []).some((t) => t.id === 'correct'), false, 'the step asks for the edit Configure Emergency Exclusions makes')
    const [card] = policySubjectsOf(correction.body.contract, correction.body.readiness, correction.body.emergencyAccountTasks)
    assert.equal(card.title, 'On')
    assert.equal(card.detail, 'Configure Emergency Exclusions adds Core - Exclusions to it.')
    void firstTask
  }
  {
    const rows = corpus()
    // Finish Moving Off Per-User MFA left every fixture's plan: no fixture reads an account on per-user MFA (walk list 4.x item 54).
    assert.ok(rows.length > 190, `the corpus still holds these cards (${rows.length})`)
    for (const row of rows) {
      assert.deepEqual(row.card.completed, [], `${row.where}: the card lists checks somebody completed`)
      assert.equal(row.card.remainingCount, null, `${row.where}: the card counts stages as checks remaining`)
    }
    // A policy the very first scan found enforced: the stage is the tenant fact
    // the step's head states, and the card claims no history for it.
    const { body } = bodyOf('s-goal-mfa-all-users', 'demo-week2')
    assert.equal(body.contract.state.fact, 'Enforced', 'the step still states the stage, as a fact of the tenant')
  }
  {
    const { body } = bodyOf('s-goal-token-protection', 'demo-week2', true)
    const [card] = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
    assert.equal(body.contract.state.lifecycle, 'ready-to-enforce', 'the premise: the policy is sitting in the rollout')
    // Not `Enforced` — a stage it has not reached — and not `Ready to enforce`,
    // the one it is sitting in (S4-4). The check is the task that moves it on.
    assert.equal(card.title, 'Turn the policy on')
    assert.deepEqual(card.completed, [])
    assert.equal(card.remainingCount, null)
    assert.equal(card.instruction, '', 'one task needs no pointer sentence')
  }
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

// The turn-on waits on the emergency drill: the task stands in every state
// (walk list section 4 item 18), and the policy's card says what it waits on,
// "Turn the policy on · Report-only blocked no one. After Verify Emergency
// Access." (item 20). Its Enable policy: On lines wait with it (enforceWaits.test.ts):
// the task reads the wait until the drill is recorded.
test('while the emergency drill is outstanding the turn-on stands, reads the wait, and the card names the drill', () => {
  const f = withFoundationSettled(structuredClone(fixture('demo-week2')))
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === 's-goal-token-protection')
  assert.ok(step, 'the premise: demo-week2 plans the token-protection step')
  assert.equal(step.state.lifecycle, 'ready-to-enforce', 'the premise: the step is ready to turn on')
  const drill = (run.schedule.cleanup?.rows ?? []).find((r) => r.kind === 'drill')
  assert.ok(drill && drill.done === null, 'the premise: the drill has not been done')
  const title = cleanupEntry('drill')?.title
  assert.ok(title, 'the drill row has a title to name it by')

  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  const body = stepBodyOf(step, ctx, { enforceWaits: [title] })
  const turnOn = body.emergencyAccountTasks?.tasks.find((t) => t.title === 'Turn the policy on')
  assert.ok(turnOn, 'the turn-on is drawn')
  // It names what it waits for (walk list 4.x item 44).
  assert.deepEqual(turnOn.steps, [`Wait for ${title}; leave this policy in Report-only until then.`], 'the turn-on reads the wait')
  assert.doesNotMatch(turnOn.steps.join('\n'), /Enable policy\*\* to \*\*On/, 'the turn-on is handed over before the drill')
  const [card] = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks)
  assert.equal(card.title, 'Turn the policy on')
  assert.equal(card.detail, `Report-only blocked no one. After ${title}.`)
})

test('Turn Off Security Defaults reads "On" only where the scan read them on, and no check where it read neither', () => {
  const cardsOf = (snapshot: ReturnType<typeof fixture>['snapshot']) => {
    const f = { ...fixture('messy'), snapshot }
    const run = runFixture(f)
    const step = run.steps.find((s) => s.id === 's-prereq-security-defaults')!
    assert.notEqual(step.status, 'done', 'the premise: the step is open')
    const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, directory: run.input.directory, naming: run.coverage.organisation.naming }
    const body = stepBodyOf(step, ctx)
    const ex = body.ex as Record<string, unknown>
    return policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, taskSubjectOf(step, body.eyebrow, body.title), cardCheckOf(step, ex), body.ownCard)
  }
  const read = fixture('messy').snapshot
  assert.ok(cardsOf(read).some((card) => card.heading === 'Security defaults' && card.title === 'On'), 'read on: the card says so')
  const unread = structuredClone(read)
  unread.config.securityDefaults = { status: 'error', rows: null, reason: 'request failed' } as unknown as typeof unread.config.securityDefaults
  assert.ok(!cardsOf(unread).some((card) => card.title === 'On'), 'read neither way: no card claims they are on')
})
