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
/** AI Info's own words: the package's text, before the IAMAI facts every AI Info carries after it (aiGrounding.ts), which must follow. */
const ownAi = (b: StepBody): string => {
  const text = drawn(b, 'ai')
  const at = text.indexOf(`\n\n${CONTRACT.implementation.aiFacts.heading}\n\n`)
  assert.ok(at > 0, 'the AI Info carries no IAMAI facts after its own words')
  return text.slice(0, at)
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
  assert.equal(ownAi(b), [
    'This policy requires MFA when Microsoft detects a medium-risk sign-in — for example, a sign-in from an unfamiliar location, a new device, or credentials found in a leaked database.',
    'It starts in Report-only so you can observe which sign-ins would be challenged without blocking anyone. After the observation window, IAMAI will prompt you to enforce it.',
    'The exclusions group is excluded so emergency access accounts are never blocked by this policy.',
  ].join('\n\n'))
  // The PowerShell script and the JSON body are unchanged, and the shared readiness sentence stays (BLOCKED.md).
  assert.match(packageOf(MEDIUM).blocks['powershell.run'].text, /^# IAMAI compact implementation script — Challenge Medium-Risk Sign-ins$/m)
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  // Why and Done when are unchanged.
  const words = stepWords('sign-in-risk-medium')
  assert.equal(words.why, 'Medium risk is where most real attacks land: a new country, a new device, a password that appears on a list.')
  assert.equal(words.doneEnd, "The policy is enforced in {tenant} at the medium-risk threshold and matches the baseline's target configuration, with the exclusions group applied.")
})

test('s-goal-sign-in-risk: Entra is one numbered portal procedure naming the strength, and AI Info explains why high risk needs the strength and Every time', () => {
  const HIGH = 's-goal-sign-in-risk'
  const STRENGTH = '{{authStrength.target.displayName}}'
  assert.deepEqual(authoredParts(packageOf(HIGH).blocks['entra.create'].text), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: {{policy.target.displayName}}.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group.'],
        ['Target resources: All resources.'],
        ['Conditions → Sign-in risk: check High only (not Medium).'],
        [`Grant → Grant access → Require authentication strength → select "${STRENGTH}" (the strength you created in the Authentication Strength step).`],
        ['Session → Sign-in frequency: Every time.'],
        ['Enable policy: Report-only.'],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  assert.equal(packageOf(HIGH).blocks['ai.create'].text, [
    'This policy responds to high-risk sign-ins detected by Microsoft Entra ID Protection. High risk means Microsoft is fairly confident the sign-in is compromised — for example, credentials confirmed in a breach database, or traffic from a known attack infrastructure.',
    `Unlike the medium-risk policy (which requires standard MFA), this one requires the authentication strength "${STRENGTH}" — only phishing-resistant methods. The reasoning: if the risk is high, a phished code or push approval might be exactly how the attacker got in.`,
    `The "Every time" sign-in frequency forces re-authentication on every high-risk sign-in, even if the user has a valid session. This ensures the attacker can't ride an existing session.`,
    'The exclusions group ensures emergency access accounts are not blocked during a high-risk event.',
  ].join('\n\n') + '\n')
  // Opened on a P2 tenant with nothing deployed, both channels draw with the tenant's names.
  const b = bodyOf('huge', HIGH)
  const entra = drawn(b, 'portal')
  assert.match(entra, /^2\. Name: Core - Require - Sign-in risk\.$/m)
  assert.match(entra, /^6\. Grant → Grant access → Require authentication strength → select "[^"{}]+" \(the strength you created in the Authentication Strength step\)\.$/m)
  assert.doesNotMatch(entra, /canonical|\{\{/)
  assert.match(drawn(b, 'ai'), /^Unlike the medium-risk policy \(which requires standard MFA\), this one requires the authentication strength "[^"{}]+"/m)
  // The shared readiness sentence stays (BLOCKED.md); Why and Done when are unchanged.
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  const words = stepWords('sign-in-risk')
  assert.equal(words.why, 'Microsoft sees leaked-credential lists and impossible travel before you do; this lets that signal act.')
  assert.equal(words.doneEnd, "The policy is enforced in {tenant} at the high-risk threshold, with the baseline's authentication strength as the grant control and the exclusions group applied.")
})

test('s-goal-require-managed-device: the threshold says what it measures, Entra is one numbered create procedure, and the undated milestone reads —', () => {
  const DEVICE = 's-goal-require-managed-device'
  assert.equal(CONTRACT.readinessValue.device, '{value} of devices compliant')
  assert.deepEqual(authoredParts(packageOf(DEVICE).blocks['entra.create'].text), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies → New policy.'],
        ['Name: {{policy.target.displayName}}.'],
        ['Users → Include: All users. Exclude → Groups: add the exclusions group.'],
        ['Target resources: All resources.'],
        ['Conditions → Locations: Exclude → trusted locations (the network you defined in the Trusted Network step).'],
        ['Grant → Grant access → Require device to be marked as compliant OR Require hybrid Azure AD joined device.'],
        ['Session: leave empty.'],
        ['Enable policy: Report-only.'],
        ['Create. Rescan in IAMAI.'],
      ],
    },
  ])
  assert.doesNotMatch(packageOf(DEVICE).blocks['entra.create'].text, /canonical|STEP\.md|IAMAI-resolved/)
  // On the demo the step is On Hold with nothing deployed: it draws the create procedure after the Intune prerequisite.
  const b = bodyOf('demo', DEVICE)
  assert.equal(b.readiness.tiles.find((t) => t.key === 'gate')?.value, '27% of devices compliant')
  for (const t of b.readiness.tiles.filter((t) => t.key.includes('step:'))) assert.match(t.label, /^Prerequisite · (To do|Waiting)$/)
  assert.equal(b.rail.metric, '—')
  const create = authoredParts(drawn(b, 'portal')).find((p) => p.kind === 'list')
  assert.ok(create && create.kind === 'list' && create.items[1][0] === 'Name: Core - Require - Compliant device for Office 365.', 'the create procedure names the demo policy')
  // The numbered readiness explanation stays shared (BLOCKED.md); Why and Done when are unchanged.
  const words = stepWords('require-managed-device')
  assert.equal(words.why, 'Company data on a device you manage can be protected, updated and wiped; on any other device, outside the office, it cannot.')
  assert.equal(words.doneEnd, 'The policy is enforced in {tenant}, requiring a managed (compliant or domain-joined) device outside the trusted network, with the exclusions group applied.')
})

test('s-goal-intune-enrollment-reauth: Entra is one numbered procedure that explains the target and the missing grant, AI Info reads for a tech, and Done when names the outcome', () => {
  const INTUNE = 's-goal-intune-enrollment-reauth'
  assert.deepEqual(authoredParts(packageOf(INTUNE).blocks['entra.create'].text), [
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
  const AI = [
    'This policy ensures that every time someone enrolls a device in Intune, they sign in fresh — no cached session, no token reuse. This prevents an attacker who has stolen a session token from enrolling their own device as "trusted."',
    "This is a session-only policy: it doesn't require MFA (the MFA-for-everyone policy already handles that). It only requires that the sign-in happens at that moment, not from a stored session.",
    'It targets Microsoft Intune Enrollment specifically, not all resources. This means it only fires during the enrollment flow — not during normal sign-ins, Teams calls, or email.',
    'The exclusions group ensures emergency access accounts are not affected.',
  ].join('\n\n')
  assert.equal(packageOf(INTUNE).blocks['ai.create'].text, AI + '\n')
  // On the demo nothing is deployed yet: both channels draw the create state with the demo's names.
  const b = bodyOf('demo', INTUNE)
  const entra = drawn(b, 'portal')
  assert.match(entra, /^2\. Name: Core - Session - Fresh sign-in for Intune enrollment\.$/m)
  assert.doesNotMatch(entra, /canonical|retained baseline member|read back|\{\{/)
  assert.equal(ownAi(b), AI)
  const words = stepWords('intune-enrollment-reauth')
  assert.equal(words.doneEnd, 'The policy is enforced, requiring a fresh sign-in for every Intune enrollment, with the exclusions group applied.')
  assert.equal(words.why, 'Enrollment makes a device trusted; it should never ride on a session someone else could be holding, so it asks for a fresh sign-in every time.')
  // The shared readiness sentence stays (BLOCKED.md).
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
})

test('s-verify-mfa: Why is two sentences, the special-care tile is short, the input says who belongs in it, Entra adds the snooze, and AI Info is the in-person walkthrough', () => {
  const CAMPAIGN = 's-verify-mfa'
  const words = stepWords(CAMPAIGN)
  assert.equal(words.why, "Enforcement should change nothing for anyone. That's only true once every person has registered a phishing-resistant method and used it to sign in at least once.")
  // The input keeps its label, which is its answer's key; the help under the milestone is short, and who qualifies sits between the label and the chips.
  const WHO = 'Admins, anyone with no sign-in method, and anyone who only has text or phone call. These people need in-person walkthrough to set up their passkey.'
  assert.equal(words.decision?.label, 'People who need special care')
  assert.equal(words.decision?.help, 'Identify anyone who needs hands-on help registering.')
  assert.equal(words.decision?.text, WHO)
  const step = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  const heading = step.indexOf('<h5 className="dlabel action-heading"')
  const text = step.indexOf("{typeof d.text === 'string' && <p className=\"reason\">")
  const picker = step.indexOf('{hasPicker && <Picker')
  assert.ok(heading > 0 && heading < text && text < picker, 'the input text is not drawn between its label and its chips')
  const b = bodyOf('demo', CAMPAIGN)
  assert.deepEqual(b.readiness.tiles.find((t) => t.key === 'unsaved:People who need special care'), { key: 'unsaved:People who need special care', label: 'Special care', tone: 'warn', value: 'Confirm who needs hands-on help', note: WHO })
  for (const t of b.readiness.tiles.filter((t) => t.key.includes('step:'))) assert.match(t.label, /^Prerequisite · (To do|Waiting)$/)
  assert.deepEqual(authoredParts(drawn(b, 'portal')), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Security → Authentication methods → Registration campaign.'],
        ['State: Enabled.'],
        ['Target: All users.'],
        ['Authentication method: Passkey (Microsoft Authenticator).'],
        ["Number of days allowed to snooze: 14 (or your organization's preference)."],
        ['Save.'],
      ],
    },
    { kind: 'break' },
    { kind: 'line', text: 'Each user will see a prompt at their next sign-in asking them to register a passkey. They can snooze it, but it returns until they complete registration.' },
  ])
  assert.equal(ownAi(b), [
    'After enabling the campaign, help each special-care person register in person:',
    [
      '1. Book 10 minutes with each person listed under "People who need special care."',
      '2. Open aka.ms/mfasetup with them signed in.',
      '3. If they have no method at all: issue a Temporary Access Pass first (Entra admin center → Users → [user] → Authentication methods → Add → Temporary Access Pass). This gives them a one-time code to sign in and register.',
      "4. If they only have text or phone call: register the passkey first, then remove the phone number from their authentication methods so it's no longer a sign-in option.",
      '5. Admins: register a passkey or a hardware security key — either counts as phishing-resistant.',
      '6. Have each person sign in one more time after registration. IAMAI checks for the sign-in record on the next scan.',
    ].join('\n'),
    'Track progress on the MFA Readiness page — it shows who still needs setup and who still needs a verified sign-in.',
    '[MFA Readiness →](#/readiness)',
  ].join('\n\n'))
  // Done when is unchanged.
  assert.ok(b.contract.doneWhen.includes('Every admin is Ready for phishing-resistant MFA, and the registration campaign has been reviewed for all other users.'))
})
