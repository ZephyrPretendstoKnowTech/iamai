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
  // The home page renders the same four, joined by |.
  const html = renderHomeHtml()
  const footer = html.slice(html.indexOf('<footer class="app">'), html.indexOf('</footer>'))
  assert.equal((footer.match(/<a /g) ?? []).length, 4, 'four links on the home page')
  assert.ok(footer.includes('<a href="https://getiamai.com/">IAMAI Home</a>'), 'IAMAI Home is a link')
  assert.ok(footer.includes('<a href="mailto:feedback@getiamai.com">feedback@getiamai.com</a>'), 'the feedback address is a mail link, in place')
  assert.equal((footer.match(/ \| /g) ?? []).length, 3)
})

test('"people" on Today, the Plan and Connect; "user" only for an Entra user object', () => {
  const connect = pages.connect as { signIn: { consent: unknown } } & Record<string, unknown>
  const { consent, ...signInRest } = connect.signIn as Record<string, unknown> & { consent: unknown }
  void consent
  const words = JSON.stringify({ today: pages.today, ladder: pages.ladder, plan: pages.plan, connect: { ...connect, signIn: signInRest }, appToday: app.today, appPlan: app.plan, appConnect: app.connect })
  assert.ok(!/\busers?\b/i.test(words), `no "user" outside Microsoft's scope names: ${(words.match(/[^"]{0,40}\busers?\b[^"]{0,40}/i) ?? [''])[0]}`)
  // Microsoft's consent rows name the user object, as Microsoft does.
  assert.ok(JSON.stringify(consent).includes("Read all users' basic profiles"))
})
