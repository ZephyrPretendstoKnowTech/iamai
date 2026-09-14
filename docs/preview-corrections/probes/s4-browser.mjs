// S4 browser probe (local, synthetic only). A local vite dev server and a local
// headless Chromium over CDP, the way scripts/smoke.mjs drives one. Every request
// to Microsoft, Graph or GitHub is blocked in the browser: nothing signs in and
// nothing leaves the machine but what the blocklist refuses.
//
// 1. C09: the Connect notice signed out, signed in (dev mock ?dev=1&mock=1) and
//    in the demo, light and dark, desktop and 375 px — screenshots + DOM facts.
// 2. C08: time to the first Plan step row for the demo: cold direct route,
//    reload, demo → non-demo, and a page frozen then resumed (the closest CDP
//    offers to background → foreground in headless).
//
// Usage: CHROME=<chrome.exe> node docs/preview-corrections/probes/s4-browser.mjs <outDir>
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const OUT = process.argv[2] ?? '../logs/s4/browser'
const CHROME = process.env.CHROME
if (!CHROME) throw new Error('set CHROME')
const PORT = Number(process.env.S4_PORT ?? 5231)
const CDP = Number(process.env.S4_CDP ?? 9471)
const ROOT = `http://localhost:${PORT}/`
mkdirSync(OUT, { recursive: true })
const report = []
const log = (k, v) => {
  report.push({ k, v })
  console.log(k, JSON.stringify(v))
}

const kill = () => {
  try { chrome?.kill() } catch {}
  try { vite.kill() } catch {}
}
setTimeout(() => { log('probe', 'global timeout 420 s'); writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2)); kill(); process.exit(3) }, 420_000).unref()

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
let up = false
for (let i = 0; i < 150 && !up; i++) {
  try { up = (await fetch(ROOT)).ok } catch { await sleep(200) }
}
if (!up) { kill(); throw new Error('vite did not start') }

const profile = `${process.env.TEMP ?? '/tmp'}/iamai-s4-profile-${PORT}`
rmSync(profile, { recursive: true, force: true })
var chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
let targets = []
for (let i = 0; i < 150 && !targets.some((t) => t.type === 'page'); i++) {
  try { targets = await (await fetch(`http://localhost:${CDP}/json/list`)).json() } catch { await sleep(200) }
}
const page = targets.find((t) => t.type === 'page')
if (!page) { kill(); throw new Error('no page target') }
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const errors = []
const blocked = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  else if (msg.method === 'Network.loadingFailed' && msg.params.blockedReason) blocked.push(msg.params.blockedReason)
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  return r.result?.exceptionDetails ? { error: r.result.exceptionDetails.exception?.description } : r.result?.result?.value
}
const waitFor = async (expr, ms) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    let hit = false
    try { hit = (await evaluate(`!!(${expr})`)) === true } catch {}
    if (hit) return Date.now() - t0
    await sleep(100)
  }
  return null
}
await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Network.setBlockedURLs', { urls: ['*login.microsoftonline.com*', '*login.live.com*', '*graph.microsoft.com*', '*github.com*', '*githubusercontent.com*', '*cloudflareinsights*'] })

const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  if (r.result?.data) writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'))
}
const theme = async (dark) => {
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] })
}
const width = async (w) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 500 })
}
const NOTICE = `document.querySelector('.surface.connect > .callout')`
const noticeFacts = `(() => {
  const n = ${NOTICE}
  if (!n) return { present: false, h2: [...document.querySelectorAll('h2')].map((h) => h.innerText).slice(0, 4) }
  const a = n.querySelector('a')
  const firstControl = document.querySelector('.surface.connect .connect-flow button, .surface.connect .connect-flow a.btn')
  const cs = getComputedStyle(n)
  const r = n.getBoundingClientRect()
  return {
    present: true,
    count: document.querySelectorAll('.surface.connect > .callout').length,
    title: n.querySelector('strong')?.innerText,
    text: n.innerText,
    href: a?.getAttribute('href'),
    aboveControls: firstControl ? !!(n.compareDocumentPosition(firstControl) & Node.DOCUMENT_POSITION_FOLLOWING) : 'no control found',
    firstControl: firstControl?.innerText,
    inputs: n.querySelectorAll('input, button, dialog').length,
    dialogs: document.querySelectorAll('dialog[open], [role=dialog]').length,
    color: cs.color, background: cs.backgroundColor, border: cs.borderColor,
    box: { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) },
    viewport: innerWidth,
    pageOverflowX: document.documentElement.scrollWidth > innerWidth,
    theme: document.documentElement.getAttribute('data-theme'),
    link: a ? getComputedStyle(a).color : null,
    h2: [...document.querySelectorAll('.connect-step h2')].map((h) => h.innerText).slice(0, 3),
  }
})()`

// ---- C09: the notice ----
const connectCases = [
  ['signed-out', `${ROOT}#/connect`],
  ['mock-signed-in', `${ROOT}?dev=1&mock=1#/connect`],
  ['demo', `${ROOT}?demo=1#/connect`],
]
for (const [name, url] of connectCases) {
  for (const [dark, w] of [[false, 1280], [true, 1280], [false, 375], [true, 375]]) {
    await theme(dark)
    await width(w)
    await send('Page.navigate', { url })
    await waitFor(`${NOTICE} && document.querySelector('.connect-flow')`, 30000)
    // The app's theme is the stored preference first (AppShell.tsx useTheme), so
    // the emulated media alone does not switch it: store the theme and reload.
    await evaluate(`localStorage.setItem('iamai-theme', '${dark ? 'dark' : 'light'}')`)
    await send('Page.reload', { ignoreCache: false })
    await sleep(300)
    const t = await waitFor(`${NOTICE} && document.querySelector('.connect-flow')`, 30000)
    await sleep(800)
    const tag = `${name}-${dark ? 'dark' : 'light'}-${w}`
    log(`c09 ${tag}`, { waitedMs: t, ...(await evaluate(noticeFacts)) })
    await shot(`c09-${tag}`)
  }
}
await send('Emulation.clearDeviceMetricsOverride')
await theme(false)

// ---- C08: first-use loading, demo and dev mock ----
// The Plan has drawn: the selector scripts/smoke.mjs's "Plan renders at #/plan" check waits for.
const ROWS = `document.querySelector('main.page .plan-progress-tile')`
const bodyText = `document.body ? document.body.innerText.slice(0, 300) : ''`
// cold direct route in a fresh document (the profile has not seen the Plan route yet)
await send('Page.navigate', { url: 'about:blank' })
await sleep(300)
await send('Page.navigate', { url: `${ROOT}?demo=1#/plan` })
const demoCold = await waitFor(ROWS, 60000)
log('c08 demo cold direct #/plan', { msToFirstStep: demoCold, text: demoCold === null ? await evaluate(bodyText) : undefined })
await send('Page.reload', { ignoreCache: false })
await sleep(200)
const demoReload = await waitFor(ROWS, 60000)
log('c08 demo reload #/plan', { msToFirstStep: demoReload, text: demoReload === null ? await evaluate(bodyText) : undefined })
// demo -> non-demo: the banner's exit, then the Plan route with no tenant
await send('Page.navigate', { url: `${ROOT}#/connect` })
await waitFor(NOTICE, 30000)
await send('Page.navigate', { url: `${ROOT}#/plan` })
await sleep(4000)
log('c08 demo -> non-demo #/plan (no tenant)', { stepRow: await evaluate(`!!${ROWS}`), text: await evaluate(bodyText) })
// non-demo with a synthetic tenant (dev mock): cold direct, then reload
await send('Page.navigate', { url: 'about:blank' })
await sleep(300)
await send('Page.navigate', { url: `${ROOT}?dev=1&mock=1#/plan` })
const mockCold = await waitFor(ROWS, 60000)
log('c08 mock cold direct #/plan', { msToFirstStep: mockCold, text: mockCold === null ? await evaluate(bodyText) : undefined })
await send('Page.reload', { ignoreCache: false })
await sleep(200)
const mockReload = await waitFor(ROWS, 60000)
log('c08 mock reload #/plan', { msToFirstStep: mockReload, text: mockReload === null ? await evaluate(bodyText) : undefined })
// demo -> mock (a tenant after the sample)
await send('Page.navigate', { url: `${ROOT}?demo=1#/plan` })
await waitFor(ROWS, 60000)
await send('Page.navigate', { url: `${ROOT}?dev=1&mock=1#/plan` })
const demoToMock = await waitFor(ROWS, 60000)
log('c08 demo -> mock #/plan', { msToFirstStep: demoToMock, text: demoToMock === null ? await evaluate(bodyText) : undefined })
// frozen while loading, then resumed
await send('Page.navigate', { url: 'about:blank' })
await sleep(300)
await send('Page.navigate', { url: `${ROOT}?demo=1#/plan` })
await sleep(300)
await send('Page.setWebLifecycleState', { state: 'frozen' })
await sleep(5000)
await send('Page.setWebLifecycleState', { state: 'active' })
const resumed = await waitFor(ROWS, 60000)
log('c08 demo frozen 5 s during load, resumed', { msToFirstStepAfterResume: resumed, text: resumed === null ? await evaluate(bodyText) : undefined })

log('page exceptions', errors.slice(0, 10))
log('blocked requests', blocked.length)
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2))
kill()
process.exit(0)
