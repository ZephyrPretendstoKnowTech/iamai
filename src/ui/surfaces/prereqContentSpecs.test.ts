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
  assert.equal(stepOf('s-prereq-break-glass').why, 'Emergency access accounts are how you keep access to your tenant if a Conditional Access change locks everyone out.')
  const entra = blocksOf('s-prereq-break-glass')['entra.create-or-correct'].text
  assert.match(entra, /^6\. Add the account to the exclusions group you chose in the Create or Correct Exclusions Group step\.$/m)
  assert.match(entra, /^8\. Store credentials and recovery keys in your organization's secure custody process \(e\.g\. a safe or vault\)\. Do not store them in IAMAI\.$/m)
  assert.doesNotMatch(entra, /IAMAI-resolved|outside IAMAI/)
})

test('s-prereq-exclusion-group: Why says what the group does, a match says what Save confirms, the note links its partner, and Entra has two paths', () => {
  const cs = stepOf(EXCLUSIONS)
  assert.equal(cs.why, 'One group, excluded from every policy in the plan, is how you keep access if a policy goes wrong. Every Conditional Access policy in the baseline excludes this group, so its members can always sign in.')
  // The pre-filled match: a ✓ badge, and one line saying what Save confirms.
  assert.equal(app.picker.matched, '✓ Matched by IAMAI')
  assert.equal(matchedNoteOf(cs.decision?.matchedNote, [{ name: 'Breakglass Exclusion', badge: app.picker.matched }], app.picker.matched), 'IAMAI found "Breakglass Exclusion" in your tenant. Confirm this is the group every policy should exclude, then Save.')
  assert.equal(matchedNoteOf(cs.decision?.matchedNote, [{ name: 'Another group' }], app.picker.matched), null, 'a group the operator chose reads as IAMAI’s match')
  assert.match(CONTENT_STEP, /\{matchedNote !== null && <p className="reason">\{matchedNote\}<\/p>\}/)
  // The header note links the step it is done together with.
  assert.deepEqual(partnerLinkOf(stepById[EXCLUSIONS] as never), { label: 'Open Create or Correct Emergency Access Accounts', href: '#/plan/s-prereq-break-glass' })
  assert.match(CONTENT_STEP, /const partnerLink = partnerLinkOf\(cs\)/)
  const entra = blocksOf(EXCLUSIONS)['entra.create-group'].text
  assert.match(entra, /^If confirming an existing group \(like "Breakglass Exclusion"\):\nClick Save above — IAMAI records the group's ID and uses it in every policy\.\n\nIf creating a new group:\n1\. Go to Entra admin center → Groups → All groups → New group\.$/m)
  assert.match(entra, /^4\. Name: Core - Exclusions \(or your preferred name\)\.$/m)
  assert.match(entra, /^7\. Rescan in IAMAI so it picks up the new group's ID\.$/m)
  assert.match(entra, /^Important: this group should contain only emergency access accounts\. Do not add regular users or service accounts — they would bypass every policy in the plan\.$/m)
  assert.doesNotMatch(entra, /owner-confirmed|canonical|tenant truth|similarly named/)
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
  assert.equal(cs.why, "This step configures which passkey providers your tenant accepts. If these settings are wrong, people register passkeys that won't work with the baseline's MFA policies, and they'll have to re-register.")
  assert.deepEqual(cs.doneWhen, ['Passkey (FIDO2), Microsoft Authenticator, and Temporary Access Pass are all enabled for all users. The passkey allow-list includes the Authenticator iOS and Android AAGUIDs, and attestation is enforced.'])
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
        ['Set Enable to Yes. Target: All users.'],
        // Cycle 2 (C05): the restriction is kept, and the step says what it does to keys already registered (Microsoft Learn, how-to-enable-passkey-fido2).
        ['Under Allowed passkeys, enable Enforce key restrictions. Set Restriction type to Allow. Once saved, a key already registered with any other AAGUID can no longer be used to sign in.'],
        ['Add the Microsoft Authenticator AAGUIDs:', '— iOS: 90a3ccdf-635c-4729-a248-9b709135078f', '— Android: de1e552d-db1d-4423-a619-566b625cdc84'],
        ['Enable Enforce attestation. It applies to new registrations; a passkey already registered without attestation can still sign in.'],
        ['Save.'],
      ],
    },
    { kind: 'list', ordered: true, start: 7, items: [['Open Microsoft Authenticator in the same Authentication methods list.'], ['Set Enable to Yes. Target: All users.'], ['Save.']] },
    { kind: 'list', ordered: true, start: 10, items: [['Open Temporary Access Pass in the same list.'], ['Set Enable to Yes. Target: All users. Set a lifetime and one-time-use policy that fits your organization.'], ['Save.']] },
  ])
  assert.ok(authoredParts(entra).some((p) => p.kind === 'line' && p.text === 'Then configure the supporting methods:'))
  assert.doesNotMatch(entra, /profileOptInApproved|resolved target|\{\{/)
  const ai = b['ai.apply'].text
  assert.match(ai, /^Passkey \(FIDO2\) is the phishing-resistant sign-in method this baseline targets\. These settings control which passkey providers are accepted tenant-wide\.$/m)
  assert.match(ai, /^The two AAGUIDs above are the Microsoft Authenticator app on iOS and Android\. Enforcing attestation and restricting to these AAGUIDs means only Authenticator passkeys are accepted — not third-party security keys or browser-based passkeys\.$/m)
  assert.match(ai, /^Temporary Access Pass is enabled so admins can issue a one-time code to users who need to register their first passkey but have no existing method to sign in with\.$/m)
  assert.match(ai, /^After saving these settings, the MFA Registration Campaign step guides each person through registering their passkey\.$/m)
})

test('s-prereq-auth-strength: Why explains a strength, the action says what to do, Entra lists the five methods inside step 4, AI Info explains them, and Done when says methods', () => {
  const cs = stepOf('s-prereq-auth-strength')
  assert.equal(cs.why, 'Several policies in the baseline require a specific set of authentication methods (called an "authentication strength"). This step creates that strength so those policies can reference it.')
  // The line the action column draws under the milestone date (stepExport.ts decisionLine: the help while the decision is open).
  assert.equal(cs.decision?.help, 'Create or select the authentication strength.')
  assert.deepEqual(cs.doneWhen, ['An authentication strength named "{strengthName}" exists with exactly the five methods listed above, or an existing strength with the same methods is selected and confirmed.'])
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
  assert.match(ai, /^An authentication strength is a named set of methods that a Conditional Access policy can require\. Instead of just "require MFA" \(which accepts any second factor including phone call\), this strength says "require one of these five specific methods\."$/m)
  assert.match(ai, /^The five methods are all phishing-resistant or temporary:\n— Windows Hello for Business: biometric or PIN bound to the device\n— Passkeys \(FIDO2\): a hardware key or Authenticator passkey\n— Certificate-based authentication: a smart card or certificate\n— Temporary Access Pass: a one-time code for bootstrapping \(so a user with no method can sign in once to register\)$/m)
  assert.match(ai, /^Phone call, SMS, and the Authenticator push notification are deliberately excluded\. They're not phishing-resistant\.$/m)
  assert.match(ai, /^Multiple policies in the plan will reference this strength by name\. Create it once; they all share it\.$/m)
  assert.doesNotMatch(ai, /pinned five|source-tenant|\{\{/)
})
