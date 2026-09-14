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
  assert.match(String(gate.value), /^\d{1,3}% MFA-ready$/)
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
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists. The correction adds the exclusions group and aligns the conditions with the baseline.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    { kind: 'list', ordered: true, start: 1, items: [['Go to Entra admin center → Conditional Access → Policies.'], ['Open the policy named {{policy.current.displayName}} (or find it by ID in Plan settings).']] },
    {
      kind: 'list', ordered: true, start: 3, items: [
        ['Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Target resources: All resources. Under Exclude, Microsoft Intune Enrollment should be excluded (this prevents an enrollment loop).'],
        ['Conditions: no sign-in risk, no device platform, no location, no client app filter — leave all conditions blank except client apps (All client apps).'],
      ],
    },
    // A conditions correction writes no grant (S3, C02): the grant is its own module, drawn only when the grant differs.
    { kind: 'list', ordered: true, start: 6, items: [['Save. Do not change the policy state (leave it On).'], ['Rescan in IAMAI to confirm the correction.']] },
  ])
  assert.doesNotMatch(entra, /mismatch modules|IAMAI-resolved|canonical/)
  const ai = packageOf(MFA_ALL).blocks['ai.correct'].text
  assert.match(ai, /^This is the foundational MFA policy: every user must present a second factor \(MFA\) at sign-in\. It's the single most impactful control in the baseline\.$/m)
  assert.match(ai, /^The policy is already enforced on your tenant\. The correction aligns its configuration with the baseline:\n— The exclusions group is added so emergency access accounts are exempt\.\n— Microsoft Intune Enrollment is excluded from target resources to prevent devices from failing enrollment because MFA fires during the enrollment flow\.\n— Conditions are cleaned to match the baseline's intent: no location, platform, or risk filters — MFA applies everywhere, unconditionally\.$/m)
  assert.match(ai, /^After this step, the MFA Registration Campaign step ensures every person has registered a phishing-resistant method\. Until that's done, the 33% threshold tile tracks progress\.$/m)
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
  assert.match(entra, /^This step manages two Conditional Access policies that work together:$/m)
  assert.match(entra, /^\*\*Policy 1: \{\{policies\.guests\.strong\.current\.displayName\}\} \(strong tier\)\*\*\nFor trusted partners — requires the authentication strength "Modern MFA \+ TAP\."$/m)
  assert.match(entra, /^\*\*Policy 2: \{\{policies\.guests\.mixed\.current\.displayName\}\} \(mixed tier\)\*\*\nFor all other guests — requires standard MFA \(any second factor\)\.$/m)
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open the strong-tier policy (find it by ID in Plan settings).'],
        ['Users → Exclude → Groups: add the exclusions group.'],
        ['Verify: the Grant requires the authentication strength "Modern MFA + TAP."'],
        ['Save.'],
        ['Open the mixed-tier policy (find it by ID in Plan settings).'],
        ['Users → Exclude → Groups: add the exclusions group.'],
        ['Verify: the Grant requires "Require multifactor authentication."'],
        ['Save.'],
        ['Rescan in IAMAI.'],
      ],
    },
  ])
  assert.match(entra, /^Do not merge these two policies into one\. They serve different guest populations with different MFA requirements\.$/m)
  assert.doesNotMatch(entra, /tenant-resolved users objects|two-member split/)
  // AI Info is unchanged (BLOCKED.md), and still the channel that binds the pair's mismatches.
  assert.match(packageOf(GUESTS).blocks['ai.correct'].text, /\{\{policies\.guests\.semanticMismatches\}\}/)
})

test('s-goal-admins-phishing-resistant: Why names the attack, the threshold says what it measures, the unknown handoff asks which admins, Entra is one numbered procedure, and AI Info explains the strength', () => {
  const ADMINS = 's-goal-admins-phishing-resistant'
  const steps = JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as { id: string; why: string }[]
  assert.equal(steps.find((s) => s.id === 'admins-phishing-resistant')?.why, "Phone codes and push approvals can be phished — an attacker builds a convincing sign-in page and the admin hands over the code. A passkey can't be used on the wrong site, so phishing doesn't work.")
  // The threshold tile's collapsed value on the demo admin step.
  const demo = bodiesOf(fixture('demo')).get(ADMINS)
  assert.ok(demo, 'the demo plan has the admin step')
  const gate = tilesOf(demo).find((t) => t.key === 'gate')
  assert.ok(gate, 'the demo admin step has no threshold tile')
  assert.match(String(gate.value), /^\d{1,3}% of admins phishing-resistant$/)
  // Where the scan could not work out which admins are held.
  const P = app.plan as unknown as Record<string, Record<string, string>>
  assert.equal(P.mfaReadinessHoldUnknown.admin, "Check which admins don't have a phishing-resistant method yet:")
  assert.equal(P.mfaReadinessLinkUnknown.admin, 'MFA Readiness →')
  assert.equal(P.mfaReadinessAfterUnknown.admin, undefined, 'nothing follows the admin link')
  // Entra: the three blocks a conditions correction draws.
  assert.ok(packageOf(ADMINS).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  const entra = channel(ADMINS, ['entra.correct-open', 'entra.correct-conditions', 'entra.correct-verify'])
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists. The correction adds the exclusions group and aligns the admin roles with the baseline.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    { kind: 'list', ordered: true, start: 1, items: [['Go to Entra admin center → Conditional Access → Policies.'], ['Open the policy named {{policy.current.displayName}} (or find it by ID in Plan settings).']] },
    {
      kind: 'list', ordered: true, start: 3, items: [
        ['Users → Include: select the directory roles the baseline targets (Global Administrator, Security Administrator, etc. — the full list is in the JSON channel).'],
        ['Users → Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Target resources: All resources.'],
      ],
    },
    // A conditions correction writes no grant (S3, C02): it used to set the TAP-inclusive custom strength while the JSON beside it PATCHed conditions only.
    { kind: 'list', ordered: true, start: 6, items: [['Save. Do not change the policy state.'], ['Rescan in IAMAI.']] },
  ])
  assert.doesNotMatch(entra, /mismatch modules|IAMAI-resolved|canonical/)
  const ai = packageOf(ADMINS).blocks['ai.correct'].text
  assert.match(ai, /^This policy requires admins to use a phishing-resistant method — passkey, hardware security key, or Windows Hello — every time they sign in\.$/m)
  assert.match(ai, /^Unlike the "MFA for Everyone" policy which accepts any MFA method \(including phone call\), this policy uses the authentication strength "Modern MFA \+ TAP" which only accepts phishing-resistant methods and Temporary Access Pass\.$/m)
  assert.match(ai, /^The 0% threshold means none of your admins currently have a qualifying method registered\. The MFA Registration Campaign step handles getting them registered\. This policy enforces the requirement; the campaign helps people meet it\.$/m)
  assert.match(ai, /^The correction adds the exclusions group and ensures the admin role list matches the baseline's set of built-in privileged roles\.$/m)
})

test('s-goal-block-auth-transfer: the bar names the Exclusions Group step, Entra is one numbered procedure naming the policy, and AI Info explains the attack', () => {
  const AUTH = 's-goal-block-auth-transfer'
  assert.equal(CONTRACT.fixConfirmExclusions, CONFIRM)
  assert.ok(packageOf(AUTH).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  // The two blocks a conditions correction draws.
  const entra = channel(AUTH, ['entra.correct-conditions', 'entra.correct-verify'])
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists. The correction adds the exclusions group.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open the policy named {{policy.current.displayName}} (or find it by ID in Plan settings).'],
        ['Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Verify: Target resources = All resources, Conditions = Client apps: Authentication flows: Authentication transfer, Grant = Block access.'],
      ],
    },
    { kind: 'list', ordered: true, start: 5, items: [['Save. Do not change the policy state (leave it On).'], ['Rescan in IAMAI to confirm the correction.']] },
  ])
  assert.doesNotMatch(entra, /IAMAI-resolved|canonical|stable tenant ID/)
  const ai = packageOf(AUTH).blocks['ai.correct'].text
  assert.match(ai, /^This policy blocks authentication transfer — the flow where a QR code or link moves an authenticated session from one device to another without re-authenticating\.$/m)
  assert.match(ai, /^Attackers use this in phishing: they get a victim to scan a code that transfers the victim's session to the attacker's device\. Blocking the flow stops this attack entirely\.$/m)
  assert.match(ai, /^The correction on this step adds the exclusions group so emergency access accounts can still use authentication transfer if needed in an emergency\.$/m)
})

test('s-goal-block-device-code: the device code tile says what to confirm, the dropdown keeps its stored answers, and Entra is one numbered procedure naming the policy', () => {
  const DEVICE = 's-goal-block-device-code'
  const body = bodiesOf(fixture('mid')).get(DEVICE)
  assert.ok(body, 'the mid plan has the device code step')
  const tile = tilesOf(body).find((t) => t.key === 'unsaved:Device code sign-in')
  assert.ok(tile, 'the unsaved device code decision has no tile')
  assert.equal(tile.value, 'Confirm no legitimate use')
  // The note stays the step's own question: the spec's exceptions note contradicts the step (BLOCKED.md).
  assert.equal(tile.note, 'Does anyone use device code sign-in for CLI tools, IoT devices, or display-limited devices?')
  // The options are the stored answers, so they stay None and Yes (BLOCKED.md).
  const steps = JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as { id: string; decision?: { options?: string[] } }[]
  assert.deepEqual(steps.find((s) => s.id === 'block-device-code')?.decision?.options, ['None', 'Yes'])
  assert.ok(packageOf(DEVICE).meta.optionalBindings?.includes('policy.current.displayName'), 'the policy name is not a declared binding')
  // The two blocks a conditions correction draws.
  const entra = channel(DEVICE, ['entra.correct-conditions', 'entra.correct-verify'])
  assert.deepEqual(authoredParts(entra)[0], { kind: 'line', text: 'This policy already exists. The correction adds the exclusions group.' })
  assert.deepEqual(authoredParts(entra).filter((p) => p.kind === 'list'), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Conditional Access → Policies.'],
        ['Open the policy named {{policy.current.displayName}} (or search by its ID in Plan settings).'],
        ['Users → Exclude → Groups → add the exclusions group you confirmed in the Exclusions Group step.'],
        ['Verify all other settings match the baseline: Target resources = All resources, Conditions = Client apps: Authentication flows: Device code, Grant = Block access.'],
      ],
    },
    { kind: 'list', ordered: true, start: 5, items: [['Save. Do not change the policy state (leave it On).'], ['Rescan in IAMAI to confirm the correction.']] },
  ])
  assert.doesNotMatch(entra, /IAMAI-resolved|canonical|stable tenant ID/)
  // PowerShell, JSON and AI Info are unchanged (BLOCKED.md).
  assert.match(packageOf(DEVICE).blocks['powershell.run'].text, /^param\(/)
  assert.doesNotMatch(packageOf(DEVICE).blocks['json.correct-conditions'].text, /\/\//)
  assert.match(packageOf(DEVICE).blocks['ai.correct'].text, /\{\{policy\.current\.semanticMismatches\}\}/)
})
