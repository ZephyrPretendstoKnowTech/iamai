// The public-beta notice on Connect (owner decision, corrective pass C09): the
// agreed words, once, in the existing callout, above the setup controls before
// and after sign-in, with the feedback address as a mail link — and no barrier:
// nothing to tick, no dialog, nothing recorded.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pages } from '../../content/content.ts'
import { FEEDBACK_ADDRESS } from '../../feedback.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const CONNECT = read('src/ui/surfaces/Connect.tsx')
const notice = (pages.connect as unknown as { notice: { title: string; body: string } }).notice

test('the notice carries the agreed title and words, with the feedback address as its one variable', () => {
  assert.equal(notice.title, 'Public beta — review before applying')
  assert.equal(
    notice.body.replace('{feedback}', FEEDBACK_ADDRESS),
    'IAMAI’s recommendations and implementation guidance are still being validated. Check every instruction, JSON payload and PowerShell script against your tenant and current Microsoft documentation before applying it. IAMAI reads your tenant; changes happen only when you apply them yourself. Report incorrect or contradictory guidance to feedback@getiamai.com.',
  )
  assert.equal(notice.body.split('{feedback}').length, 2, 'the address appears exactly once')
  // The distinction is about tenant changes; the words make no claim that the browser stores nothing.
  assert.doesNotMatch(notice.body, /nothing is (stored|saved|kept)|no (data|browser storage|local storage)/i)
})

test('Connect draws the notice once, in the callout, above both states', () => {
  const connect = CONNECT.slice(CONNECT.indexOf('export function Connect('), CONNECT.indexOf('function StatusStrip('))
  assert.equal((CONNECT.match(/<BetaNotice \/>/g) ?? []).length, 1, 'the notice is drawn once')
  const at = connect.indexOf('<BetaNotice />')
  assert.ok(at > connect.indexOf('className="lede"'), 'below the lead')
  assert.ok(at < connect.indexOf('<SignedIn') && at < connect.indexOf('<SignedOut'), 'before the branch that draws either state, so above sign-in and scan controls in both')
  const body = CONNECT.slice(CONNECT.indexOf('function BetaNotice('), CONNECT.indexOf('function StatusStrip('))
  assert.match(body, /<Callout kind="warning" title=\{W\.notice\.title\}>/, 'the existing callout component carries it')
  assert.match(body, /href=\{`mailto:\$\{FEEDBACK_ADDRESS\}`\}/, 'the address is a mailto link to the one feedback address')
  assert.match(body, /className="lnk"/, 'the link is a text link')
  // No acknowledgement barrier and no acceptance tracking.
  assert.doesNotMatch(body, /checkbox|dialog|modal|useState|localStorage|indexedDB|onClick|accept/i)
})

test('the notice has its own spacing on Connect and no rule hides it', () => {
  const css = read('src/ui/app.css')
  assert.match(css, /\.surface\.connect > \.callout \{\s*margin-top: 20px;/)
  assert.doesNotMatch(css, /\.surface\.connect > \.callout \{[^}]*display: none/)
})
