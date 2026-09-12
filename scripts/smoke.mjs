// First-run smoke test (prompt 20 §10): starts the dev server, drives headless
// Chrome over the DevTools protocol with no dependencies beyond Node 22+, and
// walks Connect → MFA Readiness → Plan → Export → How → Recovery
// against the synthetic tenant (?dev=1&mock=1), asserting the key numbers.
// It then drives the two trust actions against real storage (task 015): with a
// second tenant's rows seeded beside the mock tenant's, Sign out leaves every
// row where it is and Forget this tenant deletes one tenant's rows and no
// other's.
// The same fixture backs src/ui/consistency.test.ts, so the numbers asserted
// here are the ones the pure tests prove.
//
//   npm run smoke            (CHROME=/path/to/chrome to override the binary)
//
// The exit code says which kind of failure it was, which is the difference
// between "IAMAI has a defect" and "this machine could not run the test":
//
//   0   every check passed
//   1   checks failed — the product. Each FAIL line names the check and its detail.
//   2   the harness never got as far as checking. The line starts "smoke: harness"
//       and carries whatever vite or Chrome said before giving up.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
// The same "worth asking again" the Learn probe uses, so external-health has one
// definition of transient rather than two that drift (src/testing/transient.ts).
import { BACKOFF_MS, MAX_ATTEMPTS, probe } from '../src/testing/transient.ts'

// The authority whose metadata the sign-in warm fetches (src/graph/msal.ts).
// Asked directly only to tell a wobbling Microsoft apart from a broken IAMAI.
const AUTHORITY_METADATA = 'https://login.microsoftonline.com/organizations/v2.0/.well-known/openid-configuration'

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

// MFA Readiness's summary sentence (pages.readiness.summary), matched in either
// tense: content/render.ts pluralise may bend the verb to the count.
const SUMMARY_LINE = /(\d+) of (\d+) (?:is|are) Ready\./

// The worklist's six zones and the three summary counts, read from the words the
// page ships rather than copied here (Step 7).
const CONTENT_PAGES = JSON.parse(readFileSync('docs/design/content.json', 'utf8')).pages
const READINESS_COLUMNS = CONTENT_PAGES.readiness.columns
const STAT_TITLES = ['needsProof', 'needsSetup', 'unknown'].map((k) => CONTENT_PAGES.readiness.states[k].stat)

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
  console.error('smoke: harness — no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}

const failures = []
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  (${detail})` : ''}`)
  if (!ok) failures.push(name)
}
// A check that cannot pass without a third party answering (Microsoft's login
// authority) is not a statement about IAMAI, so it is off by default and runs
// only in .github/workflows/external-health.yml, where a red run means the
// outside world moved rather than the product broke. The line is still printed
// so a reader of the core run can see what was not asked.
const EXTERNAL_HEALTH = process.env.EXTERNAL_HEALTH === '1'
const skipped = []
const skip = (name, why) => {
  console.log(`skip ${name}  (${why})`)
  skipped.push(name)
}

/**
 * The last few lines a child wrote, kept so a harness failure can say why.
 * Bounded on purpose: this is evidence for a failure, not a log of a good run,
 * and it is printed only when something did not start. Draining also matters in
 * its own right — a piped child whose output nobody reads blocks once the pipe
 * fills, which is a hang with no message at all.
 */
const tailOf = (limit = 40) => {
  const lines = []
  return {
    push: (chunk) => {
      for (const l of String(chunk).split('\n')) if (l.trim()) lines.push(l.trimEnd())
      while (lines.length > limit) lines.shift()
    },
    text: () => lines.join('\n'),
  }
}

// ---- dev server ----
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
const viteOut = tailOf()
vite.stdout?.on('data', (d) => viteOut.push(d))
vite.stderr?.on('data', (d) => viteOut.push(d))
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
  console.error(`smoke: harness — the dev server did not start on port ${PORT} within 20 s`)
  if (viteOut.text()) console.error(`--- vite said ---\n${viteOut.text()}\n-----------------`)
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
], { stdio: ['ignore', 'ignore', 'pipe'] })
// Chrome's own reason for not starting — a missing shared library, a profile it
// could not lock — otherwise goes nowhere, and the run reads as "no page target".
const chromeErr = tailOf()
chrome.stderr?.on('data', (d) => chromeErr.push(d))
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
  console.error('smoke: harness — Chrome exposed no page target within 60 s (a slow runner, or a Chrome that could not start)')
  if (chromeErr.text()) console.error(`--- chrome said ---\n${chromeErr.text()}\n-------------------`)
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
// The How page has drawn when its last section is on screen (the checks
// registry and the limits below it), not when the shell has painted.
const HOW_DRAWN = `/Every check IAMAI runs/.test(document.body.innerText) && /Field practice/.test(document.body.innerText)`
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
// A navigation that ends the page it leaves. Page.navigate to the URL the tab is
// already on, fragment and all, is a same-document navigation: nothing reloads,
// and the old document keeps running whatever it had queued. The sign-in pass
// leaves a queued loginRedirect on its page; when the authority answered slowly
// that page survived "coming back" and left for login.microsoftonline.com in the
// middle of the demo checks. Going through about:blank always starts a new document.
const navigateFresh = async (url) => {
  await send('Page.navigate', { url: 'about:blank' })
  await send('Page.navigate', { url })
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
      'window.__copied = []; try { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: function (t) { window.__copied.push(String(t)); return Promise.resolve(); } } }); } catch (e) {}' +
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
  await waitFor(`document.querySelectorAll('main.page .connect-flow .connect-step').length === 3 && document.querySelectorAll('main.page .connect-destination').length === 1`)
  check('Connect (signed out): the demo chunk is not loaded outside demo mode', !(await evaluate(`performance.getEntriesByType('resource').some((e) => /\\/src\\/ui\\/demo\\.ts|\\/src\\/ui\\/demoFacts\\.ts/.test(e.name))`)))
  t = await text()
  check('Connect (signed out): the sample facts are on the page without it', /\d+\s*steps/.test(t) && /already in place/.test(t))
  // A chunk that fails to load reloads the page once per session, then leaves the error page to the person.
  await evaluate(`sessionStorage.removeItem('iamai.preloadReloaded'); window.__stillHere = 1; window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))`)
  check('Preload failure: the page reloads once', await waitFor(`(performance.getEntriesByType('navigation')[0] || {}).type === 'reload' && window.__stillHere === undefined`, 8000))
  await waitFor(`document.querySelectorAll('main.page .connect-flow .connect-step').length === 3 && document.querySelectorAll('main.page .connect-destination').length === 1`)
  const preloadAgain = await evaluate(`(() => { const e = new Event('vite:preloadError', { cancelable: true }); window.__stillHere = 2; window.dispatchEvent(e); return e.defaultPrevented })()`)
  await sleep(1500)
  check('Preload failure: a second failure in the session does not reload again', !preloadAgain && (await evaluate(`window.__stillHere === 2`)))

  // The walk (prompt 47 Part 6 item 23): Connect signed out, sign in (the mock state), the scan, MFA Readiness, Inventory, then the legacy Roadmap.
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1200)
  t = await text()
  check('Connect (signed out): the heading, the sign-in tile with the consent sentence, Sign in with Microsoft and Try it with sample data', /Strengthen identity security without guessing what will break/.test(t) && /Sign in\s+no tenant connected/.test(t) && /every sign-in after that can be Global Reader/.test(t) && /Sign in with Microsoft/.test(t) && /Try it with sample data/.test(t) && !/Built for|What it catches|Connect a tenant/.test(t))

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
  check('Connect: the tiles read at the page column, not the measure', (await evaluate(`Math.round(document.querySelector('main.page .connect-flow').getBoundingClientRect().width)`)) >= 700, String(await evaluate(`Math.round(document.querySelector('main.page .connect-flow').getBoundingClientRect().width)`)))

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
  // Connect as the approved staged flow and its Plan destination (docs/design/approved/anatomy/connect-v3.html).
  check('Connect: tile 1 names the tenant, the account and its role', /Signed in\s+Contoso Pty Ltd/.test(t) && /alex@example\.com · Global Administrator/.test(t), (t.match(/Signed in[^\n]*/) ?? ['no signed-in line'])[0])
  check('Connect: tile 2 carries the baseline and its policy count', /Baseline\s+selected/.test(t) && /synthetic baseline/.test(t) && /1 polic(y|ies) · uploaded package/.test(t), (t.match(/Baseline[^\n]*/) ?? [''])[0])
  // Tile 4 (task 016): the Plan is the destination — the counted state, one line of what was built, and one way on. No facts row, no readiness ladder, and nothing on the page routing to MFA Readiness ahead of the plan. The tile's own text, since the header tab is named MFA Readiness.
  const planReady = await waitFor(`/Plan\\s+ready/.test((document.querySelector('main.page') || {}).innerText || '')`, 20000)
  const planTileText = await evaluate(`(((document.querySelector('main.page .connect-destination') || {}).innerText) || '').replace(/\\s+/g, ' ')`)
  check(
    'Connect (scanned): the Plan stage is the destination, one way on, no readiness diagnostic in front of it',
    planReady &&
      /Open the plan →/.test(planTileText) &&
      /Built from this scan/.test(planTileText) &&
      !/MFA Readiness/i.test(planTileText) &&
      (await evaluate(`document.querySelectorAll('main.page .connect-destination .facts, main.page .connect-destination .rung-tile').length`)) === 0 &&
      (await evaluate(`document.querySelectorAll('main.page a[href*="#/readiness"]').length`)) === 0,
    planTileText.slice(0, 140),
  )
  // The progression: at most one stage current, the ones before it settled, and
  // the current one marked with a word rather than a colour alone.
  const stageClasses = await evaluate(`[...document.querySelectorAll('main.page .connect-step')].map((s) => (/\\bcurrent\\b/.test(s.className) ? 'current' : /\\bsettled\\b/.test(s.className) ? 'settled' : 'ahead'))`)
  check(
    'Connect (scanned): the finished stages settle, at most one is current, and a current one carries the Next marker',
    stageClasses.filter((x) => x === 'current').length <= 1 &&
      stageClasses.filter((x) => x === 'settled').length >= 1 &&
      stageClasses.lastIndexOf('settled') < (stageClasses.indexOf('current') === -1 ? Infinity : stageClasses.indexOf('current')) &&
      (await evaluate(`[...document.querySelectorAll('main.page .connect-step.current')].every((s) => ((s.querySelector('.next') || {}).textContent || '').trim().length > 0)`)),
    stageClasses.join(' · '),
  )
  // Tile 3 reads Scan complete · N ago once; tile 4 reads Plan ready · from the scan N ago with the same words, from the one stored timestamp; nothing says scanned.
  check(
    "Connect (scanned): the scan's age once as Scan complete · N ago, Plan ready · from the scan with the same age, and no scanned line",
    (await waitFor(`/Plan\\s+ready · (\\d+ steps, \\d+ done · )?from the scan/.test(document.body.innerText)`)) &&
      (await evaluate(`(() => { const t = document.querySelector('main.page').innerText; const m = t.match(/Scan\\s+complete · ([^\\n]+)/); if (!m) return false; const age = m[1].trim(); return (t.match(/complete · [^\\n]+/g) || []).length === 1 && /ready · (\\d+ steps, \\d+ done · )?from the scan /.test(t) && t.includes('from the scan ' + age) && !/scanned/.test(t) })()`)),
    (t.match(/Plan\s+ready[^\n]*/) ?? [''])[0],
  )
  check('Connect (scanned): the plan state counts the steps and how many are done', await waitFor(`/ready · \\d+ steps, \\d+ done · from the scan/.test(document.body.innerText)`, 20000), ((await text()).match(/ready · \d+ steps, \d+ done[^\n]*/) ?? [''])[0])
  check('Connect: Global Reader is the only role IAMAI names', !/Security Reader|Reports Reader/.test(t))
  check('Connect (scanned): Change baseline opens the picker with two choices', (await clickText('/^Change baseline$/')) && (await waitFor(`/Upload a package/.test(document.body.innerText) && /How to make one →/.test(document.body.innerText)`)))
  // MFA Readiness (Step 7): who can meet phishing-resistant MFA, what IAMAI can prove, and what each person needs next.
  await go('readiness')
  check('MFA Readiness: the summary renders', await waitFor(`document.querySelectorAll('main.page .readiness-summary .summary-stat').length === 3`))
  t = await text()
  check('MFA Readiness: the heading and its one opening sentence', /MFA Readiness/.test(t) && /See who can meet phishing-resistant MFA/.test(t))
  // The answer over the active people, then the three counts beside it; Ready and the three sum to the active people.
  const summaryLine = t.match(SUMMARY_LINE)
  const statCounts = await evaluate(`[...document.querySelectorAll('main.page .readiness-summary .summary-stat')].map((b) => ({ title: ((b.querySelector('.stat-k') || {}).textContent || '').replace(/\\s+/g, ' ').trim(), n: Number(((b.querySelector('.stat-n') || {}).textContent || '').trim()) }))`)
  check('MFA Readiness: the summary says how many active people are Ready', !!summaryLine, (t.match(/[^\n]*(?:is|are) Ready\.[^\n]*/) ?? [''])[0])
  check(
    'MFA Readiness: one summary panel — the answer and three counts that are buttons — and no second boxed count',
    (await evaluate(`(() => { const p = document.querySelector('main.page .readiness-summary'); if (!p) return false; return p.classList.contains('panel') && p.querySelectorAll(':scope > .summary-main').length === 1 && p.querySelectorAll(':scope > button.summary-stat').length === 3 && document.querySelectorAll('main.page .group-tile, main.page .group-counts').length === 0 })()`)),
  )
  check(
    'MFA Readiness: Need proof, Need setup and Unknown beside Ready, summing to the active people',
    statCounts.map((g) => g.title).join(' | ') === STAT_TITLES.join(' | ') && !!summaryLine && Number(summaryLine[1]) + statCounts.reduce((x, g) => x + g.n, 0) === Number(summaryLine[2]),
    statCounts.map((g) => `${g.title} ${g.n}`).join(' | '),
  )
  check('MFA Readiness: no ladder and no rung badge on the page', (await evaluate(`document.querySelectorAll('main.page .ladder, main.page .ladder-row, main.page .rung-tile, main.page .rung-badge').length`)) === 0)
  check(
    'MFA Readiness: one strip for the Plan gate and the passkey rollout',
    (await evaluate(`document.querySelectorAll('main.page .progress-strip .progress-item').length`)) === 2 && /Plan gate/.test(t) && /\d+ of \d+ must be Ready/.test(t) && /Passkey rollout/.test(t) && /\d+ of \d+ (?:has|have) a passkey/.test(t),
  )
  check('MFA Readiness: no legend, no banner, no rollout tiles, no filter chips', !/Legend/.test(t) && !/To set up before enforcement/.test(t) && !/Sign-in records: complete/.test(t) && (await evaluate(`document.querySelectorAll('.filter-bar, .legend-card, .tiles').length`)) === 0)
  check(
    'MFA Readiness: the toolbar — a search box, then the filters as pills, Needs action pressed by default, and no dropdown',
    (await evaluate(`document.querySelectorAll('main.page select').length`)) === 0 &&
      (await evaluate(`!!document.querySelector('main.page .toolbar input[type=search]')`)) &&
      (await evaluate(`document.querySelectorAll('main.page .toolbar .btn.pill[aria-pressed]').length`)) >= 5 &&
      (await evaluate(`((document.querySelector('main.page .toolbar .btn.pill[aria-pressed="true"]') || {}).textContent || '').trim()`)) === 'Needs action' &&
      /No passkey/.test(t),
  )
  check('MFA Readiness: the link to every account and policy the scan read', /Every account and policy the scan read →/.test(t))
  // A summary count is a filter: its hash lands on it pressed, and the worklist shows exactly the rows it counts.
  const setupStat = statCounts[1]
  await go('readiness/needsSetup')
  await sleep(500)
  const setupRows = await evaluate(`document.querySelectorAll('main.page table.datatable tbody tr').length`)
  const setupPressed = await evaluate(`((document.querySelectorAll('main.page .readiness-summary .summary-stat')[1] || null) || { getAttribute: () => null }).getAttribute('aria-pressed')`)
  check("MFA Readiness: a count's hash filters the worklist to exactly the rows it counts, and the count says it is pressed", setupPressed === 'true' && setupRows === (setupStat?.n ?? -1), `${setupPressed}: ${setupRows} of ${setupStat?.n}`)
  // The old name still reaches the one surface, and the app rewrites the hash.
  await go('today')
  check('The old Today hash reaches MFA Readiness', await waitFor(`location.hash === '#/readiness'`))
  await go('readiness/all')
  await sleep(400)
  // Walk fixes (prompt 47.1 Part 2): markers stand off the name; no inner scroll; a hairline header, not a band.
  // The approved table's six person zones, in its order, with the role a word of
  // its own rather than a marker beside the name (task 037).
  check(
    'MFA Readiness: the worklist has the six zones in order — Person, Role, Methods, Proof, Readiness, Action — and the role is a word',
    (await evaluate(`(() => { const h = [...document.querySelectorAll('main.page table.datatable thead th')].map((x) => x.textContent.trim()); return JSON.stringify(h) })()`)) ===
      JSON.stringify(READINESS_COLUMNS) &&
      (await evaluate(`(() => { const r = document.querySelector('main.page td .role'); return !!r && r.textContent.trim().length > 0 })()`)),
  )
  check('MFA Readiness: the table has no inner scroll', (await evaluate(`getComputedStyle(document.querySelector('main.page .datatable-wrap')).maxHeight`)) === 'none')
  // The approved pack draws the head as a small uppercase key on the inset
  // surface inside the table's own panel (task 037).
  check(
    'MFA Readiness: the approved table panel, with the head as an uppercase key on the inset surface',
    await evaluate(`(() => { const w = getComputedStyle(document.querySelector('main.page .datatable-wrap')); const th = getComputedStyle(document.querySelector('main.page table.datatable th')); return w.borderTopWidth === '1px' && parseFloat(w.borderTopLeftRadius) >= 12 && th.textTransform === 'uppercase' && th.position === 'static' && th.backgroundColor !== 'rgba(0, 0, 0, 0)' })()`),
  )
  // The detail is one level deep (Step 7): closed until a person's action is
  // pressed, then Why and Next for that person and nothing else; Close puts it away.
  check('MFA Readiness: no detail open until a person is chosen', (await evaluate(`document.querySelectorAll('main.page dialog[open]').length`)) === 0)
  // The detail's text as one line, flattened here rather than in the page: a
  // regex inside an evaluated template literal loses its escapes.
  const flat = (x) => String(x ?? '').split(/\s+/).join(' ')
  const actionLabels = await evaluate(`[...document.querySelectorAll('main.page table.datatable tbody tr button.row-action')].map((b) => b.textContent.trim())`)
  await evaluate(`(() => { const b = document.querySelector('main.page table.datatable tbody tr button.row-action'); if (b) { b.scrollIntoView({ block: 'center' }); b.click() } })()`)
  await sleep(300)
  const detail = flat(await evaluate(`(() => { const d = document.querySelector('main.page dialog.readiness-detail[open]'); return d ? d.innerText : '' })()`))
  check(
    "MFA Readiness: a person's action opens the detail for them, with Why and Next and nothing else",
    actionLabels.length > 0 && /why/i.test(detail) && /next/i.test(detail) && (await evaluate(`document.querySelectorAll('main.page dialog.readiness-detail[open] .detail-block').length`)) === 2,
    detail.slice(0, 160),
  )
  check('MFA Readiness: no raw identifier in the detail', !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(detail))
  await evaluate(`(() => { const b = [...document.querySelectorAll('main.page dialog.readiness-detail button')].find((x) => x.textContent.trim() === 'Close'); if (b) b.click() })()`)
  await sleep(250)
  check('MFA Readiness: Close puts the detail away', (await evaluate(`document.querySelectorAll('main.page dialog[open]').length`)) === 0)
  await go('readiness')
  await sleep(400)
  // Inventory and Licensing reachable
  await go('inventory')
  check('Inventory: policies table renders', await waitFor(`document.querySelectorAll('table tbody tr').length >= 3`))
  t = await text()
  check('Inventory: the heading, the ← MFA Readiness link, and no intro sentence', /Everything the scan read/.test(t) && /← MFA Readiness/.test(t) && !/as found: no analysis/.test(t))
  check('Inventory: the ten tabs', (await evaluate(`document.querySelectorAll('main.page [role=tab]').length`)) === 10)
  // The operational column, and the panel table's head band.
  //
  // Prompt 47.1 asked for the opposite of the second check: a transparent `th`,
  // because the head it was replacing was the legacy sticky band. Task 040
  // moved every panel table onto the treatment BOTH approved packs draw —
  // `plan-step-v1.html` and `mfa-readiness-v2.html` each put the head on the
  // secondary surface inside one bordered panel — so what the check now asks is
  // that the head is that band and not the old one: on the inset surface, not
  // sticky, inside a panel that carries the border.
  check('Inventory: the page uses its own operational column', (await evaluate(`Math.round(document.querySelector('main.page').getBoundingClientRect().width)`)) >= 1040, String(await evaluate(`Math.round(document.querySelector('main.page').getBoundingClientRect().width)`)))
  const invHead = await evaluate(`(() => { const th = document.querySelector('main.page .datatable-wrap.panel table.datatable th'); if (!th) return null; const cs = getComputedStyle(th); const wrap = getComputedStyle(th.closest('.datatable-wrap')); return { bg: cs.backgroundColor, inset: getComputedStyle(document.documentElement).getPropertyValue('--secondary-surface').trim(), position: cs.position, transform: cs.textTransform, border: wrap.borderTopWidth } })()`)
  check(
    'Inventory: the head is the packs’ inset band inside a panel, not the legacy sticky one',
    invHead !== null && invHead.position === 'static' && invHead.transform === 'uppercase' && invHead.border !== '0px' && invHead.bg !== 'rgba(0, 0, 0, 0)',
    JSON.stringify(invHead),
  )
  await go('how')
  // How is a lazy chunk behind the shell's ready gate, so the page is read when
  // its last section is on screen, never on a fixed sleep: a slower machine
  // would otherwise be asked what the loading line says.
  await waitFor(HOW_DRAWN)
  t = await text()
  check('How IAMAI works: the reference page renders with its sections', /How IAMAI works/.test(t) && /Permissions/.test(t) && /What IAMAI reads/.test(t) && /Every check IAMAI runs/.test(t) && /Baseline packages/.test(t) && /Limits/.test(t))
  check('How: the old reference routes redirect here', (await (async () => { await send('Page.navigate', { url: `${BASE}#/checks` }); await sleep(600); return await waitFor(`location.hash === '#/how'`) })()))



  // The old names redirect (target-state §2, prompt 47 Part 3).
  await go('start')
  check('Start redirects to Connect', await waitFor(`location.hash === '#/connect'`))
  await go('baseline')
  check('Baseline redirects to Connect', await waitFor(`location.hash === '#/connect'`))
  await go('scan')
  check('Scan redirects to MFA Readiness', await waitFor(`location.hash === '#/readiness'`))
  await go('roadmap')
  check('Roadmap redirects to Plan', await waitFor(`location.hash === '#/plan'`))
  await go('reads')
  check('What IAMAI reads redirects to How', await waitFor(`location.hash === '#/how'`))
  await go('licensing')
  check('Licensing redirects to How', await waitFor(`location.hash === '#/how'`))
  await go('plan')
  const __planOk = await waitFor(`/#\\/plan/.test(location.hash) && document.querySelector('main.page .plan-progress-tile') !== null`)
  check('Plan renders at #/plan', __planOk, __planOk ? '' : `hash=${await evaluate('location.hash')} main=${(await evaluate(`(document.querySelector('main.page')||{}).innerText||'(no main)'`)).slice(0, 140).replace(/\s+/g, ' ')}`)
  // The Plan surface (target-state §5): two header lines, numbered phases, the footer.
  let pt = await text()
  // The header's progress tiles replaced the generated status sentence (owner, 2026-09-11).
  const progressOf = () => evaluate(`[...document.querySelectorAll('main.page .plan-progress-tile')].map((t) => ((t.querySelector('dt') || {}).textContent || '').trim() + '=' + ((t.querySelector('dd') || {}).textContent || '').trim()).join(', ')`)
  const planProgress = await progressOf()
  check('Plan: the header shows progress tiles for steps, in place, waiting and remaining', /^Steps=\d+, In place=\d+, Waiting=\d+, Remaining=\d+$/.test(planProgress), planProgress)
  // The second header line left with docs/design/mockups/plan-top-v2.html; the tenant and the scan age live on Connect alone.
  check('Plan: no second header line; the tenant and the scan age live on Connect alone', !/Today shows where each person stands/.test(pt) && !/scanned|Built from what IAMAI found on|from the scan/.test(pt))
  // Task 011: the Plan is the rollout board and nothing above it. The readiness
  // ladder is a tenant-wide diagnostic and stays where the evidence it summarises
  // lives - Today, and Connect's Plan tile.
  check('Plan: no MFA readiness ladder above the board', (await evaluate(`document.querySelectorAll('main.page .rung-tiles, main.page .rung-tile, main.page .strip-head').length`)) === 0)
  // The Start date proposes today in the display zone (a weekend: the Monday after), in the same control as Plan settings' inputs, its label spaced.
  const startField = await evaluate(`(() => { const l = document.querySelector('main.page .plan-start label.rows'); const i = l && l.querySelector('input[type=date]'); if (!i) return null; const cs = getComputedStyle(l); const ci = getComputedStyle(i); return { value: i.value, display: cs.display, gap: cs.columnGap, padTop: ci.paddingTop, borderBottom: ci.borderBottomWidth } })()`)
  const startZone = await evaluate(`(async () => { try { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); if (!db.objectStoreNames.contains('mapping')) { db.close(); return null } const rows = await new Promise((r) => { const q = db.transaction('mapping').objectStore('mapping').getAll(); q.onsuccess = () => r(q.result) }); db.close(); const m = rows.find((x) => x && x.displayTimeZone); return m ? m.displayTimeZone : null } catch { return null } })()`)
  const startToday = await evaluate(`new Intl.DateTimeFormat('en-CA', { timeZone: ${JSON.stringify(startZone)} || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())`)
  const startShift = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
  const startDow = new Date(`${startToday}T12:00:00Z`).getUTCDay()
  const startExpected = startDow === 6 ? startShift(startToday, 2) : startDow === 0 ? startShift(startToday, 1) : startToday
  check('Plan: the Start date proposes today in the display zone', !!startField && startField.value === startExpected, `${startField && startField.value} vs ${startExpected} (${startZone ?? 'browser zone'})`)
  check("Plan: the Start date field is a spaced row in Plan settings' control style", !!startField && startField.display === 'flex' && parseFloat(startField.gap) >= 8 && startField.padTop === '0px' && startField.borderBottom === '1px', JSON.stringify(startField))
  // The board's groups (`.plan-group`), each with its column head over its rows.
  // The class moved with the group: a phase used to be a raised panel called
  // `.phase` and is now one group among the board's, drawn by the same component
  // whichever lens is showing (src/ui/surfaces/planBoard.ts).
  check('Plan: groups render as sections with a next mark', (await evaluate(`document.querySelectorAll('main.page .plan-group').length`)) >= 1 && (await evaluate(`document.querySelectorAll('main.page .plan-row').length`)) >= 3 && /next/.test(pt))
  check('Plan: the four zones are named over the rows', (await evaluate(`[...document.querySelectorAll('main.page .plan-column-head')].slice(0, 1).flatMap((h) => [...h.children].map((c) => (c.textContent || '').trim())).join('|')`)) === 'State|Step|Impact|When')
  // The board draws one lane at a time (S3, src/ui/surfaces/planBoard.ts): Ready is
  // the default tab, and the three are one tab set. A check that reads every row
  // reads the three tabs in turn.
  const LANES = ['Ready', 'Up Next', 'On Hold']
  const tabText = `(t) => ((t.textContent || '').replace((t.querySelector('.tab-badge') || {}).textContent || '', '').trim())`
  const showLane = async (name) => {
    await evaluate(`(() => { const t = [...document.querySelectorAll('main.page .plan-controls [role=tab]')].find((x) => (${tabText})(x) === ${JSON.stringify(name)}); if (t && t.getAttribute('aria-selected') !== 'true') t.click() })()`)
    await sleep(150)
  }
  const acrossLanes = async (js) => {
    const out = []
    for (const lane of LANES) {
      await showLane(lane)
      out.push(...(await evaluate(js)))
    }
    await showLane(LANES[0])
    return out
  }
  check('Plan: the three lanes are tabs with Ready selected', (await evaluate(`[...document.querySelectorAll('main.page .plan-controls [role=tab]')].map((t) => (${tabText})(t) + ':' + t.getAttribute('aria-selected')).join(' ')`)) === 'Ready:true Up Next:false On Hold:false')
  // Every row says its lane under its state word: `Lane · substatus/reason`.
  const laneLabels = await acrossLanes(`[...document.querySelectorAll('main.page .plan-row .lane')].map((e) => (e.textContent || '').trim())`)
  check('Plan: every row carries a Lane · substatus label', laneLabels.length >= 3 && laneLabels.every((l) => /^(Ready|Up Next|On Hold) · \S/.test(l)), JSON.stringify(laneLabels.filter((l) => !/^(Ready|Up Next|On Hold) · \S/.test(l)).slice(0, 3)))
  // The focus controls are toggles over the same rows, and their counts come
  // from the board rather than from a constant.
  check('Plan: the focus controls are pressable toggles with live counts', (await evaluate(`[...document.querySelectorAll('main.page .plan-controls .focus')].map((b) => (b.textContent || '').replace((b.querySelector('.count') || {}).textContent || '', '').trim() + '=' + ((b.querySelector('.count') || {}).textContent || '') + '/' + b.getAttribute('aria-pressed')).join(' | ')`)).match(/^Needs attention=\d+\/false \| Show completed=\d+\/false \| Show deferred=\d+\/false$/) !== null)
  check('Plan: Work type is a filter beside the toggles, never a lane', (await evaluate(`(() => { const s = document.querySelector('main.page .plan-controls .work-type select'); return s ? [...s.options].map((o) => o.textContent.trim()).join('|') : '' })()`)) === 'All work|Conditional Access|MFA & Authentication|Tenant setup|Resolution & decisions')
  // Correction A: the next marker is one row — the first Ready row in the
  // engine's order — and not every step the engine calls ready.
  const nextPills = Number(await evaluate(`document.querySelectorAll('main.page .plan-row .next-mark').length`))
  check('Plan: one row is marked next, and it is in the Ready lane', nextPills === 1, `next pills=${nextPills}`)
  const readyRows = Number(await evaluate(`[...document.querySelectorAll('main.page .plan-row')].filter((r) => ((r.querySelector('.status') || {}).textContent || '').trim() === 'Ready').length`))
  check('Plan: ready work outnumbers the next step, so the marker is not a synonym for ready', readyRows > nextPills, `Ready rows=${readyRows} next=${nextPills}`)
  // Correction B: the board's timing column. The generic `now` every
  // prerequisite and check carries is dropped, and a held row says so instead of
  // borrowing its wave's date.
  check('Plan: the board drops the generic now from supporting rows', (await evaluate(`[...document.querySelectorAll('main.page .plan-row .when')].map((e) => (e.textContent || '').trim()).filter((t) => t === 'now').length`)) === 0)
  // A held row reads Held (or the threshold, review or records that hold it); a
  // row only sequenced after a scheduled prerequisite is not held, keeps its date
  // and names what it comes after (roadmap/holds.ts). A date is never shown on a
  // Blocked row without that.
  const blockedWhens = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].filter((r) => ((r.querySelector('.status') || {}).textContent || '').trim() === 'Blocked').map((r) => ({ when: ((r.querySelector('.when') || {}).textContent || '').trim(), reason: ((r.querySelector('.plan-row-reason') || {}).textContent || '').trim() }))`)
  // A dated Blocked row is sequenced after something (after: …) or is a create the
  // plan schedules while a threshold holds its enforcement (when …): roadmap/stepSchedule.ts.
  const blockedWrong = blockedWhens.filter(({ when, reason }) => !(when === 'Held' || when === 'Not scheduled' || /^After /.test(when) || /reaches|held|ready/i.test(when) || (/\d{4}$/.test(when) && /^(after: |when )/.test(reason))))
  check('Plan: a Blocked row reads what it waits on or Held, or its date beside what it comes after', blockedWrong.length === 0, JSON.stringify(blockedWrong.slice(0, 3)))
  // Every row's When and Impact say something (owner, 2026-09-11): never a blank cell.
  const blankCells = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].filter((r) => ((r.querySelector('.when') || {}).textContent || '').trim() === '' || ((r.querySelector('.who') || {}).textContent || '').trim() === '').map((r) => ((r.querySelector('.step-title') || {}).textContent || '').trim())`)
  check('Plan: no row leaves When or Impact blank', blankCells.length === 0, JSON.stringify(blankCells.slice(0, 3)))
  check('Plan: opening a row shows the content-driven step', (await evaluate(`(() => { const r = document.querySelector('main.page .plan-row'); if (r) r.click(); return !!r })()`)) && (await waitFor(`/Why/.test(document.body.innerText) && /Readiness/.test(document.body.innerText) && /Done when/.test(document.body.innerText)`)))
  check('Plan: the step title is nine words at most', await evaluate(`[...document.querySelectorAll('main.page .step-title')].every((e) => (e.textContent || '').trim().split(/\s+/).length <= 9)`))
  // The opened step is one frame attached under the row that opened it, with a
  // head and a main column, and the frame is the row's next element (task 034).
  const framed = await evaluate(
    `(() => { const s = document.querySelector('main.page .step'); if (!s) return null; const row = s.previousElementSibling; return { tag: s.tagName, head: !!s.querySelector(':scope > .step-head'), main: !!s.querySelector('.step-body > .step-main'), row: row ? row.className + '|' + row.getAttribute('aria-expanded') : null } })()`,
  )
  check('Plan: the opened step is a frame attached under the row that opened it', !!framed && framed.tag === 'ARTICLE' && framed.head && framed.main && framed.row === 'plan-row|true', JSON.stringify(framed))
  // The frame's own footer: under BOTH columns, not the last line of the main
  // column. It carries the rollout exception where the step is excludable and the
  // scan; the row above the step is what closes it (the approved Plan design).
  check('Plan: the opened step ends in the frame’s own footer, under both columns', await evaluate(`(() => { const st = document.querySelector('main.page .step'); const f = st && st.querySelector(':scope > .step-footer'); const body = st && st.querySelector(':scope > .step-body'); return !!(f && body && body.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) })()`))
  check('Plan: the footer offers the rollout exception and the scan, and nothing else', await evaluate(`(() => { const f = document.querySelector('main.page .step > .step-footer'); if (!f) return false; const b = [...f.querySelectorAll('button')].map((x) => (x.textContent || '').trim()); if (!b.includes('Scan to update the plan')) return false; return b.every((t) => ['Scan to update the plan', 'Exclude from rollout', "Doesn't apply here", 'Put this step back'].includes(t)) && !f.querySelector('button[disabled]') })()`))
  // The Readiness region and the Next milestone rail are on every opened step.
  check('Plan: the opened step draws Readiness and the Next milestone rail', await evaluate(`(() => { const st = document.querySelector('main.page .step'); if (!st) return false; const tiles = st.querySelectorAll('.readiness-strip .readiness-tile').length; const rail = st.querySelector('.step-side'); return tiles >= 1 && tiles <= 3 && !!st.querySelector('.readiness-bar') && !!rail && /Next milestone/i.test(rail.textContent || '') && rail.querySelectorAll('.side-block').length === 1 })()`))
  // The head badge carries the lifecycle and the condition, once. The line that
  // repeated them under the title is gone.
  check('Plan: the step head states the lifecycle and condition once', await evaluate(`document.querySelectorAll('main.page .step .step-state').length === 0 && !!document.querySelector('main.page .step .step-head .status')`))
  // The implementation control follows the capability: a strip only where there
  // is a choice, and never a one-tab tab set. A decision or check step with nothing
  // to implement by design draws no Implementation region at all (owner, 2026-09-11),
  // and a planning preview offers no Copy.
  check('Plan: the implementation control matches the channels that exist', await evaluate(`(() => { const st = document.querySelector('main.page .step'); if (!st) return true; const region = st.querySelector('.implementation-section'); if (!region) return true; const strip = region.querySelector('.tabs.impl-tabs'); const empty = region.querySelector('.implementation-empty'); if (region.getAttribute('data-preview') === 'true' && region.querySelector('.preview-actions [aria-label="Copy implementation"]')) return false; if (strip) return strip.querySelectorAll('[role=tab]').length >= 2 && !empty; return !!empty })()`))
  // The approved Plan pack's topbar is sticky, and it is the one app header.
  const stickyHeader = await evaluate(
    `(async () => { window.scrollTo(0, 800); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const hs = document.querySelectorAll('header.app'); const t = hs[0].getBoundingClientRect().top; window.scrollTo(0, 0); return { n: hs.length, top: Math.round(t), sticky: getComputedStyle(hs[0]).position } })()`,
  )
  check('Plan: the one app header stays put when the plan scrolls', !!stickyHeader && stickyHeader.n === 1 && stickyHeader.sticky === 'sticky' && stickyHeader.top === 0, JSON.stringify(stickyHeader))
  // A policy step's What-to-do tabs (Entra, PowerShell, JSON) and the
  // Download JSON artifact never carry a forbidEverywhere string. Open the row of
  // a policy step until the tabs render.
  await evaluate(`(async () => { const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); for (const r of [...document.querySelectorAll('main.page .plan-row')]) { r.click(); await wait(140); if (document.querySelector('main.page .step-body .tabs .tab')) return true; r.click(); await wait(40); } return false })()`)
  if (await evaluate(`!!document.querySelector('main.page .step-body .tabs .tab')`)) {
    for (const tabLabel of ['JSON', 'PowerShell', 'Entra']) { await clickText(`/^${tabLabel}$/`); await sleep(120) }
    const stepText = await evaluate(`(document.querySelector('main.page .step') || {}).textContent || ''`)
    const stepHits = FORBID_EVERYWHERE.filter((f) => stepText.includes(f))
    check('Step: the What-to-do tabs carry no forbidden placeholder', stepHits.length === 0, stepHits.join('; '))
  }
  check('Plan: Plan settings opens the popover', (await clickText('/^Plan settings$/')) && (await waitFor(`document.querySelector('main.page .plan-settings') !== null`)))
  check('Plan: the footer names its groups', ((await evaluate(`[...document.querySelectorAll('main.page .plan-footer summary')].map((s) => s.textContent).join(' ')`)).match(/Already in place|Doesn't apply here|Not licensed|Housekeeping/g) || []).length >= 1)
  check('Plan: one status word per row', await evaluate(`[...document.querySelectorAll('main.page .plan-row .chip.status')].length >= 3`))
  // The Plan → MFA Readiness handoff (task 012): a step whose own enforcement
  // waits on the people it reaches being able to sign in the way it asks says so
  // and links there. Opening the link filters the page to those people and keeps
  // a way back to the step.
  await evaluate(`(async () => { const wait=(ms)=>new Promise(r=>setTimeout(r,ms)); for (const r of [...document.querySelectorAll('main.page .plan-row')]) { r.click(); await wait(140); if (document.querySelector('main.page a[href^="#/readiness/step/"]')) return true; r.click(); await wait(40); } return false })()`)
  const handoff = await evaluate(`(() => { const a = document.querySelector('main.page a[href^="#/readiness/step/"]'); if (!a) return null; const line = a.closest('p'); return { href: a.getAttribute('href'), text: (line ? line.textContent : a.textContent).replace(/\\s+/g, ' ').trim() } })()`)
  check('Plan: a step held on its own sign-in requirement links to MFA Readiness', !!handoff && /cannot meet its sign-in requirement/.test(handoff.text), handoff && handoff.text)
  if (handoff) {
    const wanted = Number((handoff.text.match(/^(\d+)/) ?? [])[1] ?? NaN)
    await send('Page.navigate', { url: `${BASE}${handoff.href}` })
    await sleep(1400)
    await waitFor(`/MFA Readiness/.test(document.body.innerText)`)
    const scoped = await evaluate(`document.querySelectorAll('main.page table.datatable tbody tr').length`)
    const t2 = await text()
    // The count bends its noun (pluralise): one person, or n people.
    check('MFA Readiness: opened from a step, it says which step and filters to its people', /Filtered to the \d+ (people|person)\b/.test(t2) && (Number.isNaN(wanted) || scoped === wanted), `${scoped} rows, the step said ${wanted}: ${(t2.match(/Filtered to[^\n]*/) ?? [''])[0]}`)
    check('MFA Readiness: and offers the way back to that step', /← Back to the step/.test(t2))
    // The counts above the table stay the whole tenant, not the filtered set.
    const scopedSummary = t2.match(SUMMARY_LINE)
    check('MFA Readiness: a Plan filter does not change the tenant-wide counts', !!scopedSummary && !!summaryLine && scopedSummary[2] === summaryLine[2], `${scopedSummary && scopedSummary[2]} vs ${summaryLine && summaryLine[2]}`)
    await go('plan')
    await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
  }
  check('Plan: no v2 vocabulary on the surface', !/Do it|Exit criteria|Assumes|Recovery card|Before anything else|handle-with-care/.test(pt) && !/ Wave /.test(pt))

  // Click a control by its exact visible label (a button, link or summary).
  const clickExact = (label, root = 'main.page') =>
    evaluate(`(() => { const r = document.querySelector(${JSON.stringify(root)}) ?? document; const b = [...r.querySelectorAll('button, a, summary')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (b) b.click(); return !!b })()`)

  // Export (target-state §7): six cards, every button makes bytes, and the plan
  // file round-trips carrying the tick just made.
  await go('export')
  await waitFor(`document.querySelectorAll('main.page .export-card').length >= 6`)
  check('Export: six cards render', (await evaluate(`document.querySelectorAll('main.page .export-card').length`)) === 6)
  for (const label of ['Download calendar (ICS)', 'MFA Readiness as CSV', 'Download every prompt', 'Download the bundle']) {
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
  // The five destinations, in the product's order: the Plan before the readiness
  // diagnostic that reads the people it waits on (task 017).
  check(
    'Header: the five destinations in order and the controls, no tenant tab (the tenant is on Connect)',
    !/Contoso Pty Ltd/.test(t) &&
      (await evaluate(`[...document.querySelectorAll('header.app nav a')].map((a) => a.textContent.trim()).join(' · ')`)) === 'Connect · Plan · MFA Readiness · Export · How' &&
      !/Recovery card/.test(t) &&
      /Account/.test(t),
    t.replace(/\s+/g, ' ').slice(0, 120),
  )
  // The lockup is the brand's, the tab title is the product's (task 030): the
  // approved packs and docs/brand/brand-manifest.json both set the wordmark to
  // IAMAI, and the tab title is the wordmark and the descriptor. IAMAI Planner
  // stays the registered application's name.
  check('Name: the wordmark is IAMAI and the tab title carries the wordmark and descriptor', /^IAMAI(?!\s+Planner)/.test(t.trim()) && (await evaluate('document.title')) === 'IAMAI — Microsoft Entra Planner', `${t.trim().slice(0, 40)} | ${await evaluate('document.title')}`)
  check('Header: no scan control and no scan age on any page', !/Scan to update the plan|scanned|Re-scan/.test(t), t.replace(/\s+/g, ' ').slice(0, 120))
  check('Header: the theme and Account controls are text, not button faces', await evaluate(`document.querySelectorAll('header.app .right button').length >= 2 && [...document.querySelectorAll('header.app .right button')].every((b) => { const cs = getComputedStyle(b); return cs.borderTopWidth === '0px' && cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.paddingLeft === '0px' })`))
  check('Header: no sidebar, no stepper', (await evaluate(`document.querySelectorAll('.stepper, .body-grid, .topbar').length`)) === 0)
  check('Header: the theme control names the mode it switches to', /Light theme|Dark theme/.test(t))
  await send('Page.navigate', { url: `${BASE}&state=noScan#/plan` })
  await sleep(1200)
  // The three destinations that read a scan wait for one and say why; Connect
  // and How hold no tenant data, so they are never offered dead (task 017).
  check(
    'Header (no scan): the three tabs that read a scan wait for one, and Connect and How stay live',
    (await evaluate(`[...document.querySelectorAll('header.app nav a[aria-disabled="true"]')].map((a) => a.textContent.trim()).join(' · ')`)) === 'Plan · MFA Readiness · Export' &&
      (await evaluate(`document.querySelector('header.app nav a[aria-disabled="true"]').title`)) === 'after the first scan' &&
      (await evaluate(`[...document.querySelectorAll('header.app nav a:not([aria-disabled])')].map((a) => a.textContent.trim()).join(' · ')`)) === 'Connect · How',
    await evaluate(`[...document.querySelectorAll('header.app nav a')].map((a) => a.textContent.trim() + (a.getAttribute('aria-disabled') ? ' (waiting)' : '')).join(' · ')`),
  )
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  await sleep(1200)
  t = await evaluate(`document.querySelector('header.app').innerText`)
  check('Header (signed out): only the wordmark and the theme control', /IAMAI/.test(t) && !/MFA Readiness|Account|Recovery/.test(t), t.replace(/\s+/g, ' '))

  // Failure paths and first-visitor tenants (prompt 31 §4): every page reads clearly, nothing breaks.
  await send('Page.navigate', { url: `${BASE}&licence=free#/plan` })
  await sleep(1500)
  check('Unlicensed tenant: the plan renders from configuration and directory data', await waitFor(`/[0-9]+ steps/.test(document.body.innerText)`))
  t = await text()
  check('Unlicensed tenant: the plan footer names what is not licensed', /Not licensed \(\d+\)/.test(t))
  await send('Page.navigate', { url: `${BASE}&licence=free#/readiness` })
  await sleep(1500)
  t = await text()
  check('Unlicensed tenant: MFA Readiness says why there are no sign-in records', /no sign-in records \(needs Entra ID P1 or P2\)/.test(t), (t.match(/[^\n]*sign-in records[^\n]*/) ?? [''])[0])
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

  // Forget this tenant clears every store for it (prompt 31 §2.8) and keeps the sign-in.
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
  // Forget keeps the sign-in (ui/actions.ts forgetTenant): Connect renders its not-scanned state, tile 1 still signed in.
  t = await text()
  check('Forget: Connect shows the not-scanned state, still signed in', /Signed in/.test(t) && /Scan tenant/.test(t) && !/Open the plan/.test(t), t.replace(/\s+/g, ' ').slice(0, 160))

  // The rule registry renders itself (validation-rules.md 5).
  await go('checks')
  await waitFor(HOW_DRAWN)
  t = await text()
  check('Checks: the reference page lists the registry by subject', /Every check IAMAI runs/.test(t) && /Emergency access accounts/.test(t) && /The exclusions group/.test(t))
  check('Checks: the severities render', /Must fix/.test(t) && /Recommended/.test(t) && /Note/.test(t))
  check('Checks: a break-glass rule is on the page in plain language', /Global Administrator is assigned permanently and active/.test(t))
  // Every check names its source, and the ones nobody documents say so (audit-program 6).
  check('Checks: every rule names a source', /Source/i.test(t) && /Microsoft: manage emergency access accounts/.test(t))
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
  // One pass of the sequence: land on Connect signed out, click the button while
  // it is still warming, then come back and read the trace MSAL left.
  const signInPass = async () => {
    await navigateFresh(`${BASE}&state=signedOut#/connect`)
    // Click as soon as the button exists — during the warm — not after it settles.
    await waitFor(`!!document.querySelector('.connect .connect-step-actions button')`)
    // The warming button carries a spinner but is not disabled, so an early click lands.
    const canClick = await evaluate(`(() => { const b = document.querySelector('.connect .connect-step-actions button'); return !!b && !b.disabled })()`)
    const clicked = await clickText('/Sign in with Microsoft/')
    await sleep(2800)
    // The queued click navigated away once ready; come back to the app's origin and
    // read the trace it left. The signed-out mock never runs initAuth, so nothing clears it.
    // A fresh document: if the click has not navigated yet, this page must end here
    // rather than carry its queued redirect into the checks that follow.
    await navigateFresh(`${BASE}&state=signedOut#/connect`)
    await sleep(1000)
    const trace = await evaluate(`Object.keys(sessionStorage).filter((k) => /msal|login\\.windows|microsoftonline/.test(k)).length`)
    return { canClick, clicked, trace }
  }
  let pass = await signInPass()
  const clickable = pass.canClick
  const clickedSignIn = pass.clicked
  check('Sign-in: the warming button is clickable so an early click is not lost (item 7)', clickable)
  // Two halves of item 7. That the queued click lands on the button is ours and
  // is asserted here, always, on the first pass. That MSAL then wrote its request
  // is only true when login.microsoftonline.com answers the metadata fetch, so
  // that half is an external-health check: a Microsoft outage must not make
  // product CI red.
  check('Sign-in: the first click after load lands on the button, not lost to the warm (item 7)', clickedSignIn)
  if (EXTERNAL_HEALTH) {
    // No trace can mean two things, and they are not the same news. Ask the
    // authority directly: if it is wobbling (timeout, reset, 5xx, 429) the pass
    // is inconclusive and worth repeating; if it answers cleanly then Microsoft
    // is fine and a missing trace is ours, so stop and say so rather than spend
    // three passes reaching the same answer. At most MAX_ATTEMPTS passes.
    let why = `trace keys=${pass.trace}`
    for (let attempt = 2; pass.trace === 0 && attempt <= MAX_ATTEMPTS; attempt++) {
      const authority = await probe(AUTHORITY_METADATA)
      if (!authority.transient) {
        why = `trace keys=0 after ${attempt - 1} pass(es); authority answered ${authority.detail}, so this is not the network`
        break
      }
      console.log(`retry Sign-in (external): authority ${authority.detail}; pass ${attempt} of ${MAX_ATTEMPTS}`)
      await sleep(BACKOFF_MS[attempt - 2] ?? BACKOFF_MS[BACKOFF_MS.length - 1])
      pass = await signInPass()
      why = `trace keys=${pass.trace} after ${attempt} pass(es); authority ${authority.detail}`
    }
    check('Sign-in (external): the click starts the flow via the real authority metadata fetch (item 7)', clickedSignIn && pass.trace > 0, why)
  } else skip('Sign-in (external): the click starts the flow via the real authority metadata fetch (item 7)', `needs login.microsoftonline.com; runs in external-health. trace keys=${pass.trace}`)

  // The demo (prompt 50 item 16): a stranger enters from Connect with no
  // sign-in, walks the whole flow, advances to week two and back, leaves, and no
  // real tenant's storage is touched. Every demo store keys on the demo tenant
  // id; any other tenant id is a real one. In-demo navigation sets the hash so
  // the demo query survives (go() rebuilds the URL from BASE and would drop it).
  const DEMO_TENANT_ID = 'demo-sample-tenant'
  const realKeys = () =>
    evaluate(`(async () => { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); const out = []; for (const name of [...db.objectStoreNames]) { const tx = db.transaction(name); const rows = await new Promise((r) => { const q = tx.objectStore(name).getAll(); q.onsuccess = () => r(q.result) }); for (const x of rows) if (x && x.tenantId && !String(x.tenantId).startsWith(${JSON.stringify(DEMO_TENANT_ID)})) out.push(name + ':' + x.tenantId) } db.close(); return out.sort() })()`)
  const demoGo = async (hash) => {
    await evaluate(`location.hash = ${JSON.stringify('#/' + hash)}`)
    await sleep(900)
  }
  await navigateFresh(`${BASE}&state=signedOut#/connect`)
  await sleep(1500)
  const realBefore = await realKeys()
  check('Demo: Connect offers the sample-data entry (item 12)', await waitFor(`/Try it with sample data/.test(document.body.innerText)`))
  const demoErrBase = consoleErrors.length
  // Enter the demo by the link a visitor clicks, not by a crafted URL.
  await clickText('/Try it with sample data/')
  check('Demo: entering lands on the plan under the sample-data banner', await waitFor(`location.hash === '#/plan' && /Sample data/.test(document.body.innerText)`))
  await sleep(600)
  let demoText = await text()
  const demoDay1Header = await progressOf()
  check('Demo: the banner says nothing is from a real tenant and offers to leave', /Sample data . nothing here is from a real tenant/.test(demoText) && /Leave the demo/.test(demoText))
  // Three branches, and the held one has to name what holds it: a plan whose
  // policies wait on a safety object nobody has chosen is the ordinary first
  // visit, and 'cannot finish until' with nothing after it is a hole.
  check('Demo: the plan header shows progress tiles for steps, in place, waiting and remaining', /^Steps=\d+, In place=\d+, Waiting=\d+, Remaining=\d+$/.test(demoDay1Header), demoDay1Header)
  check('Demo: the demo chunk loads in demo mode', await evaluate(`performance.getEntriesByType('resource').some((e) => /\\/src\\/ui\\/demo\\.ts/.test(e.name))`))
  check('Demo: the header carries the sample-data banner, not the org name', !/Contoso Pty Ltd/.test(await evaluate(`document.querySelector('header.app').innerText`)) && /Sample data/.test(await text()))
  // Item 4: a readiness-held step renders as a Blocked row whose date column
  // reads the reason in the 46 shape, not a date.
  // A create the plan still makes while the threshold gates its enforcement reads
  // its creation day there and the threshold on its reason line (roadmap/stepSchedule.ts).
  const whenCols = (await acrossLanes(`[...document.querySelectorAll('main.page .plan-row')].map((r) => ((r.querySelector('.when') || {}).textContent || '').trim() + ' / ' + ((r.querySelector('.plan-row-reason') || {}).textContent || '').trim())`)).join(' | ')
  // Any family: the demo's held rows are the MFA ones now that the device and admin session gates are gone (E9).
  check('Demo: a readiness-held step reads its reason in the date column, or on its reason line beside its creation day', /when [A-Za-z ]*readiness reaches \d+% \(now \d+%\)/.test(whenCols), (whenCols.match(/[^|]*when [A-Za-z ]*readiness reaches[^|]*/) ?? ['none'])[0].trim())

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
    // The row may sit in any of the three lanes (S3): show each tab until it is there.
    let i = -1
    for (const lane of LANES) {
      await showLane(lane)
      i = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].findIndex((r) => ${re}.test(r.textContent) && r.closest('.plan-footer') === null)`)
      if (i >= 0) break
    }
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
  // A rollout exception: Block the Admin Portals for Non-Admins, from its footer,
  // with the operator's reason recorded (the approved Plan design's dialog).
  await demoGo('plan')
  let skipped = false
  let skipNote = ''
  if (await openRow('/Block the Admin Portals/')) {
    if (await clickText('/^Put this step back$/', 'main.page .step .step-footer')) {
      await sleep(400)
      await demoGo('plan')
      await openRow('/Block the Admin Portals/')
    }
    skipNote = await evaluate(`[...document.querySelectorAll('main.page .step .step-footer button')].map((b) => b.textContent.trim()).join('|')`)
    if (await clickText('/^Exclude from rollout$/', 'main.page .step .step-footer')) {
      await waitFor(`!!document.querySelector('main.page .step dialog[open] textarea')`, 3000)
      await evaluate(`(() => { const el = document.querySelector('main.page .step dialog[open] textarea'); if (!el) return false; const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(el, 'Not needed for this tenant'); el.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
      await sleep(150)
      skipped = await clickText('/^Exclude from rollout$/', 'main.page .step dialog[open] .dialog-actions-row')
      await sleep(400)
    }
  }
  // A skipped step is deferred work: its row is drawn only while `Show deferred` is pressed (S3).
  await evaluate(`(() => { const b = [...document.querySelectorAll('main.page .plan-controls .focus')].find((x) => /Show deferred/.test(x.textContent || '')); if (b && b.getAttribute('aria-pressed') !== 'true') b.click() })()`)
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
    // The decision is looked for by key, not by position: the record also holds
    // the sample technician's own decisions (the emergency accounts), and which
    // one JSON writes first is not what this check is about.
    typeof recordBefore === 'string' && /"stepDecisions":\{/.test(recordBefore) && /"s-prereq-service-accounts-group":/.test(recordBefore) && /"skips":\{[^}]*"s-goal-admin-portals-protected"/.test(recordBefore) && /"startDate":"2026-10-05/.test(recordBefore),
    String(recordBefore).slice(0, 200),
  )
  await demoGo('plan')
  await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
  // The board draws one lane at a time and keeps the lane the last opened step
  // put it on (S5 TabFollowsOpenStep), so both readings are taken on the same lane.
  // Both toggles pressed for both readings: the skip above pressed Show
  // deferred, and a loaded plan starts with neither pressed.
  // One press at a time: each toggle's handler spreads the focus it rendered
  // with, so two clicks in one tick keep only the second (Plan.tsx onFocus).
  const revealAll = async () => {
    for (const word of ['Show completed', 'Show deferred']) {
      await evaluate(`(() => { const b = [...document.querySelectorAll('main.page .plan-controls .focus')].find((x) => (x.textContent || '').includes(${JSON.stringify(word)})); if (b && b.getAttribute('aria-pressed') !== 'true') b.click() })()`)
      await sleep(250)
    }
  }
  await showLane(LANES[0])
  await revealAll()
  await sleep(150)
  const planTextBefore = await mainText()
  const progressBefore = await progressOf()
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
  // The load saves the record, then the mappings, and the plan regenerates on
  // each (ui/actions.ts tenantTurn): the rows are read once the header's counts
  // are back to what they were, not on the first render after the first save.
  await waitFor(`[...document.querySelectorAll('main.page .plan-progress-tile')].map((t) => ((t.querySelector('dt') || {}).textContent || '').trim() + '=' + ((t.querySelector('dd') || {}).textContent || '').trim()).join(', ') === ${JSON.stringify(progressBefore)}`, 8000)
  await sleep(500)
  const recordAfter = await planRecord()
  await showLane(LANES[0])
  await revealAll()
  await sleep(150)
  const planTextAfter = await mainText()
  const firstDiff = (a, b) => { const i = [...a].findIndex((ch, k) => ch !== b[k]); return i < 0 ? '' : `at ${i}: "${a.slice(Math.max(0, i - 40), i + 60).replace(/\s+/g, ' ')}" vs "${b.slice(Math.max(0, i - 40), i + 60).replace(/\s+/g, ' ')}"` }
  check('Demo: the loaded plan re-renders with the same decisions, start date and skips', recordAfter === recordBefore, recordAfter === recordBefore ? '' : firstDiff(String(recordBefore), String(recordAfter)))
  check('Demo: the loaded plan renders the same rows as before the save', planTextAfter === planTextBefore, planTextAfter === planTextBefore ? '' : firstDiff(planTextBefore, planTextAfter))

  // MFA Readiness renders over the sample people.
  await demoGo('readiness')
  check('Demo: MFA Readiness renders over the sample people', await waitFor(`document.querySelectorAll('main.page table.datatable tbody tr').length >= 4`))

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

  // The banner's snapshot selector moves the sample between its two synthetic
  // scans (task 026), and Connect's Scan again advances to the follow-up one.
  // On the follow-up scan the exclusions-group step is done and two Wave 1
  // policies are in report-only, so the plan differs in its rows and the header's
  // "in place" count rises (prompt 50.1 item 5) — the fix a decisions-only record
  // makes possible: the ratchet no longer pins day-one statuses across the scan.
  await demoGo('plan')
  await waitFor(`/Sample data/.test(document.body.innerText)`)
  await sleep(400)
  // The pressed button in the banner's selector names the snapshot on screen.
  const shownSnapshot = () => evaluate(`((document.querySelector('.demo-banner .demo-snapshots button[aria-pressed="true"]') || {}).textContent || '').trim()`)
  check('Demo: the banner names the snapshot on screen and the sample starts on the initial scan', (await shownSnapshot()) === 'Initial scan', await shownSnapshot())
  // The plan may still be a chunk away on a slow runner (the surfaces load on
  // demand since prompt 53): wait for its rows, and never read a missing main.
  const planBody = async () => {
    await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
    return evaluate(`(document.querySelector('main.page') || document.body).innerText`)
  }
  const headerOf = (body) => (body.match(/Steps\s*\d+\s*In place\s*\d+\s*Waiting\s*\d+\s*Remaining\s*\d+/) ?? [''])[0].replace(/\s+/g, ' ').trim()
  const inPlaceOf = (body) => Number((body.match(/In place\s*(\d+)\s*Waiting/) ?? [])[1] ?? '0')
  const day1Body = await planBody()
  const day1Header = headerOf(day1Body)
  // Each plan row as the visitor reads it, flattened in Node (a regex in an
  // evaluate() template loses its backslashes).
  const planRows = async () => {
    await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
    return (await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((r) => r.textContent.trim())`)).join(' ~ ')
  }
  // The initial scan as the visitor leaves it: the plan on screen, and the
  // inputs behind it (this run has already saved a decision and a skip on it).
  const day1Rows = await planRows()
  const day1Record = await planRecord()
  // The header has no scan control: the demo's Scan again lives on Connect's
  // Scan tile, and a hash change keeps the page (and the snapshot) alive.
  const demoScanAgain = async () => {
    await demoGo('connect')
    await waitFor(`[...document.querySelectorAll('main.page .connect-step button')].some((b) => /^Scan again$/.test((b.textContent || '').trim()))`)
    return clickText('/^Scan again$/', 'main.page')
  }
  // Connect in the demo: nobody is signed in, so tile 1 is sample context and
  // neither Microsoft action is on the page or in the header (task 026).
  await demoGo('connect')
  await waitFor(`document.querySelectorAll('main.page .connect-step').length > 0`)
  const demoConnectText = await mainText()
  check(
    'Demo: Connect tile 1 is the sample tenant, not a Microsoft sign-in, and offers no Microsoft action',
    /Sample tenant/.test(demoConnectText) && /IAMAI is not connected to Microsoft\./.test(demoConnectText) && !/Sign out|Sign in with another account/.test(demoConnectText) && !/Account/.test(await evaluate(`document.querySelector('header.app').innerText`)),
    demoConnectText.replace(/\s+/g, ' ').slice(0, 160),
  )
  check('Demo: Connect offers Scan again', await demoScanAgain())
  check('Demo: Scan again advances to the follow-up snapshot', await waitFor(`((document.querySelector('.demo-banner .demo-snapshots button[aria-pressed="true"]') || {}).textContent || '').trim() === 'Follow-up scan'`))
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
  // The public demo's implementation path: the follow-up scan's held Intune
  // enrollment policy is prepared in report-only (Step 5), through the normal
  // engine. Its JSON copies exactly what the preview shows, with its ids, and parses.
  const INTUNE = JSON.stringify('Require a Fresh Sign-in for Intune Enrollment')
  const intuneStep = `(() => { const t = [...document.querySelectorAll('main.page .plan-row .step-title')].find((x) => x.textContent.trim() === ${INTUNE}); if (!t) return null; let n = t.closest('.plan-row').nextElementSibling; return n && (n.matches('.step') ? n : n.querySelector('.step')) })()`
  // The row may sit in any lane (S3): show each tab until it is there, then open it.
  for (const lane of LANES) {
    await showLane(lane)
    if (await evaluate(`(() => { const t = [...document.querySelectorAll('main.page .plan-row .step-title')].find((x) => x.textContent.trim() === ${INTUNE}); if (!t) return false; const r = t.closest('.plan-row'); r.scrollIntoView({ block: 'center' }); if (r.getAttribute('aria-expanded') !== 'true') r.click(); return true })()`)) break
  }
  const intuneJsonTab = await waitFor(`(() => { const st = ${intuneStep}; const tab = st && [...st.querySelectorAll('.implementation-section [role=tab]')].find((x) => x.textContent.trim() === 'JSON'); if (tab) tab.click(); return !!tab })()`, 8000)
  await sleep(300)
  const intunePreview = intuneJsonTab ? await evaluate(`(() => { const p = ${intuneStep}.querySelector('.implementation-section .impl-preview .preview-text'); return p ? p.innerText : '' })()`) : ''
  const copiedBefore = await evaluate('window.__copied.length')
  if (intuneJsonTab) await evaluate(`(() => { const b = ${intuneStep}.querySelector('.implementation-section .preview-actions button'); if (b) b.click(); return !!b })()`)
  await waitFor(`window.__copied.length > ${copiedBefore}`, 3000)
  const intuneCopied = await evaluate(`window.__copied.length > ${copiedBefore} ? window.__copied[window.__copied.length - 1] : ''`)
  let intuneParses = false
  try { intuneParses = typeof JSON.parse(intuneCopied).displayName === 'string' } catch {}
  check(
    'Demo: a held policy prepared in report-only offers JSON, and Copy copies the preview exactly and it parses',
    intuneJsonTab && intuneCopied.length > 0 && intuneCopied.replace(/\s+/g, ' ').trim() === intunePreview.replace(/\s+/g, ' ').trim() && intuneParses && !/guid-\d{4}|REDACTED/.test(intuneCopied),
    `tab ${intuneJsonTab}, preview ${intunePreview.length} chars, copied ${intuneCopied.length} chars, parses ${intuneParses}`,
  )
  await evaluate(`(() => { const t = [...document.querySelectorAll('main.page .plan-row .step-title')].find((x) => x.textContent.trim() === ${INTUNE}); const r = t && t.closest('.plan-row'); if (r && r.getAttribute('aria-expanded') === 'true') r.click(); return true })()`)
  // Scan again only ever moves forward; the way back to the initial scan is the
  // banner's selector, which names the snapshot it selects.
  await demoScanAgain()
  check('Demo: a second Scan again stays on the follow-up snapshot', (await shownSnapshot()) === 'Follow-up scan', await shownSnapshot())
  await demoGo('plan')
  const backToInitial = await clickText('/^Initial scan$/', '.demo-banner')
  check(
    'Demo: the banner selector returns to the initial scan and the plan re-derives from it',
    backToInitial && (await waitFor(`((document.querySelector('.demo-banner .demo-snapshots button[aria-pressed="true"]') || {}).textContent || '').trim() === 'Initial scan'`)) && (await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)),
    await shownSnapshot(),
  )
  // And it is the initial scan, not a hybrid: the sample is one tenant read
  // twice and the app stores one plan record per tenant, so the follow-up
  // scan's seeded decisions, its checkpoints and what it saw of each policy
  // used to stay behind in that record and the initial plan rendered over week
  // two's inputs. Each snapshot keeps its own record now (ui/demo.ts
  // nextDemoRecord), so the plan comes back as it was left — including the
  // decision and the skip this run saved on it — and the record behind it does
  // too. The re-derivation is asynchronous: poll until it settles.
  let backRows = ''
  let backRecord = null
  for (let i = 0; i < 25; i++) {
    await sleep(200)
    backRows = await planRows()
    backRecord = await planRecord()
    if (backRows === day1Rows && backRecord === day1Record) break
  }
  check(
    'Demo: the initial scan comes back as it was left, with none of the follow-up scan\'s inputs',
    backRows === day1Rows && backRecord === day1Record,
    backRows === day1Rows && backRecord === day1Record
      ? `${day1Rows.split(' ~ ').length} rows and the record are what the initial scan was left with`
      : backRecord === day1Record
        ? `rows differ: left "${day1Rows.slice(0, 200)}" / back "${backRows.slice(0, 200)}"`
        : `record: left ${String(day1Record).slice(0, 200)} / back ${String(backRecord).slice(0, 200)}`,
  )

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

  // Sign out, Forget this tenant, and two tenants on one device (task 015).
  // Real IndexedDB and the real Account menu, because the whole question is
  // what each action leaves behind. A second tenant's rows are seeded beside
  // the mock tenant's, and every check reads the store rather than the page.
  const MOCK_TENANT = '00000000-0000-0000-0000-000000000000'
  const OTHER_TENANT = 'smoke-second-tenant'
  // Every row in the store, as store:tenantId, sorted: the shape both actions
  // are judged by.
  const storedRows = () =>
    evaluate(
      `(async () => { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); const out = []; for (const name of [...db.objectStoreNames]) { const rows = await new Promise((r) => { const q = db.transaction(name).objectStore(name).getAll(); q.onsuccess = () => r(q.result) }); for (const x of rows) if (x && x.tenantId) out.push(name + ':' + x.tenantId) } db.close(); return out.sort() })()`,
    )
  const rowsFor = async (tenantId) => (await storedRows()).filter((k) => k.endsWith(':' + tenantId))
  // A row in every store for the other tenant, on the key paths the app uses,
  // so forgetting one tenant has something real of the other to leave alone.
  const seedOtherTenant = () =>
    evaluate(
      `(async () => { const req = indexedDB.open('iamai'); const db = await new Promise((r) => { req.onsuccess = () => r(req.result) }); const t = ${JSON.stringify(OTHER_TENANT)}; const put = (store, value) => new Promise((res, rej) => { const q = db.transaction(store, 'readwrite').objectStore(store).put(value); q.onsuccess = () => res(); q.onerror = () => rej(q.error) }); await put('signin-rows', { tenantId: t, id: 'row-1', userId: 'u-9' }); await put('evidence-meta', { tenantId: t, covered: { from: '2026-08-01', to: '2026-09-01' }, asOf: '2026-09-01T00:00:00.000Z', schema: 1 }); await put('group-members', { tenantId: t, groupId: 'g-9', displayName: 'Other exclusions', membershipRule: null, memberCount: 1, memberIds: ['u-9'], sampled: false, asOf: '2026-09-01T00:00:00.000Z' }); await put('mapping', { tenantId: t, breakGlassUserIds: ['u-9'] }); await put('plan', { tenantId: t, planId: 'other', skips: {} }); await put('snapshot', { tenantId: t, snapshot: { tenantId: t }, at: '2026-09-01T00:00:00.000Z' }); await put('baseline', { tenantId: t, kind: 'github' }); db.close(); return true })()`,
    )
  // The Account menu in the header, and the two buttons in it. Opening it is a
  // render, so the item is waited for rather than looked for in the same tick.
  const menuItem = async (label) => {
    const opened = await evaluate(
      `(() => { const b = document.querySelector('header.app .menu button.text-control'); if (!b) return false; if (b.getAttribute('aria-expanded') !== 'true') b.click(); return true })()`,
    )
    if (!opened) return 'no Account menu'
    if (!(await waitFor(`document.querySelectorAll('header.app .menu-list button').length >= 2`, 4000))) return 'the menu did not open'
    const hit = await evaluate(
      `(() => { const b = [...document.querySelectorAll('header.app .menu-list button')].find((x) => (x.textContent || '').trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true })()`,
    )
    return hit ? 'clicked' : `no ${label} item`
  }
  const signedIn = () => evaluate(`!!document.querySelector('header.app .menu button.text-control')`)

  await send('Page.navigate', { url: `${BASE}#/plan` })
  await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
  await seedOtherTenant()
  const bothTenants = await storedRows()
  const mockRowsBefore = await rowsFor(MOCK_TENANT)
  const otherRowsBefore = await rowsFor(OTHER_TENANT)
  check(
    'Session: both tenants have records on this device before either action',
    mockRowsBefore.length > 0 && otherRowsBefore.length === 7,
    `mock=[${mockRowsBefore.join(', ')}] other=[${otherRowsBefore.join(', ')}]`,
  )

  // Sign out: authentication goes, records stay. This is also the proof that a
  // full local store is not a sign-in — the app draws the signed-out Connect
  // over a store still holding every row of both tenants.
  const signOutClick = await menuItem('Sign out')
  const signedOutUi = await waitFor(`location.hash === '#/connect' && /Sign in with Microsoft/.test(document.body.innerText)`)
  const afterSignOut = await storedRows()
  check('Sign out: the app is signed out and Connect asks for a sign-in again', signOutClick === 'clicked' && signedOutUi, signOutClick)
  check('Sign out: the header no longer offers the Account menu', (await signedIn()) === false)
  check(
    'Sign out: nothing this device stored was deleted, so a full local store is not a sign-in',
    afterSignOut.length === bothTenants.length && afterSignOut.every((k, i) => k === bothTenants[i]),
    `before=${bothTenants.length} after=${afterSignOut.length}`,
  )
  check('Sign out: the tenant is gone from the header', !/Contoso Pty Ltd/.test(await evaluate(`document.querySelector('header.app').innerText`)))

  // Signing in again takes back this tenant's own records, and only its own.
  await send('Page.navigate', { url: `${BASE}#/plan` })
  const backIn = await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
  check('Sign in again: the tenant that was signed out of comes back with its own plan', backIn && (await signedIn()))

  // Forget this tenant: this tenant's records go, the other tenant's stay, and
  // the operator is still signed in — which is what makes it the other action.
  const forgetClick = await menuItem('Forget this tenant')
  const forgotUi = await waitFor(`location.hash === '#/connect'`)
  await sleep(800)
  const mockRowsAfter = await rowsFor(MOCK_TENANT)
  const otherRowsAfter = await rowsFor(OTHER_TENANT)
  check('Forget this tenant: the page returns to Connect', forgetClick === 'clicked' && forgotUi, forgetClick)
  check('Forget this tenant: every record this device held for it is gone', mockRowsAfter.length === 0, mockRowsAfter.join(', '))
  check(
    "Forget this tenant: the other tenant's records are untouched",
    otherRowsAfter.length === otherRowsBefore.length && otherRowsAfter.every((k, i) => k === otherRowsBefore[i]),
    `before=[${otherRowsBefore.join(', ')}] after=[${otherRowsAfter.join(', ')}]`,
  )
  check('Forget this tenant: the operator is still signed in, which is what holds it apart from Sign out', await signedIn())
  check(
    'Forget this tenant: Connect shows the tenant not scanned, and no plan is drawn from the forgotten scan',
    (await waitFor(`document.querySelectorAll('main.page .connect-step').length > 0`)) &&
      !/Open the plan/.test(await evaluate(`(document.querySelector('main.page') || document.body).innerText`)),
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

const note = skipped.length > 0 ? ` (${skipped.length} external check(s) not asked; EXTERNAL_HEALTH=1 asks them)` : ''
if (failures.length > 0) {
  // Exit 1, not 2: the harness ran and the product answered wrongly. The names
  // are repeated here so a reader has the list without scanning the whole log.
  console.error(`\nsmoke: ${failures.length} check(s) failed${note}`)
  for (const name of failures) console.error(`  FAIL ${name}`)
  process.exit(1)
}
console.log(`\nsmoke: every check passed${note}`)
process.exit(0)
