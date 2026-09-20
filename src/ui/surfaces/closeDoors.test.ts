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
import { membersOf } from '../../roadmap/stepGroups.ts'

/** The group's five members, in registry order (roadmap/stepGroups.ts). */
const CLOSE_DOORS = ['s-goal-block-legacy-auth', 's-question-mail-devices', 's-goal-block-device-code', 's-goal-block-auth-transfer', 's-goal-block-unsupported-platforms']

/** Every step's body on a fixture, as the Plan composes it (contentReview.test.ts bodiesOf). */
function bodiesOf(name: FixtureName): Map<string, StepBody> {
  setDisplayTimeZone('UTC')
  try {
    const f: Fixture = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
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
