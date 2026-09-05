// The scan runs from any page (ui/actions.ts): Connect's tile 3 shows its
// progress, every other page one line under the header, outside header.app,
// so the header keeps no scan control and no scan age. Today's table reads
// better with the wide cap (WIDE_ROUTES); its ladder keeps its own, narrower
// intrinsic width and sits centered above the wider table (.ladder-wrap).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { app, pages } from '../../content/content.ts'

const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')

test("the scan's line renders under the header on every page but Connect, from the session's scan state, with Stop and the paused notice", () => {
  const line = shell.slice(shell.indexOf('function ScanLine'), shell.indexOf('export function AppShell'))
  assert.match(line, /route === 'connect' \|\| scan\.state === 'idle' \|\| scan\.state === 'done'\) return null/, 'Connect carries the scan in its tile; an idle or finished scan shows no line')
  assert.match(line, /className="scan-line"/)
  assert.match(line, /fillText\(CONNECT\.failed/, 'a failure says why, in the same words as the tile')
  assert.match(line, /stopScan/, 'Stop is the one action')
  assert.match(line, /<PausedNotice \/>/, 'a paused scan offers Sign in again')
  // Outside the header element: the header's own text never carries the lane or the age.
  const header = shell.slice(shell.indexOf('<header className="app">'), shell.indexOf('</header>'))
  assert.doesNotMatch(header, /ScanLine|scan-line/)
  assert.match(shell, /<\/header>[\s\S]*\{signedIn && <ScanLine route=\{route\} \/>\}[\s\S]*<main/, 'the line sits between the header and the page')
  assert.equal((pages.connect as { scan: { scanning: { state: string } } }).scan.scanning.state, '{lane} · {elapsed}')
  assert.equal(app.connect.failed, 'The scan stopped before it finished: {why}')
})

// A rough CSS specificity count (ids, classes, elements): enough for the
// selectors below, none of which carries an id, an attribute or a
// pseudo-element. Classes always outrank elements here since no selector in
// this file's checks has more than a handful of either.
const specificity = (selector: string): number => {
  const classes = (selector.match(/\.[-\w]+/g) ?? []).length
  const elements = (selector.match(/(^|[\s>+~])[a-zA-Z][-\w]*/g) ?? []).length
  return classes * 1000 + elements
}

test('the wide cap keeps Today, Inventory and How; Today centers its ladder at its own intrinsic width instead of stretching it to the wide table', () => {
  assert.match(shell, /const WIDE_ROUTES = new Set<Route>\(\['today', 'inventory', 'how'\]\)/)
  const today = readFileSync('src/ui/surfaces/Today.tsx', 'utf8')
  assert.match(today, /<div className="page-head">[\s\S]*<h1>\{T\.h1\}<\/h1>[\s\S]*CONNECT_WORDS\.scan\.complete\.again/, 'Scan again sits beside the heading')
  assert.match(today, /<div className="ladder-wrap">[\s\S]*<LadderHead[\s\S]*<ul className="ladder">/, 'the ladder head and rows share one centered, capped wrapper')
  const css = readFileSync('src/ui/app.css', 'utf8')
  assert.match(css, /\.surface \.page-head \{[^}]*justify-content: space-between/)
  assert.match(css, /\.scan-line \{/)
  assert.match(css, /\.ladder-wrap \{[^}]*max-width: var\(--page\)/, 'the wrapper (head and rows together) is capped to the page width, not the wide table width')

  // The generic .surface ul/ol rule (prose lists) sets a prose max-width and a
  // list indent; both outrank .ladder's own (single-class) rule and would
  // otherwise leave the rows narrower than .ladder-wrap and flush left inside
  // it, out of line with the head. .ladder-wrap .ladder must carry a strictly
  // higher specificity than that generic rule and cancel both properties, or
  // the rows go crooked again the moment the table widens.
  const proseRule = /\.surface p,\s*\n\.surface ul,\s*\n\.surface ol \{[^}]*max-width: var\(--measure\)/
  assert.match(css, proseRule, 'the generic prose cap this override must beat is still the one in force')
  const indentRule = /\.surface ul,\s*\n\.surface ol \{[^}]*padding-left: 20px/
  assert.match(css, indentRule, 'the generic list indent this override must beat is still the one in force')
  const overrideBlock = css.match(/\.ladder-wrap \.ladder \{([^}]*)\}/)
  assert.ok(overrideBlock, '.ladder-wrap .ladder exists to override the generic rule for the ladder specifically')
  assert.match(overrideBlock![1], /max-width: none/, 'cancels the prose cap so the rows span the same width as .ladder-wrap')
  assert.match(overrideBlock![1], /padding-left: 0/, 'cancels the list indent so the rows align with the head, not indented under it')
  assert.ok(specificity('.ladder-wrap .ladder') > specificity('.surface ul'), 'the override must win the cascade against .surface ul, not just exist in the file')
})

test('Forget this tenant keeps the sign-in: its words say so', () => {
  assert.equal(app.shell.forgetTooltip, 'Deletes everything IAMAI stored for this tenant on this device; you stay signed in')
})
