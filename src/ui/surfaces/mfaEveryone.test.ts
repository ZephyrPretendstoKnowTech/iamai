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
import { execSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { personLabels } from '../../names.ts'
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
import type { RoadmapInput } from '../../roadmap/generate.ts'

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
  // The `before` line is the reviewer's and the walk's. Where a package is
  // active the package's Entra block is what an admin reads, so the same fact
  // stands in the create procedure too — the Close the Doors lesson: a fact
  // stated only in a state the admin is not in is a fact nobody reads.
  assert.match(blockText(DEVICE_REG, 'entra.create'), /Until it reads \*\*No\*\*, Microsoft does not properly enforce a Conditional Access policy that uses this User Action/)
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

// V1 audit S4-13: `entra.campaign` said the snooze days are "the value your organization
// approved … IAMAI does not hold one" while `entra.configure` told the reader to set the
// "IAMAI-resolved {{campaign.snoozeDurationInDays}} day(s)". Nothing in the product binds
// `campaign.*`, so the second was false: it named a value IAMAI does not hold and, where it
// was ever projected, would have rendered a placeholder or withheld the channel. Both
// procedures now say the same true thing.
test('C6a: both campaign procedures say the snooze days are the organization’s, because IAMAI holds no such value', () => {
  const SAYS = 'the value your organization approved, between 0 and 14; IAMAI does not hold one'
  for (const id of ['entra.campaign', 'entra.configure']) {
    const text = blockText(CAMPAIGN, id)
    assert.ok(text.includes(SAYS), `${id}: ${text}`)
    assert.doesNotMatch(text, /IAMAI-resolved \*\*\{\{campaign\.snoozeDurationInDays\}\}|IAMAI-resolved [^\n]*day\(s\)/, id)
  }
  // The premise: the package declares the value, and nothing in the product produces it.
  const pkg = (registry as unknown as { packages: Record<string, { meta: { requiredBindings?: string[] } }> }).packages[CAMPAIGN]
  assert.ok(pkg.meta.requiredBindings?.includes('campaign.snoozeDurationInDays'), 'the package no longer declares the value')
  const producers = execSync('git grep -lE "campaign\\.snoozeDurationInDays" -- src', { encoding: 'utf8' }).split('\n').filter((l) => l !== '' && !l.endsWith('.test.ts') && !l.endsWith('registry.generated.json'))
  assert.deepEqual(producers, [], `something binds the snooze value now: ${producers.join(', ')}`)
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
  assert.match(w, /Security defaults and Conditional Access are not meant to run together/)
  assert.doesNotMatch(w, /Report-only policies can exist while security defaults are on/)
})

// V1 audit S4-16 / S4-20. The lead stated only the direction that blocks NOBODY
// — you cannot re-enable security defaults once the policies exist — and left
// the direction that decides the whole plan unsaid. Microsoft Learn, checked
// 2026-09-20 (https://learn.microsoft.com/entra/fundamentals/security-defaults,
// page updated 2026-07-01): "Organizations that choose to implement Conditional
// Access policies that replace security defaults must disable security
// defaults." Report-only creation is not restricted by any first-party sentence
// (playbook V3, re-checked against the report-only page, updated 2026-06-01), so
// the gate stays on enforcement — and the step now says that is what it gates.
test('F1a: the lead names the direction that blocks — security defaults off before the replacements take over', () => {
  const w = whatToDoOf(SECURITY_DEFAULTS)
  assert.match(w, /security defaults must be off before the policies replacing them can take over/)
  assert.match(w, /nothing in this plan enforces before this step/)
  assert.match(w, /once these policies exist you cannot turn security defaults back on/)
})

test('F2: the replacement list is four policies wherever it is said', () => {
  const FOUR = /Require MFA for Everyone, Block Legacy Authentication, Block Device Code Sign-in and Require Phishing-Resistant MFA for Admins/
  assert.match(whatToDoOf(SECURITY_DEFAULTS), FOUR)
  // The cutover's Done-when, read where the cutover is still to come: messy's
  // scan read security defaults on. This read demo, whose scan read them
  // already off; there the step is complete on that fact alone and its
  // Done-when claims only it (R4-38, eb099c8c), so demo no longer names the
  // four — rightly, since nothing checked them.
  const b = bodiesOf('messy').get(SECURITY_DEFAULTS)!
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
  // A plan that saw security defaults on draws the step (V1 decision 6: one that never did reads Doesn't apply, in the footer).
  for (const name of ['demo', 'demo-week2'] as FixtureName[]) {
    assert.equal(bodiesOf(name, undefined, { securityDefaultsSeenOnAt: '2026-08-01T00:00:00.000Z' }).get(SECURITY_DEFAULTS)!.sourceLine, 'Source checked Sep 20, 2026', name)
  }
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

test('D2: the SMS risk says the method is being retired, not that a text is late', () => {
  const risks = risksOf('mfa-all-users')
  assert.ok(risks.some((r) => /Microsoft is retiring both, and a person left with nothing else is made to register a passkey before they can sign in/.test(r)), risks.join('\n'))
  assert.ok(!risks.some((r) => /waiting on a text that does not arrive/.test(r)), risks.join('\n'))
})

test('D3: help desk says a Microsoft-managed policy cannot be renamed or deleted', () => {
  const lines = helpDeskOf('mfa-all-users')
  assert.ok(lines.some((l) => /cannot rename or delete is Microsoft's own managed one/.test(l)), lines.join('\n'))
})

test('D4: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(ALL_USERS), '2026-09-20')
  assert.equal(bodiesOf('demo').get(ALL_USERS)!.sourceLine, 'Source checked Sep 20, 2026')
})

test('D5: the numbered step does not disagree with the scope shown beside it', () => {
  // The resolved settings on this task read "All users, Guest or external users
  // → all types"; the procedure used to say flatly "All users", which is the
  // same population (All users includes B2B guests) said two ways on one card.
  const tasks = tasksTextOf(bodiesOf('demo').get(ALL_USERS)!)
  assert.match(tasks, /the population the resolved settings below name; \*\*All users\*\* already covers guests/)
  assert.doesNotMatch(tasks, /Users → Include: All users\. Exclude: the exclusions IAMAI resolved/)
})

test('D6: the SMS retirement carries no date on the step; it stays in the spec', () => {
  const { example: _example, ...authored } = stepById['mfa-all-users'] as unknown as Record<string, unknown>
  for (const s of everyString(authored)) {
    assert.doesNotMatch(s, /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/, s)
  }
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

test('E2: a guest can only use four methods here, and the step says which', () => {
  const evidence = everyString((stepById['guests-mfa'] as unknown as { who?: unknown }).who).join('\n')
  assert.match(evidence, /a text message, a voice call, an Authenticator push or a software token code/)
  assert.match(evidence, /counts only as a claim their own tenant makes/)
})

test('E3: a risk says a Temporary Access Pass is not available to a guest', () => {
  const risks = risksOf('guests-mfa')
  assert.ok(risks.some((r) => /A Temporary Access Pass cannot be issued to a guest, so a strength that relies on one is met only by a claim from their own tenant/.test(r)), risks.join('\n'))
})

test('E4: the step says trust decides where MFA is answered, not whether the policy applies', () => {
  const evidence = everyString((stepById['guests-mfa'] as unknown as { who?: unknown }).who).join('\n')
  assert.match(evidence, /does not exempt them from the policy; it decides where they answer it/)
})

test('E5: a risk says a direct connect user is blocked when no trust is configured', () => {
  const risks = risksOf('guests-mfa')
  assert.ok(risks.some((r) => /B2B direct connect user is blocked outright rather than prompted/.test(r)), risks.join('\n'))
})

test('E6: a risk says a strength does not reach every external identity', () => {
  const risks = risksOf('guests-mfa')
  assert.ok(risks.some((r) => /one-time passcode, SAML or Google account needs the plain MFA requirement instead/.test(r)), risks.join('\n'))
})

test('E7: the step and its package cite the page the facts come from', () => {
  const b = bodiesOf('demo').get(GUESTS)!
  assert.equal(b.learnUrl, 'https://learn.microsoft.com/entra/external-id/authentication-conditional-access')
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { url: string }[] } }>)[GUESTS]?.meta
  assert.ok((meta?.verifiedSources ?? []).some((s) => s.url === b.learnUrl), 'the package cites a different page from the step')
})

test('E8: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(GUESTS), '2026-09-20')
  assert.equal(bodiesOf('demo').get(GUESTS)!.sourceLine, 'Source checked Sep 20, 2026')
})

// ---------------------------------------------------------------------------
// Finish Moving Off Per-User MFA (spec section 8)
// ---------------------------------------------------------------------------

const PER_USER = 's-prereq-per-user-mfa'

test('G1: About gives Learn\'s reason: Enforced asks every time, whatever the policy decides', () => {
  const why = whyOf(PER_USER)
  assert.match(why, /asked for MFA at every sign-in whatever the policy decides/)
  assert.match(why, /Microsoft says not to keep per-user MFA where Conditional Access is in use/)
  assert.doesNotMatch(why, /makes it easier to manage consistently/)
  // And on screen, where the admin reads it.
  assert.match(aboutOf(bodiesOf('demo').get(PER_USER)!), /at every sign-in whatever the policy decides/)
})

test('G2: help desk says Conditional Access does not change the per-user state', () => {
  const lines = helpDeskOf(PER_USER)
  assert.ok(lines.some((l) => /turning MFA on through an access policy never changes the per-user state/.test(l)), lines.join('\n'))
  assert.match(blockText(PER_USER, 'entra.disable'), /never changes the per-user state/)
})

test('G3: the portal step reads Per-user MFA and Disable MFA', () => {
  const w = whatToDoOf(PER_USER)
  // "select the accounts above" pointed at a list this step does not draw. The
  // accounts the scan read as Enabled or Enforced are on the Legacy Per-User MFA
  // tile, and an account whose state it could not read is on no list here (this
  // said IAMAI cannot read a per-user state at all, which is not so: G11). The
  // instruction sends the reader to the page that holds every one of them.
  assert.match(w, /Users → All users → Per-user MFA./)
  assert.match(w, /Enabled and Enforced views, select every account they list, and choose Disable MFA/)
  assert.doesNotMatch(w, /accounts above|accounts listed here/)
  assert.match(w, /Authentication Policy Administrator role/)
  assert.match(blockText(PER_USER, 'entra.disable'), /Select \*\*Disable MFA\*\*/)
})

test('G4: a risk names the intranet skip that reads as a trusted location', () => {
  const risks = risksOf(PER_USER)
  assert.ok(risks.some((r) => /skip for federated requests from your intranet, which makes every such request read as a trusted location/.test(r)), risks.join('\n'))
})

test('G5: a risk says an app password survives the change, and the procedure deletes it', () => {
  const risks = risksOf(PER_USER)
  assert.ok(risks.some((r) => /app password created under per-user MFA keeps working after the state is Disabled/.test(r)), risks.join('\n'))
  assert.match(whatToDoOf(PER_USER), /delete any app password those accounts still hold/)
  assert.match(blockText(PER_USER, 'entra.disable'), /Delete any app password these accounts hold/)
})

test('G6: the methods-policy line is a pre-check, not the outcome', () => {
  const w = whatToDoOf(PER_USER)
  assert.match(w, /it never requires MFA, so finishing its migration is not what finishes this step/)
  assert.doesNotMatch(w, /Manage migration → Migration complete\./)
  // Which is what this step's own second criterion has always said.
  const done = bodiesOf('demo').get(PER_USER)!.contract.doneWhen
  assert.ok(done.some((d) => /its completion does not prove that legacy per-user MFA is disabled/.test(d)), done.join('\n'))
})

test('G7: the step and its package cite the action plan this step performs', () => {
  const b = bodiesOf('demo').get(PER_USER)!
  assert.equal(b.learnUrl, 'https://learn.microsoft.com/entra/identity/monitoring-health/recommendation-turn-off-per-user-mfa')
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { url: string }[] } }>)[PER_USER]?.meta
  assert.ok((meta?.verifiedSources ?? []).some((s) => s.url === b.learnUrl), 'the package cites a different page from the step')
})

test('G8: the step shows a source line at all, dated', () => {
  assert.equal(checkedOn(PER_USER), '2026-09-20')
  for (const name of ['demo', 'demo-week2'] as FixtureName[]) {
    assert.equal(bodiesOf(name).get(PER_USER)!.sourceLine, 'Source checked Sep 20, 2026', name)
  }
})

// R4-54. On the large tenant, with no per-user state read, the tile said "Not
// fully read · 4902 accounts need a per-user state check." while every other
// count on the plan said 4,900: per-user MFA is a state of every account, the two
// emergency accounts included, and nothing on the tile said so. The words were
// inline template strings, so the number had no separator and one account would
// have read "1 accounts enabled".
test('G10: the per-user MFA tile counts through count() and says what its number is', () => {
  const tileOf = (f: Fixture) => runFixture(f).steps.find((s) => s.id === PER_USER)?.configurationFindings?.find((x) => x.key === 'per-user-mfa')
  const large = structuredClone(fixture('large'))
  assert.equal(large.snapshot.perUserMfa, undefined, 'the premise: the large tenant read no per-user state')
  const unread = tileOf(large)
  assert.ok(unread, 'the premise: the step carries the tile')
  assert.equal(unread.value, 'Not fully read')
  const all = large.snapshot.users.length.toLocaleString('en')
  assert.equal(unread.detail, `The scan read no per-user MFA state, so every account in the directory needs a check: all ${all} accounts, the emergency accounts included.`)

  const demo = structuredClone(fixture('demo'))
  const [first, second] = demo.snapshot.users
  demo.snapshot.perUserMfa = Object.fromEntries(demo.snapshot.users.map((u) => [u.id, { state: u.id === first.id ? 'enforced' : 'disabled', reason: null }])) as typeof demo.snapshot.perUserMfa
  const one = tileOf(demo)
  assert.ok(one)
  assert.equal(one.value, '1 account Enabled or Enforced')
  demo.snapshot.perUserMfa = Object.fromEntries(demo.snapshot.users.map((u) => [u.id, { state: u.id === second.id ? 'unknown' : 'disabled', reason: null }])) as typeof demo.snapshot.perUserMfa
  const oneUnread = tileOf(demo)
  assert.ok(oneUnread)
  assert.equal(oneUnread.detail, '1 account needs a per-user MFA state check: the scan could not read their state.')
})

// A partial read. The collector leaves a throttled or failed sub-request's state
// 'unknown' (graph/collect/collectors.ts), so on a large tenant some states read
// Enforced and others are never read. The tile read "3 accounts Enabled or
// Enforced" over the three names and nothing about the 2,000 it did not read,
// and the step deletes its manual review while any account reads on: the names
// read as the complete list, and no line on the step said otherwise.
test('G12: on a partial read the per-user MFA tile names what it read and counts what it did not', () => {
  const f = structuredClone(fixture('large'))
  const users = f.snapshot.users
  f.snapshot.perUserMfa = Object.fromEntries(users.map((u, i) => [u.id, { state: i < 3 ? 'enforced' : i < 2003 ? 'unknown' : 'disabled', reason: null }])) as typeof f.snapshot.perUserMfa
  const tile = runFixture(f).steps.find((s) => s.id === PER_USER)?.configurationFindings?.find((x) => x.key === 'per-user-mfa')
  assert.ok(tile, 'the premise: the step carries the tile')
  assert.equal(tile.value, '3 accounts Enabled or Enforced')
  for (const u of users.slice(0, 3)) assert.ok(tile.detail.includes(u.displayName!), `the tile names ${u.displayName}`)
  assert.match(tile.detail, /\. 2,000 accounts need a per-user MFA state check: the scan could not read their state\.$/, tile.detail)
  // One unread state reads as one.
  f.snapshot.perUserMfa = Object.fromEntries(users.map((u, i) => [u.id, { state: i < 3 ? 'enforced' : i === 3 ? 'unknown' : 'disabled', reason: null }])) as typeof f.snapshot.perUserMfa
  const one = runFixture(f).steps.find((s) => s.id === PER_USER)?.configurationFindings?.find((x) => x.key === 'per-user-mfa')
  assert.match(one?.detail ?? '', /\. 1 account needs a per-user MFA state check: the scan could not read their state\.$/, one?.detail ?? 'no tile')
  // An account list the scan did not fully read: the names, and that the tenant-wide state is not established.
  const partialList = structuredClone(f)
  partialList.snapshot.sources.users = { ...partialList.snapshot.sources.users, status: 'partial' }
  const unlisted = runFixture(partialList).steps.find((s) => s.id === PER_USER)?.configurationFindings?.find((x) => x.key === 'per-user-mfa')
  assert.match(unlisted?.detail ?? '', /\. The account list was not fully read; the tenant-wide per-user MFA state is not established\.$/, unlisted?.detail ?? 'no tile')
  // Every state read: the names alone, as before.
  f.snapshot.perUserMfa = Object.fromEntries(users.map((u, i) => [u.id, { state: i < 3 ? 'enforced' : 'disabled', reason: null }])) as typeof f.snapshot.perUserMfa
  const all = runFixture(f).steps.find((s) => s.id === PER_USER)?.configurationFindings?.find((x) => x.key === 'per-user-mfa')
  // Each by the one naming rule (names.ts personLabels): a display name another account shares carries its address.
  const labels = personLabels(users)
  assert.equal(all?.detail, users.slice(0, 3).map((u) => labels.get(u.id)).join(', '))
})

// The step's action said "IAMAI cannot read those states, so it cannot list the
// accounts for you" beside its own Legacy Per-User MFA tile listing, by name, the
// accounts the scan read as Enabled or Enforced. IAMAI reads every account's
// state (graph/collect/collectors.ts, /authentication/requirements); the tile is
// the one place that says what this scan read, including where it could not.
test('G11: the step never says IAMAI cannot read the per-user states it lists', () => {
  const f = structuredClone(fixture('demo'))
  const [first, second] = f.snapshot.users
  f.snapshot.perUserMfa = Object.fromEntries(f.snapshot.users.map((u) => [u.id, { state: u.id === first.id || u.id === second.id ? 'enforced' : 'disabled', reason: null }])) as typeof f.snapshot.perUserMfa
  setDisplayTimeZone('UTC')
  try {
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const step = r.steps.find((s) => s.id === PER_USER)
    assert.ok(step, 'the premise: the step is planned')
    const tile = step.configurationFindings?.find((x) => x.key === 'per-user-mfa')
    assert.equal(tile?.value, '2 accounts Enabled or Enforced', 'the premise: the tile lists what the scan read')
    for (const id of [first.id, second.id]) assert.ok(tile?.detail.includes(f.snapshot.users.find((u) => u.id === id)!.displayName!), `the tile names ${id}`)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    const reading = readings.get(PER_USER)!
    const body = stepBodyOf(step, ctx, { lane: laneViewOf(reading, titleOf), blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) })
    const drawn = everyString(JSON.parse(JSON.stringify(body))).join('\n')
    assert.match(drawn, /disable every legacy per-user MFA state/, 'the premise: the action is drawn')
    assert.doesNotMatch(drawn, /cannot read those states|cannot list the accounts/)
  } finally {
    setDisplayTimeZone(null)
  }
})

test('G9: per-user MFA is never called retired; no Learn page gives it an end date', () => {
  const { example: _example, ...authored } = stepById[PER_USER] as unknown as Record<string, unknown>
  for (const s of everyString(authored)) {
    assert.doesNotMatch(s, /\bretir(ed|ing|ement)\b/i, s)
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
