// The "Protect Your Administrators" group, taken to the V1 standard:
// docs/plans/protect-admins-spec.md holds the outcome, the Microsoft Learn page
// behind every technical claim and the date it was checked. One test per
// acceptance item in that spec.
//
// A test here reads the OPENED STEP, not the content file, wherever the claim is
// about what an admin sees: the acceptance is what is on screen (CLAUDE.md).
// Where a claim is about a lifecycle state no fixture reaches, the compiled
// package block is read instead, because that is the text the state would draw.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stepById } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { membersOf } from '../../roadmap/stepGroups.ts'

/** The group's five members, in registry order (roadmap/stepGroups.ts). */
const PROTECT_ADMINS = [
  's-ladder-operator-passkey',
  's-prereq-auth-strength',
  's-goal-admins-phishing-resistant',
  's-goal-admin-session',
  's-goal-pim-activation-reauth',
]

/** Every step's body on a fixture, as the Plan composes it (closeDoors.test.ts bodiesOf). */
function bodiesOf(name: FixtureName): Map<string, StepBody> {
  setDisplayTimeZone('UTC')
  try {
    const f: Fixture = fixture(name)
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const out = new Map<string, StepBody>()
    for (const step of r.steps) {
      const reading = readings.get(step.id)
      const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
      out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
    }
    return out
  } finally {
    setDisplayTimeZone(null)
  }
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

/** A content step's own instruction lines, unfilled. */
const stepsOf = (id: string): string[] =>
  ((stepById[id] as unknown as { whatToDo?: { steps?: string[] } }).whatToDo?.steps ?? []) as string[]

/** A step's risk lines from the content file, whatever their `applies`. */
const risksOf = (id: string): string[] =>
  (((stepById[id] as unknown as { more?: { risks?: { text?: string }[] } }).more?.risks ?? []).map((r) => r.text ?? '')) as string[]

/** A step's help-desk lines from the content file. */
const helpDeskOf = (id: string): string[] => ((stepById[id] as unknown as { more?: { helpDesk?: unknown } }).more?.helpDesk ?? []) as string[]

/** The step's About sentence as the opened step fills it. */
const aboutOf = (b: StepBody): string => fillText(String((b.cs as Record<string, unknown>).why ?? ''), b.ex as Record<string, unknown>)

/** Every Implementation Task line the opened step lists, as one block of text. */
const tasksTextOf = (b: StepBody): string =>
  (b.emergencyAccountTasks?.tasks ?? []).map((t) => [t.title, ...t.steps, ...(t.facts ?? []).map((f) => `${f.label}: ${f.value}`)].join('\n')).join('\n')

// ---------------------------------------------------------------------------
// The group itself
// ---------------------------------------------------------------------------

test('the group draws its five members in the spec order', () => {
  assert.deepEqual([...membersOf('protect-admins')], PROTECT_ADMINS)
})

// ---------------------------------------------------------------------------
// Register Your Own Passkey (spec section 2)
// ---------------------------------------------------------------------------

const PASSKEY = 's-ladder-operator-passkey'

test('A1: registration starts where Microsoft documents it, not at the old shortcut', () => {
  const steps = stepsOf(PASSKEY).join('\n')
  assert.match(steps, /https:\/\/mysignins\.microsoft\.com\/security-info/)
  assert.doesNotMatch(steps, /aka\.ms\/mfasetup/)
  assert.match(blockText(PASSKEY, 'entra.register'), /https:\/\/mysignins\.microsoft\.com\/security-info/)
})

test('A2: the five-minute window before a passkey can be registered is stated', () => {
  assert.match(stepsOf(PASSKEY).join('\n'), /only be registered within five minutes of a completed prompt/)
  assert.match(blockText(PASSKEY, 'entra.register'), /an MFA completed in the last five minutes/)
})

test('A3: the two methods are named by their own menu entries, and either is enough', () => {
  const steps = stepsOf(PASSKEY).join('\n')
  assert.match(steps, /Add sign-in method → Passkey registers a security key/)
  assert.match(steps, /Add sign-in method → Passkey in Microsoft Authenticator registers one in the app/)
  assert.match(steps, /Either one is enough, and Microsoft recommends a security key for elevated privileges/)
})

test('A4: a refused passkey names the three settings that refuse it', () => {
  const steps = stepsOf(PASSKEY).join('\n')
  assert.match(steps, /Allow self-service set up, which stops registration here when it is No/)
  assert.match(steps, /enforced attestation/)
  assert.match(steps, /key restriction that excludes the key you used/)
})

test('A5: the step links the page that carries the registration procedure', () => {
  const b = bodiesOf('demo').get(PASSKEY)!
  assert.equal(b.learnUrl, 'https://learn.microsoft.com/entra/identity/authentication/how-to-register-passkey-with-security-key')
  const meta = (registry.packages as Record<string, { meta?: { verifiedSources?: { url: string }[] } }>)[PASSKEY]?.meta
  assert.ok((meta?.verifiedSources ?? []).some((s) => s.url === b.learnUrl), 'the package cites a different page from the step')
})

test('A6: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(PASSKEY), '2026-09-20')
  assert.equal(bodiesOf('demo').get(PASSKEY)!.sourceLine, 'Source checked Sep 20, 2026')
})

// ---------------------------------------------------------------------------
// Create the Baseline's Authentication Strength (spec section 3)
// ---------------------------------------------------------------------------

const STRENGTH = 's-prereq-auth-strength'

test('B1: the strength is made under Authentication methods, the one place Microsoft puts it', () => {
  const steps = stepsOf(STRENGTH).join('\n')
  assert.match(steps, /Authentication methods → Authentication strengths → New authentication strength/)
  assert.match(steps, /It takes the Security Administrator role, and it is not under Conditional Access\./)
  assert.doesNotMatch(steps, /Conditional Access → Authentication strengths/)
  // The step and its package give the same path, so the fact has one source.
  assert.match(blockText(STRENGTH, 'entra.create'), /Entra admin center → Entra ID → Authentication methods → Authentication strengths/)
})

test('B2: the baseline strength carries both Temporary Access Pass forms, said once in the evidence', () => {
  // `who.none` is drawn when no strength in the tenant matches; the demo has
  // none to match, so the sentence is read from the step it belongs to.
  const none = String(((stepById[STRENGTH] as unknown as { who?: { none?: string } }).who ?? {}).none ?? '')
  assert.match(none, /a Temporary Access Pass in both its one-time and its multi-use form/)
  // And the procedure that creates it still lists the two options separately.
  assert.match(stepsOf(STRENGTH).join('\n'), /Temporary Access Pass \(one-time\) · Temporary Access Pass \(multi-use\)/)
})

test('B3: If it goes wrong says when the strength can no longer be deleted', () => {
  const ifWrong = String((stepById[STRENGTH] as unknown as { ifWrong?: string }).ifWrong ?? '')
  assert.match(ifWrong, /^Delete the strength; no policy references it yet\./)
  assert.match(ifWrong, /Once one does, Entra refuses the delete and asks you to confirm every edit\./)
})

test('B4: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(STRENGTH), '2026-09-20')
  assert.equal(bodiesOf('demo').get(STRENGTH)!.sourceLine, 'Source checked Sep 20, 2026')
})

// ---------------------------------------------------------------------------
// Require Phishing-Resistant MFA for Admins (spec section 4)
// ---------------------------------------------------------------------------

const ADMINS = 's-goal-admins-phishing-resistant'

test('C1: help desk says what a Temporary Access Pass does here, in both its forms', () => {
  const lines = helpDeskOf('admins-phishing-resistant')
  assert.ok(lines.some((l) => /satisfies this policy's strength in both its forms/.test(l)), lines.join('\n'))
  assert.ok(lines.some((l) => /Microsoft's own phishing-resistant strength accepts neither/.test(l)), lines.join('\n'))
})

test('C2: no help-desk line still claims only a passkey, key or Hello gets through', () => {
  const lines = helpDeskOf('admins-phishing-resistant')
  assert.ok(!lines.some((l) => /Only a registered passkey, security key or Windows Hello gets through/.test(l)), lines.join('\n'))
  assert.ok(lines.some((l) => /Anything the strength does not list is refused/.test(l)), lines.join('\n'))
})

test('C3: help desk names the Windows Hello prompt that never arrives after a password', () => {
  const lines = helpDeskOf('admins-phishing-resistant')
  assert.ok(
    lines.some((l) => /signed in with a password first is never prompted for Windows Hello/.test(l) && /Sign-in options/.test(l)),
    lines.join('\n'),
  )
})

test('C4: Completion Criteria is this step’s outcome, and never over-claims phishing resistance', () => {
  const end = String((stepById['admins-phishing-resistant'] as unknown as { doneEnd?: string }).doneEnd ?? '')
  assert.match(end, /^Admins in the baseline's built-in directory roles can only sign in to \{tenant\} with a method its authentication strength accepts/)
  assert.doesNotMatch(end, /phishing-resistant method/)
})

test('C5: the client-apps condition is left unconfigured, because that is what reaches them all', () => {
  const create = blockText(ADMINS, 'entra.create')
  assert.match(create, /Leave \*\*Conditions > Client apps\*\* unconfigured, with \*\*Configure\*\* at \*\*No\*\*/)
  assert.match(create, /Ticking every box instead sets a narrower list than the target/)
  // No fixture puts this policy in Partial — the demo has it in Report-only —
  // so the correction is read from the block that state would draw.
  assert.match(blockText(ADMINS, 'entra.correct-conditions'), /Leave Conditions → Client apps unconfigured, with Configure at No/)
})

test('C6: the step shows the date its Microsoft sources were checked', () => {
  assert.equal(checkedOn(ADMINS), '2026-09-20')
  assert.equal(bodiesOf('demo').get(ADMINS)!.sourceLine, 'Source checked Sep 20, 2026')
})

// The unused readers below are kept for the sections that follow.
void risksOf
void aboutOf
