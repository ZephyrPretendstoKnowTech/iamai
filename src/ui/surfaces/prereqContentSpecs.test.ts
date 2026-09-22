// Content review S2 (docs/content-review/SEGMENTS.md, prerequisite steps): one
// test per content spec (docs/content-review/specs/content-spec-*.md), each
// asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { readinessLeadOf } from './stepContract.ts'
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
    const lane = laneViewFor(step, { readings, titleOf })
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
  }
  return out
}

test('s-prereq-break-glass: preparation owns account identity, role and approved passkeys only', () => {
  assert.equal(stepOf('s-prereq-break-glass').why, 'Prepare at least two dedicated emergency access accounts with approved passkeys. These provide administrative access when your normal sign-in is unavailable. Two accounts give you another recovery option if one account or its passkey cannot be used.')
  const cs = stepOf('s-prereq-break-glass')
  assert.equal(cs.partner, undefined)
  assert.deepEqual(cs.doneWhen, [
    "The selected dedicated accounts are enabled, cloud-only identities on the tenant's onmicrosoft.com domain with permanent active Global Administrator assignments.",
    'Each selected account has an approved passkey compatible with the current and planned settings.',
  ])
  const artifacts = bodiesOf(fixture('demo')).get('s-prereq-break-glass')!.artifacts
  const entra = artifacts.find((artifact) => artifact.id === 'portal')!.text()
  assert.doesNotMatch(entra, /exclusions group|controlled drill|confirmed credential custody/i)
  assert.doesNotMatch(artifacts.find((artifact) => artifact.id === 'ps')!.text(), /exclusions group|group membership/i)
  assert.doesNotMatch(artifacts.find((artifact) => artifact.id === 'ai')!.text(), /credential custody|controlled (?:sign-in|drill)|exclusions group/i)
})

test('s-prereq-exclusion-group: About text is direct, the selector has no repeated helper, and Entra has two paths', () => {
  const cs = stepOf(EXCLUSIONS)
  // Editorial batch C: the register Why.
  assert.equal(cs.why, 'Keep the selected recovery accounts outside policies that could prevent recovery, using the intended exclusions group.')
  // The milestone carries the short selector help; the picker does not repeat a detected-match paragraph.
  assert.match(CONTENT_STEP, /const matchedNote = isExclusionsGroup \? null : matchedNoteOf/)
  // The nearby previous-step link was removed from the header.
  assert.equal(cs.partner, undefined)
  assert.doesNotMatch(CONTENT_STEP, /const partnerLink = partnerLinkOf\(cs\)/)
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
  assert.equal(cs.why, 'Keep approved passkey registration available, protect existing working methods, and apply the intended passkey settings without guessing at unread configuration.')
  assert.deepEqual(cs.doneWhen, [
    'The scan confirms that the applicable passkey settings match the intended configuration.',
  ])
  const body = bodiesOf(fixture('demo')).get(PASSKEYS)!
  assert.ok(body.readiness.tiles.some(t => t.key.startsWith('configuration:')), 'scan findings are concrete')
  const b = blocksOf(PASSKEYS)
  const entra = b['entra.configure-fido2'].text
  assert.ok(authoredParts(entra).some(p => p.kind === 'list' && p.ordered))
  for (const text of ['attestation', 'modelList', 'hardware', 'profile']) assert.match(entra, new RegExp(text, 'i'))
  const drawn = body.artifacts.find(a => a.id === 'portal')!.text()
  assert.doesNotMatch(drawn, /Open Temporary Access Pass|Open Microsoft Authenticator in the same/)
  assert.match(drawn, /rescan|scan again/i)
  assert.ok(b['ai.apply'].text.length > 100)

})

test('s-prereq-auth-strength: Why explains a strength, the action says what to do, Entra lists the five methods inside step 4, AI Info explains them, and Done when says methods', () => {
  const cs = stepOf('s-prereq-auth-strength')
  // Editorial batch C: the register Why; the help checks the policies already using the strength; Done when counts combinations and adds its human check.
  assert.equal(cs.why, 'An authentication strength defines the methods a policy accepts. Creating the right one keeps related policies consistent and makes any temporary sign-in options explicit.')
  // The line the action column draws under the milestone date (stepExport.ts decisionLine: the help while the decision is open).
  assert.equal(cs.decision, null)
  assert.deepEqual(cs.doneWhen, [
    'An authentication strength named "{strengthName}" or an equivalent strength matches the baseline’s required method combinations and restrictions. IAMAI detects the match automatically.',
    'Every policy already using the strength still accepts the methods its users rely on.',
  ])
  const b = blocksOf('s-prereq-auth-strength')
  assert.deepEqual(authoredParts(b['entra.create'].text), [
    {
      kind: 'list', ordered: true, start: 1, items: [
        // protect-admins B1: the path Learn gives, and the role it takes; "not under
        // Conditional Access" because that is where the step used to send people.
        ['Go to Entra admin center → Entra ID → Authentication methods → Authentication strengths. It takes the Security Administrator role, and it is not under Conditional Access.'],
        ['Click + New authentication strength.'],
        ['Name: {{strength.target.displayName}}.'],
        ['Select exactly these methods: {{strength.target.methodNames}}.'],
        ['Do not select any other methods.'],
        ['Review and Create.'],
        ['Rescan in IAMAI.'],
      ],
    },
  ])
  const ai = b['ai.create'].text
  // Editorial batch C (factual fix): five combinations with both Temporary Access Pass options, TAP is not phishing-resistant,
  // the strength differs from Microsoft's built-in one, and policies reference it by object ID, not by name.
  assert.match(ai, /This custom strength accepts exactly: \{\{strength.target.methodNames\}\}/)
  assert.match(ai, /^Windows Hello for Business, FIDO2 and multifactor certificate authentication are phishing-resistant\. A Temporary Access Pass is a time-limited passcode an administrator issues, for example so a person with no usable method can sign in and register one\. When a Temporary Access Pass option is accepted, this strength is not the same as Microsoft's built-in Phishing-resistant MFA strength\.$/m)
  assert.match(ai, /^Phone call, text message and Authenticator push notifications are not accepted\.$/m)
  assert.match(ai, /^Several baseline policies use this strength\. Create it once in this tenant; those policies reference it by its object ID\.$/m)
  assert.doesNotMatch(ai, /pinned five|source-tenant|all phishing-resistant or temporary|by name/)
})
