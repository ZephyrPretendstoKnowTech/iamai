// Export's note on policy JSON and PowerShell says only what is true (OWN-X1):
// some policy steps carry those tabs (9 of 20 on the demo; not 4.4 or 4.3), so
// it no longer says every policy's are on its step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('the Doing the work note says where JSON and PowerShell are, without claiming every policy step has them', () => {
  const content = JSON.parse(readFileSync('docs/design/content.json', 'utf8'))
  const note: string = content.pages.export.groups.implementationNote
  // F-024 (owner, 2026-10-04): Policies as JSON gathers the ones written today into one file.
  assert.equal(note, "Where a policy step offers JSON or PowerShell, they're in its tabs in the Plan. Policies as JSON puts every policy the plan writes today in one file.")
  assert.doesNotMatch(note, /for a policy are on that step/)
})
