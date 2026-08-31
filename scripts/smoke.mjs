// First-run smoke test (prompt 20 §10): starts the dev server, drives headless
// Chrome over the DevTools protocol with no dependencies beyond Node 22+, and
// walks Start → Connect → Baseline → Scan → Setup → Findings → Roadmap
// against the synthetic tenant (?dev=1&mock=1), asserting the key numbers.
// The same fixture backs src/ui/consistency.test.ts, so the numbers asserted
// here are the ones the pure tests prove.
//
//   npm run smoke            (CHROME=/path/to/chrome to override the binary)
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = Number(process.env.SMOKE_PORT ?? 5199)
const CDP_PORT = Number(process.env.SMOKE_CDP_PORT ?? 9444)
const BASE = `http://localhost:${PORT}/?dev=1&mock=1`
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)
const CHROME = CANDIDATES.find((p) => existsSync(p))
if (!CHROME) {
  console.error('smoke: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures.push(name)
}

// ---- dev server ----
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
let up = false
for (let i = 0; i < 100 && !up; i++) {
  try {
    const r = await fetch(`http://localhost:${PORT}/`)
    up = r.ok
  } catch {
    await sleep(200)
  }
}
if (!up) {
  console.error('smoke: dev server did not start')
  vite.kill()
  process.exit(2)
}

// ---- browser ----
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-smoke-profile`,
  `--remote-debugging-port=${CDP_PORT}`, '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' })
let targets = []
for (let i = 0; i < 100 && targets.length === 0; i++) {
  try {
    targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json()
  } catch {
    await sleep(200)
  }
}
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const consoleErrors = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
  }
}
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
  return r.result.result.value
}
const go = async (hash) => {
  await send('Page.navigate', { url: `${BASE}#/${hash}` })
  await sleep(900)
}
const waitFor = async (expr, ms = 15000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if ((await evaluate(expr)) === true) return true
    await sleep(100)
  }
  return false
}
const text = () => evaluate('document.body.innerText')
// Scoped to the page by default: the header carries a Plan tab of its own (prompt 47 Part 3), so a page click must not find it first.
const clickText = (re, root = 'main.page') => evaluate(`(() => { const r = document.querySelector(${JSON.stringify(root)}) ?? document; const b = [...r.querySelectorAll('a, button, summary')].find(x => ${re}.test(x.textContent.trim())); if (b) b.click(); return !!b })()`)

await send('Page.enable')
await send('Accessibility.enable')
await send('Runtime.enable')

try {
  let t = ''
  // An MSAL auth response in the fragment survives the first frame (prompt 47.1
  // Part 1): the mock never goes through MSAL, so this records what the hash
  // was the moment the header first rendered, before anything could rewrite it.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(() => { const seen = () => { if (window.__firstFrameHash === undefined && document.querySelector('header.app')) window.__firstFrameHash = location.hash }; new MutationObserver(seen).observe(document, { childList: true, subtree: true }); document.addEventListener('DOMContentLoaded', seen) })()`,
  })
  await send('Page.navigate', { url: `${BASE}#code=abc&client_info=def&state=ghi` })
  await sleep(1500)
  check('Sign-in: an auth response in the fragment is intact when the first frame renders', (await evaluate('window.__firstFrameHash')) === '#code=abc&client_info=def&state=ghi', String(await evaluate('window.__firstFrameHash')))
  check('Sign-in: once auth has settled the page lands on Plan', await waitFor(`location.hash === '#/roadmap'`))

  // The walk (prompt 47 Part 6 item 23): Connect signed out, sign in (the mock state), the scan, Today, Inventory, then the legacy Roadmap.
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1200)
  t = await text()
  check('Connect (signed out): the heading, the three lines and Sign in', /Connect a tenant/.test(t) && /Global Administrator or Global Reader/.test(t) && /Sign in with Microsoft/.test(t))

  // The consent disclosure, generated from the scope list and the registry (prompt 34 part 1), on the signed-out page (target-state §3).
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1000)
  check(
    'Connect: the permissions disclosure opens and lists the scopes',
    (await clickText('/What IAMAI asks for/')) && (await waitFor(`/Policy.Read.All/.test(document.body.innerText)`)),
  )
  t = await text()
  check('Connect: six permission rows, three columns', (await evaluate(`document.querySelectorAll('details.permissions tbody tr').length`)) === 6 && /Permission\s+What IAMAI reads\s+Without it/.test(t))
  check('Connect: the standard sign-in permissions are one line, not a table', /Plus the standard sign-in permissions\./.test(t) && !/openid/.test(t))
  check('Connect: it gives the removal path and stops there', /Enterprise applications/.test(t) && /Properties → Delete/.test(t) && !/leaves nothing behind/.test(t))
  // Prompt 46 item 23: Application.Read.All is gone, so every requested scope
  // has a collector behind it and the "requested, not yet used" group is absent.
  check('Connect: no requested scope sits unused', !/Requested, not yet used/.test(t) && !/Application\.Read\.All/.test(t) && !/Used for/.test(t))
  // Walk fixes (prompt 47.1 Part 2): the permission name on one line, the prose at the page column.
  check('Connect: no permission name breaks mid-word', await evaluate(`[...document.querySelectorAll('details.permissions tbody td:first-child code')].every((c) => c.getClientRects().length === 1)`))
  check('Connect: the prose reads at the page column, not the measure', (await evaluate(`Math.round(document.querySelector('.connect ul').getBoundingClientRect().width)`)) >= 700, String(await evaluate(`Math.round(document.querySelector('.connect ul').getBoundingClientRect().width)`)))

  await send('Page.navigate', { url: `${BASE}&state=noScan#/connect` })
  await sleep(1200)
  t = await text()
  check('Connect (no scan): Scan tenant and the ten-minute line', /Scan tenant/.test(t) && /About ten minutes\. Reads the tenant into this browser; nothing is sent anywhere\./.test(t))
  check('Connect (no scan): nothing about a plan yet', !/Open the plan/.test(t))
  await send('Page.navigate', { url: `${BASE}&state=scanning#/connect` })
  await sleep(1200)
  t = await text()
  check('Connect (scanning): the lane in plain words and Stop', /Reading people/.test(t) && /Stop/.test(t) && !/Scan tenant/.test(t), (t.match(/Reading[^\n]*/) ?? [''])[0])
  check('Connect (scanning): the header tabs are disabled', (await evaluate(`[...document.querySelectorAll('header.app nav a[aria-disabled="true"]')].length`)) === 2)
  // Connect, scanned: who is signed in, the baseline line, the one-line result, Open the plan (target-state §3).
  await go('connect')
  await sleep(600)
  t = await text()
  check('Connect: signed in as the operator', /Signed in to Contoso Pty Ltd as alex@example\.com/.test(t), (t.match(/Signed in[^\n]*/) ?? ['no signed-in line'])[0])
  check('Connect: the baseline line names the baseline and its policy count', /Baseline: synthetic baseline \(1 policy\)/.test(t), (t.match(/Baseline:[^\n]*/) ?? [''])[0])
  check('Connect (scanned): the one-line result and Open the plan', /Scan complete · 5 people · 3 policies · sign-ins [A-Z][a-z]{2} \d+ → [A-Z][a-z]{2} \d+/.test(t) && /Open the plan →/.test(t), (t.match(/Scan complete[^\n]*/) ?? [''])[0])
  check('Connect (scanned): the baseline picker opens with two choices', (await clickText('/^change$/')) && (await waitFor(`/Upload a package/.test(document.body.innerText) && /how to make one →/.test(document.body.innerText)`)))
  // Today: where things are now, over active people (target-state §4).
  await go('today')
  check('Today: the table renders', await waitFor(`document.querySelectorAll('table.datatable tbody tr').length >= 4`))
  t = await text()
  check('Today: one line counts active people, enabled, admins and the sign-in window', /(\d+ active (person|people)|no enabled people) of \d+ enabled · (\d+ admins?|no admins) · sign-ins [A-Z][a-z]{2} \d+ → [A-Z][a-z]{2} \d+/.test(t), (t.match(/[^\n]*active (person|people)[^\n]*/) ?? [''])[0])
  check('Today: four tiles', /MFA proven/.test(t) && /Registered, unproven/.test(t) && /No method/.test(t) && /Not active/.test(t))
  check('Today: state words are the plain six', /Proven|Likely works|Never prompted|Possibly broken|No method|Not active/.test(t) && !/Verified|Looks healthy/.test(t))
  check('Today: no legend, no banner, no rollout tiles, no filter chips', !/Legend/.test(t) && !/To set up before enforcement/.test(t) && !/Sign-in records: complete/.test(t) && (await evaluate(`document.querySelectorAll('.filter-bar, .legend-card').length`)) === 0)
  check('Today: one Show dropdown and a search box', (await evaluate(`document.querySelectorAll('main.page select').length`)) === 1 && (await evaluate(`!!document.querySelector('main.page input[type=search]')`)))
  check('Today: the link to everything the scan read', /Everything the scan read →/.test(t))
  // Walk fixes (prompt 47.1 Part 2): markers stand off the name; no inner scroll; a hairline header, not a band.
  check('Today: the Admin marker stands off the name, small and quiet', await evaluate(`(() => { const c = document.querySelector('main.page td .chip:not(.status)'); if (!c) return false; const cs = getComputedStyle(c); return parseFloat(cs.marginLeft) >= 6 && cs.fontSize === '12px' })()`))
  check('Today: the table has no inner scroll', (await evaluate(`getComputedStyle(document.querySelector('main.page .datatable-wrap')).maxHeight`)) === 'none')
  check('Today: the header row is a hairline, not a band', await evaluate(`(() => { const cs = getComputedStyle(document.querySelector('main.page table.datatable th')); return cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.position === 'static' && cs.textTransform === 'none' })()`))

  // Inventory and Licensing reachable
  await go('inventory')
  check('Inventory: policies table renders', await waitFor(`document.querySelectorAll('table tbody tr').length >= 3`))
  t = await text()
  check('Inventory: the heading, the ← Today link, and no intro sentence', /Everything the scan read/.test(t) && /← Today/.test(t) && !/as found: no analysis/.test(t))
  check('Inventory: the ten tabs', (await evaluate(`document.querySelectorAll('main.page [role=tab]').length`)) === 10)
  // Walk fixes (prompt 47.1 Part 2): the table column, and a hairline header.
  check('Inventory: the page uses the 1040px table column', (await evaluate(`Math.round(document.querySelector('main.page').getBoundingClientRect().width)`)) >= 1040, String(await evaluate(`Math.round(document.querySelector('main.page').getBoundingClientRect().width)`)))
  check('Inventory: the header row is a hairline, not a band', (await evaluate(`getComputedStyle(document.querySelector('main.page table.datatable th')).backgroundColor`)) === 'rgba(0, 0, 0, 0)')
  await go('licensing')
  t = await text()
  check('Licensing: Entra ID P1 detected', /Entra ID P1/.test(t))

  // Setup: 6 questions, all required; detection may already have answered them (prompt 46 item 19).
  await go('mapping')
  check('Setup: questions render', await waitFor(`/Question 1/.test(document.body.innerText)`))
  t = await text()
  check('Setup: every answer detected, 6 of 6', /6 of 6 answered/.test(t), (t.match(/\d of \d answered[^\n]*/) ?? [''])[0])
  check('Setup: no optional split', !/optional question/.test(t))

  // Findings
  await go('coverage')
  check('Findings: tiles render', await waitFor(`document.querySelectorAll('.stat').length >= 5`))
  t = await text()
  check('Findings: 2 in place, 1 partly, 13 missing', /2\s+In place[\s\S]*1\s+Partly[\s\S]*13\s+Missing/.test(t))
  check('Findings: MFA proven share and to-set-up count over enabled users', /%\s+of enabled users proved MFA in the last 30 days/.test(t) && /\d+\s+enabled users to set up before enforcement/.test(t))
  check('Findings: grouped by domain by default', (await clickText('/[Nn]eeds attention/')) && (await waitFor(`[...document.querySelectorAll('select')].some(s => s.value === 'domain') && /Identity.*Admins/s.test(document.body.innerText)`)))
  check('Findings: scan age shown', /Based on the scan from/.test(t))

  // Roadmap
  await go('roadmap')
  check('Roadmap: overview renders', await waitFor(`/steps in place/.test(document.body.innerText)`))
  t = await text()
  check('Roadmap: headline counts the steps in place and says when it finishes', /\d+ of \d+ steps in place · finishes /.test(t))
  // Setup is unanswered on the mock walk, so emergency access is not validated:
  // the plan must lead with it and hold everything that can deny access (32).
  check('Roadmap: Do this next leads with the emergency-access blocker', /Sort out emergency access before anything else/.test(t))
  check('Roadmap: the blocker says what it is holding', /Must fix first: \d+ steps that can deny access are held until it passes/.test(t))
  check('Roadmap: tiles Safe today and Blocked', /\d+\s+Safe today/.test(t) && /\d+\s+Blocked/.test(t))
  // R11 removed the "This week" line: it repeated card one of Do this next verbatim.
  check('Roadmap: the licence sentence', /With this tenant's Entra ID/.test(t))
  check('Roadmap: danger areas name the blocked user', /1 user is blocked today|Watch first\s+1/.test(t))
  check('Roadmap: Plan tab lists the verification campaign', (await clickText('/^Plan/')) && (await waitFor(`/Run the MFA verification campaign/.test(document.body.innerText)`)))
  // R13: Progress is the Plan tab's header now, not a tab of its own.
  check('Roadmap: the Plan tab carries the journey', (await clickText('/^Plan/')) && (await waitFor(`/The journey/.test(document.body.innerText)`)))
  check('Roadmap: Schedule tab carries the dates and the calendar export', (await clickText('/^Schedule/')) && (await waitFor(`/Export to calendar/.test(document.body.innerText)`)))
  check('Roadmap: Do this next and History render', (await clickText('/^Plan/')) && (await waitFor(`/Do this next/.test(document.body.innerText) && /History/.test(document.body.innerText)`)))

  // The old names redirect (target-state §2, prompt 47 Part 3).
  await go('start')
  check('Start redirects to Connect', await waitFor(`location.hash === '#/connect'`))
  await go('baseline')
  check('Baseline redirects to Connect', await waitFor(`location.hash === '#/connect'`))
  await go('scan')
  check('Scan redirects to Today', await waitFor(`location.hash === '#/today'`))
  await go('plan')
  check('Plan opens the Roadmap until prompt 48', await waitFor(`location.hash === '#/roadmap'`))

  // The header (target-state §2): wordmark, tenant, tabs, Re-scan with the scan's age, Recovery card, theme, Account.
  await go('roadmap')
  await waitFor(`/Do this next/.test(document.body.innerText)`)
  t = await evaluate(`document.querySelector('header.app').innerText`)
  check('Header: the tenant name, both tabs and the controls', /Contoso Pty Ltd/.test(t) && /Today/.test(t) && /Plan/.test(t) && /Recovery card/.test(t) && /Account/.test(t), t.replace(/\s+/g, ' ').slice(0, 120))
  check('Name: the wordmark is IAMAI Planner and the tab title carries the descriptor', /^IAMAI Planner/.test(t.trim()) && (await evaluate('document.title')) === 'IAMAI Planner — Conditional Access rollout planner', await evaluate('document.title'))
  check('Header: Re-scan carries the scan age', /Re-scan · scanned (just now|\d+h ago|\d+d ago)/.test(t), t.replace(/\s+/g, ' ').slice(0, 120))
  check('Header: no sidebar, no stepper', (await evaluate(`document.querySelectorAll('.stepper, .body-grid, .topbar').length`)) === 0)
  check('Header: the theme control names the mode it switches to', /Light theme|Dark theme/.test(t))
  await send('Page.navigate', { url: `${BASE}&state=noScan#/roadmap` })
  await sleep(1200)
  check('Header (no scan): the tabs are disabled until the first scan', (await evaluate(`[...document.querySelectorAll('header.app nav a[aria-disabled="true"]')].length`)) === 2 && (await evaluate(`document.querySelector('header.app nav a').title`)) === 'after the first scan')
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1200)
  t = await evaluate(`document.querySelector('header.app').innerText`)
  check('Header (signed out): only the wordmark and the theme control', /IAMAI/.test(t) && !/Today|Account|Recovery/.test(t), t.replace(/\s+/g, ' '))

  // Failure paths and first-visitor tenants (prompt 31 §4): every page reads clearly, nothing breaks.
  await send('Page.navigate', { url: `${BASE}&licence=free#/coverage` })
  await sleep(1500)
  check('Unlicensed tenant: Findings renders from configuration and directory data', await waitFor(`document.querySelectorAll('.stat').length >= 3`))
  t = await text()
  check('Unlicensed tenant: Findings says which goals need another licence', /goals need a licence tier this tenant does not have/.test(t))
  await send('Page.navigate', { url: `${BASE}&licence=free#/today` })
  await sleep(1500)
  t = await text()
  check('Unlicensed tenant: Today says why there are no sign-in records', /no sign-in records \(needs Entra ID P1 or P2\)/.test(t), (t.match(/[^\n]*sign-in records[^\n]*/) ?? [''])[0])
  check('Unlicensed tenant: nobody is Proven without records', !/\bProven\b/.test(t))
  await send('Page.navigate', { url: `${BASE}&licence=free#/roadmap` })
  await sleep(1500)
  check('Unlicensed tenant: the plan still generates', await waitFor(`/steps in place/.test(document.body.innerText)`))
  t = await text()
  check('Unlicensed tenant: the licence header names the tier and what needs another', /With this tenant's Entra ID Free/.test(t))
  // The free-tier ladder is the plan for a tenant that cannot hold a policy (SPEC 12).
  check('Unlicensed tenant: the plan says it is the free hardening ladder', /free hardening ladder/.test(t))
  check(
    'Unlicensed tenant: the ladder is the plan, with this tenant own numbers',
    (await clickText('/^Plan/')) && (await waitFor(`/Switch on the free protection|Keep two emergency accounts/.test(document.body.innerText)`)),
  )
  t = await text()
  check('Unlicensed tenant: nothing asks for objects a policy would reference', !/Create a trusted named location|Create the exclusions group/.test(t))
  check(
    'Unlicensed tenant: a ladder step names what it changes here, and where to click',
    (await clickText('/Switch on the free protection/')) &&
      (await waitFor(`/enabled account/.test(document.body.innerText)`)) &&
      (await waitFor(`/Manage security defaults/.test(document.body.innerText)`)),
  )
  await send('Page.navigate', { url: `${BASE}&policies=0#/coverage` })
  await sleep(1500)
  check('Zero policies: Findings renders', await waitFor(`document.querySelectorAll('.stat').length >= 3`))
  await send('Page.navigate', { url: `${BASE}&policies=0#/roadmap` })
  await sleep(1500)
  check('Zero policies: the plan renders with Do this next', await waitFor(`/Do this next/.test(document.body.innerText)`))
  t = await text()
  check('Zero policies: the policy count reads zero, not a wall of missing', /no Conditional Access policies in the tenant today/.test(t))
  // A sign-in with too little access names the role to ask for (prompt 31 4.18).
  // The refused-sections notice lives with the scan result, on Connect (prompt 47 Part 4).
  await send('Page.navigate', { url: `${BASE}&denied=1#/connect` })
  await sleep(1500)
  check('Denied sections: the scan says a role is missing, never just insufficient privileges', await waitFor(`/Some sections need a higher role/.test(document.body.innerText)`))
  t = await text()
  check('Denied sections: the ask is Global Reader, and it is read-only', /Global Reader/.test(t) && /grants every section IAMAI reads and can change nothing/.test(t))
  check('Denied sections: each refused section names its own least role', /Conditional Access policies|CA policies/.test(t) && /Security Reader/.test(t) && /Reports Reader/.test(t))
  check('Denied sections: a licence gate is never reported as a missing role', !/not available on this licence[\s\S]{0,120}holds no role/.test(t))

  check('No page threw', consoleErrors.filter((e) => !/authmethods|Not signed in|favicon/.test(e)).length === 0, consoleErrors.filter((e) => !/authmethods|Not signed in|favicon/.test(e)).slice(0, 2).join(' | '))

  // Forget this tenant clears every store for it (prompt 31 §2.8).
  await go('roadmap')
  await waitFor(`/Do this next/.test(document.body.innerText)`)
  const tenantId = await evaluate(`(async () => { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); const tx = db.transaction('plan'); const all = await new Promise((r) => { const q = tx.objectStore('plan').getAllKeys(); q.onsuccess = () => r(q.result) }); db.close(); return all[0] ?? null })()`)
  const countFor = (id) => evaluate(`(async () => { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); let n = 0; for (const name of [...db.objectStoreNames]) { const tx = db.transaction(name); const rows = await new Promise((r) => { const q = tx.objectStore(name).getAll(); q.onsuccess = () => r(q.result) }); n += rows.filter((x) => x && x.tenantId === ${JSON.stringify(id)}).length } db.close(); return n })()`)
  const before = tenantId ? await countFor(tenantId) : 0
  check('Forget: stores hold rows for the tenant before forgetting', before > 0, `rows=${before}`)
  check('Forget: the Account menu opens', await clickText('/^Account$/', 'header.app'))
  await sleep(200)
  check('Forget: the button is there', await clickText('/^Forget this tenant/', 'header.app'))
  await sleep(1500)
  const after = tenantId ? await countFor(tenantId) : 0
  check('Forget: every store is empty for the tenant afterwards', after === 0, `rows=${after}`)
  check('Forget: no MSAL account remains in session storage', (await evaluate(`Object.keys(sessionStorage).filter((k) => /msal|login\.windows|microsoftonline/.test(k)).length`)) === 0)

  // The feedback channel shows the message before anything opens (prompt 34 part 2).
  await go('roadmap')
  await sleep(1200)
  check(
    'Feedback: the footer link opens the panel',
    (await clickText('/Something wrong or unclear/', 'footer.app')) && (await waitFor(`/What the email will contain/.test(document.body.innerText)`)),
  )
  t = await text()
  check('Feedback: the message shows the page, version and browser', /Page: #\/roadmap/.test(t) && /Version:/.test(t) && /Browser:/.test(t))
  check('Feedback: nothing is sent automatically', /Nothing is sent from here/.test(t))
  check('Feedback: the scan summary is opt-in and not attached by default', !/Users in the directory/.test(t))

  // The rule registry renders itself (validation-rules.md 5).
  await go('checks')
  t = await text()
  check('Checks: the reference page lists the registry by subject', /Every check IAMAI runs/.test(t) && /Emergency access accounts/.test(t) && /The exclusions group/.test(t))
  check('Checks: severities and the unknown rule are stated', /Must fix/.test(t) && /Recommended/.test(t) && /holds the plan exactly as a failure does/.test(t))
  check('Checks: a break-glass rule is on the page in plain language', /Global Administrator is assigned permanently and active/.test(t))
  // Every check names its source, and the ones nobody documents say so (audit-program 6).
  check('Checks: every rule names a source', /Source/.test(t) && /Microsoft: manage emergency access accounts/.test(t))
  check('Checks: field practice is labelled rather than dressed up as Microsoft', /Field practice/.test(t))

  // Accessible names, from Chrome's own accessibility tree rather than from our
  // own name computation (prompt 42 §17, review-09 finding 16). Whether a screen
  // reader announces something is not our judgement to make, so this asks the
  // browser, in both themes, and reports what it says.
  for (const theme of ['light', 'dark']) {
    await send('Page.navigate', { url: `${BASE}#/roadmap` })
    await sleep(2500)
    await evaluate(`document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)})`)
    await sleep(400)
    const tree = await send('Accessibility.getFullAXTree', {})
    const nodes = tree.result?.nodes ?? []
    const INTERACTIVE = ['button', 'link', 'checkbox', 'textbox', 'combobox', 'switch', 'tab']
    const unnamed = nodes.filter((n) => INTERACTIVE.includes(n.role?.value) && !n.ignored && !(n.name?.value ?? '').trim())
    check(`Accessibility (${theme}): every control has a name a screen reader can announce`, unnamed.length === 0, unnamed.map((n) => n.role?.value).slice(0, 4).join(', '))
  }

  check('No console errors or exceptions across the walk', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
} catch (e) {
  check('walk completed', false, e instanceof Error ? e.message : String(e))
} finally {
  ws.close()
  chrome.kill()
  vite.kill()
}

if (failures.length > 0) {
  console.error(`\nsmoke: ${failures.length} check(s) failed`)
  process.exit(1)
}
console.log('\nsmoke: every check passed')
process.exit(0)
