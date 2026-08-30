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
const clickText = (re) => evaluate(`(() => { const b = [...document.querySelectorAll('a, button, summary')].find(x => ${re}.test(x.textContent.trim())); if (b) b.click(); return !!b })()`)

await send('Page.enable')
await send('Runtime.enable')

try {
  // Start
  await go('start')
  check('Start renders the headline', await waitFor(`!!document.querySelector('h1')`))
  check('Start: Get started leads to Connect', (await clickText('/^Get started/')) && (await waitFor(`location.hash === '#/connect'`)))

  // Connect shows the mock account and the saved scan
  await sleep(600)
  let t = await text()
  check('Connect: signed in as the operator', /alex@example\.com/.test(t), 'operator UPN visible')
  check('Connect: the saved scan is offered', /5 users/.test(t))

  // Baseline: the loaded synthetic baseline and the Setup promise
  await go('baseline')
  t = await text()
  check('Baseline: 1 policy loaded', /1 policy ·/.test(t))
  check('Baseline: Setup will ask 8 questions (all required)', /Setup will ask 8 questions \(all required\)/.test(t), (t.match(/Setup will ask[^\n]*/) ?? [''])[0])

  // Scan: the readiness table
  await go('scan')
  check('Scan: readiness table renders', await waitFor(`document.querySelectorAll('table.datatable tbody tr').length >= 5`))
  await evaluate(`document.querySelectorAll('details').forEach(d => d.open = true)`)
  t = await text()
  check('Scan: 5 users · 3 policies', /5 users · 3 policies/.test(t))
  check('Scan: tiles 1 Verified, 4 Active', /1\s+Verified/.test(t) && /4\s+Active/.test(t))
  check('Scan: rollout tiles name the window and the population', /MFA proven in the last 30 days/.test(t) && /To set up before enforcement/.test(t) && !/Challenged rate/.test(t))
  check('Scan: legend has three cards', (await evaluate(`document.querySelectorAll('.legend-card').length`)) === 3)

  // Setup: 8 questions, 3 required
  await go('mapping')
  check('Setup: questions render', await waitFor(`/Question 1/.test(document.body.innerText)`))
  t = await text()
  check('Setup: every shown question is required, 8 to go', /0 of 8 answered · 8 to go/.test(t))
  check('Setup: no optional split', !/optional question/.test(t))

  // Findings
  await go('coverage')
  check('Findings: tiles render', await waitFor(`document.querySelectorAll('.stat').length >= 5`))
  t = await text()
  check('Findings: 2 in place, 1 partly, 13 missing', /2\s+In place[\s\S]*1\s+Partly[\s\S]*13\s+Missing/.test(t))
  check('Findings: MFA proven share and to-set-up count over enabled users', /%\s+of enabled users proved MFA in the last 30 days/.test(t) && /\d+\s+enabled users to set up before enforcement/.test(t))
  check('Findings: grouped by domain by default', (await clickText('/needs attention/')) && (await waitFor(`[...document.querySelectorAll('select')].some(s => s.value === 'domain') && /Identity.*Admins/s.test(document.body.innerText)`)))
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
  check('Roadmap: This week card and the licence sentence', /This week/.test(t) && /With this tenant's Entra ID/.test(t))
  check('Roadmap: danger areas name the blocked user', /1 user is blocked today|Watch first\s+1/.test(t))
  check('Roadmap: Plan tab lists the verification campaign', (await clickText('/^Plan/')) && (await waitFor(`/Run the MFA verification campaign/.test(document.body.innerText)`)))
  check('Roadmap: Progress tab shows the journey', (await clickText('/^Progress/')) && (await waitFor(`/The journey/.test(document.body.innerText)`)))
  check('Roadmap: Schedule tab carries the dates and the calendar export', (await clickText('/^Schedule/')) && (await waitFor(`/Export to calendar/.test(document.body.innerText)`)))
  check('Roadmap: Do this next and History render', (await clickText('/^Progress/')) && (await waitFor(`/Do this next/.test(document.body.innerText) && /History/.test(document.body.innerText)`)))

  // Failure paths and first-visitor tenants (prompt 31 §4): every page reads clearly, nothing breaks.
  await send('Page.navigate', { url: `${BASE}&licence=free#/coverage` })
  await sleep(1500)
  check('Unlicensed tenant: Findings renders from configuration and directory data', await waitFor(`document.querySelectorAll('.stat').length >= 3`))
  t = await text()
  check('Unlicensed tenant: Findings says which goals need another licence', /goals need a licence tier this tenant does not have/.test(t))
  await send('Page.navigate', { url: `${BASE}&licence=free#/scan` })
  await sleep(1500)
  t = await text()
  check('Unlicensed tenant: sign-in records degrade with a plain reason', /not available on this licence \(needs Entra ID P1 or P2\)/.test(t))
  check('Unlicensed tenant: readiness says nothing can be Verified without records', /nothing can be Verified without usable records/.test(t))
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
  await send('Page.navigate', { url: `${BASE}&denied=1#/scan` })
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
  check('Forget: the button is there', await clickText('/^Forget this tenant/'))
  await sleep(1500)
  const after = tenantId ? await countFor(tenantId) : 0
  check('Forget: every store is empty for the tenant afterwards', after === 0, `rows=${after}`)
  check('Forget: no MSAL account remains in session storage', (await evaluate(`Object.keys(sessionStorage).filter((k) => /msal|login\.windows|microsoftonline/.test(k)).length`)) === 0)

  // Inventory and Licensing reachable
  await go('inventory')
  check('Inventory: policies table renders', await waitFor(`document.querySelectorAll('table tbody tr').length >= 3`))
  await go('licensing')
  t = await text()
  check('Licensing: Entra ID P1 detected', /Entra ID P1/.test(t))

  // The consent disclosure, generated from the scope list and the registry (prompt 34 part 1).
  await go('connect')
  await sleep(700)
  check(
    'Connect: the permissions disclosure opens and lists the scopes',
    (await clickText('/What IAMAI will ask for/')) && (await waitFor(`/Policy.Read.All/.test(document.body.innerText)`)),
  )
  t = await text()
  check('Connect: it says the permissions are read-only', /There is no write permission in the set/.test(t))
  check('Connect: it says what consent creates', /an enterprise application named IAMAI/.test(t))
  check('Connect: it gives the removal path', /Enterprise applications/.test(t) && /Properties . Delete|Properties → Delete/.test(t))
  check('Connect: a scope nothing uses says so rather than implying it is spent', /Not used by anything IAMAI runs today/.test(t))

  // The feedback channel shows the message before anything opens (prompt 34 part 2).
  await go('roadmap')
  await sleep(1200)
  check(
    'Feedback: the footer link opens the panel',
    (await clickText('/Something wrong or unclear/')) && (await waitFor(`/What the email will contain/.test(document.body.innerText)`)),
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
