// Content review S2 (docs/content-review/SEGMENTS.md, prerequisite steps): one
// test per content spec (docs/content-review/specs/content-spec-*.md), each
// asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }

type Block = { meta: { id: string; channel: string }; text: string }
const blocksOf = (stepId: string): Record<string, Block> => (registry as unknown as { packages: Record<string, { blocks: Record<string, Block> }> }).packages[stepId].blocks
const stepOf = (id: string): Record<string, unknown> & { decision?: Record<string, unknown> | null } =>
  (JSON.parse(readFileSync('docs/design/content.json', 'utf8')).steps as { id: string }[]).find((s) => s.id === id) as never

test('s-prereq-break-glass: Why names the tenant, Entra names the group and where keys go', () => {
  assert.equal(stepOf('s-prereq-break-glass').why, 'Emergency access accounts are how you keep access to your tenant if a Conditional Access change locks everyone out.')
  const entra = blocksOf('s-prereq-break-glass')['entra.create-or-correct'].text
  assert.match(entra, /^6\. Add the account to the exclusions group you chose in the Create or Correct Exclusions Group step\.$/m)
  assert.match(entra, /^8\. Store credentials and recovery keys in your organization's secure custody process \(e\.g\. a safe or vault\)\. Do not store them in IAMAI\.$/m)
  assert.doesNotMatch(entra, /IAMAI-resolved|outside IAMAI/)
})
