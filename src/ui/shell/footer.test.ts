// The footer on every page (docs/design/mockups/today-v2.html, plan-top-v2.html):
// IAMAI Home as a link, the author, the source, and feedback@getiamai.com as the
// fourth link; the app's shell and the home page render the same four. And
// "people" on Today, the Plan and Connect: "user" names an Entra user object
// (Microsoft's own scope names) and nothing else.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { app, pages } from '../../content/content.ts'
import { renderHomeHtml } from '../../../scripts/build-home.ts'
import { consentRows } from '../../copy/permissions.ts'

const FOOTER = (pages.footer as { links: { text: string; href: string }[] }).links

test('the footer has four links: IAMAI Home (a link), LinkedIn, GitHub, feedback@getiamai.com', () => {
  assert.equal(FOOTER.length, 4)
  assert.deepEqual(FOOTER[0], { text: 'IAMAI Home', href: 'https://getiamai.com/' })
  assert.deepEqual(FOOTER[3], { text: 'feedback@getiamai.com', href: 'mailto:feedback@getiamai.com' })
  for (const l of FOOTER) assert.match(l.href, /^(https:\/\/|mailto:)/, `${l.text} is a link`)
  // The shell renders every link as an anchor; the mail link opens the mail client, not a tab.
  const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  assert.match(shell, /footer\.links\.map\(/)
  assert.match(shell, /startsWith\('mailto:'\) \? \(\s*<a href=\{l\.href\}>/)
  // The home page renders the same links, in the arrangement its approved pack
  // draws (task 038): the product's name on the left, the public links on the
  // right. The link that points at this page IS the name on the left, so it is
  // not repeated as a link to itself — every destination is still reachable.
  const html = renderHomeHtml()
  const footer = html.slice(html.indexOf('<footer class="app">'), html.indexOf('</footer>'))
  assert.equal((footer.match(/<a /g) ?? []).length, 3, 'the three public links on the home page')
  assert.ok(footer.includes('<span>IAMAI</span>'), "the product's name stands where the link to this page would be")
  assert.ok(!footer.includes('href="https://getiamai.com/"'), 'the home page does not link to itself in its own footer')
  assert.ok(footer.includes('<a href="mailto:feedback@getiamai.com">feedback@getiamai.com</a>'), 'the feedback address is a mail link, in place')
  for (const l of FOOTER.slice(1)) assert.ok(footer.includes(`>${l.text}</a>`), `${l.text} is on the home page`)
  assert.equal((footer.match(/ · /g) ?? []).length, 2)
})

test('"people" on Today, the Plan and Connect; "user" only for an Entra user object', () => {
  // The consent rows are Microsoft's own wording and live with the permission
  // authority (src/copy/permissions.ts), not in the page's words (task 016), so
  // the page's words carry no "user" at all.
  // One owner-chosen exception (2026-09-11): the Impact column's "No user impact",
  // which says a policy reaches no one without calling the reach zero.
  const words = JSON.stringify({ today: pages.readiness, plan: pages.plan, connect: pages.connect, appReadiness: app.readiness, appPlan: app.plan, appConnect: app.connect }).replaceAll(JSON.stringify((pages.plan as { impact: { noUserImpact: string } }).impact.noUserImpact), '""')
  assert.ok(!/\busers?\b/i.test(words), `no "user" outside Microsoft's scope names: ${(words.match(/[^"]{0,40}\busers?\b[^"]{0,40}/i) ?? [''])[0]}`)
  // Microsoft's consent rows name the user object, as Microsoft does.
  assert.ok(JSON.stringify(consentRows()).includes("Read all users' basic profiles"))
})
