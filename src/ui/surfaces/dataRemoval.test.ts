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

// T3-A: one browser can hold several tenants. How and SECURITY.md say that each
// keeps its own stored scan and plan here until it is forgotten, that opening
// another deletes nothing, that one not open can be forgotten without signing
// in, and that Sign out signs out the open account only.
test('How and SECURITY.md say each tenant opened here keeps its own stored scan and plan until it is forgotten', () => {
  const content = JSON.parse(readFileSync('docs/design/content.json', 'utf8'))
  assert.ok(content.pages.app.how.hostingBody.includes(`${SENTENCE} Each tenant you open keeps its own scan and plan in this browser until you forget it. Opening another tenant deletes nothing, and you can forget a tenant that is not open from the Account menu without signing in to it.`))
  const security = readFileSync('SECURITY.md', 'utf8').replace(/\r\n/g, '\n').replace(/\s+/g, ' ')
  assert.ok(security.includes('Each tenant opened in this browser keeps its own records here until it is forgotten; opening another tenant from the Account menu deletes nothing.'))
  assert.ok(security.includes('A tenant that is not open is forgotten the same way from its own row in the Account menu, without signing in to it.'))
  assert.ok(security.includes('*Sign out* signs out the account that is open; an account signed in to another tenant in the same tab stays signed in.'))
  assert.ok(security.includes('Sign out removes the open account\'s part of it, and all of it when no other account is signed in in that tab.'))
  assert.ok(!security.includes('cleared when the tab closes or when you sign out'), 'SECURITY.md still says Sign out clears the whole sign-in session')
})
