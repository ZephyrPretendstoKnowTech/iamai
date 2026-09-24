// The "Close the Doors Nobody Should Use" steps, taken to the V1 standard:
// docs/plans/close-doors-spec.md holds the outcome, the Microsoft Learn page
// behind every technical claim and the date it was checked. What is kept here
// is the settings that decide who a block reaches, and the folded exception task;
// the rest of the spec's words are pinned by the step snapshots.
//
// A test here reads the OPENED STEP, not the content file, wherever the claim is
// about what an admin sees: the acceptance is what is on screen (CLAUDE.md), and
// a fact that reaches only one lifecycle state is the defect this group had.
// Where a claim is about a state no fixture reaches, the compiled package block
// is read instead, because that is the text the state would draw.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepById } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { STEP_GROUPS } from '../../roadmap/stepGroups.ts'
import { QUESTION_STEP, answerKey, answerTextFor, questionLabels, questionOptions } from '../../roadmap/answers.ts'
import type { MappingState } from '../../mapping/types.ts'

const LEGACY = 's-goal-block-legacy-auth'

/** Every step's body on a fixture, as the Plan composes it (contentReview.test.ts bodiesOf). */
function bodiesOf(name: FixtureName, mapping?: MappingState): Map<string, StepBody> {
  setDisplayTimeZone('UTC')
  try {
    const f: Fixture = mapping ? { ...fixture(name), mapping } : fixture(name)
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const out = new Map<string, StepBody>()
    for (const step of r.steps) {
      const reading = readings.get(step.id)
      if (!reading) continue
      const lane = laneViewOf(reading, titleOf)
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
      out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
    }
    return out
  } finally {
    setDisplayTimeZone(null)
  }
}

/** A step's risk lines from the content file, whatever their `applies`. */
const risksOf = (id: string): string[] =>
  (((stepById[id] as unknown as { more?: { risks?: { text?: string }[] } }).more?.risks ?? []).map((r) => r.text ?? '')) as string[]

/** The step's About sentence as the opened step fills it. */
const aboutOf = (b: StepBody): string => fillText(String((b.cs as Record<string, unknown>).why ?? ''), b.ex as Record<string, unknown>)

/** Every Implementation Task line the opened step lists, as one block of text. */
const tasksTextOf = (b: StepBody): string =>
  (b.emergencyAccountTasks?.tasks ?? []).map((t) => [t.title, ...t.steps, ...(t.facts ?? []).map((f) => `${f.label}: ${f.value}`)].join('\n')).join('\n')

/** A compiled package block's authored text, for a lifecycle state no fixture reaches. */
function blockText(stepId: string, blockId: string): string {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[stepId]
  const text = pkg?.blocks?.[blockId]?.text
  assert.ok(typeof text === 'string' && text !== '', `${stepId}: the package has no ${blockId} block`)
  return text as string
}

/** The package's own last-checked date (project.ts sourceUpdatedOn reads the max). */
function checkedOn(stepId: string): string {
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { checkedOn: string }[] } }>)[stepId]?.meta
  const dates = (meta?.verifiedSources ?? []).map((s) => s.checkedOn).sort()
  return dates[dates.length - 1] ?? ''
}

// ---------------------------------------------------------------------------
// The create procedures (spec sections 2, 4, 5 and 6)
// ---------------------------------------------------------------------------

test('the create procedures carry the settings that decide who the block reaches: each condition set through Configure: Yes, Device Registration Service reached, Linux inside the block', () => {
  {
    // Create: no fixture is missing this policy, so the authored block is read.
    const create = blockText('s-goal-block-legacy-auth', 'entra.create')
    assert.match(create, /set \*\*Configure\*\* to \*\*Yes\*\*/)
    assert.match(create, /Left at \*\*No\*\*, the condition matches every client app/)
    // On screen, the step's own create sets the condition through Configure: Yes
    // (roadmap/policyProcedure.ts); the demo's correction names only what differs.
    const tasks = tasksTextOf(bodiesOf('demo').get('s-goal-block-legacy-auth')!)
    assert.match(tasks, /Under \*\*Conditions → Client apps\*\*, set \*\*Configure\*\* to \*\*Yes\*\*/)
  }
  {
    assert.ok(risksOf('block-device-code').some((t) => /must exclude the Device Registration Service/.test(t)), risksOf('block-device-code').join('\n'))
    assert.match(blockText('s-goal-block-device-code', 'entra.create'), /also reaches \*\*Device Registration Service\*\*/)
  }
  {
    assert.match(blockText('s-goal-block-device-code', 'entra.create'), /set \*\*Configure\*\* to \*\*Yes\*\*/)
  }
  {
    assert.match(blockText('s-goal-block-auth-transfer', 'entra.create'), /set \*\*Configure\*\* to \*\*Yes\*\*/)
  }
  {
    const about = aboutOf(bodiesOf('demo-week2').get('s-goal-block-unsupported-platforms')!)
    assert.match(about, /only Android, iOS, Windows and macOS reach the tenant/)
    assert.match(about, /Linux and anything that reports no platform are blocked/)
    assert.ok(risksOf('block-unsupported-platforms').some((t) => /Linux is a platform Conditional Access supports and this policy does not exclude/.test(t)), risksOf('block-unsupported-platforms').join('\n'))
    assert.match(blockText('s-goal-block-unsupported-platforms', 'entra.create'), /\*\*Linux\*\* is a platform Conditional Access supports and this target does not exclude/)
  }
  {
    const create = blockText('s-goal-block-unsupported-platforms', 'entra.create')
    assert.match(create, /set \*\*Configure\*\* to \*\*Yes\*\*/)
    assert.match(create, /include \*\*Any device\*\* and exclude \*\*Android\*\*, \*\*iOS\*\*, \*\*Windows\*\* and \*\*macOS\*\*/)
    // The whole policy is a block, as the recommendation says.
    const tasks = tasksTextOf(bodiesOf('demo-week2').get('s-goal-block-unsupported-platforms')!)
    assert.match(tasks, /Under \*\*Grant\*\*, select \*\*Block access\*\*/)
  }
})

// ---------------------------------------------------------------------------
// Moving the exception devices (spec section 3)
//
// This was `s-question-mail-devices`: a `check` step drawing the default
// headings beside four policy steps in the same group, generated only when the
// mail-sending answer named accounts, and in no fixture snapshot. It is now the
// second Implementation Task of Block Legacy Authentication, whose outcome it
// always was (docs/plans/step-redundancy-analysis.md finding 6), so the spec's
// acceptance is read there.
// ---------------------------------------------------------------------------

test('B4: the exception devices are one step\u2019s second task, and the step they were is gone', () => {
  assert.equal(stepById['s-question-mail-devices'], undefined, 'the carved-out step still has words')
  assert.equal(STEP_GROUPS.some((g) => g.members.includes('s-question-mail-devices')), false)
  // No mail account named: the policy's procedures alone, as every other policy
  // step draws. One named that still signs in with legacy authentication: one more
  // task, naming it, before the turn-on that waits for it (walk list 4.x items 5 and 36). One named that no longer
  // does has moved, and there is nothing to do.
  const alone = bodiesOf('demo').get(LEGACY)!.emergencyAccountTasks?.tasks.map((t) => t.id) ?? []
  assert.equal(alone.includes('mail-devices-route'), false)
  assert.deepEqual([alone[0], alone[alone.length - 1]], ['create', 'turn-on'])
  const f = fixture('demo')
  const key = answerKey(QUESTION_STEP.mailDevices, questionLabels(QUESTION_STEP.mailDevices).decision!)
  const naming = (id: string) => ({ ...f.mapping, questionAnswers: { ...(f.mapping.questionAnswers ?? {}), [key]: answerTextFor(questionOptions(QUESTION_STEP.mailDevices, 'decision')[1], [id]) } })
  const sender = f.snapshot.users.find((u) => u.userPrincipalName === 'svc-mailer-1@demo.example.com')!.id
  const tasks = bodiesOf('demo', naming(sender)).get(LEGACY)!.emergencyAccountTasks!.tasks
  const mail = tasks[tasks.length - 2]
  assert.equal(mail.id, 'mail-devices-route')
  assert.equal(tasks[tasks.length - 1].id, 'turn-on')
  assert.equal(mail.title, 'Move each mail account to a supported mail route')
  assert.match(mail.targetLabel ?? '', /svc-mailer-1/)
  assert.match(mail.steps.join('\n'), /SMTP AUTH with OAuth, an Exchange Online connector, or Direct Send \(internal recipients only\)/)
  assert.doesNotMatch(mail.steps.join('\n'), /exception|Record each device/)
  const moved = bodiesOf('demo', naming(f.snapshot.users[0].id)).get(LEGACY)!.emergencyAccountTasks?.tasks.map((t) => t.id) ?? []
  assert.equal(moved.includes('mail-devices-route'), false)
  assert.equal(checkedOn(LEGACY), '2026-09-25')
})
