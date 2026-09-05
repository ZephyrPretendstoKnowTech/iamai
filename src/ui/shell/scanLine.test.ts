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

test('the wide cap keeps Today, Inventory and How; Today centers its ladder at its own intrinsic width instead of stretching it to the wide table', () => {
  assert.match(shell, /const WIDE_ROUTES = new Set<Route>\(\['today', 'inventory', 'how'\]\)/)
  const today = readFileSync('src/ui/surfaces/Today.tsx', 'utf8')
  assert.match(today, /<div className="page-head">[\s\S]*<h1>\{T\.h1\}<\/h1>[\s\S]*CONNECT_WORDS\.scan\.complete\.again/, 'Scan again sits beside the heading')
  assert.match(today, /<div className="ladder-wrap">[\s\S]*<LadderHead[\s\S]*<ul className="ladder">/, 'the ladder head and rows share one centered, capped wrapper')
  const css = readFileSync('src/ui/app.css', 'utf8')
  assert.match(css, /\.surface \.page-head \{[^}]*justify-content: space-between/)
  assert.match(css, /\.scan-line \{/)
  assert.match(css, /\.ladder-wrap \{[^}]*max-width: var\(--page\)/, 'the ladder is capped to the page width, not the wide table width')
})

test('Forget this tenant keeps the sign-in: its words say so', () => {
  assert.equal(app.shell.forgetTooltip, 'Deletes everything IAMAI stored for this tenant on this device; you stay signed in')
})
