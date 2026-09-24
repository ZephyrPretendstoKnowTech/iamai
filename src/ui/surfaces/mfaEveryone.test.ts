// The "Turn On MFA for Everyone" steps, taken to the V1 standard:
// docs/plans/mfa-everyone-spec.md holds the outcome, the Microsoft Learn page
// behind every technical claim and the date it was checked. The step's words
// are pinned by the rendered step snapshots (src/testing/stepSnapshots.test.ts);
// what is asserted here is the acceptance that is a safety instruction, an owner
// decision or a fact the pinned baseline holds.
//
// A test here reads the OPENED STEP wherever the claim is about what an admin
// sees, because that is the acceptance (CLAUDE.md). Where a claim belongs to a
// lifecycle state no fixture reaches — and three of this group's seven steps
// draw no Implementation Task at all on either demo snapshot, because they are
// not policy steps — the compiled package block is read instead, since that is
// the text the state would draw.
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
import { rowWho } from './rowWho.ts'
import type { MappingState } from '../../mapping/types.ts'
import type { RoadmapInput } from '../../roadmap/generate.ts'

/** Every step's body on a fixture, as the Plan composes it (closeDoors.test.ts bodiesOf). */
function bodiesOf(name: FixtureName, mapping?: MappingState, over: Partial<RoadmapInput> = {}): Map<string, StepBody> {
  setDisplayTimeZone('UTC')
  try {
    const f: Fixture = mapping ? { ...fixture(name), mapping } : fixture(name)
    const r = runFixture(f, { mapping: f.mapping, ...over }, null, f.snapshot.asOf)
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

/** The step's About sentence as the opened step fills it. */
const aboutOf = (b: StepBody): string => fillText(String((b.cs as Record<string, unknown>).why ?? ''), b.ex as Record<string, unknown>)

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
// Protect Sign-in Method Registration (spec section 2)
// ---------------------------------------------------------------------------

const REGISTER = 's-goal-register-info-protected'

test('A3, A4: help desk says a Temporary Access Pass is how someone with no method registers, and that a phishing-resistant requirement does not accept one', () => {
  const lines = helpDeskOf('register-info-protected')
  assert.ok(lines.some((l) => /Temporary Access Pass: it is the one credential that satisfies a multifactor requirement before they have anything else/.test(l)), lines.join('\n'))
  assert.ok(lines.some((l) => /phishing-resistant requirement does not accept a Temporary Access Pass/.test(l)), lines.join('\n'))
})

// ---------------------------------------------------------------------------
// Require MFA to Register a Device (spec section 3)
//
// An unmapped baseline group holds this step on both demo snapshots, so it
// draws no Implementation Task. Its own words are read from the step, and the
// create procedure from the compiled package.
// ---------------------------------------------------------------------------

const DEVICE_REG = 's-goal-device-registration-mfa'

/** A content step's reviewer-facing reference procedure. */
const referenceOf = (id: string): string[] =>
  (((stepById[id] as unknown as { whatToDoReference?: { steps?: string[] } }).whatToDoReference?.steps) ?? []) as string[]

// ---------------------------------------------------------------------------
// Prepare Your Team for MFA (spec section 4)
//
// The campaign is not a policy step, so `policyTasks.ts` draws it no
// Implementation Task on either snapshot. Its procedures are read from the
// compiled package; its own words from the step.
// ---------------------------------------------------------------------------

const CAMPAIGN = 's-verify-mfa'

test('C11: the owner rule holds — guests are counted beside people in the Impact', () => {
  // The owner settled this on 2026-09-19: guests stay in the campaign and are
  // counted as "N people and M guests" (mfa-everyone-spec.md section 4).
  for (const name of ['demo', 'demo-week2'] as FixtureName[]) {
    assert.match(impactOf(name, CAMPAIGN), /^\d+ people and \d+ guests?$/, name)
  }
})

// ---------------------------------------------------------------------------
// Turn Off Security Defaults (spec section 7)
// ---------------------------------------------------------------------------

const SECURITY_DEFAULTS = 's-prereq-security-defaults'

/** A content step's own `whatToDo`, flattened: its lead and every step line. */
const whatToDoOf = (id: string): string => everyString((stepById[id] as unknown as { whatToDo?: unknown }).whatToDo).join('\n')

// Walk list 4.x item 8: the four policies' turn-ons wait on security defaults
// being off, so once someone saved Disabled nothing said to turn them on until
// the next scan. Turn Off Security Defaults' own task turns each on, by name.
test('F2: Turn Off Security Defaults turns on the four policies it waits on, each by name, in its own task', () => {
  const b = bodiesOf('messy').get(SECURITY_DEFAULTS)!
  const portal = b.artifacts.find((a) => a.id === 'portal')!.text()
  const turnOns = portal.split('\n').filter((l) => l.endsWith('set Enable policy to On and select Save.'))
  assert.equal(turnOns.length, 4, portal)
  assert.ok(portal.includes('Select Disabled (not recommended), then Save.'), portal)
  assert.match(aboutOf(b) + everyString((stepById[SECURITY_DEFAULTS] as unknown as { who?: unknown }).who).join('\n'), /block device code sign-in today/)
})

// ---------------------------------------------------------------------------
// Require MFA for Everyone (spec section 5)
// ---------------------------------------------------------------------------

const ALL_USERS = 's-goal-mfa-all-users'

test('D1: the reference grant is the control the evidence names, and the pin holds', () => {
  const ref = referenceOf('mfa-all-users')
  assert.ok(ref.some((l) => /^Grant → Require multifactor authentication\./.test(l)), ref.join('\n'))
  assert.ok(!ref.some((l) => /Require authentication strength: Multifactor authentication/.test(l)), ref.join('\n'))
  // The evidence line said this all along; now they agree.
  const evidence = everyString((stepById['mfa-all-users'] as unknown as { who?: unknown }).who).join('\n')
  assert.match(evidence, /This policy uses Require multifactor authentication\./)
  // And Learn's reason for there being only one: the two controls are exclusive.
  assert.match(ref.join('\n'), /a policy cannot carry both/)
})

// ---------------------------------------------------------------------------
// Require MFA for Guests (spec section 6)
// ---------------------------------------------------------------------------

const GUESTS = 's-goal-guests-mfa'

test('E1: the reference names the pin\'s two policies, by external-user type', () => {
  const ref = referenceOf('guests-mfa').join('\n')
  // Policy A is the pin's Mixed-Guests: ordinary guests and other external users.
  assert.match(ref, /B2B collaboration guest users, Other external users/)
  // Policy B is the pin's B2B-Guest: the four types it includes, all tenants.
  assert.match(ref, /Internal guest users, B2B collaboration member users, B2B direct connect users, Service provider users → all external tenants/)
  // Not the partner-tenant split the step used to describe.
  assert.doesNotMatch(ref, /Selected external tenants/)
  assert.doesNotMatch(ref, /all types\{serviceProviderClause\}/)
})

// ---------------------------------------------------------------------------
// Finish Moving Off Per-User MFA (spec section 8)
// ---------------------------------------------------------------------------

const PER_USER = 's-prereq-per-user-mfa'

test('G5: a risk says an app password survives the change, and the procedure deletes it', () => {
  const risks = risksOf(PER_USER)
  assert.ok(risks.some((r) => /app password created under per-user MFA keeps working after the state is Disabled/.test(r)), risks.join('\n'))
  assert.match(whatToDoOf(PER_USER), /Delete all existing app passwords generated by the selected users/)
  assert.match(blockText(PER_USER, 'entra.disable'), /Delete any app password these accounts hold/)
})

test('every step of the group shows the date its Microsoft sources were checked', () => {
  // A plan that read per-user MFA on draws that step (walk list 4.x item 9).
  const demo = bodiesOf('demo', undefined, { perUserMfaSeenOnAt: '2026-08-01T00:00:00.000Z' })
  for (const id of [REGISTER, DEVICE_REG, CAMPAIGN, ALL_USERS, GUESTS, PER_USER]) {
    assert.equal(checkedOn(id), '2026-09-25', id)
    assert.equal(demo.get(id)!.sourceLine, 'Source checked Sep 25, 2026', id)
  }
  // A plan that saw security defaults on draws that step (V1 decision 6: one that never did reads Doesn't apply, in the footer).
  assert.equal(checkedOn(SECURITY_DEFAULTS), '2026-09-25')
  assert.equal(bodiesOf('demo', undefined, { securityDefaultsSeenOnAt: '2026-08-01T00:00:00.000Z' }).get(SECURITY_DEFAULTS)!.sourceLine, 'Source checked Sep 25, 2026')
})
