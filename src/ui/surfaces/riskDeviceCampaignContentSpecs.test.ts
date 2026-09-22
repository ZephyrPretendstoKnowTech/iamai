// Content review S5 (docs/content-review/SEGMENTS.md, risk, device and campaign
// steps): one test per content spec (docs/content-review/specs/content-spec-*.md),
// each asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { CONTRACT } from './stepContract.ts'
import { fillText } from '../../content/render.ts'
import { authoredParts } from './authoredText.ts'

type Block = { meta: { id: string; channel: string }; text: string }
type Pkg = { meta: { optionalBindings?: string[] }; blocks: Record<string, Block> }
const packageOf = (stepId: string): Pkg => (registry as unknown as { packages: Record<string, Pkg> }).packages[stepId]
type ContentStepWords = { id: string; why: string; doneEnd?: string; doneWhen?: string[]; decision?: { label?: string; help?: string; text?: string; tileValue?: string } }
const stepWords = (id: string): ContentStepWords => (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as ContentStepWords[]).find((s) => s.id === id)!
// The confirmation names the exclusions step by its real title. "the Exclusions Group
// step" named no step (quality audit 2026-09-20 §3, `fixConfirmExclusions`), so the
// sentence carries a {step} slot the contract fills with that step's own title.
const EXCLUSIONS_TITLE = 'Configure Emergency Exclusions'
const CONFIRM = `Complete ${EXCLUSIONS_TITLE} first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.`
// R3: the create procedure refuses On at the line where the lifecycle is picked,
// because the guard the script hard-codes was in the one channel a portal-fluent
// administrator never opens. Every create procedure in the library carries it,
// so the specs read it from the shared line rather than repeating it nine times.
const REFUSE_ON = 'Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.'

/** One step's body on a fixture, as the Plan composes it (sessionAdminContentSpecs.test.ts). */
function bodyOf(name: FixtureName, stepId: string): StepBody {
  const f = fixture(name)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const step = r.steps.find((s) => s.id === stepId)
  assert.ok(step, `the ${name} plan has ${stepId}`)
  const reading = readings.get(step.id)
  const lane = laneViewFor(step, { readings, titleOf })
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  return stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) })
}
/** The text one channel tab draws. */
const drawn = (b: StepBody, id: string): string => b.artifacts.find((a) => a.id === id)!.text()
/** AI Info's own words: the package's text, after the shared opening and before the IAMAI facts every AI Info carries (aiGrounding.ts), which must frame it. */
const ownAi = (b: StepBody): string => {
  const text = drawn(b, 'ai')
  const opening = `${(CONTRACT.implementation.aiFacts as unknown as { opening: string[] }).opening.join('\n\n')}\n\n`
  assert.ok(text.startsWith(opening), 'the AI Info does not open with the shared briefing request')
  const at = text.indexOf(`\n\n${CONTRACT.implementation.aiFacts.heading}\n\n`)
  assert.ok(at > 0, 'the AI Info carries no IAMAI facts after its own words')
  return text.slice(opening.length, at)
}

test('s-goal-sign-in-risk-medium: Entra is one numbered portal procedure naming the exclusions group step, and AI Info explains the policy for a tech', () => {
  const MEDIUM = 's-goal-sign-in-risk-medium'
  // A P2 tenant with nothing deployed draws the create state.
  const b = bodyOf('huge', MEDIUM)
  const entra = drawn(b, 'portal')
  assert.deepEqual(authoredParts(entra), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: Core - Require - Medium sign-in risk.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in Configure Emergency Exclusions.'],
        ['Target resources: All resources.'],
        // Respond to Risk and Limit Sessions (docs/plans/risk-and-sessions-spec.md):
        // both conditions go through their own Configure toggle, and each says what
        // the other value would reach. Left at No the sign-in risk condition is not
        // written at all, so the grant would apply to every sign-in; the Client apps
        // condition is the opposite case, where unconfigured is the target and
        // ticking every box writes the four named client types instead
        // (policy-risk-based-sign-in and concept-conditional-access-conditions,
        // checked 2026-09-20).
        ['Conditions → Sign-in risk: set **Configure** to **Yes**, then check Medium only. Left at **No** the policy carries no risk condition, and its grant applies to every sign-in.'],
        ['Conditions → Client apps: leave **Configure** at **No**. This policy is meant to reach every client app, which is what an unconfigured condition does; ticking every box writes the four named client types instead.'],
        ['Grant → Grant access → Require multifactor authentication.'],
        ['Session: leave empty (no session controls).'],
        [`Enable policy: Report-only. ${REFUSE_ON}`],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  assert.doesNotMatch(entra, /canonical|retained baseline member/)
  // Editorial batch C: no fixed detection-to-severity examples, and enforcement waits on evidence, not only time.
  assert.equal(ownAi(b), [
    'This state creates a policy that requires built-in MFA when Microsoft Entra ID Protection rates a sign-in Medium risk. Microsoft sets the risk level from its detections, so do not assume that a particular event, such as an unfamiliar location, always produces a Medium rating. Sign-in risk conditions require Microsoft Entra ID P2.',
    'The policy has no session controls, and High sign-in risk is covered by a separate policy. It is created in Report-only, which records what would happen without prompting anyone. Moving to enforcement depends on reviewing the available Medium-risk sign-ins and MFA readiness, not only on time passing.',
    'The exclusions group is excluded, so accounts in that group, such as emergency access accounts, are not subject to this policy.',
  ].join('\n\n'))
  // The PowerShell script and the JSON body are unchanged, and the shared readiness sentence stays (BLOCKED.md).
  assert.match(packageOf(MEDIUM).blocks['powershell.run'].text, /^# IAMAI compact implementation script — Challenge Medium-Risk Sign-ins$/m)
  assert.equal(fillText(CONTRACT.fixConfirmExclusions, { step: EXCLUSIONS_TITLE }), CONFIRM)
  // Editorial batch C: the register Why; the held end state is unchanged.
  const words = stepWords('sign-in-risk-medium')
  // Respond to Risk and Limit Sessions §2: About this Step says what a medium rating
  // is — one or more moderate anomalies, with less confidence than a high one
  // (concept-risk-detection-types, ms.date 2026-06-10, checked 2026-09-20).
  assert.equal(words.why, 'A medium rating means Microsoft saw one or more moderate anomalies in the sign-in and is less confident than it is at high. This rule asks for multifactor authentication at that level, and leaves the High-risk rule its own stronger requirement.')
  // §2: Completion Criteria was the same sentence twice; the end state is now the step's own outcome.
  assert.equal(words.doneEnd, 'A sign-in {tenant} rates medium risk cannot continue until it is answered with multifactor authentication, and the exclusions group is applied.')
})

test('s-goal-sign-in-risk: Entra is one numbered portal procedure naming the strength, and AI Info explains why high risk needs the strength and Every time', () => {
  const HIGH = 's-goal-sign-in-risk'
  assert.deepEqual(authoredParts(packageOf(HIGH).blocks['entra.create'].text), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: {{policy.target.displayName}}.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group.'],
        ['Target resources: All resources.'],
        // Respond to Risk and Limit Sessions: the same two conditions, said the same way.
        ['Conditions → Sign-in risk: set **Configure** to **Yes**, then check High only (not Medium). Left at **No** the policy carries no risk condition, and its grant applies to every sign-in.'],
        ['Conditions → Client apps: leave **Configure** at **No**. This policy is meant to reach every client app, which is what an unconfigured condition does; ticking every box writes the four named client types instead.'],
        ['Grant: {{policy.target.grantWords}}. Use only the controls listed here.'],
        ['Session → Sign-in frequency: Every time.'],
        [`Enable policy: Report-only. ${REFUSE_ON}`],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  // Editorial batch C (channel correction): the strength is not called phishing-resistant-only, Temporary Access Pass is
  // named when accepted, a saved first-enforcement grant is stated from IAMAI's facts, and Every time promises no more than it does.
  assert.equal(packageOf(HIGH).blocks['ai.create'].text, [
    'This state creates a policy that applies when Microsoft Entra ID Protection rates a sign-in High risk. Microsoft sets the risk level from its detections, so do not assume a particular detection always produces a High rating. Sign-in risk conditions require Microsoft Entra ID P2.',
    `Selected grant: {{policy.target.grantWords}}. Every time sign-in frequency also applies. When an authentication strength is selected, explain its accepted methods rather than calling every strength phishing-resistant.\nAccepted method combinations: {{authStrength.target.allowedCombinations}} [omit this line when unavailable]`,
    "The outputs follow the saved first-enforcement choice. If that choice is built-in MFA, explain that the baseline authentication strength remains a later hardening goal; do not describe it as already applied.",
    'Every time sign-in frequency asks for fresh authentication each time the policy applies instead of relying on an earlier sign-in. It reduces reliance on an existing session but does not guarantee that an attacker cannot use one.',
    'The Medium-risk policy stays separate and uses built-in MFA. The exclusions group is excluded, so accounts in that group, such as emergency access accounts, are not subject to this policy.',
  ].join('\n\n') + '\n')
  // Opened on a P2 tenant with nothing deployed, both channels draw with the tenant's names.
  const b = bodyOf('huge', HIGH)
  const entra = drawn(b, 'portal')
  assert.match(entra, /^2\. Name: Core - Require - Sign-in risk\.$/m)
  // The Client apps condition took item 6, so the grant is item 7.
  assert.match(entra, /^7\. Grant: .+Use only the controls listed here\.$/m)
  assert.doesNotMatch(entra, /canonical|\{\{/)
  assert.match(drawn(b, 'ai'), /^Selected grant: [^{}]+/m)
  assert.doesNotMatch(drawn(b, 'ai'), /\[omit |\{\{|only phishing-resistant methods/)
  // The shared readiness sentence stays (BLOCKED.md); the held end state is unchanged.
  assert.equal(fillText(CONTRACT.fixConfirmExclusions, { step: EXCLUSIONS_TITLE }), CONFIRM)
  const words = stepWords('sign-in-risk')
  // Respond to Risk and Limit Sessions §3: About this Step is the step's own outcome,
  // and says what sign-in risk is a reading of — one authentication request, and how
  // likely it is that it did not come from the account's owner (policy-risk-based-sign-in,
  // ms.date 2026-03-24, checked 2026-09-20).
  assert.equal(words.why, "Sign-in risk is Microsoft's reading of one authentication request: how likely it is that the request did not come from the person who owns the account. A high reading stops the sign-in until it is answered with a method the baseline's authentication strength accepts.")
  // §3: the end state is the step's own outcome, and it honours the operator's saved
  // grant rather than restating the baseline's strength as already applied.
  assert.equal(words.doneEnd, 'A sign-in {tenant} rates high risk cannot continue until it is answered with a method the selected grant accepts, and the exclusions group is applied.')
})

test('s-goal-require-managed-device: the threshold says what it measures, Entra is one numbered create procedure, and it is undated while it waits on the device direction', () => {
  const DEVICE = 's-goal-require-managed-device'
  // Require Healthy Devices D8 (docs/plans/require-healthy-devices-spec.md): the
  // gate counts the active people who own an in-scope compliant device
  // (roadmap/readiness.ts), so the value says people, not devices.
  assert.equal(CONTRACT.readinessValue.device, '{value} of people on a compliant device')
  // Editorial batch C: the exclusions resolved from the device plan, the location include and exclude, the current
  // portal names for the OR grant, and the shared Create sentence.
  assert.deepEqual(authoredParts(packageOf(DEVICE).blocks['entra.create'].text), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: {{policy.target.displayName}}.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group, plus any other exclusions IAMAI resolved from the saved device plan.'],
        ['Target resources: All resources.'],
        // Require Healthy Devices D3/D4: each condition through its own Configure toggle, with the resolved words for both.
        [
          'Conditions → set only what IAMAI resolved, and set each one through its own **Configure** toggle:',
          'Locations: set **Configure** to **Yes** — at **No** the policy asks for a managed device in the office too — then **{{policy.target.locationWords}}**. [omit this line when unavailable]',
          'Device platforms: set **Configure** to **Yes** — at **No** it reaches every platform, including the ones your device answer left out — then **{{policy.target.platformWords}}**. [omit this line when unavailable]',
        ],
        ['Grant → Grant access → select Require device to be marked as compliant and Require Microsoft Entra hybrid joined device → For multiple controls: Require one of the selected controls.'],
        ['Session: leave empty.'],
        [`Enable policy: Report-only. It will not enforce its access rule until you enable it. ${REFUSE_ON}`],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  assert.doesNotMatch(packageOf(DEVICE).blocks['entra.create'].text, /canonical|STEP\.md|IAMAI-resolved|hybrid Azure AD/)
  // On the demo the step is On Hold with nothing deployed: it draws the create procedure after the Intune prerequisite.
  const b = bodyOf('demo', DEVICE)
  // The demo carries each person's devices since 95228ecc (withDeviceFacts), which moved the compliant share; the script account left the people counted in 8b71ec1a (29% -> 30%).
  assert.equal(b.readiness.tiles.find((t) => t.key === 'gate')?.value, '30% of people on a compliant device')
  const prerequisites = b.readiness.tiles.filter((t) => t.key.includes('step:'))
  // One label, and one sentence per card: the 'Before enforcement' relabelling
  // and its composed caveat are gone (owner, 2026-09-19 — "both tasks basically
  // say the same thing"). A prerequisite states what is waited on and links to it.
  // The card is headed by what is being waited on, and checked by its state
  // (owner, 2026-09-20; quality audit 2.4).
  for (const t of prerequisites) assert.ok(['Prerequisite · To do', 'Prerequisite · Waiting'].includes(t.value), `${t.label}: ${t.value}`)
  for (const t of prerequisites) assert.doesNotMatch(t.note ?? '', /does not enforce access restrictions/, t.key)
  // Its wait is on Decide How People and Devices Sign In (roadmap/direction.ts gateOnDirection), and a
  // Direction answer nobody has approved holds the step undated, like every other hold (owner, 2026-09-19):
  // no create day either, until the answer is approved.
  assert.equal(b.rail.metric, 'Not scheduled')
  const create = authoredParts(drawn(b, 'portal')).find((p) => p.kind === 'list')
  assert.ok(create && create.kind === 'list' && create.items[1][0] === 'Name: Core - Require - Compliant device for Office 365.', 'the create procedure names the demo policy')
  // The numbered readiness explanation stays shared (BLOCKED.md). Editorial batch C: the register Why; the held end state is unchanged.
  const words = stepWords('require-managed-device')
  // Require Healthy Devices D1: About this Step is the step's own outcome.
  assert.equal(words.why, 'Away from the trusted network, work access needs a device this business manages: one Intune has marked compliant, or a Microsoft Entra hybrid joined Windows computer. A device only registered in Entra meets neither, and a managed device whose app sends no device information is refused as if it were unmanaged.')
  assert.equal(words.doneEnd, 'The policy is enforced in {tenant}, requiring a compliant device OR Microsoft Entra hybrid joined device on the selected platforms outside the trusted network, with the approved exclusions applied.')
})

test('s-goal-intune-enrollment-reauth: Entra is one numbered procedure that explains the target and the missing grant, AI Info reads for a tech, and Done when names the outcome', () => {
  const INTUNE = 's-goal-intune-enrollment-reauth'
  // Editorial batch C: the shared Create sentence and what this policy does and does not do lead the procedure.
  assert.deepEqual(authoredParts(packageOf(INTUNE).blocks['entra.create'].text), [
    { kind: 'line', text: 'Create this policy in Report-only. It will not enforce its access rule until you enable it. This policy targets Microsoft Intune Enrollment only and sets Sign-in frequency to Every time. It does not add MFA or make the device compliant. Microsoft names Intune enrollment as one of the actions Every time is for, and it asks for the sign-in again whenever the session is evaluated.' },
    { kind: 'break' },
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: {{policy.target.displayName}}.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group.'],
        ['Target resources → Select resources → Microsoft Intune Enrollment (not "All resources" — this policy targets only the enrollment flow).'],
        // Require Healthy Devices E2/E3: an unconfigured condition is a choice, and it is said as one.
        ['Conditions: leave every condition unconfigured, **Client apps** included. At **Configure: No** the client-apps condition reaches every client app, which is the target here; selecting the four boxes instead writes a narrower policy that IAMAI reads as a difference that never resolves.'],
        ['Grant: do not add a grant control. This policy only sets a session control, not an MFA requirement. Microsoft\'s own enrollment recipe adds one; the pinned baseline does not, and IAMAI follows the baseline.'],
        ['Session → Sign-in frequency: Every time.'],
        [`Enable policy: Report-only. ${REFUSE_ON}`],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  // Editorial batch C (channel correction): the target is Intune Enrollment only, Grant stays unconfigured, and the
  // all-user MFA policy excludes Intune Enrollment, so it does not supply MFA there (pinned baseline).
  const AI = [
    'This state creates the policy in Report-only.',
    'The target is Microsoft Intune Enrollment only (application ID `d4ebce55-015a-49b5-a083-c84d1797ae8c`), not All resources. Users: All users; the exclusions group keeps emergency access accounts outside the policy.',
    'Grant stays unconfigured. Session → Sign-in frequency is Every time, a session-only control. It does not add MFA or make a device compliant.',
    'MFA must come from other applicable controls. The all-user MFA policy excludes the Intune Enrollment resource, so it does not supply MFA there.',
  ].join('\n\n')
  assert.equal(packageOf(INTUNE).blocks['ai.create'].text, AI + '\n')
  assert.doesNotMatch(AI, /already handles that|as "trusted"/)
  // On the demo nothing is deployed yet: both channels draw the create state with the demo's names.
  const b = bodyOf('demo', INTUNE)
  const entra = drawn(b, 'portal')
  assert.match(entra, /^2\. Name: Core - Session - Fresh sign-in for Intune enrollment\.$/m)
  assert.doesNotMatch(entra, /canonical|retained baseline member|read back|\{\{/)
  assert.equal(ownAi(b), AI)
  const words = stepWords('intune-enrollment-reauth')
  assert.equal(words.doneEnd, 'The policy is enforced, requiring a fresh sign-in for every Intune enrollment, with the exclusions group applied.')
  // Require Healthy Devices E1: About this Step is the step's own outcome.
  assert.equal(words.why, 'Enrolling a device in Intune asks the person to sign in again, so an open session cannot quietly turn a device into a managed one. It is a session control and nothing else: it adds no MFA requirement and it does not make the device compliant.')
  // The shared readiness sentence stays (BLOCKED.md).
  assert.equal(fillText(CONTRACT.fixConfirmExclusions, { step: EXCLUSIONS_TITLE }), CONFIRM)
})

test('MFA preparation explains registration, support and useful campaign setup without inventing configuration approval', () => {
  const words = stepWords('s-verify-mfa')
  assert.equal(words.decision?.label, 'People Needing Help')
  const b = bodyOf('demo', 's-verify-mfa')
  assert.ok(b.readiness.tiles.some(t => t.key === 'unsaved:People Needing Help'))
  assert.match(drawn(b, 'portal'), /Registration campaign/)
  assert.match(drawn(b, 'portal'), /snooze/)
  assert.doesNotMatch(drawn(b, 'portal'), /Target: All users|State: Enabled/)
  // mfa-everyone-spec.md §4 C9: Completion Criteria is split so each line says one thing.
  assert.ok(b.contract.doneWhen.some(l => /Everyone in this step has a registered MFA method they can use/.test(l)))
  assert.ok(b.contract.doneWhen.some(l => /Every administrator has a phishing-resistant method/.test(l)))
  assert.ok(b.contract.doneWhen.some(l => /The people who still need help are identified and on the support list/.test(l)))
  assert.doesNotMatch(b.contract.doneWhen.join(' '), /90%|campaign's settings match/)
})
