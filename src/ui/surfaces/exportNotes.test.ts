// Export's note on policy JSON and PowerShell says only what is true (OWN-X1):
// some policy steps carry those tabs (9 of 20 on the demo; not 4.4 or 4.3), so
// it no longer says every policy's are on its step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('the Doing the work note says where JSON and PowerShell are, without claiming every policy step has them', () => {
  const content = JSON.parse(readFileSync('docs/design/content.json', 'utf8'))
  const note: string = content.pages.export.groups.implementationNote
  assert.equal(note, "Where a policy step offers JSON or PowerShell, they're in its tabs in the Plan. They belong to one step, so they are not offered here for the whole plan.")
  assert.doesNotMatch(note, /for a policy are on that step/)
})
