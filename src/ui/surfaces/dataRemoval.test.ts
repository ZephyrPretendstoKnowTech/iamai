// Connect and How say how to delete what IAMAI keeps in this browser (F-078):
// both said the scan stays in the browser, and neither said how to remove it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const SENTENCE = 'What it keeps here stays after Sign out; Account → Forget this tenant deletes it.'

test('Connect\'s removal line and How\'s Where it runs say Sign out keeps the data and Forget this tenant deletes it', () => {
  const content = JSON.parse(readFileSync('docs/design/content.json', 'utf8'))
  assert.ok(content.pages.connect.signIn.removal.endsWith(`Nothing it read leaves this browser unless you export it. ${SENTENCE}`))
  assert.ok(content.pages.app.how.hostingBody.includes(`keeps the scan in this browser. ${SENTENCE}`))
})
