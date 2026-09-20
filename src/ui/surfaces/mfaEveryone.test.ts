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

// ---------------------------------------------------------------------------
// Require MFA to Register a Device (spec section 3)
//
// An unmapped baseline group holds this step on both demo snapshots, so it
// draws no Implementation Task. Its own words are read from the step, and the
// create procedure from the compiled package.
// ---------------------------------------------------------------------------

const DEVICE_REG = 's-goal-device-registration-mfa'

/** A content step's `whatToDo.before` lines: the setting to change before the policy exists. */
const beforeOf = (id: string): string[] =>
  (((stepById[id] as unknown as { whatToDo?: { before?: string[] } }).whatToDo?.before) ?? []) as string[]

/** A content step's reviewer-facing reference procedure. */
const referenceOf = (id: string): string[] =>
  (((stepById[id] as unknown as { whatToDoReference?: { steps?: string[] } }).whatToDoReference?.steps) ?? []) as string[]

test('B1: a risk says Windows Hello and a device-bound passkey cannot answer this policy', () => {
  const risks = risksOf('device-registration-mfa')
  assert.ok(risks.some((r) => /Windows Hello for Business and a device-bound passkey cannot answer this policy/.test(r)), risks.join('\n'))
  assert.ok(risks.some((r) => /need the device to be registered already/.test(r)), risks.join('\n'))
})

test('B2: the create procedure says the same where the strength is chosen', () => {
  const create = blockText(DEVICE_REG, 'entra.create')
  assert.match(create, /\*\*Windows Hello for Business\*\* and a \*\*device-bound passkey\*\* cannot answer this policy/)
  assert.match(create, /the only controls this User Action offers/)
})

test('B3: the step says the policy is not properly enforced while the tenant setting is Yes', () => {
  const before = beforeOf('device-registration-mfa')
  assert.ok(before.some((l) => /this policy is not properly enforced/.test(l)), before.join('\n'))
  // And the old ordering-only wording, which read as hygiene, is gone.
  assert.ok(!before.some((l) => /After it is enforced for the intended registration or join scope/.test(l)), before.join('\n'))
})

test('B4: the tenant setting is named and pathed as its own Learn page names it', () => {
  const before = beforeOf('device-registration-mfa').join('\n')
  assert.match(before, /Devices → Overview → Device Settings/)
  assert.match(before, /Require multifactor authentication to register or join devices with Microsoft Entra ID/)
})

test('B5: the reference says the three conditions are unavailable, not a bad idea', () => {
  const ref = referenceOf('device-registration-mfa')
  assert.ok(ref.some((l) => /Client apps, Filters for devices and Device state are not available for this user action/.test(l)), ref.join('\n'))
  assert.ok(!ref.some((l) => /a first join has no device to check/.test(l)), ref.join('\n'))
})

test('B6: the reference grant is the resolved strength, not a hard-coded one', () => {
  const ref = referenceOf('device-registration-mfa')
  assert.ok(ref.some((l) => l.startsWith('Grant → Require authentication strength: {strengthName}')), ref.join('\n'))
})

test('B7: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(DEVICE_REG), '2026-09-20')
  assert.equal(bodiesOf('demo').get(DEVICE_REG)!.sourceLine, 'Source checked Sep 20, 2026')
})

// ---------------------------------------------------------------------------
// Prepare Your Team for MFA (spec section 4)
//
// The campaign is not a policy step, so `policyTasks.ts` draws it no
// Implementation Task on either snapshot. Its procedures are read from the
// compiled package; its own words from the step.
// ---------------------------------------------------------------------------

const CAMPAIGN = 's-verify-mfa'

/** A content step's `whatToDo.generic` lines: what to do for everyone else. */
const genericOf = (id: string): string[] =>
  (((stepById[id] as unknown as { whatToDo?: { generic?: string[] } }).whatToDo?.generic) ?? []) as string[]

test('C1: the campaign instructions name both methods and say one at a time', () => {
  const generic = genericOf(CAMPAIGN).join('\n')
  assert.match(generic, /nudges one method at a time, either Passkey \(FIDO2\) or Microsoft Authenticator/)
  assert.doesNotMatch(generic, /Check the separate passkey registration instructions/)
  assert.match(blockText(CAMPAIGN, 'entra.campaign'), /A campaign nudges one of them at a time/)
})

test('C2: the step says a passkey campaign does not nudge guests', () => {
  const generic = genericOf(CAMPAIGN).join('\n')
  assert.match(generic, /A passkey campaign does not nudge guests, because a guest cannot register a passkey here/)
  assert.match(blockText(CAMPAIGN, 'entra.campaign'), /A passkey campaign does not reach guests/)
})

test('C3: a risk says the Authenticator nudge reaches someone already stronger', () => {
  const risks = risksOf(CAMPAIGN)
  assert.ok(risks.some((r) => /already signs in with a stronger method, so it can read as a step backwards/.test(r)), risks.join('\n'))
})

test('C4: the configure procedure names the Authenticator authentication-mode prerequisite', () => {
  const configure = blockText(CAMPAIGN, 'entra.configure')
  assert.match(configure, /\*\*Authentication mode\*\* set to \*\*Passwordless\*\*, nobody is eligible and the campaign nudges no one/)
  assert.match(configure, /It must be \*\*Any\*\* or \*\*Push\*\*/)
})

test('C5: the campaign block says when the prompt appears and when it does not', () => {
  const campaign = blockText(CAMPAIGN, 'entra.campaign')
  assert.match(campaign, /after an interactive sign-in that completed MFA here/)
  assert.match(campaign, /skipped where they arrive by single sign-on/)
  assert.match(campaign, /does not prompt on a mobile device/)
  // The same fact reaches the help desk, where the symptom is reported.
  assert.ok(helpDeskOf(CAMPAIGN).some((l) => /No prompt appeared/.test(l)))
})

test('C6: the snooze fields are named as the blade names them, and say three', () => {
  for (const id of ['entra.campaign', 'entra.configure']) {
    const text = blockText(CAMPAIGN, id)
    assert.match(text, /Days allowed to snooze/, id)
    assert.match(text, /Limited number of snoozes/, id)
    assert.match(text, /three times/, id)
  }
  assert.match(genericOf(CAMPAIGN).join('\n'), /Days allowed to snooze and Limited number of snoozes/)
})

test('C7: the configure procedure says what Microsoft managed does now', () => {
  const configure = blockText(CAMPAIGN, 'entra.configure')
  assert.match(configure, /Left at \*\*Microsoft managed\*\*, Microsoft runs the campaign/)
  assert.match(configure, /reaches everyone who can do MFA rather than only the people on a text message or a voice call/)
  assert.doesNotMatch(configure, /not Microsoft managed, because the plan keeps an explicit Microsoft Authenticator campaign/)
})

test('C8: help desk names the four methods a guest can use in this tenant', () => {
  const lines = helpDeskOf(CAMPAIGN)
  assert.ok(lines.some((l) => /a text message, a voice call, an Authenticator push or a software token code/.test(l)), lines.join('\n'))
})

test('C9: Completion Criteria is three lines, each saying one thing', () => {
  for (const name of ['demo', 'demo-week2'] as FixtureName[]) {
    const done = bodiesOf(name).get(CAMPAIGN)!.contract.doneWhen
    assert.deepEqual(done, [
      'Everyone in this step has a registered MFA method they can use.',
      'Every administrator has a phishing-resistant method.',
      'The people who still need help are identified and on the support list.',
    ], name)
  }
})

test('C10: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(CAMPAIGN), '2026-09-20')
  assert.equal(bodiesOf('demo').get(CAMPAIGN)!.sourceLine, 'Source checked Sep 20, 2026')
})

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

test('F1: the step says security defaults must be off, not that report-only may coexist', () => {
  const w = whatToDoOf(SECURITY_DEFAULTS)
  assert.match(w, /Security defaults and Conditional Access are not meant to run together: once these policies exist you cannot turn security defaults back on/)
  assert.doesNotMatch(w, /Report-only policies can exist while security defaults are on/)
})

test('F2: the replacement list is four policies wherever it is said', () => {
  const FOUR = /Require MFA for Everyone, Block Legacy Authentication, Block Device Code Sign-in and Require Phishing-Resistant MFA for Admins/
  assert.match(whatToDoOf(SECURITY_DEFAULTS), FOUR)
  const b = bodiesOf('demo').get(SECURITY_DEFAULTS)!
  assert.ok(b.contract.doneWhen.some((d) => FOUR.test(d)), b.contract.doneWhen.join('\n'))
  assert.match(aboutOf(b) + everyString((stepById[SECURITY_DEFAULTS] as unknown as { who?: unknown }).who).join('\n'), /block device code sign-in today/)
})

test('F3: a risk says device code sign-in reopens without its policy', () => {
  const risks = risksOf(SECURITY_DEFAULTS)
  assert.ok(risks.some((r) => /Security defaults also block device code sign-in, so that route reopens/.test(r)), risks.join('\n'))
})

test('F4: the portal step reads the value the portal shows', () => {
  assert.match(whatToDoOf(SECURITY_DEFAULTS), /Manage security defaults → Disabled \(not recommended\) → Save/)
  assert.match(blockText(SECURITY_DEFAULTS, 'entra.disable'), /\*\*Disabled \(not recommended\)\*\*/)
  assert.match(blockText(SECURITY_DEFAULTS, 'entra.verify'), /\*\*Disabled \(not recommended\)\*\*/)
})

test('F5: help desk says security defaults allowed only the Authenticator app', () => {
  const lines = helpDeskOf(SECURITY_DEFAULTS)
  assert.ok(lines.some((l) => /allowed only the Microsoft Authenticator app, so the switch day is the first day anyone here can use another method/.test(l)), lines.join('\n'))
})

test('F6: help desk says what covers guests after the changeover', () => {
  const lines = helpDeskOf(SECURITY_DEFAULTS)
  assert.ok(lines.some((l) => /Guests were covered by security defaults the same as staff; Require MFA for Everyone is what covers them afterwards/.test(l)), lines.join('\n'))
})

test('F7: the step shows a source line at all, dated', () => {
  assert.equal(checkedOn(SECURITY_DEFAULTS), '2026-09-20')
  for (const name of ['demo', 'demo-week2'] as FixtureName[]) {
    assert.equal(bodiesOf(name).get(SECURITY_DEFAULTS)!.sourceLine, 'Source checked Sep 20, 2026', name)
  }
})

test('A8: no content string of this step carries a hard date', () => {
  // The July 2026 Windows Hello milestone stays in the spec (walkContent C3).
  // `example` is the sample tenant's filled values, not an authored sentence.
  const { example: _example, ...authored } = stepById['register-info-protected'] as unknown as Record<string, unknown>
  for (const s of everyString(authored)) {
    assert.doesNotMatch(s, /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/, s)
  }
})
