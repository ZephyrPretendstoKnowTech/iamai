// Content review S2 (docs/content-review/SEGMENTS.md, prerequisite steps): one
// test per content spec (docs/content-review/specs/content-spec-*.md), each
// asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { app, stepById } from '../../content/content.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { matchedNoteOf } from './pickerRows.ts'
import { partnerLinkOf, readinessLeadOf } from './stepContract.ts'
import { authoredParts } from './authoredText.ts'

type Block = { meta: { id: string; channel: string }; text: string }
const blocksOf = (stepId: string): Record<string, Block> => (registry as unknown as { packages: Record<string, { blocks: Record<string, Block> }> }).packages[stepId].blocks
const stepOf = (id: string): Record<string, unknown> & { decision?: Record<string, unknown> | null } =>
  (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as { id: string }[]).find((s) => s.id === id) as never
const CONTENT_STEP = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
const SECTIONS = readFileSync('src/ui/surfaces/StepSections.tsx', 'utf8')
const EXCLUSIONS = 's-prereq-exclusion-group'
const PASSKEYS = 's-prereq-passkey-settings'

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

test('s-prereq-break-glass: Why names the tenant, Entra names the group and where keys go', () => {
  // Editorial batch C: the register Why, and custody the authorized staff can reach without this tenant.
  assert.equal(stepOf('s-prereq-break-glass').why, 'Emergency access accounts give your team another way into the tenant when normal administrator sign-in fails. Checking their roles, authentication and exclusions helps uncover recovery routes that exist on paper but would fail when needed.')
  const entra = blocksOf('s-prereq-break-glass')['entra.create-or-correct'].text
  assert.match(entra, /^6\. Add the account to the exclusions group you chose in the Create or Correct Exclusions Group step, and verify that it is a member\.$/m)
  assert.match(entra, /^8\. Store credentials and recovery keys [^\n]*where authorized staff can retrieve them without this tenant \(for example, a safe or an independent vault\)\. Do not store them in IAMAI\.$/m)
  assert.match(entra, /^10\. Verify after the change: run a controlled drill for each account that tests sign-in and administrative access\. A passing configuration check does not prove the recovery path works\.$/m)
  assert.doesNotMatch(entra, /IAMAI-resolved|outside IAMAI/)
})

test('s-prereq-exclusion-group: Why says what the group does, a match says what Save confirms, the note links its partner, and Entra has two paths', () => {
  const cs = stepOf(EXCLUSIONS)
  // Editorial batch C: the register Why.
  assert.equal(cs.why, 'One reviewed group keeps emergency access exclusions consistent. Checking its members can also reveal ordinary accounts that are bypassing controls intended to protect them.')
  // The pre-filled match: a ✓ badge, and one line saying what Save confirms.
  assert.equal(app.picker.matched, '✓ Matched by IAMAI')
  assert.equal(matchedNoteOf(cs.decision?.matchedNote, [{ name: 'Breakglass Exclusion', badge: app.picker.matched }], app.picker.matched), 'IAMAI found "Breakglass Exclusion" in your tenant. Confirm this is the group every policy should exclude, then Save.')
  assert.equal(matchedNoteOf(cs.decision?.matchedNote, [{ name: 'Another group' }], app.picker.matched), null, 'a group the operator chose reads as IAMAI’s match')
  assert.match(CONTENT_STEP, /\{matchedNote !== null && <p className="reason">\{matchedNote\}<\/p>\}/)
  // The header note links the step it is done together with.
  assert.deepEqual(partnerLinkOf(stepById[EXCLUSIONS] as never), { label: 'Open Create or Correct Emergency Access Accounts', href: '#/plan/s-prereq-break-glass' })
  assert.match(CONTENT_STEP, /const partnerLink = partnerLinkOf\(cs\)/)
  const entra = blocksOf(EXCLUSIONS)['entra.create-group'].text
  // Editorial batch C (channel correction): saving records the group's ID and changes no policy; each policy is corrected separately.
  assert.match(entra, /^If confirming an existing group \(like "Breakglass Exclusion"\):\nClick Save above\. IAMAI records the group's ID for the plan; saving does not change any policy\. Each policy that must exclude the group is corrected separately\.\n\nIf creating a new group:\n1\. Go to Entra admin center → Groups → All groups → New group\.$/m)
  assert.match(entra, /^4\. Name: Core - Exclusions \(or your preferred name\)\.$/m)
  assert.match(entra, /^7\. Rescan in IAMAI so it picks up the new group's ID\. Then add the group to each policy IAMAI identifies\.$/m)
  assert.match(entra, /^Important: this group should contain only emergency access accounts\. Do not add regular users or service accounts; they would be excluded from every policy that excludes this group\.$/m)
  assert.doesNotMatch(entra, /owner-confirmed|canonical|tenant truth|similarly named|uses it in every policy/)
})

test('authored Markdown: a numbered list starts where it is written, and an indented line stays inside its item', () => {
  assert.deepEqual(authoredParts('1. One\n2. Two\n   — a\n   — b\n3. Three\n\nThen:\n\n7. Seven'), [
    { kind: 'list', ordered: true, start: 1, items: [['One'], ['Two', '— a', '— b'], ['Three']] },
    { kind: 'break' },
    { kind: 'line', text: 'Then:' },
    { kind: 'break' },
    { kind: 'list', ordered: true, start: 7, items: [['Seven']] },
  ])
  // Outside a list an indented line is still its own line.
  assert.deepEqual(authoredParts('  indented\n- a\n# Head'), [{ kind: 'line', text: '  indented' }, { kind: 'list', ordered: false, start: 1, items: [['a']] }, { kind: 'heading', text: 'Head' }])
  const fn = SECTIONS.slice(SECTIONS.indexOf('export function AuthoredText'), SECTIONS.indexOf('/** The truthful no-action box'))
  assert.match(fn, /authoredParts\(text\)/, 'the viewer does not read the parts')
  assert.match(fn, /<ol key=\{k\} start=\{part\.start === 1 \? undefined : part\.start\}>/, 'a list does not keep its number')
})

test('s-prereq-passkey-settings: Why says what the step sets, the bar and tile are clear, Entra is one numbered procedure, AI Info explains it, and Done when is one line', () => {
  const cs = stepOf(PASSKEYS)
  // Editorial batch C: the register Why, and the resolved change on the next scan with the emergency sign-in as a human check.
  assert.equal(cs.why, 'Passkey settings decide which authenticators people can register and use. Checking existing keys first helps prevent a settings change from disabling a method someone still needs.')
  assert.deepEqual(cs.doneWhen, [
    'Passkey (FIDO2) matches the resolved change on the next scan: enabled for the existing target groups, with existing model restrictions and exclusions retained and Microsoft Authenticator allowed.',
    'Existing approved keys still work. Test new emergency-account keys in Create or Correct Emergency Access Accounts.',
  ])
  // Ready now with nothing unresolved: no filler under the bar (R2), and the clear tile (R5).
  const body = bodiesOf(fixture('demo')).get(PASSKEYS)
  assert.ok(body, 'the demo plan has the passkey step')
  assert.equal(readinessLeadOf(body.contract), null, `the bar says "${readinessLeadOf(body.contract)}"`)
  assert.equal(body.readiness.tiles.length, 0, 'a tile is outstanding, so the step does not read Clear')
  const b = blocksOf(PASSKEYS)
  // The three Entra blocks draw as one channel, joined as the projection joins them (project.ts).
  const entra = ['entra.configure-fido2', 'entra.configure-authenticator', 'entra.configure-tap'].map((id) => b[id].text).join('\n\n')
  const lists = authoredParts(entra).filter((p) => p.kind === 'list')
  assert.deepEqual(lists, [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Security → Authentication methods → Policies → Passkey (FIDO2).'],
        // Owner approval 2026-09-14: the change is resolved from the tenant's own configuration, and a change made since the scan is not overwritten.
        ['Compare the page with the settings IAMAI read. If anything differs, stop and rescan before saving.'],
        // Existing allowed models, groups and exclusions are kept, and the step says what removing a model does to keys already registered (Microsoft Learn, how-to-enable-passkey-fido2).
        ["Apply the resolved change. Keep every existing allowed model, target group and exclusion: removing an allowed model stops that model's existing keys from signing in."],
        ['Enforcing attestation applies to new registrations only. A passkey already registered without attestation can still sign in, but an authenticator that cannot provide attestation cannot register afterwards.'],
        ['Save, reopen the page to confirm the saved settings, then rescan.'],
      ],
    },
    { kind: 'list', ordered: true, start: 6, items: [['Open Microsoft Authenticator in the same Authentication methods list.'], ['Set Enable to Yes. Target: All users, keeping any existing exclusions.'], ['Save.']] },
    // IAMAI holds no Temporary Access Pass target (the withheld Apply mode says so), so the walkthrough keeps the tenant's own values rather than offering an arbitrary one.
    { kind: 'list', ordered: true, start: 9, items: [['Open Temporary Access Pass in the same list.'], ["Set Enable to Yes for the people who may need a pass to register their first passkey. IAMAI holds no Temporary Access Pass target, so keep the tenant's current lifetime and one-time-use settings unless your security team has approved different values."], ['Save.']] },
  ])
  assert.ok(authoredParts(entra).some((p) => p.kind === 'line' && p.text === 'Then check the supporting methods:'))
  // The resolved change is bound, never typed: the walkthrough names no model of its own, and its only values are the passkey reading, change and review.
  assert.deepEqual([...new Set([...entra.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]))].sort(), ['passkey.current.summary', 'passkey.review.detail', 'passkey.target.summary'])
  assert.doesNotMatch(entra, /profileOptInApproved|90a3ccdf|de1e552d/)
  const ai = b['ai.apply'].text
  assert.match(ai, /^Enable Microsoft Authenticator passkeys while preserving the tenant's existing approved hardware-key access and profile assignments\. Review any conflicting restrictions before saving\. A registered key is not automatically approved, and configuration checks do not replace an emergency sign-in test\.$/m)
  assert.match(ai, /Existing allowed models are retained configuration, not proof that every registered key was approved\./)
  assert.match(ai, /Do not suggest converting an unrestricted policy into an allow list, opting in to passkey profiles, or enabling synced passkeys\.$/m)
})

test('s-prereq-auth-strength: Why explains a strength, the action says what to do, Entra lists the five methods inside step 4, AI Info explains them, and Done when says methods', () => {
  const cs = stepOf('s-prereq-auth-strength')
  // Editorial batch C: the register Why; the help checks the policies already using the strength; Done when counts combinations and adds its human check.
  assert.equal(cs.why, 'An authentication strength defines the methods a policy accepts. Creating the right one keeps related policies consistent and makes any temporary sign-in options explicit.')
  // The line the action column draws under the milestone date (stepExport.ts decisionLine: the help while the decision is open).
  assert.equal(cs.decision?.help, 'Check the five allowed combinations and every policy already using this strength before changing it.')
  assert.deepEqual(cs.doneWhen, [
    'An authentication strength named "{strengthName}" exists with exactly the five combinations listed above, or an existing strength with the same combinations is selected and confirmed.',
    'Every policy already using the strength still accepts the methods its users rely on.',
  ])
  const b = blocksOf('s-prereq-auth-strength')
  assert.deepEqual(authoredParts(b['entra.create'].text), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        ['Go to Entra admin center → Authentication methods → Authentication strengths.'],
        ['Click + New authentication strength.'],
        ['Name: {{strength.target.displayName}}.'],
        ['Select exactly these five methods:', '— Windows Hello for Business', '— Passkeys (FIDO2)', '— Certificate-based authentication (multifactor)', '— Temporary Access Pass (one-time use)', '— Temporary Access Pass (multi-use)'],
        ['Do not select any other methods.'],
        ['Review and Create.'],
        ['Rescan in IAMAI.'],
      ],
    },
  ])
  const ai = b['ai.create'].text
  // Editorial batch C (factual fix): five combinations with both Temporary Access Pass options, TAP is not phishing-resistant,
  // the strength differs from Microsoft's built-in one, and policies reference it by object ID, not by name.
  assert.match(ai, /^An authentication strength is a named set of sign-in methods that a Conditional Access policy can require\. The grant "Require multifactor authentication" accepts any second factor the tenant allows, including phone call and text message\. This custom strength accepts only five combinations:\n— Windows Hello for Business: a biometric or PIN bound to the device\n— Passkeys \(FIDO2\): a security key or a passkey in Microsoft Authenticator\n— Certificate-based authentication \(multifactor\): a smart card or certificate\n— Temporary Access Pass \(one-time use\)\n— Temporary Access Pass \(multi-use\)$/m)
  assert.match(ai, /^The first three are phishing-resistant\. A Temporary Access Pass is a time-limited passcode an administrator issues, for example so a person with no usable method can sign in and register one\. Because both Temporary Access Pass options are accepted, this strength is not the same as Microsoft's built-in Phishing-resistant MFA strength\.$/m)
  assert.match(ai, /^Phone call, text message and Authenticator push notifications are not accepted\.$/m)
  assert.match(ai, /^Several baseline policies use this strength\. Create it once in this tenant; those policies reference it by its object ID\.$/m)
  assert.doesNotMatch(ai, /pinned five|source-tenant|\{\{|all phishing-resistant or temporary|by name/)
})
