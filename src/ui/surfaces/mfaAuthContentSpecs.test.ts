// Content review S3 (docs/content-review/SEGMENTS.md, MFA and authentication
// policy steps): one test per content spec (docs/content-review/specs/content-spec-*.md),
// each asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { app } from '../../content/content.ts'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
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
const HANDOFF = readFileSync('src/ui/surfaces/MfaHandoff.tsx', 'utf8')
const PACKAGE_SRC = readFileSync('src/ui/surfaces/stepPackage.ts', 'utf8')
const GUESTS = 's-goal-guests-mfa'
const CONFIRM = 'Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.'
const MFA_ALL = 's-goal-mfa-all-users'
// Cycle 6 (review 5 queue 1): a correction's Save item also carries the line naming the
// exclusions the update removes, omitted when it removes none ([omit this line when unavailable]).
const REMOVED = "This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]"
const REMOVED_MEMBER = (role: string): string => `This change removes {{policies.guests.${role}.current.removedExclusions}} from the exclusions of {{policies.guests.${role}.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]`
// Editorial batch C (SHARED-COPY-AND-RULES.md, correction preserving state): the one sentence a correction says about a policy that is On.
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

const tilesOf = (b: StepBody) => [...b.readiness.tiles, ...b.readiness.satisfied]

test('s-goal-mfa-all-users: the bar names the Exclusions Group step, the threshold says what it measures, the unknown handoff reads plainly, Entra is one numbered procedure, and AI Info explains the policy', () => {
  // The readiness bar's sub-line while the scan's group waits on a Save.
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  const waiting = bodiesOf(noExclusionsAnswer(fixture('mid')))
  assert.ok([...waiting.values()].some((b) => b.contract.whatToDo.text === CONFIRM), 'no step on the mid fixture waits on the group with the new words')
  // The threshold tile's collapsed value: the percentage and what it measures.
  const demo = bodiesOf(fixture('demo')).get(MFA_ALL)
  assert.ok(demo, 'the demo plan has the MFA step')
  const gate = tilesOf(demo).find((t) => t.key === 'gate')
  assert.ok(gate, 'the demo MFA step has no threshold tile')
  assert.equal(gate.value, 'not measured')
  assert.ok(gate.note, 'unmeasured readiness explains the missing evidence')
  // Where the scan could not work out who is held: the line, the link, and what follows it.
  const P = app.plan as unknown as Record<string, Record<string, string>>
  // The spec's "Some users may not…" is not applied: the Plan's words say people (footer.test.ts; BLOCKED.md).
  assert.equal(P.mfaReadinessHoldUnknown.mfa, "This scan could not work out who cannot meet this step's sign-in requirement yet.")
  assert.equal(P.mfaReadinessLinkUnknown.mfa, 'Check MFA Readiness →')
  assert.equal(P.mfaReadinessAfterUnknown.mfa, 'for per-person detail.')
  assert.match(HANDOFF, /UNKNOWN\.hold\[hold\.family\]/, 'the unknown line does not follow the hold family')
  assert.match(HANDOFF, /UNKNOWN\.link\[hold\.family\]/, 'the unknown link does not follow the hold family')
  assert.match(HANDOFF, /n === null && UNKNOWN\.after\[hold\.family\]/, 'the words after the link are not drawn')
  assert.equal(HANDOFF.match(/href=\{readinessStepHref\(step\.id\)\}/g)?.length, 1, 'the words are not one working link to the step’s MFA Readiness')
  // Entra: the three blocks a conditions correction draws.
  assert.ok(packageOf(MFA_ALL).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  const entra = channel(MFA_ALL, ['entra.correct-open', 'entra.correct-conditions', 'entra.correct-verify'])
  // Editorial batch C: the open block precedes every module, so it says only that the correction changes what IAMAI found different.
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: REMOVED })
  assert.deepEqual(authoredParts(entra).filter(p => p.kind === "line")[1], { kind: 'line', text: 'This policy already exists. The correction changes only the settings IAMAI found different from the intended target, on the same policy.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    { kind: 'list', ordered: true, start: 1, items: [['Go to Entra admin center → Conditional Access → Policies.'], ['Open the policy named {{policy.current.displayName}} (ID: {{policy.current.id}}).']] },
    {
      kind: 'list', ordered: true, start: 3, items: [
        ['Users → Include: All users. Exclude: the exclusions IAMAI resolved, including the exclusions group you confirmed in the Exclusions Group step.'],
        ['Target resources → Include: All resources. Exclude: Microsoft Intune Enrollment. A separate step sets the requirement for Intune enrollment.'],
        ['Conditions: leave user risk, sign-in risk, device platforms, locations and authentication flows unconfigured. Client apps remains All.'],
      ],
    },
    // A conditions correction writes no grant (S3, C02): the grant is its own module, drawn only when the grant differs.
    // Cycle 2 (C02): the correction keeps the state it finds and says what saving does to a policy that is On.
    // Editorial batch C: the human check after the rescan is labelled as one.
    { kind: 'list', ordered: true, start: 6, items: [[`Save. ${KEEP_STATE}`], ['Rescan in IAMAI to confirm the correction. Verify after the change: an ordinary user in scope can complete MFA, and emergency access still works.']] },
  ])
  assert.doesNotMatch(entra, /mismatch modules|IAMAI-resolved|canonical/)
  const ai = packageOf(MFA_ALL).blocks['ai.correct'].text
  // Editorial batch C (channel correction): the built-in grant, the Intune Enrollment exclusion, no promise of a prompt at every sign-in.
  assert.match(ai, /^This policy requires multifactor authentication for the users it covers\. It uses the built-in Require multifactor authentication grant, not an authentication strength\./m)
  assert.match(ai, /^— Target resources: All resources, excluding Microsoft Intune Enrollment\. A separate step sets the requirement for Intune enrollment\.$/m)
  assert.match(ai, /^An existing MFA claim may satisfy the policy, so people are not necessarily prompted at every sign-in\. Whether each person has a usable method is shown on MFA Readiness; the Prepare Your Team for MFA step helps people register one\.$/m)
  assert.ok(ai.includes(KEEP_STATE))
  assert.doesNotMatch(ai, /single most impactful|unconditionally|already enforced|\d+% threshold/)
})

test('s-goal-guests-mfa: the partner tile says what to confirm, and Entra names both tiers with numbered corrections for each', () => {
  const guests = bodiesOf(fixture('mid')).get(GUESTS)
  assert.ok(guests, 'the mid plan has the guests step')
  const tile = tilesOf(guests).find((t) => t.key === 'unsaved:Partner or MSP access')
  assert.ok(tile, 'the unsaved partner question has no tile')
  assert.equal(tile.value, 'Confirm whether partners access your tenant')
  // The label is the stored answer's key, so it stays (BLOCKED.md).
  assert.equal(tile.label, 'Partner or MSP access')
  // The members' own names bind from the scan row the pair already reads.
  assert.match(PACKAGE_SRC, /out\[`\$\{prefix\}\.current\.displayName`\] = row\.displayName/)
  for (const role of ['strong', 'mixed']) assert.ok(packageOf(GUESTS).meta.optionalBindings?.includes(`policies.guests.${role}.current.displayName`), `${role}: the member name is not a declared binding`)
  const entra = packageOf(GUESTS).blocks['entra.correct-pair'].text
  // Editorial batch C (channel correction): two policies over different external-user types, not trusted partners
  // versus everyone else, and each member corrected to its whole resolved target, not only its exclusions.
  assert.match(entra, /^This step manages two separate Conditional Access policies\. The policies cover different external-user types\. Apply each policy's resolved users and exclusions; the split is not simply trusted partners versus everyone else\.$/m)
  assert.match(entra, /^\*\*Policy 1: \{\{policies\.guests\.strong\.current\.displayName\}\}\*\* requires the authentication strength in the resolved target\.$/m)
  assert.match(entra, /^\*\*Policy 2: \{\{policies\.guests\.mixed\.current\.displayName\}\}\*\* requires built-in multifactor authentication\.$/m)
  const USERS = "Users → Include → Guest or external users: select exactly the external-user types and external Microsoft Entra organizations in this policy's resolved target. Users → Exclude: match the resolved target's excluded guest types, users, groups and roles, including the exclusions group. Remove any exclusion the target does not list."
  // Review 3 queue 5: each save says what it does to a guest policy that is On.
  const SAVE = 'Save. Leave **Enable policy** as it is: if the policy is On, the changed rule can affect access after you save.'
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open {{policies.guests.strong.current.displayName}} (use the policy name and ID shown on this step).'],
        ['Name: set it to **{{policies.guests.strong.target.displayName}}**.'],
        [USERS],
        ['Target resources: All resources. Client apps: All. Remove any other condition.'],
        ['Grant: **Grant access → Require authentication strength**, and select the authentication strength in the resolved target. Remove any other grant control.'],
        ['Session: remove any session control the resolved target does not include.'],
        [SAVE, REMOVED_MEMBER('strong')],
        ['Open {{policies.guests.mixed.current.displayName}} (use the policy name and ID shown on this step).'],
        ['Name: set it to **{{policies.guests.mixed.target.displayName}}**.'],
        [USERS],
        ['Target resources: All resources. Client apps: All. Remove any other condition.'],
        ['Grant: **Grant access → Require multifactor authentication**. Remove any authentication strength or other grant control.'],
        ['Session: remove any session control the resolved target does not include.'],
        [SAVE, REMOVED_MEMBER('mixed')],
        ['Rescan in IAMAI.'],
      ],
    },
  ])
  assert.match(entra, /^Do not merge these two policies into one\. Each covers different external-user types with a different MFA requirement\.$/m)
  assert.doesNotMatch(entra, /tenant-resolved users objects|two-member split|Modern MFA \+ TAP|For trusted partners/)
  // A partly deployed pair keeps its Entra correction: the walkthrough needs neither member's id (guestsPairInvocation.test.ts).
  assert.doesNotMatch(entra, /\{\{policies\.guests\.(strong|mixed)\.current\.id\}\}/)
  // AI Info is still the channel that binds the pair's mismatches.
  assert.match(packageOf(GUESTS).blocks['ai.correct'].text, /\{\{policies\.guests\.semanticMismatches\}\}/)
})

test('s-goal-admins-phishing-resistant: Why names the attack, the threshold says what it measures, the unknown handoff asks which admins, Entra is one numbered procedure, and AI Info explains the strength', () => {
  const ADMINS = 's-goal-admins-phishing-resistant'
  const steps = JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as { id: string; why: string }[]
  // Editorial batch C: the register Why.
  assert.equal(steps.find((s) => s.id === 'admins-phishing-resistant')?.why, 'Administrator access deserves stronger sign-in protection. Checking accepted methods and recent use helps identify admins who would struggle to meet the policy when it is enabled.')
  // The threshold tile's collapsed value on the demo admin step.
  const demo = bodiesOf(fixture('demo')).get(ADMINS)
  assert.ok(demo, 'the demo plan has the admin step')
  const gate = tilesOf(demo).find((t) => t.key === 'gate')
  assert.ok(gate, 'the demo admin step has no threshold tile')
  assert.equal(gate.value, '67% of admins phishing-resistant')
  // Where the scan could not work out which admins are held.
  const P = app.plan as unknown as Record<string, Record<string, string>>
  assert.equal(P.mfaReadinessHoldUnknown.admin, "Check which admins don't have a phishing-resistant method yet:")
  assert.equal(P.mfaReadinessLinkUnknown.admin, 'MFA Readiness →')
  assert.equal(P.mfaReadinessAfterUnknown.admin, undefined, 'nothing follows the admin link')
  // Entra: the three blocks a conditions correction draws.
  assert.ok(packageOf(ADMINS).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  const entra = channel(ADMINS, ['entra.correct-open', 'entra.correct-conditions', 'entra.correct-verify'])
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: REMOVED })
  assert.deepEqual(authoredParts(entra).filter(p => p.kind === "line")[1], { kind: 'line', text: 'This policy already exists. Correct only the settings below, which IAMAI found different from the baseline.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    { kind: 'list', ordered: true, start: 1, items: [['Go to Entra admin center → Conditional Access → Policies.'], ['Open the policy named {{policy.current.displayName}} (ID: {{policy.current.id}}).']] },
    {
      kind: 'list', ordered: true, start: 3, items: [
        ['Users → Include → Directory roles: select exactly the built-in roles in the resolved target (the includeRoles list in the JSON output) and clear any role it does not list. Custom roles and administrative-unit-scoped role assignments are not covered by this selection.'],
        ['Users → Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step. Remove any exclusion the resolved target does not list.'],
        ['Target resources: All resources. Client apps: All. Remove any other condition.'],
      ],
    },
    // A conditions correction writes no grant (S3, C02): it used to set the TAP-inclusive custom strength while the JSON beside it PATCHed conditions only.
    // Cycle 2 (C02): the correction keeps the state it finds and says what saving does to a policy that is On.
    { kind: 'list', ordered: true, start: 6, items: [[`Save. ${KEEP_STATE}`], ['Rescan in IAMAI.']] },
  ])
  assert.doesNotMatch(entra, /mismatch modules|IAMAI-resolved|canonical/)
  const ai = packageOf(ADMINS).blocks['ai.correct'].text
  // Editorial batch C: the accepted set is named, Temporary Access Pass included, and no prompt at every sign-in is promised.
  assert.match(ai, /^This policy requires administrators in the baseline's built-in directory roles to satisfy the tenant's custom authentication strength\. That strength accepts Windows Hello for Business, passkeys and FIDO2 security keys, certificate-based multifactor authentication and Temporary Access Pass\./m)
  assert.match(ai, /the accepted set is not exclusively phishing-resistant because it includes Temporary Access Pass\. Microsoft's built-in Phishing-resistant MFA strength does not accept a Temporary Access Pass\.$/m)
  // No fixed claim about the tenant's registrations: nothing binds one (C07).
  assert.doesNotMatch(ai, /0% threshold|none of your admins|every time they sign in/)
  assert.match(ai, /Whether admins have an accepted method registered is shown on MFA Readiness, and the Prepare Your Team for MFA step helps them register one\./)
  assert.match(ai, /^The correction changes only the settings IAMAI found different from the baseline: the role list and exclusions, grant, session controls or name\.$/m)
  assert.ok(ai.includes(KEEP_STATE))
})

test('s-goal-block-auth-transfer: the bar names the Exclusions Group step, Entra is one numbered procedure naming the policy, and AI Info explains the attack', () => {
  const AUTH = 's-goal-block-auth-transfer'
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  assert.ok(packageOf(AUTH).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  // The two blocks a conditions correction draws.
  const entra = channel(AUTH, ['entra.correct-conditions', 'entra.correct-verify'])
  // Editorial batch C (channel correction): the correction sets the whole intended target, not only the exclusions group.
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists. The correction sets its users, exclusions, target resources and conditions to the intended target on the same policy.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open the policy named {{policy.current.displayName}} (ID: {{policy.current.id}}).'],
        ['Users → Include: All users. Exclude: the exclusions IAMAI resolved, including the exclusions group you confirmed in the Exclusions Group step.'],
        ['Target resources: All resources. Conditions → Authentication flows → Configure: Yes, then Authentication transfer. Client apps remains All. Grant → Block access.'],
      ],
    },
    // Cycle 2 (C02): "leave it On" was wrong for a Report-only policy; the correction keeps whatever state the policy has.
    // Cycle 3 (review 2): and says what saving does to a policy that is On.
    { kind: 'list', ordered: true, start: 5, items: [[`Save. ${KEEP_STATE}`, REMOVED], ['Rescan in IAMAI to confirm the correction. Verify after the change: affected users can sign in directly on the destination device where the app supports it.']] },
  ])
  assert.doesNotMatch(entra, /IAMAI-resolved|canonical|stable tenant ID/)
  // Authentication flows is its own condition, not a Client apps setting.
  assert.doesNotMatch(entra, /Client apps: Authentication flows/)
  const ai = packageOf(AUTH).blocks['ai.correct'].text
  assert.match(ai, /^This policy blocks authentication transfer: the flow that moves a signed-in state from one device to another, for example by scanning a QR code shown in a desktop app, without a new sign-in on the second device\. It blocks this flow only; it does not block every QR-code sign-in or other forms of token theft\.$/m)
  assert.match(ai, /^Accounts excluded from this policy are not blocked by it\. That does not guarantee them access through other policies\.$/m)
  assert.doesNotMatch(ai, /stops this attack entirely|can still use authentication transfer/)
})

test('s-goal-block-device-code: the device code tile says what to confirm, the dropdown keeps its stored answers, and Entra is one numbered procedure naming the policy', () => {
  const DEVICE = 's-goal-block-device-code'
  const body = bodiesOf(fixture('mid')).get(DEVICE)
  assert.ok(body, 'the mid plan has the device code step')
  const tile = tilesOf(body).find((t) => t.key === 'unsaved:Device code sign-in')
  assert.ok(tile, 'the unsaved device code decision has no tile')
  assert.equal(tile.value, 'Confirm no legitimate use')
  // The note stays the step's own question: the spec's exceptions note contradicts the step (BLOCKED.md).
  assert.equal(tile.note, 'The sign-in records cover observed use; they can miss infrequent CLI, shared-device and enrollment workflows.')
  // The options are the stored answers, so they stay None and Yes (BLOCKED.md).
  const steps = JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as { id: string; decision?: { options?: string[] } }[]
  assert.deepEqual(steps.find((s) => s.id === 'block-device-code')?.decision?.options, ['None', 'Yes'])
  assert.ok(packageOf(DEVICE).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  // The two blocks a conditions correction draws.
  const entra = channel(DEVICE, ['entra.correct-conditions', 'entra.correct-verify'])
  // Editorial batch C (channel correction): the correction sets the intended conditions, and Authentication flows is not inside Client apps.
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists. The correction sets its conditions to the intended target, including the exclusions group.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open the policy named {{policy.current.displayName}} (ID: {{policy.current.id}}).'],
        ['Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Check the other settings and set any that differ from the baseline: Target resources = All resources. Conditions → Authentication flows → Configure: Yes, then Device code flow. Client apps remains All. Grant → Block access.'],
      ],
    },
    // Cycle 2 (C02): "leave it On" was wrong for a Report-only policy; the correction keeps whatever state the policy has.
    // Cycle 3 (review 2): and says what saving does to a policy that is On.
    { kind: 'list', ordered: true, start: 5, items: [['Save. Leave **Enable policy** as it is. If the policy is On, the changed rule can affect access after you save.', REMOVED], ['Rescan in IAMAI to confirm the correction.']] },
  ])
  assert.doesNotMatch(entra, /IAMAI-resolved|canonical|stable tenant ID/)
  assert.doesNotMatch(entra, /Client apps: Authentication flows/)
  // PowerShell and JSON are unchanged (BLOCKED.md), apart from the cycle 6 line naming
  // removed exclusions, which heads the script and is omitted when nothing is removed.
  assert.match(packageOf(DEVICE).blocks['powershell.run'].text, /^# This change removes \{\{policy\.current\.removedExclusions\}\}[^\n]*\[omit this line when unavailable\]\nparam\(/)
  assert.doesNotMatch(packageOf(DEVICE).blocks['json.correct-conditions'].text, /\/\//)
  assert.match(packageOf(DEVICE).blocks['ai.correct'].text, /\{\{policy\.current\.semanticMismatches\}\}/)
})
