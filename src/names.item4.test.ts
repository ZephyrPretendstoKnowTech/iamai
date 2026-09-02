// Prompt 52, walk-51 item 4: the translator names its ids — the exclusions group
// to the tenant's group, and Azure Virtual Desktop / Windows 365 to their names
// through the first-party table — and "an account IAMAI could not name" is
// deleted as vocabulary.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildNameDirectory, UNNAMED } from './names.ts'

test('Azure Virtual Desktop and Windows 365 resolve, and the phrase is gone', () => {
  const dir = buildNameDirectory(null)
  assert.equal(dir.nameOf('9cdead84-a844-4324-93f2-b2e6bb768d07'), 'Azure Virtual Desktop')
  assert.equal(dir.nameOf('0af06dc6-e4b5-4f28-818e-e78e62d137a5'), 'Windows 365')
  assert.equal(dir.nameOf('708861da-226e-4d65-a57a-24128df64524'), 'Windows Cloud Login')
  assert.doesNotMatch(UNNAMED, /could not name/, 'the phrase is deleted')
  // No rendered translator output carries the forbidden phrase.
  assert.doesNotMatch(readFileSync('docs/design/translator-output.json', 'utf8'), /could not name/)
})
