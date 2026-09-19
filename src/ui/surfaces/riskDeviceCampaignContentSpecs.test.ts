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
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { CONTRACT } from './stepContract.ts'
import { authoredParts } from './authoredText.ts'

type Block = { meta: { id: string; channel: string }; text: string }
type Pkg = { meta: { optionalBindings?: string[] }; blocks: Record<string, Block> }
const packageOf = (stepId: string): Pkg => (registry as unknown as { packages: Record<string, Pkg> }).packages[stepId]
type ContentStepWords = { id: string; why: string; doneEnd?: string; doneWhen?: string[]; decision?: { label?: string; help?: string; text?: string; tileValue?: string } }
const stepWords = (id: string): ContentStepWords => (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as ContentStepWords[]).find((s) => s.id === id)!
const CONFIRM = 'Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.'

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
  const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
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
        ['Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Target resources: All resources.'],
        ['Conditions → Sign-in risk: check Medium only.'],
        ['Grant → Grant access → Require multifactor authentication.'],
        ['Session: leave empty (no session controls).'],
        ['Enable policy: Report-only.'],
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
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  // Editorial batch C: the register Why; the held end state is unchanged.
  const words = stepWords('sign-in-risk-medium')
  assert.equal(words.why, 'This rule adds MFA when Microsoft rates a sign-in medium risk. It provides a separate response from the High-risk rule without changing ordinary sign-ins that are outside its scope.')
  assert.equal(words.doneEnd, "A scan confirms the medium-risk sign-in policy is On and requires the intended MFA controls for the intended users, with the correct exclusions.")
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
        ['Conditions → Sign-in risk: check High only (not Medium).'],
        ['Grant: {{policy.target.grantWords}}. Use only the controls listed here.'],
        ['Session → Sign-in frequency: Every time.'],
        ['Enable policy: Report-only.'],
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
  assert.match(entra, /^6\. Grant: .+Use only the controls listed here\.$/m)
  assert.doesNotMatch(entra, /canonical|\{\{/)
  assert.match(drawn(b, 'ai'), /^Selected grant: [^{}]+/m)
  assert.doesNotMatch(drawn(b, 'ai'), /\[omit |\{\{|only phishing-resistant methods/)
  // The shared readiness sentence stays (BLOCKED.md); the held end state is unchanged.
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  const words = stepWords('sign-in-risk')
  assert.equal(words.why, 'A risk-based rule can ask for stronger verification when Microsoft flags a sign-in as suspicious. Review the selected requirement so people have a working way to meet it.')
  assert.equal(words.doneEnd, "The policy is enforced in {tenant} at the high-risk threshold, with the selected grant and the exclusions group applied.")
})

test('s-goal-require-managed-device: the threshold says what it measures, Entra is one numbered create procedure, and the milestone is its create day', () => {
  const DEVICE = 's-goal-require-managed-device'
  assert.equal(CONTRACT.readinessValue.device, '{value} of devices compliant')
  // Editorial batch C: the exclusions resolved from the device plan, the location include and exclude, the current
  // portal names for the OR grant, and the shared Create sentence.
  assert.deepEqual(authoredParts(packageOf(DEVICE).blocks['entra.create'].text), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: {{policy.target.displayName}}.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group, plus any other exclusions IAMAI resolved from the saved device plan.'],
        ['Target resources: All resources.'],
        ['Conditions → Locations: Include → Any location. Exclude → the resolved trusted locations (the network you defined in the Trusted Network step).'],
        ['Grant → Grant access → select Require device to be marked as compliant and Require Microsoft Entra hybrid joined device → For multiple controls: Require one of the selected controls.'],
        ['Session: leave empty.'],
        ['Enable policy: Report-only. It will not enforce its access rule until you enable it.'],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  assert.doesNotMatch(packageOf(DEVICE).blocks['entra.create'].text, /canonical|STEP\.md|IAMAI-resolved|hybrid Azure AD/)
  // On the demo the step is On Hold with nothing deployed: it draws the create procedure after the Intune prerequisite.
  const b = bodyOf('demo', DEVICE)
  // The demo carries each person's devices since 95228ecc (withDeviceFacts), which moved the compliant share; the script account left the people counted in 8b71ec1a (29% -> 30%).
  assert.equal(b.readiness.tiles.find((t) => t.key === 'gate')?.value, '30% of devices compliant')
  const prerequisites = b.readiness.tiles.filter((t) => t.key.includes('step:'))
  for (const t of prerequisites) assert.ok(['Before enforcement', 'Prerequisite · To do', 'Prerequisite · Waiting'].includes(t.label), t.label)
  assert.ok(prerequisites.some(t => t.label === 'Before enforcement'), 'the safe report-only path is not distinguished from enforcement prerequisites')
  // It was undated while it waited on the retired device-plan step. Its wait is on Decide How People and
  // Devices Sign In now, which holds the row and not the schedule (roadmap/direction.ts gateOnDirection):
  // the milestone is the day the plan creates it in report-only.
  assert.match(b.rail.metric, /^[A-Z][a-z]{2} \d{1,2}, \d{4}$/)
  const create = authoredParts(drawn(b, 'portal')).find((p) => p.kind === 'list')
  assert.ok(create && create.kind === 'list' && create.items[1][0] === 'Name: Core - Require - Compliant device for Office 365.', 'the create procedure names the demo policy')
  // The numbered readiness explanation stays shared (BLOCKED.md). Editorial batch C: the register Why; the held end state is unchanged.
  const words = stepWords('require-managed-device')
  assert.equal(words.why, "Device checks help limit access from computers and phones that do not meet the business's chosen requirements. Reviewing real sign-ins can reveal managed devices whose apps are not sending the expected device information.")
  assert.equal(words.doneEnd, 'The policy is enforced in {tenant}, requiring a compliant device OR Microsoft Entra hybrid joined device on the selected platforms outside the trusted network, with the approved exclusions applied.')
})

test('s-goal-intune-enrollment-reauth: Entra is one numbered procedure that explains the target and the missing grant, AI Info reads for a tech, and Done when names the outcome', () => {
  const INTUNE = 's-goal-intune-enrollment-reauth'
  // Editorial batch C: the shared Create sentence and what this policy does and does not do lead the procedure.
  assert.deepEqual(authoredParts(packageOf(INTUNE).blocks['entra.create'].text), [
    { kind: 'line', text: 'Create this policy in Report-only. It will not enforce its access rule until you enable it. This policy targets Microsoft Intune Enrollment only and sets Sign-in frequency to Every time. It does not add MFA or make the device compliant.' },
    { kind: 'break' },
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: {{policy.target.displayName}}.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group.'],
        ['Target resources → Select resources → Microsoft Intune Enrollment (not "All resources" — this policy targets only the enrollment flow).'],
        ['Conditions: leave all blank. Client apps: All.'],
        ['Grant: do not add a grant control. This policy only sets a session control, not an MFA requirement.'],
        ['Session → Sign-in frequency: Every time.'],
        ['Enable policy: Report-only.'],
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
  assert.equal(words.why, 'A fresh authentication check during user-driven enrollment reduces reliance on an older sign-in session. Test the enrollment methods your organization uses so setup can still finish.')
  // The shared readiness sentence stays (BLOCKED.md).
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
})

test('MFA preparation explains registration, support and useful campaign setup without inventing configuration approval', () => {
  const words = stepWords('s-verify-mfa')
  assert.equal(words.decision?.label, 'People Needing Help')
  const b = bodyOf('demo', 's-verify-mfa')
  assert.ok(b.readiness.tiles.some(t => t.key === 'unsaved:People Needing Help'))
  assert.match(drawn(b, 'portal'), /Registration campaign/)
  assert.match(drawn(b, 'portal'), /snooze/)
  assert.doesNotMatch(drawn(b, 'portal'), /Target: All users|State: Enabled/)
  assert.ok(b.contract.doneWhen.some(l => /Everyone in this step has a suitable registered MFA method/.test(l)))
  assert.ok(b.contract.doneWhen.some(l => /Administrators have a phishing-resistant method/.test(l)))
  assert.doesNotMatch(b.contract.doneWhen.join(' '), /90%|campaign's settings match/)
})
