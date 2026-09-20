// The "Close the Doors Nobody Should Use" group, taken to the V1 standard:
// docs/plans/close-doors-spec.md holds the outcome, the Microsoft Learn page
// behind every technical claim and the date it was checked. One test per
// acceptance item in that spec.
//
// A test here reads the OPENED STEP, not the content file, wherever the claim is
// about what an admin sees: the acceptance is what is on screen (CLAUDE.md), and
// a fact that reaches only one lifecycle state is the defect this group had.
// Where a claim is about a state no fixture reaches, the compiled package block
// is read instead, because that is the text the state would draw.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shared, stepById } from '../../content/content.ts'
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
import { membersOf } from '../../roadmap/stepGroups.ts'
import { QUESTION_STEP, answerKey, answerTextFor, questionLabels, questionOptions } from '../../roadmap/answers.ts'
import type { MappingState } from '../../mapping/types.ts'

/** The group's four members, in registry order (roadmap/stepGroups.ts). */
const CLOSE_DOORS = ['s-goal-block-legacy-auth', 's-goal-block-device-code', 's-goal-block-auth-transfer', 's-goal-block-unsupported-platforms']
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

/** A step's help-desk lines from the content file. */
const helpDeskOf = (id: string): string[] => ((stepById[id] as unknown as { more?: { helpDesk?: unknown } }).more?.helpDesk ?? []) as string[]

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
// The group itself
// ---------------------------------------------------------------------------

test('the group draws its five members in the spec order', () => {
  assert.deepEqual([...membersOf('close-doors')], CLOSE_DOORS)
})

// ---------------------------------------------------------------------------
// Block Legacy Authentication (spec section 2)
// ---------------------------------------------------------------------------

test('A1: About says legacy protocols cannot complete MFA, not that they might', () => {
  const about = aboutOf(bodiesOf('demo').get('s-goal-block-legacy-auth')!)
  assert.match(about, /cannot complete multifactor authentication/)
  assert.doesNotMatch(about, /can prevent MFA/)
})

test('A2: the client-apps condition is set through Configure: Yes, in create and in correct', () => {
  // Create: no fixture is missing this policy, so the authored block is read.
  const create = blockText('s-goal-block-legacy-auth', 'entra.create')
  assert.match(create, /set \*\*Configure\*\* to \*\*Yes\*\*/)
  assert.match(create, /Left at \*\*No\*\*, the condition matches every client app/)
  // Correct: the demo's policy differs from the target, so this is on screen.
  const tasks = tasksTextOf(bodiesOf('demo').get('s-goal-block-legacy-auth')!)
  assert.match(tasks, /"Configure" is set to "Yes"/)
})

test('A3: help desk names the one Exchange ActiveSync quarantine email', () => {
  const lines = helpDeskOf('block-legacy-auth')
  assert.ok(lines.some((l) => /one quarantine email with the reason/.test(l)), lines.join('\n'))
})

test('A4: help desk says a certificate is still legacy authentication here', () => {
  const lines = helpDeskOf('block-legacy-auth')
  assert.ok(lines.some((l) => /still on legacy authentication, and this policy still blocks it/.test(l)), lines.join('\n'))
})

test('A5: the step and its package cite the same Learn page', () => {
  const b = bodiesOf('demo').get('s-goal-block-legacy-auth')!
  assert.equal(b.learnUrl, 'https://learn.microsoft.com/entra/identity/conditional-access/policy-block-legacy-authentication')
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { url: string }[] } }>)['s-goal-block-legacy-auth']?.meta
  assert.ok((meta?.verifiedSources ?? []).some((s) => s.url === b.learnUrl), 'the package cites a different page from the step')
})

test('A6: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn('s-goal-block-legacy-auth'), '2026-09-19')
  assert.equal(bodiesOf('demo').get('s-goal-block-legacy-auth')!.sourceLine, 'Source checked Sep 19, 2026')
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

/** A content step's own `why`, unfilled. */
const whyOf = (id: string): string => String((stepById[id] as unknown as { why?: string }).why ?? '')

test('B1: About says the mail protocols already refuse a password, and names the one that does not', () => {
  const why = whyOf('block-legacy-auth')
  assert.match(why, /Exchange Online already refuses a password for POP, IMAP and ActiveSync/)
  assert.match(why, /SMTP AUTH is the last route that accepts one/)
  assert.doesNotMatch(why, /may depend on a mail-sending method/)
})

test('B2: About says that route is going too, and carries no date of its own', () => {
  const why = whyOf('block-legacy-auth')
  assert.match(why, /Microsoft is retiring that route too/)
  // walkContent C3: no content string carries a hard date. The retirement's
  // milestones live in docs/plans/close-doors-spec.md section 3.
  assert.doesNotMatch(why, /\b(19|20)\d{2}\b/)
})

test('B3: the folded task offers only supported routes, never a password one', () => {
  const steps = (shared.mailDevices as { steps: string[] }).steps.join('\n')
  assert.match(steps, /SMTP AUTH with OAuth, an Exchange Online connector, or Direct Send for internal recipients only/)
  assert.match(steps, /Graph sendMail API/)
})

test('B4: the exception devices are one step\u2019s second task, and the step they were is gone', () => {
  assert.equal(stepById['s-question-mail-devices'], undefined, 'the carved-out step still has words')
  assert.equal(membersOf('close-doors').includes('s-question-mail-devices'), false)
  // No exception account named: the policy procedure alone, as every other
  // policy step draws. One named: a second task, with the account as its fact.
  assert.deepEqual(bodiesOf('demo').get(LEGACY)!.emergencyAccountTasks?.tasks.map((t) => t.id), ['policy-procedure'])
  const f = fixture('demo')
  const device = f.snapshot.users[0].id
  const key = answerKey(QUESTION_STEP.mailDevices, questionLabels(QUESTION_STEP.mailDevices).decision!)
  const answered = { ...f.mapping, questionAnswers: { ...(f.mapping.questionAnswers ?? {}), [key]: answerTextFor(questionOptions(QUESTION_STEP.mailDevices, 'decision')[1], [device]) } }
  const tasks = bodiesOf('demo', answered).get(LEGACY)!.emergencyAccountTasks!.tasks
  assert.deepEqual(tasks.map((t) => t.id), ['policy-procedure', 'mail-devices-route'])
  assert.match(tasks[1].title, /Move each exception device to a supported mail route/)
  assert.match(tasks[1].steps.join('\n'), /remove its old account exception/)
  assert.equal(checkedOn(LEGACY), '2026-09-19')
})

// ---------------------------------------------------------------------------
// Block Device Code Sign-in (spec section 4)
// ---------------------------------------------------------------------------

/** A step's risk lines from the content file, whatever their `applies`. */
const risksOf = (id: string): string[] =>
  (((stepById[id] as unknown as { more?: { risks?: { text?: string }[] } }).more?.risks ?? []).map((r) => r.text ?? '')) as string[]

test('C1: protocol tracking is a risk on every state, not a line only report-only shows', () => {
  assert.ok(risksOf('block-device-code').some((t) => /later requests in it are blocked as well, which can sign a device out/.test(t)), risksOf('block-device-code').join('\n'))
  // And the create procedure, which is the state an admin meets first, says it too.
  assert.match(blockText('s-goal-block-device-code', 'entra.create'), /later requests in it are blocked too and a device can be signed out/)
})

test('C2: the policy reaching Device Registration Service is a risk, and is in the create procedure', () => {
  assert.ok(risksOf('block-device-code').some((t) => /must exclude the Device Registration Service/.test(t)), risksOf('block-device-code').join('\n'))
  assert.match(blockText('s-goal-block-device-code', 'entra.create'), /also reaches \*\*Device Registration Service\*\*/)
})

test('C3: help desk names the log filter and the property that tells a tracked session apart', () => {
  const lines = helpDeskOf('block-device-code')
  assert.ok(lines.some((l) => /filter by Authentication Protocol for device code/.test(l)), lines.join('\n'))
  assert.ok(lines.some((l) => /Original transfer method in Activity details/.test(l)), lines.join('\n'))
})

test('C4: the authentication-flows condition is set through Configure: Yes', () => {
  assert.match(blockText('s-goal-block-device-code', 'entra.create'), /set \*\*Configure\*\* to \*\*Yes\*\*/)
})

test('C5: the held step names its own outcome, not "the baseline\'s target configuration"', () => {
  // `doneEnd` is the Completion Criteria of a held policy step
  // (stepContract.ts doneWhenOf). No fixture holds this step that way — the
  // fixtures that hold it hold it for a reason with no policy at all — so the
  // step's own sentence is read here, and the rendering of the same field is
  // asserted on Block Authentication Transfer (D5) and Block Unsupported Device
  // Platforms (E5), which the messy fixture does hold.
  const end = String((stepById['block-device-code'] as unknown as { doneEnd?: string }).doneEnd ?? '')
  assert.match(end, /^No sign-in to \{tenant\} completes through device code flow/)
  assert.doesNotMatch(end, /the baseline's target configuration/)
  assert.equal(checkedOn('s-goal-block-device-code'), '2026-09-19')
})

// ---------------------------------------------------------------------------
// Block Authentication Transfer (spec section 5)
// ---------------------------------------------------------------------------

test('D1: About names the flow, not "a transfer path the business may not need"', () => {
  const about = aboutOf(bodiesOf('demo-week2').get('s-goal-block-auth-transfer')!)
  assert.match(about, /scanning a QR code shown in desktop Outlook/)
  assert.match(about, /sign in on the device they are using/)
  assert.doesNotMatch(about, /removes a transfer path/)
})

test('D2: protocol tracking is a risk here too, and is in the create procedure', () => {
  assert.ok(risksOf('block-auth-transfer').some((t) => /later requests in it are blocked as well, which can sign a device out/.test(t)), risksOf('block-auth-transfer').join('\n'))
  assert.match(blockText('s-goal-block-auth-transfer', 'entra.create'), /later requests in it are blocked too and a device can be signed out/)
})

test('D3: the authentication-flows condition is set through Configure: Yes', () => {
  assert.match(blockText('s-goal-block-auth-transfer', 'entra.create'), /set \*\*Configure\*\* to \*\*Yes\*\*/)
})

test('D4: the package cites its Microsoft pages, checked with this group', () => {
  assert.equal(checkedOn('s-goal-block-auth-transfer'), '2026-09-19')
  assert.equal(bodiesOf('demo-week2').get('s-goal-block-auth-transfer')!.sourceLine, 'Source checked Sep 19, 2026')
})

test('D5: the held step\'s Completion Criteria is this step\'s outcome, on screen', () => {
  const b = bodiesOf('messy').get('s-goal-block-auth-transfer')!
  assert.ok(
    b.contract.doneWhen.some((l: string) => /Nobody carries a signed-in session from one device to another/.test(l)),
    b.contract.doneWhen.join('\n'),
  )
  assert.ok(!b.contract.doneWhen.some((l: string) => /the baseline's target configuration/.test(l)), b.contract.doneWhen.join('\n'))
})

test('D6: the finished step says what is true, not that the policy matches a target', () => {
  const done = ((stepById['block-auth-transfer'] as unknown as { doneWhen?: string[] }).doneWhen ?? []).join('\n')
  assert.match(done, /no longer signs anyone in on another/)
})

// ---------------------------------------------------------------------------
// Block Unsupported Device Platforms (spec section 6)
// ---------------------------------------------------------------------------

test('E1: the step says Linux is inside the block, on screen and in the create procedure', () => {
  const about = aboutOf(bodiesOf('demo-week2').get('s-goal-block-unsupported-platforms')!)
  assert.match(about, /only Android, iOS, Windows and macOS reach the tenant/)
  assert.match(about, /Linux and anything that reports no platform are blocked/)
  assert.ok(risksOf('block-unsupported-platforms').some((t) => /Linux is a platform Conditional Access supports and this policy does not exclude/.test(t)), risksOf('block-unsupported-platforms').join('\n'))
  assert.match(blockText('s-goal-block-unsupported-platforms', 'entra.create'), /\*\*Linux\*\* is a platform Conditional Access supports and this target does not exclude/)
})

test('E2: the risk names how the platform is decided, not just that it can be wrong', () => {
  const risks = risksOf('block-unsupported-platforms')
  assert.ok(risks.some((t) => /reads the platform from what the client reports, such as its user agent, and does not verify it/.test(t)), risks.join('\n'))
  assert.ok(!risks.some((t) => /can be treated differently from the device/.test(t)), risks.join('\n'))
})

test('E3: the create procedure keeps the shape Microsoft recommends, through Configure: Yes', () => {
  const create = blockText('s-goal-block-unsupported-platforms', 'entra.create')
  assert.match(create, /set \*\*Configure\*\* to \*\*Yes\*\*/)
  assert.match(create, /include \*\*Any device\*\* and exclude \*\*Android\*\*, \*\*iOS\*\*, \*\*Windows\*\* and \*\*macOS\*\*/)
  // The whole policy is a block, as the recommendation says.
  const tasks = tasksTextOf(bodiesOf('demo-week2').get('s-goal-block-unsupported-platforms')!)
  assert.match(tasks, /Grant → Block access/)
})

test('E4: the package cites its Microsoft page, checked with this group', () => {
  assert.equal(checkedOn('s-goal-block-unsupported-platforms'), '2026-09-19')
  assert.equal(bodiesOf('demo-week2').get('s-goal-block-unsupported-platforms')!.sourceLine, 'Source checked Sep 19, 2026')
})

test('E5: the held step\'s Completion Criteria names the platforms, on screen', () => {
  const b = bodiesOf('messy').get('s-goal-block-unsupported-platforms')!
  assert.ok(
    b.contract.doneWhen.some((l: string) => /Only Android, iOS, Windows and macOS reach /.test(l)),
    b.contract.doneWhen.join('\n'),
  )
})
