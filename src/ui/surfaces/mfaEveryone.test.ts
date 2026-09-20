// The "Turn On MFA for Everyone" group, taken to the V1 standard:
// docs/plans/mfa-everyone-spec.md holds the outcome, the Microsoft Learn page
// behind every technical claim and the date it was checked. One test per
// acceptance item in that spec.
//
// A test here reads the OPENED STEP wherever the claim is about what an admin
// sees, because that is the acceptance (CLAUDE.md). Where a claim belongs to a
// lifecycle state no fixture reaches — and three of this group's seven steps
// draw no Implementation Task at all on either demo snapshot, because they are
// not policy steps — the compiled package block is read instead, since that is
// the text the state would draw.
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
import { rowWho } from './rowWho.ts'
import { membersOf } from '../../roadmap/stepGroups.ts'
import type { MappingState } from '../../mapping/types.ts'

/** The group's seven members, in registry order (roadmap/stepGroups.ts). */
const MFA_EVERYONE = [
  's-goal-register-info-protected',
  's-goal-device-registration-mfa',
  's-verify-mfa',
  's-prereq-security-defaults',
  's-goal-mfa-all-users',
  's-goal-guests-mfa',
  's-prereq-per-user-mfa',
]

/** Every step's body on a fixture, as the Plan composes it (closeDoors.test.ts bodiesOf). */
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

/** The Impact a plan row shows for a step, on a fixture. */
function impactOf(name: FixtureName, id: string): string {
  setDisplayTimeZone('UTC')
  try {
    const f = fixture(name)
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const step = r.steps.find((s) => s.id === id)
    assert.ok(step, `${id} is not generated on ${name}`)
    return rowWho(step!)
  } finally {
    setDisplayTimeZone(null)
  }
}

/** A step's help-desk lines from the content file. */
const helpDeskOf = (id: string): string[] => ((stepById[id] as unknown as { more?: { helpDesk?: unknown } }).more?.helpDesk ?? []) as string[]

/** A step's risk sentences from the content file, whatever each one applies to. */
const risksOf = (id: string): string[] =>
  (((stepById[id] as unknown as { more?: { risks?: { text: string }[] } }).more?.risks ?? []) as { text: string }[]).map((r) => r.text)

/** A content step's own `why`, unfilled. */
const whyOf = (id: string): string => String((stepById[id] as unknown as { why?: string }).why ?? '')

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

/** Every string a step's own content entry holds, flattened, for a "said nowhere else" check. */
function everyString(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const v of value) everyString(v, out)
  else if (value && typeof value === 'object') for (const v of Object.values(value)) everyString(v, out)
  return out
}

// ---------------------------------------------------------------------------
// The group itself
// ---------------------------------------------------------------------------

test('the group draws its seven members in the spec order', () => {
  assert.deepEqual([...membersOf('mfa-everyone')], MFA_EVERYONE)
})

// ---------------------------------------------------------------------------
// Protect Sign-in Method Registration (spec section 2)
// ---------------------------------------------------------------------------

const REGISTER = 's-goal-register-info-protected'

test('A1: the create procedure sets Configure to Yes before naming the locations', () => {
  // On screen: the demo and the follow-up both draw this step's create task.
  const tasks = tasksTextOf(bodiesOf('demo').get(REGISTER)!)
  assert.match(tasks, /Conditions > Locations: set \*\*Configure\*\* to \*\*Yes\*\*/)
  assert.match(tasks, /Left at \*\*No\*\*, the condition matches every location/)
})

test('A2: the correct-conditions procedure sets Configure to Yes too', () => {
  const correct = blockText(REGISTER, 'entra.correct-conditions')
  assert.match(correct, /set \*\*Configure\*\* to \*\*Yes\*\*/)
  assert.match(correct, /Left at \*\*No\*\*, the condition matches every location/)
})

test('A3: help desk says a Temporary Access Pass is how someone with no method registers', () => {
  const lines = helpDeskOf('register-info-protected')
  assert.ok(lines.some((l) => /Temporary Access Pass: it is the one credential that satisfies a multifactor requirement before they have anything else/.test(l)), lines.join('\n'))
})

test('A4: help desk says a phishing-resistant requirement does not accept a Temporary Access Pass', () => {
  const lines = helpDeskOf('register-info-protected')
  assert.ok(lines.some((l) => /phishing-resistant requirement does not accept a Temporary Access Pass/.test(l)), lines.join('\n'))
})

test('A5: the guest-scope line gives the reason guests are excluded', () => {
  const words = shared.registrationScope as Record<string, string>
  assert.match(words.excluded, /because a Temporary Access Pass cannot be issued to them/)
  // And it is the line the step draws, not a string sitting unused in the file.
  const b = bodiesOf('demo').get(REGISTER)!
  assert.equal(fillText('{registrationGuestScope}', b.ex as Record<string, unknown>).length > 0, true)
})

test('A6: a risk names Windows Hello for Business and Platform SSO registration', () => {
  const risks = risksOf('register-info-protected')
  assert.ok(risks.some((r) => /Windows Hello for Business, or a Mac's Platform SSO credential, is registration too/.test(r)), risks.join('\n'))
})

test('A7: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(REGISTER), '2026-09-20')
  assert.equal(bodiesOf('demo').get(REGISTER)!.sourceLine, 'Source checked Sep 20, 2026')
})

test('A8: no content string of this step carries a hard date', () => {
  // The July 2026 Windows Hello milestone stays in the spec (walkContent C3).
  // `example` is the sample tenant's filled values, not an authored sentence.
  const { example: _example, ...authored } = stepById['register-info-protected'] as unknown as Record<string, unknown>
  for (const s of everyString(authored)) {
    assert.doesNotMatch(s, /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/, s)
  }
})
