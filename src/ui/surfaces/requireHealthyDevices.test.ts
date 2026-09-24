// The "Require Healthy Devices" steps, taken to the V1 standard:
// docs/plans/require-healthy-devices-spec.md holds the outcome, the Microsoft
// Learn page behind every technical claim and the date it was checked. The tests
// kept here are the spec items that decide what a policy reaches, what it
// excludes and the state it is created in.
//
// A test here reads the OPENED STEP wherever the claim is about what an admin
// sees, and the compiled package block where the claim is about a lifecycle
// state no fixture reaches — the rule closeDoors.test.ts and whereSignIn.test.ts
// follow. Two of the group's members are reached only through the device
// answer (`s-ladder-phone-access-restriction` exists only where phones are kept
// off company data), so their fixtures carry that answer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepById } from '../../content/content.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDevicesReady } from '../../roadmap/fixtures/run.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { answerKey } from '../../roadmap/answers.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import type { MappingState } from '../../mapping/types.ts'

/** The spec's four steps (docs/plans/require-healthy-devices-spec.md), in its order. */

const MANAGED = 's-goal-require-managed-device'
const PHONES = 's-ladder-phone-access-restriction'
const SHARED = 's-shared-devices'

/**
 * The device answer that keeps company data off phones: the one answer that
 * generates `s-ladder-phone-access-restriction` (roadmap/generate.ts) and the
 * one that narrows the compliant-device policy's platforms
 * (roadmap/deviations.ts excludedPlatforms).
 */
function withPhonesBlocked(f: Fixture): Fixture {
  const step = PREREQ_STEP_ID.devicePlan
  return {
    ...f,
    mapping: {
      ...f.mapping,
      questionAnswers: {
        ...(f.mapping.questionAnswers ?? {}),
        [answerKey(step, 'phoneManagement')]: 'blocked',
        [answerKey(step, 'phoneAppProtection')]: 'not-required',
        [answerKey(step, 'computerManagement')]: 'enrolled',
      },
    } as MappingState,
  }
}

/** Every step's body on a fixture, as the Plan composes it (closeDoors.test.ts bodiesOf). */
function bodiesOf(name: FixtureName, shape: (f: Fixture) => Fixture = (f) => f): Map<string, StepBody> {
  setDisplayTimeZone('UTC')
  try {
    const f = shape(fixture(name))
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

/** One body, or a failure naming the step the fixture did not draw. */
function bodyOf(name: FixtureName, stepId: string, shape?: (f: Fixture) => Fixture): StepBody {
  const b = bodiesOf(name, shape).get(stepId)
  assert.ok(b, `the ${name} plan has ${stepId}`)
  return b
}

/** The text one channel tab draws. */
const drawn = (b: StepBody, id: string): string => b.artifacts.find((a) => a.id === id)!.text()

/** Every string a step's content entry carries, joined: the whole of what it can say. */
function allText(id: string): string {
  const out: string[] = []
  const walk = (n: unknown): void => {
    if (typeof n === 'string') out.push(n)
    else if (Array.isArray(n)) n.forEach(walk)
    else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) if (k !== 'example') walk(v)
  }
  walk(stepById[id])
  return out.join('\n')
}

/** A compiled package block's authored text, for a lifecycle state no fixture reaches. */
function blockText(stepId: string, blockId: string): string {
  const pkg = (registry.packages as Record<string, { blocks?: Record<string, { text?: string }> }>)[stepId]
  const text = pkg?.blocks?.[blockId]?.text
  assert.ok(typeof text === 'string' && text !== '', `${stepId}: the package has no ${blockId} block`)
  return text as string
}

// ---------------------------------------------------------------------------
// Require a Managed Device Outside the Office (spec section 3)
// ---------------------------------------------------------------------------

/** Every tab a body draws, joined: the whole of what it hands over. */
const allDrawn = (b: StepBody): string => b.artifacts.map((a) => a.text()).join('\n')

test('D4: the device answer that narrows the platforms puts them in the Entra procedure beside the JSON, a target with no platform condition drops only that line, and a held create draws no procedure', () => {
  {
    // Below device readiness the create waits with its turn-on, and nothing the
    // step draws creates the policy: no procedure, no platform line, no body.
    const held = allDrawn(bodyOf('demo', MANAGED, withPhonesBlocked))
    assert.doesNotMatch(held, /New policy|Device platforms|excludePlatforms|enabledForReportingButNotEnforced/, 'the held create draws no procedure')
    const b = bodyOf('demo', MANAGED, (f) => withDevicesReady(withPhonesBlocked(f)))
    const entra = drawn(b, 'portal')
    const json = drawn(b, 'json')
    // The JSON always carried the exclusion; before this wave the Entra procedure did not name it at all.
    assert.match(json, /"excludePlatforms":\["android","iOS"\]/)
    assert.match(entra, /Under \*\*Conditions → Device platforms\*\*, set \*\*Configure\*\* to \*\*Yes\*\*/)
    assert.match(entra, /exclude \*\*Android\*\* and \*\*iOS\*\*/)
  }
  {
    // The demo with the device decision unanswered is the pinned baseline's own
    // shape: no platform condition, so there is nothing to configure and no line.
    // Held on device readiness, it draws no procedure at all.
    assert.doesNotMatch(allDrawn(bodyOf('demo', MANAGED)), /New policy|Locations: set|enabledForReportingButNotEnforced/, 'the held create draws no procedure')
    const entra = drawn(bodyOf('demo', MANAGED, withDevicesReady), 'portal')
    assert.doesNotMatch(entra, /Device platforms/)
    assert.doesNotMatch(entra, /\[omit |\{\{/)
    assert.match(entra, /Under \*\*Conditions → Locations\*\*, set \*\*Configure\*\* to \*\*Yes\*\*/)
  }
})

// ---------------------------------------------------------------------------
// Keep Company Data Off Phones (spec section 5)
//
// The step exists only where the device answer keeps company data off phones
// (roadmap/generate.ts), so every reading here carries that answer.
// ---------------------------------------------------------------------------

test('P2-P4: the phone policy sets Configure to Yes on Device platforms (at No, Block would lock out every computer), excludes the emergency exclusions group and never an account by name, and is created in Report-only', () => {
  const b = bodyOf('demo', PHONES, withPhonesBlocked)
  const entra = drawn(b, 'portal')
  assert.match(entra, /Conditions → Device platforms: set Configure to Yes, then Include: Android and iOS\./)
  assert.match(entra, /Left at No the condition applies to every platform, and Block access there would lock out every computer as well\./)
  assert.match(entra, /Exclude → Groups: the emergency exclusions group\. Never exclude an emergency account by name\./)
  assert.match(entra, /Enable policy: Report-only/)
  assert.match(entra, /Test from a real iPhone and a real Android phone/)
  assert.match(entra, /Record the policy, its scope and the test result/)
  // The outcome the step is done by is the policy, not a general "restricted as agreed".
  assert.ok(b.contract.doneWhen.some((l) => /iOS and Android are blocked by a policy of this tenant's own/.test(l)), b.contract.doneWhen.join(' | '))
})

// ---------------------------------------------------------------------------
// Give Shared Devices Their Own Policy (spec section 6)
// ---------------------------------------------------------------------------

test('S3/S4: every shared-device procedure sets Configure to Yes on Locations (at No it stops the device completely), and the grant is Block with no interactive control', () => {
  {
    for (const id of ['entra.create', 'entra.correct.location', 'entra.manual-review']) {
      const text = blockText(SHARED, id)
      assert.match(text, /set \*\*Configure\*\* to \*\*Yes\*\*/, id)
      assert.match(text, /stops the device completely/, id)
    }
    // And the step's own portal reference, which the review page and the export read.
    assert.match(allText('s-shared-devices'), /Conditions → Locations: set Configure to Yes, then Include: Any location; Exclude: \{trustedLocation\}/)
  }
  {
    assert.match(blockText(SHARED, 'entra.create'), /Grant: \*\*Block access\*\*\. Do not add an interactive control: a room account has no second device to approve one with\./)
  }
})
