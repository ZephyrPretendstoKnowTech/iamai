// First-run smoke test (prompt 20 §10): starts the dev server, drives headless
// Chrome over the DevTools protocol with no dependencies beyond Node 22+, and
// walks Connect → Today → Plan → Export → How → Recovery
// against the synthetic tenant (?dev=1&mock=1), asserting the key numbers.
// The same fixture backs src/ui/consistency.test.ts, so the numbers asserted
// here are the ones the pure tests prove.
//
//   npm run smoke            (CHROME=/path/to/chrome to override the binary)
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

// No rendered surface and no downloaded artifact may carry a forbidEverywhere
// string (prompt 49.1 item 1): a placeholder token, a Setup mention, a raw URN.
const FORBID_EVERYWHERE = JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8')).forbidEverywhere ?? []

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
  await sleep(1500)
  check('Sign-in: an auth response in the fragment is intact when the first frame renders', (await evaluate('window.__firstFrameHash')) === '#code=abc&client_info=def&state=ghi', String(await evaluate('window.__firstFrameHash')))
  check('Sign-in: once auth has settled the page lands on Plan', await waitFor(`location.hash === '#/plan'`))

  // The walk (prompt 47 Part 6 item 23): Connect signed out, sign in (the mock state), the scan, Today, Inventory, then the legacy Roadmap.
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1200)
  t = await text()
  check('Connect (signed out): the opener heading, Built for, What it catches and Sign in', /Plan the journey to your Conditional Access baseline/.test(t) && /Built for/.test(t) && /What it catches/.test(t) && /Global Administrator or Global Reader/.test(t) && /Sign in with Microsoft/.test(t))

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
  check('Connect (scanning): the header tabs are disabled', (await evaluate(`[...document.querySelectorAll('header.app nav a[aria-disabled="true"]')].length`)) === 3)
  // Connect, scanned: who is signed in, the baseline line, the one-line result, Open the plan (target-state §3).
  await go('connect')
  await sleep(600)
  t = await text()
  check('Connect: signed in as the operator', /Signed in to Contoso Pty Ltd as alex@example\.com/.test(t), (t.match(/Signed in[^\n]*/) ?? ['no signed-in line'])[0])
  check('Connect: the baseline line names the baseline and its policy count', /Baseline: synthetic baseline \(1 polic(y|ies)\)/.test(t), (t.match(/Baseline:[^\n]*/) ?? [''])[0])
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
  check('Plan: line two names what the plan is built from', /Built from what IAMAI found on/.test(pt) && /Today shows where each person stands/.test(pt))
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
  const nBefore = await evaluate(`window.__dl.length`)
  await clickExact('Save plan file')
  await sleep(450)
  check('Export: Save plan file produces bytes', await evaluate(`window.__dl.length > ${nBefore} && window.__dl[window.__dl.length - 1].size > 0`))
  const planJson = await evaluate(`(async () => { const d = window.__dl[window.__dl.length - 1]; return d && d.blob ? await d.blob.text() : null })()`)
  check('Export: the saved plan carries its steps', typeof planJson === 'string' && /"steps"\s*:/.test(planJson))
  // The saved bytes parse back to a plan with its steps (v3 carries no hand-ticked
  // state — IAMAI never asks the user to maintain state it can detect). Identifier
  // redaction rewrites the tenant id, so a live reload into the same tenant is
  // refused by the tenant guard by design (planTenant.test); the format round-trip
  // is what matters, and Load a plan file runs the import path.
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
  const printText = await evaluate(`(document.querySelector('.print-plan') || {}).textContent || ''`)
  const printHits = FORBID_EVERYWHERE.filter((f) => printText.includes(f))
  check('Export: the print document carries no forbidden placeholder', printHits.length === 0, printHits.join('; '))
  // The rebuilt print shows the step content, not the old pre-48 body (item 3).
  check('Export: the print renders the step body, not the old fields', /Who this touches/.test(printText) && !/Proposed name:|What the last 30 days say/.test(printText))
  // Item 4: the print DOM lives only while printing; afterprint tears it down.
  await evaluate(`window.dispatchEvent(new Event('afterprint'))`)
  await sleep(200)
  check('Export: the print DOM is gone once printing ends', (await evaluate(`document.querySelector('.print-plan') === null`)))

  // The header (target-state §2): wordmark, tenant, tabs, Scan to update the plan with the scan's age, theme, Account.
  await go('plan')
  await waitFor(`/\\bsteps\\b/.test(document.body.innerText)`)
  t = await evaluate(`document.querySelector('header.app').innerText`)
  check('Header: the tenant name, both tabs and the controls', /Contoso Pty Ltd/.test(t) && /Today/.test(t) && /Plan/.test(t) && !/Recovery card/.test(t) && /Account/.test(t), t.replace(/\s+/g, ' ').slice(0, 120))
  check('Name: the wordmark is IAMAI Planner and the tab title carries the descriptor', /^IAMAI Planner/.test(t.trim()) && (await evaluate('document.title')) === 'IAMAI Planner — Conditional Access rollout planner', await evaluate('document.title'))
  check('Header: Scan to update the plan carries the scan age', /Scan to update the plan · scanned (just now|\d+h ago|\d+d ago)/.test(t), t.replace(/\s+/g, ' ').slice(0, 120))
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
  check('Unlicensed tenant: the plan footer names what does not apply', /Doesn't apply here \(\d+\)/.test(t))
  await send('Page.navigate', { url: `${BASE}&licence=free#/today` })
  await sleep(1500)
  t = await text()
  check('Unlicensed tenant: Today says why there are no sign-in records', /no sign-in records \(needs Entra ID P1 or P2\)/.test(t), (t.match(/[^\n]*sign-in records[^\n]*/) ?? [''])[0])
  check('Unlicensed tenant: nobody is Proven without records', !/\bProven\b/.test(t))
  await send('Page.navigate', { url: `${BASE}&licence=free#/plan` })
  await sleep(1500)
  check('Unlicensed tenant: the plan still generates', await waitFor(`/[0-9]+ steps/.test(document.body.innerText)`))
  t = await text()
  check('Unlicensed tenant: the ladder steps are the plan', /Switch on the free protection|Keep two emergency accounts/.test(await text()))
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
  await send('Page.navigate', { url: `${BASE}&denied=1#/connect` })
  await sleep(1500)
  check('Denied sections: the scan says a role is missing, never just insufficient privileges', await waitFor(`/Some sections need a higher role/.test(document.body.innerText)`))
  t = await text()
  check('Denied sections: the ask is Global Reader, and it is read-only', /Global Reader/.test(t) && /grants every section IAMAI reads and can change nothing/.test(t))
  check('Denied sections: each refused section names its own least role', /Conditional Access policies|CA policies/.test(t) && /Security Reader/.test(t) && /Reports Reader/.test(t))
  check('Denied sections: a licence gate is never reported as a missing role', !/not available on this licence[\s\S]{0,120}holds no role/.test(t))

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

  // The feedback channel shows the message before anything opens (prompt 34 part 2).
  await go('plan')
  await sleep(1200)
  check(
    'Feedback: the footer link opens the panel',
    (await clickText('/feedback@getiamai.com/', 'footer.app')) && (await waitFor(`/What the email will contain/.test(document.body.innerText)`)),
  )
  t = await text()
  check('Feedback: the message shows the page, version and browser', /Page: #\/plan/.test(t) && /Version:/.test(t) && /Browser:/.test(t))
  check('Feedback: nothing is sent automatically', /Nothing is sent from here/.test(t))
  check('Feedback: the scan summary is opt-in and not attached by default', !/Users in the directory/.test(t))

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
  check('Demo: Connect offers the sample-data entry (item 12)', await waitFor(`/See it with sample data/.test(document.body.innerText)`))
  const demoErrBase = consoleErrors.length
  // Enter the demo by the link a visitor clicks, not by a crafted URL.
  await clickText('/See it with sample data/')
  check('Demo: entering lands on the plan under the sample-data banner', await waitFor(`location.hash === '#/plan' && /Sample data/.test(document.body.innerText)`))
  await sleep(600)
  let demoText = await text()
  const demoDay1Header = (demoText.match(/[^\n]*\d+ in place[^\n]*/) ?? [''])[0].trim()
  check('Demo: the banner says nothing is from a real tenant and offers to leave', /Sample data . nothing here is from a real tenant/.test(demoText) && /Leave the demo/.test(demoText))
  check('Demo: the plan header counts steps, in place and the finish', /\d+ steps . \d+ in place . (finishes |nothing is dated)/.test(demoText), demoDay1Header)
  check('Demo: the header names the sample org', /Contoso Pty Ltd/.test(await evaluate(`document.querySelector('header.app').innerText`)))
  // Item 4: a readiness-held step renders as a Blocked row whose date column
  // reads the reason in the 46 shape, not a date.
  const whenCols = await evaluate(`[...document.querySelectorAll('main.page .plan-row .when')].map((e) => e.textContent.trim()).join(' | ')`)
  check('Demo: a readiness-held step reads its reason in the date column', /when [a-z ]*readiness reaches \d+% \(now \d+%\)/.test(whenCols), (whenCols.match(/when [a-z ]*readiness reaches[^|]*/) ?? ['none'])[0].trim())

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
  const planBody = () => evaluate(`document.querySelector('main.page').innerText`)
  const headerOf = (body) => (body.match(/[^\n]*\d+ in place[^\n]*/) ?? [''])[0].trim()
  const inPlaceOf = (body) => Number((body.match(/(\d+) in place/) ?? [])[1] ?? '0')
  const day1Body = await planBody()
  const day1Header = headerOf(day1Body)
  await clickText('/^Scan to update the plan/', 'header.app')
  check('Demo: Re-scan advances to the week-two snapshot', await waitFor(`/Sample data . week 2/.test(document.body.innerText)`))
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
  await clickText('/^Scan to update the plan/', 'header.app')
  check('Demo: a second Re-scan returns to day one', await waitFor(`/Sample data . nothing here is from a real tenant/.test(document.body.innerText)`))

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
