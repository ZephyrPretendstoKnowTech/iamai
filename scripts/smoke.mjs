// First-run smoke test (prompt 20 §10): starts the dev server, drives headless
// Chrome over the DevTools protocol with no dependencies beyond Node 22+, and
// walks Connect → Today → Plan → Export → How → Recovery
// against the synthetic tenant (?dev=1&mock=1), asserting the key numbers.
// The same fixture backs src/ui/consistency.test.ts, so the numbers asserted
// here are the ones the pure tests prove.
//
//   npm run smoke            (CHROME=/path/to/chrome to override the binary)
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

// No rendered surface and no downloaded artifact may carry a forbidEverywhere
// string (prompt 49.1 item 1): a placeholder token, a Setup mention, a raw URN.
const CONTRACTS = JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8'))
const FORBID_EVERYWHERE = CONTRACTS.forbidEverywhere ?? []
// Every export and the print speak from the content-driven step (prompt 53 queue
// item 7), so the plan.step contract's forbid list holds for them too.
const STEP_FORBID = (CONTRACTS.surfaces ?? []).find((c) => c.id === 'plan.step')?.forbid ?? []
// The print shows every step in full, More open, so More's own headings are not
// forbidden there (plan.step.more allows them).
const MORE_HEADINGS = (CONTRACTS.surfaces ?? []).find((c) => c.id === 'plan.step.more')?.allow?.headings ?? []
const PRINT_FORBID = [...FORBID_EVERYWHERE, ...STEP_FORBID.filter((f) => !MORE_HEADINGS.includes(f))]

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
// A fresh profile every run, as CI has: a second run on one machine otherwise
// inherits the demo record the first run's week-two visit seeded, and the
// record checks read the wrong order.
const profile = `${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-smoke-profile`
rmSync(profile, { recursive: true, force: true })
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${CDP_PORT}`, '--window-size=1440,1000', 'about:blank',
], { stdio: 'ignore' })
let targets = []
for (let i = 0; i < 300 && targets.length === 0; i++) {
  try {
    targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json()
  } catch {
    await sleep(200)
  }
}
const page = targets.find((t) => t.type === 'page')
if (!page) {
  console.error('smoke: Chrome exposed no page target within 60 s (a slow runner, or a Chrome that could not start)')
  chrome.kill()
  vite.kill()
  process.exit(2)
}
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
    // A poll that lands mid-navigation (the demo entry is a full page load, so
    // document.body is null for a moment) means "not yet", never a failed walk.
    let hit = false
    try {
      hit = (await evaluate(expr)) === true
    } catch {
      hit = false
    }
    if (hit) return true
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
  // The dev server fetches hundreds of modules; the resource timing buffer must hold them all for the demo-chunk checks.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'performance.setResourceTimingBufferSize(20000)' })
  // Capture downloads (produced bytes), swallow alerts (they would block the
  // headless page), and make print a no-op. It fires beforeprint but NOT
  // afterprint: the print DOM mounts on demand (prompt 49.1 item 4) and afterprint
  // tears it down, so the walk fires afterprint itself once it has read the page.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'window.__dl = []; window.__alerts = []; window.__printed = 0;' +
      'window.print = function () { try { window.dispatchEvent(new Event("beforeprint")); } catch (e) {} window.__printed++; };' +
      'window.alert = function (m) { window.__alerts.push(String(m)); };' +
      'var _c = URL.createObjectURL.bind(URL); URL.createObjectURL = function (b) { window.__lastBlob = b; return _c(b); };' +
      'var _k = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) { var b = window.__lastBlob; window.__dl.push({ name: this.download, size: b ? b.size : 0, blob: b }); return; } return _k.call(this); };',
  })
  await send('Page.navigate', { url: `${BASE}#code=abc&client_info=def&state=ghi` })
  // The first frame on a cold dev server takes longer than a fixed wait on CI (e1fc8ab):
  // wait for the header's first render, which is what the recorded hash is keyed to.
  await waitFor('window.__firstFrameHash !== undefined', 15000)
  check('Sign-in: an auth response in the fragment is intact when the first frame renders', (await evaluate('window.__firstFrameHash')) === '#code=abc&client_info=def&state=ghi', String(await evaluate('window.__firstFrameHash')))
  check('Sign-in: once auth has settled the page lands on Plan', await waitFor(`location.hash === '#/plan'`))

  // The demo chunk loads in demo mode and nowhere else: the signed-out page reads
  // the sample facts from the build-time module and never fetches src/ui/demo.ts.
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await waitFor(`document.querySelectorAll('main.page section.step-tile').length === 4`)
  check('Connect (signed out): the demo chunk is not loaded outside demo mode', !(await evaluate(`performance.getEntriesByType('resource').some((e) => /\\/src\\/ui\\/demo\\.ts|\\/src\\/ui\\/demoFacts\\.ts/.test(e.name))`)))
  t = await text()
  check('Connect (signed out): the sample facts are on the page without it', /\d+\s*steps/.test(t) && /already in place/.test(t))
  // A chunk that fails to load reloads the page once per session, then leaves the error page to the person.
  await evaluate(`sessionStorage.removeItem('iamai.preloadReloaded'); window.__stillHere = 1; window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))`)
  check('Preload failure: the page reloads once', await waitFor(`(performance.getEntriesByType('navigation')[0] || {}).type === 'reload' && window.__stillHere === undefined`, 8000))
  await waitFor(`document.querySelectorAll('main.page section.step-tile').length === 4`)
  const preloadAgain = await evaluate(`(() => { const e = new Event('vite:preloadError', { cancelable: true }); window.__stillHere = 2; window.dispatchEvent(e); return e.defaultPrevented })()`)
  await sleep(1500)
  check('Preload failure: a second failure in the session does not reload again', !preloadAgain && (await evaluate(`window.__stillHere === 2`)))

  // The walk (prompt 47 Part 6 item 23): Connect signed out, sign in (the mock state), the scan, Today, Inventory, then the legacy Roadmap.
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1200)
  t = await text()
  check('Connect (signed out): the heading, the sign-in tile with the consent sentence, Sign in with Microsoft and Try it with sample data', /Plan the journey to your Conditional Access baseline/.test(t) && /Sign in\s+no tenant connected/.test(t) && /every sign-in after that can be Global Reader/.test(t) && /Sign in with Microsoft/.test(t) && /Try it with sample data/.test(t) && !/Built for|What it catches|Connect a tenant/.test(t))

  // The consent disclosure, generated from the scope list and the registry (prompt 34 part 1), on the signed-out page (target-state §3).
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1000)
  check(
    'Connect: the permissions disclosure opens and lists the scopes',
    (await clickText('/What IAMAI asks for/')) && (await waitFor(`/Read your organization's policies/.test(document.body.innerText)`)),
  )
  t = await text()
  check('Connect: one consent row per tenant scope in Microsoft\'s wording, no table, no sign-in scopes', (await evaluate(`document.querySelectorAll('details.permissions .tile-rows li').length`)) === 6 && (await evaluate(`document.querySelectorAll('details.permissions table').length`)) === 0 && !/openid/.test(t))
  check('Connect: the collapsible ends with the removal line', /Remove it any time: Entra admin center → Enterprise applications → IAMAI Planner → Delete\./.test(t) && !/leaves nothing behind/.test(t))
  // Prompt 46 item 23: Application.Read.All is gone, so every requested scope
  // has a collector behind it and the "requested, not yet used" group is absent.
  check('Connect: no requested scope sits unused', !/Requested, not yet used/.test(t) && !/Application\.Read\.All/.test(t) && !/Used for/.test(t))
  // Walk fixes (prompt 47.1 Part 2): the permission name on one line, the prose at the page column.
  check('Connect: the tiles read at the page column, not the measure', (await evaluate(`Math.round(document.querySelector('main.page section.step-tile').getBoundingClientRect().width)`)) >= 700, String(await evaluate(`Math.round(document.querySelector('main.page section.step-tile').getBoundingClientRect().width)`)))

  await send('Page.navigate', { url: `${BASE}&state=noScan#/connect` })
  await sleep(1200)
  t = await text()
  check('Connect (no scan): Scan tenant and the ten-minute line', /Scan tenant/.test(t) && /About ten minutes\. Reads the tenant into this browser; nothing is sent anywhere\./.test(t))
  check('Connect (no scan): nothing about a plan yet', !/Open the plan/.test(t))
  await send('Page.navigate', { url: `${BASE}&state=scanning#/connect` })
  await sleep(1200)
  t = await text()
  check('Connect (scanning): the lane in plain words with the elapsed time, and Stop', /reading people · \d+s/.test(t) && /Stop/.test(t) && !/Scan tenant/.test(t), (t.match(/[^\n]*reading[^\n]*/) ?? [''])[0])
  check('Connect (scanning): the header tabs are disabled', (await evaluate(`[...document.querySelectorAll('header.app nav a[aria-disabled="true"]')].length`)) === 3)
  // Connect, scanned: who is signed in, the baseline line, the one-line result, Open the plan (target-state §3).
  await go('connect')
  await sleep(600)
  t = await text()
  // Connect as four tiles (docs/design/connect-mockup.html).
  check('Connect: tile 1 names the tenant, the account and its role', /Signed in\s+Contoso Pty Ltd/.test(t) && /alex@example\.com · Global Administrator/.test(t), (t.match(/Signed in[^\n]*/) ?? ['no signed-in line'])[0])
  check('Connect: tile 2 carries the baseline and its policy count', /Baseline\s+synthetic baseline · 1 polic(y|ies)/.test(t), (t.match(/Baseline[^\n]*/) ?? [''])[0])
  // The people fact counts what the plan counts: "N active people · of M enabled", never the directory's row count.
  check('Connect (scanned): the facts and Open the plan', /\d+\s*active people · of \d+ enabled/.test(t) && !/5\s*people/.test(t) && /3\s*policies/.test(t) && /[A-Z][a-z]{2} \d+ → [A-Z][a-z]{2} \d+\s*sign-in records/.test(t) && /Open the plan →/.test(t) && !/Scan complete · 5 people/.test(t), (t.match(/Scan complete[^\n]*/) ?? [''])[0])
  // Tile 3 reads Scan complete · N ago once; tile 4 reads Plan ready · from the scan N ago with the same words, from the one stored timestamp; nothing says scanned.
  check(
    "Connect (scanned): the scan's age once as Scan complete · N ago, Plan ready · from the scan with the same age, and no scanned line",
    (await waitFor(`/Plan\\s+ready · from the scan/.test(document.body.innerText)`)) &&
      (await evaluate(`(() => { const t = document.querySelector('main.page').innerText; const m = t.match(/Scan\\s+complete · ([^\\n]+)/); if (!m) return false; const age = m[1].trim(); return (t.match(/complete · [^\\n]+/g) || []).length === 1 && t.includes('ready · from the scan ' + age) && !/scanned/.test(t) })()`)),
    (t.match(/Plan\s+ready[^\n]*/) ?? [''])[0],
  )
  check('Connect (scanned): the plan facts count the steps and how many are done', await waitFor(`/\\d+\\s*steps · \\d+ done/.test(document.body.innerText)`, 20000), ((await text()).match(/\d+\s*steps · \d+ done/) ?? [''])[0])
  check('Connect: Global Reader is the only role IAMAI names', !/Security Reader|Reports Reader/.test(t))
  check('Connect (scanned): Change baseline opens the picker with two choices', (await clickText('/^Change baseline$/')) && (await waitFor(`/Upload a package/.test(document.body.innerText) && /How to make one →/.test(document.body.innerText)`)))
  // Today: where things are now, over active people (target-state §4).
  await go('today')
  check('Today: the table renders', await waitFor(`document.querySelectorAll('table.datatable tbody tr').length >= 4`))
  t = await text()
  check('Today: one line counts active people, enabled, admins and the sign-in window', /(\d+ active (person|people)|no enabled people) of \d+ enabled · (\d+ admins?|no admins) · sign-ins [A-Z][a-z]{2} \d+ → [A-Z][a-z]{2} \d+/.test(t), (t.match(/[^\n]*active (person|people)[^\n]*/) ?? [''])[0])
  // The tiles' labels are the table's state words; the grouping tile names its states.
  const tileLabels = await evaluate(`[...document.querySelectorAll('main.page .tile .stat-label')].map((e) => { const c = e.cloneNode(true); c.querySelectorAll('.infotip, .infotip-btn, button').forEach((n) => n.remove()); return (c.textContent || '').replace(/\\s+/g, ' ').trim() })`)
  check('Today: four tiles', tileLabels.length === 4 && tileLabels[0] === 'Proven' && tileLabels[1] === 'Likely works · Never prompted · Possibly broken' && tileLabels[2] === 'No method' && tileLabels[3] === 'Not active', tileLabels.join(' | '))
  check('Today: state words are the plain six', /Proven|Likely works|Never prompted|Possibly broken|No method|Not active/.test(t) && !/Verified|Looks healthy/.test(t))
  check('Today: no legend, no banner, no rollout tiles, no filter chips', !/Legend/.test(t) && !/To set up before enforcement/.test(t) && !/Sign-in records: complete/.test(t) && (await evaluate(`document.querySelectorAll('.filter-bar, .legend-card').length`)) === 0)
  check('Today: one Show dropdown and a search box', (await evaluate(`document.querySelectorAll('main.page select').length`)) === 1 && (await evaluate(`!!document.querySelector('main.page input[type=search]')`)))
  check('Today: the link to everything the scan read', /Everything the scan read →/.test(t))
  // Walk fixes (prompt 47.1 Part 2): markers stand off the name; no inner scroll; a hairline header, not a band.
  check('Today: the Admin marker stands off the name, small and quiet', await evaluate(`(() => { const c = document.querySelector('main.page td .chip:not(.status)'); if (!c) return false; const cs = getComputedStyle(c); return parseFloat(cs.marginLeft) >= 6 && cs.fontSize === '13px' })()`))
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
  await go('how')
  t = await text()
  check('How IAMAI works: the reference page renders with its sections', /How IAMAI works/.test(t) && /Permissions/.test(t) && /What IAMAI reads/.test(t) && /Every check IAMAI runs/.test(t) && /Baseline packages/.test(t) && /Limits/.test(t))
  check('How: the old reference routes redirect here', (await (async () => { await send('Page.navigate', { url: `${BASE}#/checks` }); await sleep(600); return await waitFor(`location.hash === '#/how'`) })()))



  // The old names redirect (target-state §2, prompt 47 Part 3).
  await go('start')
  check('Start redirects to Connect', await waitFor(`location.hash === '#/connect'`))
  await go('baseline')
  check('Baseline redirects to Connect', await waitFor(`location.hash === '#/connect'`))
  await go('scan')
  check('Scan redirects to Today', await waitFor(`location.hash === '#/today'`))
  await go('roadmap')
  check('Roadmap redirects to Plan', await waitFor(`location.hash === '#/plan'`))
  await go('reads')
  check('What IAMAI reads redirects to How', await waitFor(`location.hash === '#/how'`))
  await go('licensing')
  check('Licensing redirects to How', await waitFor(`location.hash === '#/how'`))
  await go('plan')
  const __planOk = await waitFor(`/#\\/plan/.test(location.hash) && /[0-9]+ steps/.test(document.body.innerText)`)
  check('Plan renders at #/plan', __planOk, __planOk ? '' : `hash=${await evaluate('location.hash')} main=${(await evaluate(`(document.querySelector('main.page')||{}).innerText||'(no main)'`)).slice(0, 140).replace(/\s+/g, ' ')}`)
  // The Plan surface (target-state §5): two header lines, numbered phases, the footer.
  let pt = await text()
  check('Plan: the header counts steps, in place and the finish', /\d+ steps . \d+ in place . (finishes |the plan cannot finish)/.test(pt), (pt.match(/[^\n]*in place[^\n]*/) ?? [''])[0])
  check('Plan: line two points at Today; the tenant and the scan age live on Connect alone', /Today shows where each person stands/.test(pt) && !/scanned|Built from what IAMAI found on/.test(pt))
  // The Start date proposes today in the display zone (a weekend: the Monday after), in the same control as Plan settings' inputs, its label spaced.
  const startField = await evaluate(`(() => { const l = document.querySelector('main.page .plan-start label.rows'); const i = l && l.querySelector('input[type=date]'); if (!i) return null; const cs = getComputedStyle(l); const ci = getComputedStyle(i); return { value: i.value, display: cs.display, gap: cs.columnGap, padTop: ci.paddingTop, borderBottom: ci.borderBottomWidth } })()`)
  const startZone = await evaluate(`(async () => { try { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); if (!db.objectStoreNames.contains('mapping')) { db.close(); return null } const rows = await new Promise((r) => { const q = db.transaction('mapping').objectStore('mapping').getAll(); q.onsuccess = () => r(q.result) }); db.close(); const m = rows.find((x) => x && x.displayTimeZone); return m ? m.displayTimeZone : null } catch { return null } })()`)
  const startToday = await evaluate(`new Intl.DateTimeFormat('en-CA', { timeZone: ${JSON.stringify(startZone)} || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())`)
  const startShift = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
  const startDow = new Date(`${startToday}T12:00:00Z`).getUTCDay()
  const startExpected = startDow === 6 ? startShift(startToday, 2) : startDow === 0 ? startShift(startToday, 1) : startToday
  check('Plan: the Start date proposes today in the display zone', !!startField && startField.value === startExpected, `${startField && startField.value} vs ${startExpected} (${startZone ?? 'browser zone'})`)
  check("Plan: the Start date field is a spaced row in Plan settings' control style", !!startField && startField.display === 'flex' && parseFloat(startField.gap) >= 8 && startField.padTop === '0px' && startField.borderBottom === '1px', JSON.stringify(startField))
  check('Plan: phases render as sections with a next mark', (await evaluate(`document.querySelectorAll('main.page .phase').length`)) >= 1 && (await evaluate(`document.querySelectorAll('main.page .plan-row').length`)) >= 3 && /next/.test(pt))
  check('Plan: opening a row shows the content-driven step', (await evaluate(`(() => { const r = document.querySelector('main.page .plan-row'); if (r) r.click(); return !!r })()`)) && (await waitFor(`/Why/.test(document.body.innerText) && /What to do/.test(document.body.innerText) && /Done when/.test(document.body.innerText)`)))
  check('Plan: the step title is nine words at most', await evaluate(`[...document.querySelectorAll('main.page .step-title')].every((e) => (e.textContent || '').trim().split(/\s+/).length <= 9)`))
  // A policy step's What-to-do tabs (Portal steps, JSON, PowerShell) and the
  // Download JSON artifact never carry a forbidEverywhere string. Open the row of
  // a policy step until the tabs render.
  await evaluate(`(async () => { const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); for (const r of [...document.querySelectorAll('main.page .plan-row')]) { r.click(); await wait(140); if (document.querySelector('main.page .step-body .tabs .tab')) return true; r.click(); await wait(40); } return false })()`)
  if (await evaluate(`!!document.querySelector('main.page .step-body .tabs .tab')`)) {
    for (const tabLabel of ['JSON', 'PowerShell', 'Portal steps']) { await clickText(`/^${tabLabel}$/`); await sleep(120) }
    const stepText = await evaluate(`(document.querySelector('main.page .step-body') || {}).textContent || ''`)
    const stepHits = FORBID_EVERYWHERE.filter((f) => stepText.includes(f))
    check('Step: the What-to-do tabs carry no forbidden placeholder', stepHits.length === 0, stepHits.join('; '))
    await clickText('/^Download JSON$/'); await sleep(200)
  }
  check('Plan: Plan settings opens the popover', (await clickText('/^Plan settings$/')) && (await waitFor(`document.querySelector('main.page .plan-settings') !== null`)))
  check('Plan: the footer names its groups', ((await evaluate(`[...document.querySelectorAll('main.page .plan-footer summary')].map((s) => s.textContent).join(' ')`)).match(/Already in place|Doesn't apply here|Not licensed|Housekeeping/g) || []).length >= 1)
  check('Plan: one status word per row', await evaluate(`[...document.querySelectorAll('main.page .plan-row .chip.status')].length >= 3`))
  check('Plan: no v2 vocabulary on the surface', !/Do it|Exit criteria|Assumes|Recovery card|Before anything else|handle-with-care/.test(pt) && !/ Wave /.test(pt))

  // Click a control by its exact visible label (a button, link or summary).
  const clickExact = (label, root = 'main.page') =>
    evaluate(`(() => { const r = document.querySelector(${JSON.stringify(root)}) ?? document; const b = [...r.querySelectorAll('button, a, summary')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (b) b.click(); return !!b })()`)

  // Export (target-state §7): six cards, every button makes bytes, and the plan
  // file round-trips carrying the tick just made.
  await go('export')
  await waitFor(`document.querySelectorAll('main.page .export-card').length >= 6`)
  check('Export: six cards render', (await evaluate(`document.querySelectorAll('main.page .export-card').length`)) === 6)
  for (const label of ['Download calendar (ICS)', 'Today as CSV', 'Download every prompt', 'Download the bundle']) {
    const before = await evaluate(`window.__dl.length`)
    const clicked = await clickExact(label)
    await sleep(350)
    const grew = await evaluate(`window.__dl.length > ${before} && window.__dl[window.__dl.length - 1].size > 0`)
    check(`Export: "${label}" produces bytes`, clicked && grew)
  }
  const printed = await clickExact('Print or save as PDF')
  await sleep(200)
  check('Export: Print or save as PDF prints the document', printed && (await evaluate(`window.__printed >= 1`)))
  check('Export: the print document renders its cover', /Conditional Access rollout plan/.test(await evaluate(`(document.querySelector('.print-plan .print-cover h1') || {}).textContent || ''`)))
  // Read while the print DOM is up: Load a plan file (below) lands on the plan and unmounts it.
  const printText = await evaluate(`(document.querySelector('.print-plan') || {}).textContent || ''`)
  const printHits = PRINT_FORBID.filter((f) => printText.includes(f))
  check('Export: the print document carries no forbidden placeholder or step vocabulary', printHits.length === 0, printHits.join('; '))
  // The rebuilt print shows the step content, not the old pre-48 body (item 3).
  check('Export: the print renders the step body, not the old fields', /Who this touches/.test(printText) && !/Proposed name:|What the last 30 days say/.test(printText), `${(printText.match(/Proposed name:|What the last 30 days say/) ?? ['no old field'])[0]}; ${printText.replace(/\s+/g, ' ').slice(0, 220)}`)
  // Item 4: the print DOM lives only while printing; afterprint tears it down.
  await evaluate(`window.dispatchEvent(new Event('afterprint'))`)
  await sleep(200)
  check('Export: the print DOM is gone once printing ends', (await evaluate(`document.querySelector('.print-plan') === null`)))
  const nBefore = await evaluate(`window.__dl.length`)
  await clickExact('Save plan file')
  await sleep(450)
  check('Export: Save plan file produces bytes', await evaluate(`window.__dl.length > ${nBefore} && window.__dl[window.__dl.length - 1].size > 0`))
  const planJson = await evaluate(`(async () => { const d = window.__dl[window.__dl.length - 1]; return d && d.blob ? await d.blob.text() : null })()`)
  check('Export: the saved plan carries its steps', typeof planJson === 'string' && /"steps"\s*:/.test(planJson))
  // The saved bytes parse back to a plan with its steps. The plan file is the
  // person's own working state and leaves unredacted, so a reload into the same
  // tenant passes the tenant guard; the demo section below saves and loads one
  // and asserts the plan re-renders the same.
  const reparsed = typeof planJson === 'string' ? JSON.parse(planJson) : null
  check('Export: the plan file round-trips (parses back with its steps)', !!reparsed && Array.isArray(reparsed.steps) && reparsed.steps.length >= 3)
  if (typeof planJson === 'string') {
    const ran = await evaluate(`(() => { const input = document.querySelector('main.page input[type=file]'); if (!input) return false; const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(planJson)}], 'plan.json', { type: 'application/json' })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    await sleep(700)
    check('Export: Load a plan file runs the import path', ran && (await evaluate(`window.__alerts.length > 0 || location.hash === '#/plan'`)))
  }

  // Item 1: every artifact generated so far (the step JSON, ICS, CSVs, prompts,
  // bundle, plan file) carries no forbidEverywhere string. urn:user:… is the one
  // exception a raw policy body needs (item 7), so it is allowed inside a .json
  // artifact (the Download JSON and the plan file) and forbidden everywhere else.
  const artifactHits = await evaluate(
    `(async () => { const bad = ${JSON.stringify(FORBID_EVERYWHERE)}; const out = []; for (const d of window.__dl) { if (!d.blob) continue; const t = await d.blob.text(); const isJson = /\\.json$/.test(d.name); for (const f of bad) { if (f === 'urn:user:' && isJson) continue; if (t.includes(f)) out.push(d.name + ': ' + f) } } return out })()`,
  )
  check('Export: no downloaded artifact carries a forbidden placeholder', artifactHits.length === 0, artifactHits.join('; '))

  // The header (target-state §2, docs/design/connect-mockup.html): wordmark, tabs, theme, Account. No scan control: the scan runs from Connect, which alone shows the tenant and the scan's age.
  await go('plan')
  await waitFor(`/\\bsteps\\b/.test(document.body.innerText)`)
  t = await evaluate(`document.querySelector('header.app').innerText`)
  check('Header: the three tabs and the controls, no tenant tab (the tenant is on Connect)', !/Contoso Pty Ltd/.test(t) && /Today/.test(t) && /Plan/.test(t) && /Export/.test(t) && !/Recovery card/.test(t) && /Account/.test(t), t.replace(/\s+/g, ' ').slice(0, 120))
  check('Name: the wordmark is IAMAI Planner and the tab title carries the descriptor', /^IAMAI Planner/.test(t.trim()) && (await evaluate('document.title')) === 'IAMAI Planner — Conditional Access rollout planner', await evaluate('document.title'))
  check('Header: no scan control and no scan age on any page', !/Scan to update the plan|scanned|Re-scan/.test(t), t.replace(/\s+/g, ' ').slice(0, 120))
  check('Header: the theme and Account controls are text, not button faces', await evaluate(`document.querySelectorAll('header.app .right button').length >= 2 && [...document.querySelectorAll('header.app .right button')].every((b) => { const cs = getComputedStyle(b); return cs.borderTopWidth === '0px' && cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.paddingLeft === '0px' })`))
  check('Header: no sidebar, no stepper', (await evaluate(`document.querySelectorAll('.stepper, .body-grid, .topbar').length`)) === 0)
  check('Header: the theme control names the mode it switches to', /Light theme|Dark theme/.test(t))
  await send('Page.navigate', { url: `${BASE}&state=noScan#/plan` })
  await sleep(1200)
  check('Header (no scan): the tabs are disabled until the first scan', (await evaluate(`[...document.querySelectorAll('header.app nav a[aria-disabled="true"]')].length`)) === 3 && (await evaluate(`document.querySelector('header.app nav a').title`)) === 'after the first scan')
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1200)
  t = await evaluate(`document.querySelector('header.app').innerText`)
  check('Header (signed out): only the wordmark and the theme control', /IAMAI/.test(t) && !/Today|Account|Recovery/.test(t), t.replace(/\s+/g, ' '))

  // Failure paths and first-visitor tenants (prompt 31 §4): every page reads clearly, nothing breaks.
  await send('Page.navigate', { url: `${BASE}&licence=free#/plan` })
  await sleep(1500)
  check('Unlicensed tenant: the plan renders from configuration and directory data', await waitFor(`/[0-9]+ steps/.test(document.body.innerText)`))
  t = await text()
  check('Unlicensed tenant: the plan footer names what is not licensed', /Not licensed \(\d+\)/.test(t))
  await send('Page.navigate', { url: `${BASE}&licence=free#/today` })
  await sleep(1500)
  t = await text()
  check('Unlicensed tenant: Today says why there are no sign-in records', /no sign-in records \(needs Entra ID P1 or P2\)/.test(t), (t.match(/[^\n]*sign-in records[^\n]*/) ?? [''])[0])
  // The Show list carries the content file's state names, "Proven" included (walk-51 item 10),
  // so the check reads the table's state chips, not the page text.
  check('Unlicensed tenant: nobody is Proven without records', !(await evaluate(`[...document.querySelectorAll('main.page td .status, main.page td .chip')].some((e) => /^Proven$/.test((e.textContent || '').trim()))`)))
  await send('Page.navigate', { url: `${BASE}&licence=free#/plan` })
  await sleep(1500)
  check('Unlicensed tenant: the plan still generates', await waitFor(`/[0-9]+ steps/.test(document.body.innerText)`))
  t = await text()
  // The ladder steps carry the data file's names as their titles (prune C).
  const ladderNames = JSON.parse(readFileSync('data/free-tier-ladder.json', 'utf8')).items.map((i) => i.name)
  check('Unlicensed tenant: the ladder steps are the plan', ladderNames.filter((n) => t.includes(n)).length >= 2, ladderNames.filter((n) => t.includes(n)).join(' | '))
  t = await text()
  check('Unlicensed tenant: nothing asks for objects a policy would reference', !/Create a trusted named location|Create the exclusions group/.test(t))
  check(
    'Unlicensed tenant: a step opens in place',
    (await evaluate(`(() => { const r = document.querySelector('main.page .plan-row'); if (r) r.click(); return !!r })()`)) &&
      (await waitFor(`document.querySelector('main.page .step-body') !== null`)),
  )
  await send('Page.navigate', { url: `${BASE}&policies=0#/plan` })
  await sleep(1500)
  check('Zero policies: the plan renders', await waitFor(`/[0-9]+ steps/.test(document.body.innerText)`))
  await send('Page.navigate', { url: `${BASE}&policies=0#/plan` })
  await sleep(1500)
  check('Zero policies: the plan renders', await waitFor(`/[0-9]+ steps/.test(document.body.innerText)`))
  t = await text()
  // A sign-in with too little access names the role to ask for (prompt 31 4.18).
  // The refused-sections notice lives with the scan result, on Connect (prompt 47 Part 4).
  await send('Page.navigate', { url: `${BASE}&state=gaps#/connect` })
  await sleep(1500)
  check('Scan with gaps: the tile says so and builds no plan', await waitFor(`/finished with gaps · no plan built/.test(document.body.innerText)`))
  t = await text()
  check('Scan with gaps: the unread sections are rows marked not read', /Conditional Access policies\s*not read/.test(t) && /Sign-in records\s*not read/.test(t))
  check('Scan with gaps: the one ask is Global Reader, read-only', /Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing\./.test(t) && !/Security Reader|Reports Reader/.test(t))
  check('Scan with gaps: the last full plan stays open', /Open the last full plan \([A-Z][a-z]{2} \d+\)/.test(t) && !/Open the plan →/.test(t))

  check('No page threw', consoleErrors.filter((e) => !/authmethods|Not signed in|favicon/.test(e)).length === 0, consoleErrors.filter((e) => !/authmethods|Not signed in|favicon/.test(e)).slice(0, 2).join(' | '))

  // Forget this tenant clears every store for it (prompt 31 §2.8).
  await go('plan')
  await waitFor(`/[0-9]+ steps/.test(document.body.innerText)`)
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

  // The rule registry renders itself (validation-rules.md 5).
  await go('checks')
  t = await text()
  check('Checks: the reference page lists the registry by subject', /Every check IAMAI runs/.test(t) && /Emergency access accounts/.test(t) && /The exclusions group/.test(t))
  check('Checks: the severities render', /Must fix/.test(t) && /Recommended/.test(t) && /Note/.test(t))
  check('Checks: a break-glass rule is on the page in plain language', /Global Administrator is assigned permanently and active/.test(t))
  // Every check names its source, and the ones nobody documents say so (audit-program 6).
  check('Checks: every rule names a source', /Source/.test(t) && /Microsoft: manage emergency access accounts/.test(t))
  check('Checks: field practice is labelled rather than dressed up as Microsoft', /Field practice/.test(t))

  // Accessible names, from Chrome's own accessibility tree rather than from our
  // own name computation (prompt 42 §17, review-09 finding 16). Whether a screen
  // reader announces something is not our judgement to make, so this asks the
  // browser, in both themes, and reports what it says.
  for (const theme of ['light', 'dark']) {
    await send('Page.navigate', { url: `${BASE}#/plan` })
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

  // Item 7 (prompt 50.1): the first click on Sign in with Microsoft, right after
  // the page loads, starts the flow. The button warms up (initialize plus a real
  // fetch of the authority metadata) carrying a spinner but staying clickable; a
  // click made during the warm is queued and fires when ready, so the first click
  // always lands where it used to do nothing until the second. This tests the
  // real authority metadata fetch, not the mock: authReady fetches
  // login.microsoftonline.com's metadata, and loginRedirect writes its request to
  // sessionStorage before it navigates, so a click that started the flow leaves
  // that trace and a no-op leaves none.
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  // Click as soon as the button exists — during the warm — not after it settles.
  await waitFor(`!!document.querySelector('.connect .actions button')`)
  // The warming button carries a spinner but is not disabled, so an early click lands.
  const clickable = await evaluate(`(() => { const b = document.querySelector('.connect .actions button'); return !!b && !b.disabled })()`)
  const clickedSignIn = await clickText('/Sign in with Microsoft/')
  await sleep(2800)
  // The queued click navigated away once ready; come back to the app's origin and
  // read the trace it left. The signed-out mock never runs initAuth, so nothing clears it.
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1000)
  const msalTrace = await evaluate(`Object.keys(sessionStorage).filter((k) => /msal|login\\.windows|microsoftonline/.test(k)).length`)
  check('Sign-in: the warming button is clickable so an early click is not lost (item 7)', clickable)
  check('Sign-in: the first click after load starts the flow, via the real metadata fetch (item 7)', clickedSignIn && msalTrace > 0, `sign-in trace keys=${msalTrace}`)

  // The demo (prompt 50 item 16): a stranger enters from Connect with no
  // sign-in, walks the whole flow, advances to week two and back, leaves, and no
  // real tenant's storage is touched. Every demo store keys on the demo tenant
  // id; any other tenant id is a real one. In-demo navigation sets the hash so
  // the demo query survives (go() rebuilds the URL from BASE and would drop it).
  const DEMO_TENANT_ID = 'demo-sample-tenant'
  const realKeys = () =>
    evaluate(`(async () => { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); const out = []; for (const name of [...db.objectStoreNames]) { const tx = db.transaction(name); const rows = await new Promise((r) => { const q = tx.objectStore(name).getAll(); q.onsuccess = () => r(q.result) }); for (const x of rows) if (x && x.tenantId && x.tenantId !== ${JSON.stringify(DEMO_TENANT_ID)}) out.push(name + ':' + x.tenantId) } db.close(); return out.sort() })()`)
  const demoGo = async (hash) => {
    await evaluate(`location.hash = ${JSON.stringify('#/' + hash)}`)
    await sleep(900)
  }
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1500)
  const realBefore = await realKeys()
  check('Demo: Connect offers the sample-data entry (item 12)', await waitFor(`/Try it with sample data/.test(document.body.innerText)`))
  const demoErrBase = consoleErrors.length
  // Enter the demo by the link a visitor clicks, not by a crafted URL.
  await clickText('/Try it with sample data/')
  check('Demo: entering lands on the plan under the sample-data banner', await waitFor(`location.hash === '#/plan' && /Sample data/.test(document.body.innerText)`))
  await sleep(600)
  let demoText = await text()
  const demoDay1Header = (demoText.match(/[^\n]*\d+ in place[^\n]*/) ?? [''])[0].trim()
  check('Demo: the banner says nothing is from a real tenant and offers to leave', /Sample data . nothing here is from a real tenant/.test(demoText) && /Leave the demo/.test(demoText))
  check('Demo: the plan header counts steps, in place and the finish', /\d+ steps . \d+ in place . (finishes |nothing is dated)/.test(demoText), demoDay1Header)
  check('Demo: the demo chunk loads in demo mode', await evaluate(`performance.getEntriesByType('resource').some((e) => /\\/src\\/ui\\/demo\\.ts/.test(e.name))`))
  check('Demo: the header carries the sample-data banner, not the org name', !/Contoso Pty Ltd/.test(await evaluate(`document.querySelector('header.app').innerText`)) && /Sample data/.test(await text()))
  // Item 4: a readiness-held step renders as a Blocked row whose date column
  // reads the reason in the 46 shape, not a date.
  const whenCols = await evaluate(`[...document.querySelectorAll('main.page .plan-row .when')].map((e) => e.textContent.trim()).join(' | ')`)
  // Any family: the demo's held rows are the MFA ones now that the device and admin session gates are gone (E9).
  check('Demo: a readiness-held step reads its reason in the date column', /when [A-Za-z ]*readiness reaches \d+% \(now \d+%\)/.test(whenCols), (whenCols.match(/when [A-Za-z ]*readiness reaches[^|]*/) ?? ['none'])[0].trim())

  // Two steps: open two plan rows, each shows its step body.
  let demoOpened = 0
  const demoRows = await evaluate(`document.querySelectorAll('main.page .plan-row').length`)
  for (let i = 0; i < demoRows && demoOpened < 2; i++) {
    await evaluate(`(() => { const r = document.querySelectorAll('main.page .plan-row')[${i}]; if (r) r.click(); return true })()`)
    await sleep(250)
    if (await evaluate(`!!document.querySelector('main.page .step-body')`)) {
      demoOpened++
      await evaluate(`(() => { const r = document.querySelectorAll('main.page .plan-row')[${i}]; if (r) r.click(); return true })()`)
      await sleep(120)
    }
  }
  check('Demo: two steps open and show their detail', demoOpened >= 2)

  // Save plan file, then Load a plan file, on the same tenant: the plan file is
  // the person's own working state, unredacted, so what was decided, dated and
  // skipped before the save renders again after the load.
  let openNote = ''
  const openRow = async (re) => {
    await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`, 6000)
    const i = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].findIndex((r) => ${re}.test(r.textContent) && r.closest('.plan-footer') === null)`)
    const n = await evaluate(`document.querySelectorAll('main.page .plan-row').length`)
    if (i < 0) {
      openNote = `no row matching ${re} among ${n} at ${await evaluate('location.hash')}: ${await evaluate(`[...document.querySelectorAll('main.page .plan-row .step-title')].map((e) => e.textContent.trim()).slice(0, 6).join(' | ')`)}`
      return false
    }
    await evaluate(`document.querySelectorAll('main.page .plan-row')[${i}].click()`)
    const opened = await waitFor(`document.querySelector('main.page .step-body') !== null`, 4000)
    if (!opened) openNote = `row ${i} of ${n} did not open at ${await evaluate('location.hash')}`
    return opened
  }
  const mainText = () => evaluate(`(document.querySelector('main.page') || document.body).innerText`)
  const planRecord = () =>
    evaluate(
      `(async () => { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); const tx = db.transaction('plan'); const v = await new Promise((r) => { const q = tx.objectStore('plan').get('demo-sample-tenant'); q.onsuccess = () => r(q.result) }); db.close(); if (!v || typeof v !== 'object') return null; const d = v.decisions ?? v; return JSON.stringify({ skips: d.skips ?? null, startDate: d.startDate ?? null, stepDecisions: d.stepDecisions ?? null }) })()`,
    )
  // A decision: the service-accounts picker's Save.
  await demoGo('plan')
  await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
  let decided = false
  let decideNote = ''
  if (await openRow('/Service Accounts Group/')) {
    decideNote = await evaluate(`[...document.querySelectorAll('main.page .step-body button')].map((b) => b.textContent.trim()).join('|')`)
    decided = await clickText('/^Save$/', 'main.page .step-body .decision')
    await sleep(400)
  }
  check('Demo: a picker decision is saved', decided, decideNote || openNote)
  // A skip: Block the Admin Portals for Non-Admins, from its More.
  await demoGo('plan')
  let skipped = false
  let skipNote = ''
  if (await openRow('/Block the Admin Portals/')) {
    await evaluate(`(() => { const d = document.querySelector('main.page .step-body details.more'); if (d) d.open = true })()`)
    await sleep(150)
    if (await clickText('/^Put this step back$/', 'main.page .step-body')) {
      await sleep(400)
      await demoGo('plan')
      await openRow('/Block the Admin Portals/')
      await evaluate(`(() => { const d = document.querySelector('main.page .step-body details.more'); if (d) d.open = true })()`)
      await sleep(150)
    }
    skipNote = await evaluate(`[...document.querySelectorAll('main.page .step-body button')].map((b) => b.textContent.trim()).join('|')`)
    skipped = await clickText('/^Skip this step$/', 'main.page .step-body')
    await sleep(400)
  }
  check('Demo: a step is skipped', skipped && (await waitFor(`[...document.querySelectorAll('main.page .plan-row')].some((r) => /Block the Admin Portals/.test(r.textContent) && /Skipped/.test(r.textContent))`, 4000)), skipNote || openNote)
  // A start date, in the plan settings.
  await demoGo('plan')
  await clickText('/^Plan settings$/')
  await sleep(200)
  const dateSet = await evaluate(`(() => { const el = document.querySelector('main.page input[type=date]'); if (!el) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '2026-10-05'); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  await sleep(400)
  // Close the settings so the page reads as it will after the reload.
  await clickText('/^Close$/')
  await sleep(200)
  check('Demo: the plan start is set', dateSet, await evaluate(`(() => { const el = document.querySelector('main.page input[type=date]'); return el ? 'value=' + el.value + ' label=' + ((el.closest('label') || {}).textContent || '').trim().slice(0, 40) + ' hash=' + location.hash : 'no date input' })()`))
  const recordBefore = await planRecord()
  check(
    'Demo: the record holds the decision, the skip and the start',
    typeof recordBefore === 'string' && /"stepDecisions":\{[^}]*"s-prereq-service-accounts-group"/.test(recordBefore) && /"skips":\{[^}]*"s-goal-admin-portals-protected"/.test(recordBefore) && /"startDate":"2026-10-05/.test(recordBefore),
    String(recordBefore).slice(0, 200),
  )
  await demoGo('plan')
  await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
  const planTextBefore = await mainText()
  await demoGo('export')
  await waitFor(`document.querySelectorAll('main.page .export-card').length >= 6`)
  const dlBefore = await evaluate(`window.__dl.length`)
  await clickExact('Save plan file')
  await sleep(450)
  const demoPlanJson = await evaluate(`(async () => { const d = window.__dl[window.__dl.length - 1]; return window.__dl.length > ${dlBefore} && d && d.blob ? await d.blob.text() : null })()`)
  check(
    'Demo: Save plan file carries the tenant id, the decision, the skip and the start',
    typeof demoPlanJson === 'string' && /"id":\s*"demo-sample-tenant"/.test(demoPlanJson) && /"s-prereq-service-accounts-group"/.test(demoPlanJson) && /"s-goal-admin-portals-protected"/.test(demoPlanJson) && /2026-10-05/.test(demoPlanJson),
  )
  const alertsBefore = await evaluate(`window.__alerts.length`)
  const loaded =
    typeof demoPlanJson === 'string' &&
    (await evaluate(`(() => { const input = document.querySelector('main.page input[type=file]'); if (!input) return false; const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(demoPlanJson)}], 'plan.json', { type: 'application/json' })); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); return true })()`))
  check(
    'Demo: Load a plan file takes the saved file back, with no tenant refusal',
    loaded && (await waitFor(`location.hash === '#/plan'`, 6000)) && (await evaluate(`window.__alerts.length`)) === alertsBefore,
    String(await evaluate(`window.__alerts.slice(-1)[0] || ''`)).slice(0, 120),
  )
  await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
  await sleep(500)
  const recordAfter = await planRecord()
  const planTextAfter = await mainText()
  const firstDiff = (a, b) => { const i = [...a].findIndex((ch, k) => ch !== b[k]); return i < 0 ? '' : `at ${i}: "${a.slice(Math.max(0, i - 40), i + 60).replace(/\s+/g, ' ')}" vs "${b.slice(Math.max(0, i - 40), i + 60).replace(/\s+/g, ' ')}"` }
  check('Demo: the loaded plan re-renders with the same decisions, start date and skips', recordAfter === recordBefore, recordAfter === recordBefore ? '' : firstDiff(String(recordBefore), String(recordAfter)))
  check('Demo: the loaded plan renders the same rows as before the save', planTextAfter === planTextBefore, planTextAfter === planTextBefore ? '' : firstDiff(planTextBefore, planTextAfter))

  // Today renders over the sample people.
  await demoGo('today')
  check('Demo: Today renders over the sample people', await waitFor(`document.querySelectorAll('main.page table.datatable tbody tr').length >= 4`))

  // Export: print page 1 is the posture summary (item 8).
  await demoGo('export')
  await waitFor(`document.querySelectorAll('main.page .export-card').length >= 6`)
  const demoPrinted = await clickExact('Print or save as PDF')
  await sleep(300)
  const demoCover = await evaluate(`(document.querySelector('.print-plan .print-cover') || {}).textContent || ''`)
  check(
    'Demo: print page 1 renders the posture summary',
    demoPrinted && /Conditional Access rollout plan/.test(demoCover) && /Tenant/.test(demoCover) && /Scanned/.test(demoCover) && /Baseline/.test(demoCover) && /In place \(/.test(demoCover) && /To do \(/.test(demoCover) && /Doesn't apply \(/.test(demoCover),
  )
  await evaluate(`window.dispatchEvent(new Event('afterprint'))`)
  await sleep(200)

  // Re-scan advances to week two, and a second Re-scan returns to day one
  // (item 14). By week two the exclusions-group step is done and two Wave 1
  // policies are in report-only, so the plan differs in its rows and the header's
  // "in place" count rises (prompt 50.1 item 5) — the fix a decisions-only record
  // makes possible: the ratchet no longer pins day-one statuses across the scan.
  await demoGo('plan')
  await waitFor(`/Sample data/.test(document.body.innerText)`)
  await sleep(400)
  // The plan may still be a chunk away on a slow runner (the surfaces load on
  // demand since prompt 53): wait for its rows, and never read a missing main.
  const planBody = async () => {
    await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
    return evaluate(`(document.querySelector('main.page') || document.body).innerText`)
  }
  const headerOf = (body) => (body.match(/[^\n]*\d+ in place[^\n]*/) ?? [''])[0].trim()
  const inPlaceOf = (body) => Number((body.match(/(\d+) in place/) ?? [])[1] ?? '0')
  const day1Body = await planBody()
  const day1Header = headerOf(day1Body)
  // The header has no scan control: the demo's Scan again lives on Connect's
  // Scan tile, and a hash change keeps the page (and the week) alive.
  const demoScanAgain = async () => {
    await demoGo('connect')
    await waitFor(`[...document.querySelectorAll('main.page section.step-tile button')].some((b) => /^Scan again$/.test((b.textContent || '').trim()))`)
    return clickText('/^Scan again$/', 'main.page')
  }
  check('Demo: Connect offers Scan again', await demoScanAgain())
  check('Demo: Scan again advances to the week-two snapshot', await waitFor(`/Sample data . week 2/.test(document.body.innerText)`))
  await demoGo('plan')
  // The week-two snapshot reloads asynchronously (a dynamic import, then a
  // regenerate); the banner flips first. Poll the plan until its body changes
  // from day one, so the check proves the plan advanced, not just the banner.
  let week2Body = day1Body
  for (let i = 0; i < 25; i++) {
    await sleep(200)
    week2Body = await planBody()
    if (week2Body !== day1Body) break
  }
  const demoWeek2Header = headerOf(week2Body)
  check('Demo: the week-two plan differs in its rows from day one', week2Body !== day1Body, demoWeek2Header)
  check(
    'Demo: week two raises the header in-place count',
    inPlaceOf(week2Body) > inPlaceOf(day1Body),
    `day one: "${day1Header}" -> week two: "${demoWeek2Header}"`,
  )
  await demoScanAgain()
  check('Demo: a second Scan again returns to day one', await waitFor(`/Sample data . nothing here is from a real tenant/.test(document.body.innerText)`))

  // Leave the demo: back to the signed-out app, no banner (item 12).
  await clickText('/Leave the demo/', '.demo-banner')
  check('Demo: Leave returns to Connect with the banner gone', (await waitFor(`location.hash === '#/connect'`)) && !/Sample data/.test(await text()))

  const realAfter = await realKeys()
  check(
    'Demo: no real tenant storage was touched by the demo',
    realBefore.length === realAfter.length && realBefore.every((k, i) => k === realAfter[i]),
    `before=[${realBefore.join(', ')}] after=[${realAfter.join(', ')}]`,
  )
  check(
    'Demo: no console errors during the demo walk',
    consoleErrors.slice(demoErrBase).filter((e) => !/authmethods|favicon|microsoftonline|net::|ERR_/.test(e)).length === 0,
    consoleErrors.slice(demoErrBase).slice(0, 3).join(' | '),
  )

  // The error page (pages.app.error), through the mock's ?crash=1: the words and
  // the three buttons in their weights; Reload reloads the page. Last, because
  // the throw is logged to the console.
  await send('Page.navigate', { url: `${BASE}&crash=1#/plan` })
  check('Error page: a surface that throws while drawing shows it', await waitFor(`document.querySelector('main.page section.error-page') !== null`))
  const errPage = await evaluate(`(() => { const s = document.querySelector('main.page section.error-page'); if (!s) return { title: '', ps: [], btns: [], text: '' }; const ps = [...s.querySelectorAll('p')].map((p) => (p.textContent || '').replace(/\\s+/g, ' ').trim()); const btns = [...s.querySelectorAll('button')].map((b) => (b.textContent || '').trim() + ':' + (/btn-primary/.test(b.className) ? 'primary' : /btn-secondary/.test(b.className) ? 'secondary' : /btn-tertiary/.test(b.className) ? 'tertiary' : 'none')); return { title: ((s.querySelector('h2') || {}).textContent || '').trim(), ps, btns, text: s.innerText } })()`)
  check('Error page: the title, the lead with its full stop, no Setup, no Start step', errPage.title === 'This page hit an error' && errPage.ps[0] === 'Nothing in the tenant changed.' && !/\bSetup\b|Start step/.test(errPage.text), JSON.stringify(errPage.ps.slice(0, 2)))
  check('Error page: Reload (primary), Download diagnostics (redacted) (secondary), Start over (tertiary), and where to send them', errPage.btns.join(' | ') === 'Reload:primary | Download diagnostics (redacted):secondary | Start over:tertiary' && errPage.ps.includes('Send the diagnostics to feedback@getiamai.com'), errPage.btns.join(' | '))
  await clickText('/^Reload$/')
  check('Error page: Reload reloads the page', await waitFor(`(performance.getEntriesByType('navigation')[0] || {}).type === 'reload'`, 8000))
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
