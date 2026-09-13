// Content review S2 (docs/content-review/SEGMENTS.md, prerequisite steps): one
// test per content spec (docs/content-review/specs/content-spec-*.md), each
// asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { app, stepById } from '../../content/content.ts'
import { matchedNoteOf } from './pickerRows.ts'
import { partnerLinkOf } from './stepContract.ts'

type Block = { meta: { id: string; channel: string }; text: string }
const blocksOf = (stepId: string): Record<string, Block> => (registry as unknown as { packages: Record<string, { blocks: Record<string, Block> }> }).packages[stepId].blocks
const stepOf = (id: string): Record<string, unknown> & { decision?: Record<string, unknown> | null } =>
  (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as { id: string }[]).find((s) => s.id === id) as never
const CONTENT_STEP = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
const EXCLUSIONS = 's-prereq-exclusion-group'

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
