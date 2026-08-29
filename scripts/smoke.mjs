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
const clickText = (re) => evaluate(`(() => { const b = [...document.querySelectorAll('a, button')].find(x => ${re}.test(x.textContent.trim())); if (b) b.click(); return !!b })()`)

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
  check('Roadmap: overview renders', await waitFor(`/of 18 steps in place/.test(document.body.innerText)`))
  t = await text()
  check('Roadmap: headline 2 of 18 steps in place, finishes', /2 of 18 steps in place · finishes /.test(t))
  check('Roadmap: tiles Ready today and Blocked', /\d+\s+Ready today/.test(t) && /\d+\s+Blocked/.test(t))
  check('Roadmap: danger areas name the blocked user', /1 user is blocked today|Watch first\s+1/.test(t))
  check('Roadmap: Plan tab lists the verification campaign', (await clickText('/^Plan/')) && (await waitFor(`/Run the MFA verification campaign/.test(document.body.innerText)`)))
  check('Roadmap: Progress tab shows the journey', (await clickText('/^Progress/')) && (await waitFor(`/The journey/.test(document.body.innerText)`)))
  check('Roadmap: Schedule tab carries owners and the calendar export', (await clickText('/^Schedule/')) && (await waitFor(`/Owners and dates/.test(document.body.innerText)`)))

  // Inventory and Licensing reachable
  await go('inventory')
  check('Inventory: policies table renders', await waitFor(`document.querySelectorAll('table tbody tr').length >= 3`))
  await go('licensing')
  t = await text()
  check('Licensing: Entra ID P1 detected', /Entra ID P1/.test(t))

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
