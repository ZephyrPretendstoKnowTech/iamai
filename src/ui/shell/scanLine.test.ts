// The scan runs from any page (ui/actions.ts): Connect's tile 3 shows its
// progress, every other page one line under the header, outside header.app,
// so the header keeps no scan control and no scan age.
//
// The page's width is route-aware (task 030): the shell carries `data-route`
// and src/ui/app.css gives each approved surface the column its pack sets —
// Connect 1040, Plan 1240, MFA Readiness 1200. Task 040 gave the three surfaces
// no pack governs a column from their content role too — Export 1040, How 1040,
// Inventory 1240 — and made the page and the footer read one `--route-width`
// declared on the shell, so the frame and the content cannot end up on two
// different columns. It replaced a boolean `page-wide` class that could only
// say "the wide one". MFA Readiness's ladder and counts keep their own,
// narrower measure and sit above the wider table.
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

test('each surface reads at its approved width; the diagnostic above the table keeps the page column instead of stretching to it', () => {
  assert.match(shell, /<main className="page" data-route=\{route\}>/, 'the width is decided by the route, in CSS')
  const widths = readFileSync('src/ui/app.css', 'utf8')
  // Task 040 moved the width from the page element to the shell, so the page
  // and the footer read one value per route (`--route-width`). The routes and
  // the columns they resolve to are the fact; where the variable is declared is
  // not.
  for (const [route, token] of [['connect', 'w-connect'], ['plan', 'w-plan'], ['readiness', 'w-readiness']]) {
    assert.match(widths, new RegExp(`\\.shell\\[data-route='${route}'\\] \\{\\s*\\n\\s*--route-width: var\\(--${token}\\);`), `${route} has no approved column`)
  }
  // Inventory, How and Export left the shared table cap for a column chosen by
  // their own content role (task 040): these are engineering widths, not
  // approved ones, and each is named once in src/ui/tokens.ts ROUTE_WIDTHS.
  for (const [route, token] of [['inventory', 'w-inventory'], ['how', 'w-how'], ['export', 'w-export']]) {
    assert.match(widths, new RegExp(`\\.shell\\[data-route='${route}'\\] \\{\\s*\\n\\s*--route-width: var\\(--${token}\\);`), `${route} has no column of its own`)
  }
  const today = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(today, /<div className="page-head">[\s\S]*<h1 className="display">\{T\.h1\}<\/h1>[\s\S]*CONNECT_WORDS\.scan\.complete\.again/, 'Scan again sits beside the heading')
  // The three counts are the approved integrated summary's stats (task 037), not
  // three cards and not five equal rung tiles.
  assert.match(today, /<section className="readiness-summary panel">/, 'the three readiness counts sit in one panel')
  assert.match(today, /className="summary-stat">/, 'and each count is a cell of it')
  const css = readFileSync('src/ui/app.css', 'utf8')
  assert.match(css, /\.surface \.page-head \{[^}]*justify-content: space-between/)
  assert.match(css, /\.scan-line \{/)
  // The approved pack gives the summary panel the full table column and caps the
  // sentence above it, which is the opposite way round from the tiles it
  // replaced: the panel IS the diagnostic, and the intro is the prose.
  assert.match(css, /\.surface\.readiness \.line\.intro \{[^}]*max-width: var\(--page\)/, 'the opening sentence is capped to the page width, not the wide table width')

  // The generic .surface p rule (prose) sets a prose max-width that would
  // otherwise cap the summary line below the page column the counts under it
  // sit at. The .surface.readiness override carries a strictly higher
  // specificity than that generic rule, or the line and the counts go out of
  // line the moment the table widens.
  const proseRule = /\.surface p,\s*\n\.surface ul,\s*\n\.surface ol \{[^}]*max-width: var\(--measure\)/
  assert.match(css, proseRule, 'the generic prose cap this override must beat is still the one in force')
  assert.ok(specificity('.surface.readiness .line.intro') > specificity('.surface p'), 'the override must win the cascade against .surface p, not just exist in the file')
  // And the summary panel's headline is not capped by the prose measure at all:
  // it is the panel's own cell, at the panel's width.
  assert.ok(
    specificity('.readiness-summary .summary-main .headline') > specificity('.surface p'),
    'the summary headline must beat the prose cap, or it wraps short inside a cell that is not prose',
  )
  // The five boxed rung rows the page used to draw are gone with the page they
  // were on: nothing renders them, so nothing styles them.
  assert.doesNotMatch(css, /\.ladder-row|\.ladder-divider|\.ladder-wrap/, 'the old ladder rows left no dead rules behind')
  assert.doesNotMatch(today, /ladder-wrap|LadderHead/, 'and the surface does not draw them')
})

test('Forget this tenant keeps the sign-in: its words say so', () => {
  assert.equal(app.shell.forgetTooltip, 'Deletes everything IAMAI stored for this tenant on this device; you stay signed in')
})
