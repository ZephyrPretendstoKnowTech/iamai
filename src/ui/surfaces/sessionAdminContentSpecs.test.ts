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
// Cycle 6 (review 5 queue 1): a correction's Save item and AI Info also carry the line naming
// the exclusions the update removes, omitted when it removes none ([omit this line when unavailable]).
const REMOVED = "This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]"
// Editorial batch C (SHARED-COPY-AND-RULES.md, correction preserving state).
const KEEP_STATE = "Keep the policy's current state. If it is On, the changed rule can affect access after you save."

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
  // Editorial batch C: the register Why.
  assert.equal(stepWords('admin-session').why, 'Shorter admin browser sessions reduce how long a signed-in browser can remain useful without another authentication check. Test the experience so normal admin work remains practical.')
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  assert.ok(packageOf(SESSION).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  // The two blocks a conditions correction draws.
  const entra = channel(SESSION, ['entra.correct-conditions', 'entra.correct-verify'])
  // Editorial batch C (channel correction): the correction sets the pinned target's conditions and session controls, not only the exclusions group.
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists. The correction sets its conditions to the intended target, including the exclusions group.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open the policy named {{policy.current.displayName}} (ID: {{policy.current.id}}).'],
        ['Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Check the other conditions and set any that differ from the baseline: Users → Include: the resolved admin roles; Target resources: All resources; Client apps: Browser. Also check the session controls: Sign-in frequency: 4 hours. Persistent browser session: Never persistent. Grant stays unconfigured.'],
      ],
    },
    // Cycle 2 (C02): "leave it On" was wrong for a Report-only policy; the correction keeps whatever state the policy has.
    // Cycle 3 (review 2): and says what saving does to a policy that is On.
    { kind: 'list', ordered: false, start: 1, items: [['Save with **Enable policy** unchanged. If it is On, the changed rule can affect access after you save.', REMOVED], ['Rescan in IAMAI to confirm the correction.']] },
  ])
  assert.doesNotMatch(entra, /IAMAI's canonical target|canonical|stable tenant ID|the baseline's interval/)
  const ai = packageOf(SESSION).blocks['ai.correct'].text
  // Editorial batch C (factual fix): sign-in frequency is not a hard lifetime for every token, and nothing promises the attacker lacks a passkey.
  assert.match(ai, /^Policy \{\{policy\.current\.id\}\} for \*\*Shorten Admin Sessions\*\* differs from the intended target: \{\{policy\.current\.semanticMismatches\}\}\. The next action is to correct those settings on the same policy\.$/m)
  assert.match(ai, /^The intended target applies to the resolved admin roles, all resources and Browser client apps\. It sets Sign-in frequency to 4 hours and Persistent browser session to Never persistent, with no grant control\. After the interval, an admin using a browser is asked to authenticate again; this is not a hard lifetime for every token or application session\.$/m)
  assert.match(ai, /^The exclusions group in the target keeps emergency access accounts out of this policy\.$/m)
  assert.ok(ai.includes(KEEP_STATE))
  assert.doesNotMatch(ai, /expires quickly|a passkey the attacker doesn't have/)
  // The held end state is unchanged.
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
  // Editorial batch C: the register Why.
  assert.equal(words.why, 'Token protection makes supported sign-in tokens harder to reuse on another device. Compatibility checks help identify apps or device setups that need attention before the requirement is enabled.')
  assert.equal(words.doneEnd, "A scan confirms token protection is On for the intended Windows clients and resources, with the correct exclusions. Supported work apps sign in successfully with token protection.")
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  const ai = packageOf(TOKEN).blocks['ai.correct'].text
  // Editorial batch C (factual fix): supported session tokens on the pinned resources and platform only, never every token, and no claim that the correction only adds the exclusions group.
  assert.match(ai, /^Token protection makes supported sign-in session tokens harder to reuse on another device\. In this policy it applies only to Exchange Online, SharePoint Online, Microsoft Teams Services, Azure Virtual Desktop and Windows 365, for Windows mobile apps and desktop clients, with Microsoft Entra joined Cloud PCs excluded by the device filter\. It does not cover browser sessions, other platforms, or every token\.$/m)
  assert.match(ai, /^Keep the intended resources, Windows platform, client-app scope, CloudPC filter and resolved exclusions\. The JSON and PowerShell outputs use Microsoft Graph beta because `secureSignInSession` is not exposed in the v1\.0 session-controls schema\.$/m)
  assert.ok(ai.includes(KEEP_STATE))
  assert.doesNotMatch(ai, /semantic mismatch|canonical|Stable policy ID|bypasses MFA entirely|adds the exclusions group/)
  // Entra's create still selects client apps as the pinned baseline does, and the package composes Entra per mismatch (BLOCKED.md).
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
        // Editorial batch C: the policy is opened by its id, and each step makes the setting so rather than only confirming it.
        ['In Entra admin center → Protection → Conditional Access → Policies, open the existing legacy authentication blocking policy with ID **{{policy.current.id}}**.'],
        // Cycle 2 (C02): the correction no longer moves an enforced block to Report-only; it keeps the state and says what saving does.
        [KEEP_STATE],
        ['Under Conditions → Client apps, make sure "Configure" is set to "Yes" and only "Exchange ActiveSync clients" and "Other clients" are checked. Left at "No", the condition matches every client app.'],
        ['Under Users → Include, make sure "All users" is selected. Under Target resources, make sure "All resources" is selected.'],
        ['Under Users → Exclude, make sure the exclusions IAMAI resolved are listed, including the exclusions group from the Configure Emergency Exclusions step.'],
        ['Under Grant, make sure "Block access" is selected.'],
      ],
    },
    { kind: 'list', ordered: true, start: 7, items: [['Leave **Enable policy** as it is and click Save.', REMOVED], ['Rescan in IAMAI.']] },
  ])
  assert.doesNotMatch(entra, /stable tenant ID|resolved policy|canonical|conditions object/)
  // Editorial batch C: AI Info covers every correction module the block serves, not only the conditions.
  assert.equal(packageOf(LEGACY).blocks['ai.correct'].text, "Policy {{policy.current.id}} for **Block Legacy Authentication** differs from the intended target: {{policy.current.semanticMismatches}}. The next action is to correct those settings on the same policy. The intended target blocks Exchange ActiveSync clients and Other clients for all users except the resolved exclusions, across all resources, with no session controls. Keep the policy's current state. If it is On, the changed rule can affect access after you save.\n\n" + REMOVED + '\n')
  const words = stepWords('block-legacy-auth')
  assert.equal(words.doneEnd, 'The policy is enforced and matches the baseline: it blocks legacy authentication for all users, excludes the exclusions group, and every mail-sending device is accounted for.')
  // The shared readiness sentence and the stored answers stay (BLOCKED.md).
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  assert.deepEqual(words.decision?.options, ['None', 'Temporary exception accounts: {devices}'])
})

test('s-prereq-trusted-location: the milestone says what to add, Entra is plain steps with the name bound, AI Info explains the location, and Done when names the object', () => {
  const TRUSTED = 's-prereq-trusted-location'
  const content = readFileSync('docs/design/content.json', 'utf8')
  const words = stepWords(TRUSTED)
  // Editorial batch C: only ranges the network owner approved; an observed address is not trusted, and the ranges are a human check.
  assert.equal(words.decision?.help, 'Use only public IP ranges the network owner approved. An observed address is not automatically trusted.')
  assert.deepEqual(words.doneWhen, ['A trusted IP named location exists in the tenant.', 'Its ranges are exactly the public ranges the network owner approved, and expected sign-ins match without widening them.'])
  assert.ok(content.includes('"clearNote": "No unresolved checks."'), 'the Clear readiness line is not the plain one')
  const entra = packageOf(TRUSTED).blocks['entra.create'].text
  assert.deepEqual(authoredParts(entra), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Named locations → + IP ranges location.'],
        ['Name: {{location.target.displayName}}.'],
        ['Confirm the public IP ranges with the network owner before adding them. An address seen in sign-ins, or from a "what is my IP" check, is not approval. Do not use private LAN ranges.'],
        ['Add only the approved public ranges, including VPN exits only where the network owner has approved that trust.'],
        ['Check "Mark as trusted location."'],
        ['Create.'],
        ['Rescan in IAMAI and check that an expected sign-in from the approved network matches this location. If it does not, investigate instead of adding more addresses.'],
      ],
    },
  ])
  assert.doesNotMatch(entra, /CIDR|supplied by IAMAI|downstream policies|or a name that describes your location/)
  const ai = packageOf(TRUSTED).blocks['ai.create'].text
  assert.match(ai, /^A trusted location tells Microsoft Entra that sign-ins from these public IP addresses come from a network the organization controls\. Some baseline policies apply differently inside a trusted network\.$/m)
  assert.match(ai, /^Add only public IPv4 and IPv6 ranges the network owner approves, including VPN exits only where that trust is approved\. An address seen in sign-ins is not automatically trusted: an unrelated office, a VPN or a shared provider address can appear there too\.$/m)
  assert.match(ai, /^Don't add home IP addresses\. They change, and the organization does not control them\.$/m)
  assert.match(ai, /^If nobody works from an office \(fully remote, no VPN\), you can mark this step as "Doesn't apply here\."$/m)
  assert.doesNotMatch(ai, /should cover every IP address your people normally sign in from/)
})
