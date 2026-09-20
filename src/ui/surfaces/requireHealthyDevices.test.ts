// The "Require Healthy Devices" group, taken to the V1 standard:
// docs/plans/require-healthy-devices-spec.md holds the outcome, the Microsoft
// Learn page behind every technical claim and the date it was checked. One test
// per acceptance item in that spec.
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
import { CONTRACT } from './stepContract.ts'
import { membersOf } from '../../roadmap/stepGroups.ts'
import { answerKey } from '../../roadmap/answers.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import type { MappingState } from '../../mapping/types.ts'

/** The group's four members, in registry order (roadmap/stepGroups.ts). */
const DEVICES = ['s-goal-require-managed-device', 's-goal-intune-enrollment-reauth', 's-ladder-phone-access-restriction', 's-shared-devices']

const MANAGED = 's-goal-require-managed-device'
const INTUNE = 's-goal-intune-enrollment-reauth'
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

/** The step's About sentence as the OPENED step fills it, which is what a person reads. */
const aboutOf = (b: StepBody): string => fillText(String((b.cs as Record<string, unknown>).why ?? ''), b.ex as Record<string, unknown>)

/** A step's risk lines from the content file, whatever their `applies`. */
const risksOf = (id: string): string[] =>
  (((stepById[id] as unknown as { more?: { risks?: { text?: string }[] } }).more?.risks ?? []).map((r) => r.text ?? '')) as string[]

/** A step's help-desk lines from the content file. */
const helpDeskOf = (id: string): string[] => ((stepById[id] as unknown as { more?: { helpDesk?: unknown } }).more?.helpDesk ?? []) as string[]

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

/** The package's own last-checked date (project.ts sourceUpdatedOn reads the max). */
function checkedOn(stepId: string): string {
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { checkedOn: string }[] } }>)[stepId]?.meta
  const dates = (meta?.verifiedSources ?? []).map((s) => s.checkedOn).sort()
  return dates[dates.length - 1] ?? ''
}

// ---------------------------------------------------------------------------
// The group itself
// ---------------------------------------------------------------------------

test('the group draws its four members in the spec order', () => {
  assert.deepEqual([...membersOf('devices')], DEVICES)
})

// ---------------------------------------------------------------------------
// Require a Managed Device Outside the Office (spec section 3)
// ---------------------------------------------------------------------------

test('D1: About this Step is the outcome — the two device states that pass, and that registration is neither', () => {
  const about = aboutOf(bodyOf('demo', MANAGED))
  assert.match(about, /marked compliant/)
  assert.match(about, /Microsoft Entra hybrid joined/)
  assert.match(about, /only registered in Entra meets neither/)
  assert.doesNotMatch(about, /Device checks help limit access/)
})

test('D2: the Intune prerequisite names the path Microsoft documents, the setting it ships with, and the field the grace period lives in', () => {
  const prerequisite = blockText(MANAGED, 'entra.intune-prerequisite')
  assert.match(prerequisite, /Intune admin center → Endpoint security → Device compliance → Compliance policy settings/)
  assert.doesNotMatch(prerequisite, /Devices → Compliance → Compliance policy settings/)
  // It ships as Compliant, which is the permissive value; Learn says change it.
  assert.match(prerequisite, /It ships as \*\*Compliant\*\*/)
  // The action is built in at zero days, and the schedule field is what the baseline's 3 days is set on.
  assert.match(prerequisite, /Schedule \(days after noncompliance\)\*\* = 0/)
  // The step's own before-line says the same path, so the screen and the export cannot disagree.
  assert.match(allText('require-managed-device'), /Intune → Endpoint security → Device compliance → Compliance policy settings/)
})

test('D3: the create and correct procedures set Configure to Yes on Locations and on Device platforms', () => {
  for (const id of ['entra.create', 'entra.correct-conditions']) {
    const text = blockText(MANAGED, id)
    assert.match(text, /Locations: set \*\*Configure\*\* to \*\*Yes\*\*/, id)
    assert.match(text, /Device platforms: set \*\*Configure\*\* to \*\*Yes\*\*/, id)
    assert.match(text, /\{\{policy\.target\.locationWords\}\}/, id)
    assert.match(text, /\{\{policy\.target\.platformWords\}\}/, id)
  }
})

test('D4: the device answer that narrows the platforms puts them in the Entra procedure, beside the JSON that carries them', () => {
  const b = bodyOf('demo', MANAGED, withPhonesBlocked)
  const entra = drawn(b, 'portal')
  const json = drawn(b, 'json')
  // The JSON always carried the exclusion; before this wave the Entra procedure did not name it at all.
  assert.match(json, /"excludePlatforms":\["android","iOS"\]/)
  assert.match(entra, /Device platforms: set \*\*Configure\*\* to \*\*Yes\*\*/)
  assert.match(entra, /Exclude: Android, iOS/)
})

test('D4b: a target with no platform condition drops the platform line and keeps the rest of the procedure', () => {
  // The demo with the device decision unanswered is the pinned baseline's own
  // shape: no platform condition, so there is nothing to configure and no line.
  const entra = drawn(bodyOf('demo', MANAGED), 'portal')
  assert.doesNotMatch(entra, /Device platforms/)
  assert.doesNotMatch(entra, /\[omit |\{\{/)
  assert.match(entra, /Locations: set \*\*Configure\*\* to \*\*Yes\*\*/)
})

test('D5: a risk names the compliance status validity period and the default that blocks a returning laptop', () => {
  assert.ok(risksOf('require-managed-device').some((t) => /compliance status validity period runs out, thirty days unless you change it/.test(t)), risksOf('require-managed-device').join('\n'))
})

test('D6: the platform-limit risk says what each limit really is', () => {
  const risks = risksOf('require-managed-device').join('\n')
  // Home cannot be hybrid joined; Linux compliance is the builds Intune supports; InPrivate is neither state.
  assert.match(risks, /Windows Home cannot be hybrid joined/)
  assert.match(risks, /Ubuntu and Red Hat builds it supports/)
  assert.match(risks, /InPrivate counts as neither compliant nor hybrid joined/)
  assert.doesNotMatch(risks, /Windows Home editions, Linux builds Intune cannot mark compliant, and Edge InPrivate\./)
})

test('D7: help desk says a device code sign-in cannot meet this grant at all', () => {
  assert.ok(helpDeskOf('require-managed-device').some((t) => /device code flow cannot meet this grant/.test(t)), helpDeskOf('require-managed-device').join('\n'))
})

test('D8: the threshold tile counts the people on a compliant device, which is what it measures', () => {
  assert.equal(CONTRACT.readinessValue.device, '{value} of people on a compliant device')
  const b = bodyOf('demo', MANAGED)
  assert.equal(b.readiness.tiles.find((t) => t.key === 'gate')?.value, '30% of people on a compliant device')
})

test('D9: the step says IAMAI reads no Intune policy, on the step and in the procedure', () => {
  assert.ok(risksOf('require-managed-device').some((t) => /IAMAI has no permission to see a compliance policy/.test(t)), risksOf('require-managed-device').join('\n'))
  assert.match(blockText(MANAGED, 'entra.intune-prerequisite'), /IAMAI reads no Intune policy/)
})

// The step's footer reads this same value (project.ts sourceUpdatedOn takes the
// latest `verifiedSources[].checkedOn` the registry carries), so the date on
// screen moves with it.
test('D10: the package’s checked date is 2026-09-20', () => {
  assert.equal(checkedOn(MANAGED), '2026-09-20')
})
