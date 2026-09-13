// Content review S4 (docs/content-review/SEGMENTS.md, session and admin policy
// steps): one test per content spec (docs/content-review/specs/content-spec-*.md),
// each asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
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
/** The blocks one channel draws, joined as the projection joins them (project.ts). */
const channel = (stepId: string, ids: string[]): string => ids.map((id) => packageOf(stepId).blocks[id].text).join('\n\n')
type ContentStepWords = { id: string; why: string; doneEnd?: string; doneWhen?: string[]; decision?: { help?: string; options?: string[] } }
const stepWords = (id: string): ContentStepWords => (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as ContentStepWords[]).find((s) => s.id === id)!
const CONFIRM = 'Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.'

/** Every step's body on a fixture, as the Plan composes it (contentReview.test.ts). */
function bodiesOf(f: Fixture): Map<string, StepBody> {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
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
}

test('s-goal-admin-session: Why is two whole sentences, Entra is one numbered procedure naming the policy, and AI Info explains the session limit', () => {
  const SESSION = 's-goal-admin-session'
  assert.equal(stepWords('admin-session').why, 'A stolen admin session stays useful as long as it lasts. A short session limits the damage: an attacker who steals the token has minutes, not hours.')
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  assert.ok(packageOf(SESSION).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  // The two blocks a conditions correction draws.
  const entra = channel(SESSION, ['entra.correct-conditions', 'entra.correct-verify'])
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists and is enforced. The correction adds the exclusions group.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open the policy named {{policy.current.displayName}} (or find it by ID in Plan settings).'],
        ['Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.'],
        ["Verify the session controls match the baseline: Sign-in frequency enabled, set to the baseline's interval. Persistent browser session: set to Never persistent."],
      ],
    },
    { kind: 'list', ordered: true, start: 5, items: [['Save. Do not change the policy state (leave it On).'], ['Rescan in IAMAI to confirm the correction.']] },
  ])
  assert.doesNotMatch(entra, /IAMAI's canonical target|canonical|stable tenant ID/)
  const ai = packageOf(SESSION).blocks['ai.correct'].text
  assert.match(ai, /^This policy shortens how long an admin's session stays valid\. After the sign-in frequency interval, the admin is prompted to re-authenticate\.$/m)
  assert.match(ai, /^This protects against token theft: even if an attacker steals an admin's session token, it expires quickly\. Combined with phishing-resistant MFA, re-authentication requires a passkey the attacker doesn't have\.$/m)
  assert.match(ai, /^The correction on this step adds the exclusions group so emergency access accounts are not affected by the session limit\.$/m)
  assert.match(ai, /^The persistent browser session control ensures admin sessions are not remembered across browser closures\.$/m)
  // Done when is unchanged.
  assert.equal(stepWords('admin-session').doneEnd, "The policy is enforced in {tenant} with the baseline's session controls (sign-in frequency and persistent browser session), and the exclusions group is applied.")
})

test('s-goal-admin-portals-protected: the conflict says there is nothing to do, explains itself in two paragraphs, names the baseline author, and drops the review note', () => {
  const PORTALS = 's-goal-admin-portals-protected'
  const body = bodiesOf(fixture('demo')).get(PORTALS)
  assert.ok(body, 'the demo plan has the admin portals step')
  assert.equal(body.contract.state.condition, 'baseline-conflict')
  // The readiness bar's sub-line.
  assert.equal(body.contract.whatToDo.text, 'This step is on hold until the baseline author resolves a contradiction. There is nothing for you to do.')
  // The danger callout: what the contradiction is, then why IAMAI won't act and what happens next.
  assert.deepEqual(body.conflictWords?.split('\n\n'), [
    "The baseline says this policy should block non-admins from admin portals. But the policy it actually defines targets All users and excludes no administrator — by role, account, or group. If IAMAI followed the policy definition literally, it would lock every administrator out of the admin portals. If it followed the documentation, it would need exclusions the policy doesn't have.",
    "IAMAI won't write instructions for either interpretation because one locks admins out and the other is incomplete. Nothing is wrong in your tenant. This step waits for the baseline author to publish a corrected version. The rest of the plan is unaffected.",
  ])
  assert.match(readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8'), /conflictWords\.split\('\\n\\n'\)\.map\(\(paragraph, i\) => \(\n\s*<p key=\{i\}>/, 'the callout does not draw one paragraph per paragraph')
  // Implementation: two lines, and no note about the guidance's review history.
  assert.equal(body.empty.title, 'Not enough information to provide implementation guidance.')
  assert.equal(body.empty.text, 'The baseline defines this policy two ways. Until the baseline author publishes a corrected version, no implementation steps are available.')
  assert.deepEqual(body.notes, [], 'the conflict step still carries the review note')
  assert.deepEqual(body.contract.doneWhen, ["The baseline author publishes a version that resolves the contradiction between the policy's documentation and its definition."])
})

test('s-goal-token-protection: Why says what token protection is, AI Info explains the attack and the Windows limit, and Done when names the target', () => {
  const TOKEN = 's-goal-token-protection'
  const words = stepWords('token-protection')
  assert.equal(words.why, "Token protection binds a session token to the device it was issued on. If someone steals the token and tries to use it on a different machine, it's rejected.")
  assert.equal(words.doneEnd, "The policy is enforced and matches the baseline's target: token protection required for all users on Windows, with the exclusions group applied.")
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  const ai = packageOf(TOKEN).blocks['ai.correct'].text
  assert.match(ai, /^Token protection binds each sign-in token to the device it was created on\. If an attacker steals the token \(from memory, from a browser export, or from disk\) and tries to replay it on their own machine, Entra rejects it because the device doesn't match\.$/m)
  assert.match(ai, /^This is one of the strongest protections against token theft, which is the attack that bypasses MFA entirely — the attacker doesn't need the user's password or second factor, just a copy of the session token\.$/m)
  assert.match(ai, /^Current limitation: token protection only works on Windows devices running supported apps\. Non-Windows devices \(Mac, iOS, Android\) and some web apps don't support it yet\. This doesn't mean those devices are unprotected — other policies \(MFA, device compliance\) still apply\. It means the token binding doesn't fire there\.$/m)
  assert.match(ai, /^The correction on this step adds the exclusions group so emergency access accounts are not affected\.$/m)
  assert.doesNotMatch(ai, /semantic mismatch|canonical|Stable policy ID/)
  // Entra is unchanged: the target's Browser client apps contradict the pinned
  // baseline, and the package composes Entra per mismatch (BLOCKED.md).
  assert.match(packageOf(TOKEN).blocks['entra.create'].text, /select only \*\*Mobile apps and desktop clients\*\*\. Leave Browser unselected\./)
  assert.match(packageOf(TOKEN).blocks['entra.correct.lifecycle.report-only'].text, /Report-only/)
})

test('s-goal-block-legacy-auth: Entra is a portal walkthrough, AI Info reads for a tech, and Done when drops the product name', () => {
  const LEGACY = 's-goal-block-legacy-auth'
  // The two blocks a conditions correction draws.
  const entra = channel(LEGACY, ['entra.correct-conditions', 'entra.correct-verify'])
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['In Entra admin center → Protection → Conditional Access → Policies, find the existing policy named for legacy authentication blocking.'],
        ['If the policy is currently On (Enforced), switch it to Report-only before making changes.'],
        ['Under Conditions → Client apps, confirm only "Exchange ActiveSync clients" and "Other clients" are checked.'],
        ['Under Users → Include, confirm "All users" is selected.'],
        ['Under Users → Exclude, confirm the exclusions group from the Create or Correct Exclusions Group step is listed.'],
        ['Under Grant, confirm "Block access" is selected.'],
      ],
    },
    { kind: 'list', ordered: true, start: 7, items: [['Leave the policy in Report-only.'], ['Click Save, then rescan in IAMAI.']] },
  ])
  assert.doesNotMatch(entra, /stable tenant ID|resolved policy|canonical|conditions object/)
  assert.equal(packageOf(LEGACY).blocks['ai.correct'].text, "This tenant already has a legacy-authentication-blocking policy, but it does not match the baseline. The corrections are to the policy's conditions (which client apps and users it covers). If the policy is currently enforced, switch it to Report-only before making changes, then correct the conditions to match the baseline target.\n")
  const words = stepWords('block-legacy-auth')
  assert.equal(words.doneEnd, 'The policy is enforced and matches the baseline: it blocks legacy authentication for all users, excludes the exclusions group, and every mail-sending device is accounted for.')
  // The shared readiness sentence and the stored answers stay (BLOCKED.md).
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  assert.deepEqual(words.decision?.options, ['None', 'Yes: add: {devices}; the service-accounts group carries them'])
})

test('s-prereq-trusted-location: the milestone says what to add, Entra is plain steps with the name bound, AI Info explains the location, and Done when names the object', () => {
  const TRUSTED = 's-prereq-trusted-location'
  const content = readFileSync('docs/design/content.json', 'utf8')
  const words = stepWords(TRUSTED)
  assert.equal(words.decision?.help, 'Add your office and VPN IP addresses.')
  assert.deepEqual(words.doneWhen, ['A trusted named location exists in Entra whose IP ranges cover the sign-in sources seen since {from}.'])
  assert.ok(content.includes('"clearNote": "No blockers. Ready to proceed."'), 'the Clear readiness line is not the plain one')
  const entra = packageOf(TRUSTED).blocks['entra.create'].text
  assert.deepEqual(authoredParts(entra), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Named locations → + IP ranges location.'],
        ['Name: {{location.target.displayName}} (or a name that describes your location).'],
        ['Add your office\'s public IP address(es). These are the IPs your internet traffic comes from — your ISP assigns them. If you\'re not sure, search "what is my IP" from a computer in the office.'],
        ['If you have a VPN, add its exit IP addresses too.'],
        ['Check "Mark as trusted location."'],
        ['Create.'],
        ['Rescan in IAMAI.'],
      ],
    },
  ])
  assert.doesNotMatch(entra, /CIDR|supplied by IAMAI|downstream policies/)
  const ai = packageOf(TRUSTED).blocks['ai.create'].text
  assert.match(ai, /^A trusted location tells Entra "sign-ins from these IP addresses are coming from our office\." Several policies in the baseline use this: some relax their requirements inside the trusted network \(like the managed-device policy, which only requires a managed device outside the office\)\.$/m)
  assert.match(ai, /^If you have one office, add its public IP address\. If you have multiple offices or a VPN, add all of them\. The location should cover every IP address your people normally sign in from at work\.$/m)
  assert.match(ai, /^Don't add home IP addresses — those change and aren't controlled by the organization\. The point of a trusted location is that the network itself is something you manage\.$/m)
  assert.match(ai, /^If nobody works from an office \(fully remote, no VPN\), you can mark this step as "Doesn't apply here\."$/m)
})
