// Measures the responsive behaviour of the four approved surfaces, in the
// canonical HTML and in the built application, at a list of widths (task 039).
//
//   node scripts/responsive-probe.mjs                    every surface, every width
//   node scripts/responsive-probe.mjs --only plan        one surface
//   node scripts/responsive-probe.mjs --theme dark       the production theme to read
//   node scripts/responsive-probe.mjs --json out.json    the readings as data
//
// Why this exists. scripts/render-design.mjs writes PNGs, and a picture is how
// a person checks a layout — but it cannot answer "does the rail's border move
// from left to top at 940" without somebody eyeballing twelve plates, and it
// renders three fixed widths that are not any pack's breakpoints. A responsive
// CONFORMANCE claim is a claim about a transition: which grid a row uses on
// each side of a threshold, whether a value is still on the page, whether the
// document is wider than the window. Those are measurements, so this reads them
// out of the live layout instead of asking a reviewer to trust a screenshot.
//
// It changes nothing. It opens the canonical packs read-only over file:// and
// the built site over a local static server, exactly as render-design.mjs does,
// and drives the same headless Chrome over CDP. No network, no CDN, no upload.
//
// The canonical HTML remains the authority: a reading here describes what a
// document DOES, and the comparison of the two readings is the evidence. Where
// production deliberately differs from a pack (the shared shell's navigation is
// real navigation, not a mock's decoration) the difference is recorded in
// src/ui/responsive.test.ts, which is the contract this script measures.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const root = resolve(import.meta.dirname, '..')
const at = (p) => resolve(root, p)
const arg = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

/**
 * What is read out of one element. Everything here is a computed value, so a
 * reading says what the browser actually resolved rather than what a stylesheet
 * hoped for — a `grid-template-columns` reads back as used pixel tracks, which
 * is precisely the fact a "does this row collapse" claim needs.
 */
const READ = `(el) => {
  if (!el) return null
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  return {
    cols: cs.gridTemplateColumns,
    display: cs.display,
    flexDirection: cs.flexDirection,
    textAlign: cs.textAlign,
    fontSize: cs.fontSize,
    borderLeft: cs.borderLeftWidth,
    borderTop: cs.borderTopWidth,
    paddingLeft: cs.paddingLeft,
    gridColumn: cs.gridColumnStart + '/' + cs.gridColumnEnd,
    w: Math.round(r.width),
    x: Math.round(r.left),
    visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden',
  }
}`

/**
 * The surfaces, each with the canonical file it is judged against, the built
 * route it renders at, and the elements whose responsive relationship the pack
 * actually describes. `c` is the canonical selector, `p` the production one;
 * where a pack has no counterpart (a shared shell role) `c` is null and the
 * reading is production-only.
 */
const SURFACES = {
  home: {
    canonical: 'docs/design/approved/home-v2.html',
    route: { home: true },
    breakpoints: [760, 560],
    probes: [
      { key: 'product', c: '.product', p: '.product' },
      { key: 'side', c: '.side', p: '.side' },
      { key: 'catch', c: '.catch', p: '.catch' },
      { key: 'h1', c: 'h1', p: '.hero h1' },
      { key: 'heroP', c: '.hero p', p: '.hero .site-line' },
      { key: 'hero', c: '.hero', p: '.hero' },
      { key: 'wrap', c: '.wrap', p: 'main.page' },
      { key: 'trust', c: '.trust', p: '.trust' },
      { key: 'firstLink', c: '.links a:first-child', p: 'header.app .links a:first-child' },
      { key: 'cta', c: '.links a:last-child', p: '.hero .cta, .hero a.btn-primary, header.app .links a:last-child' },
    ],
  },
  connect: {
    canonical: 'docs/design/approved/connect-v3.html',
    route: { hash: '#/connect' },
    breakpoints: [760],
    probes: [
      { key: 'statusBar', c: '.status-bar', p: '.connect-status' },
      { key: 'step', c: '.step', p: '.connect-step' },
      { key: 'actions', c: '.actions', p: '.connect-step-actions' },
      { key: 'ready', c: '.ready', p: '.connect-destination' },
      { key: 'h1', c: 'h1', p: '.surface.connect h1' },
      { key: 'page', c: '.page', p: 'main.page' },
      { key: 'n', c: '.step .n', p: '.connect-step .n' },
      { key: 'flow', c: '.flow', p: '.connect-flow' },
    ],
  },
  plan: {
    canonical: 'docs/design/approved/plan-step-v1.html',
    route: { hash: '#/plan', openStep: true },
    breakpoints: [940, 650],
    probes: [
      { key: 'row', c: '.roadmap-row', p: 'main.page .plan-row' },
      { key: 'rowMeta', c: '.row-meta', p: 'main.page .plan-row .who' },
      { key: 'rowDate', c: '.row-date', p: 'main.page .plan-row .when' },
      { key: 'stepBody', c: '.step-body', p: '.step-body.has-rail' },
      { key: 'stepSide', c: '.step-side', p: '.step-side' },
      { key: 'findings', c: '.findings', p: '.step .findings' },
      { key: 'headTop', c: '.step-head-top', p: '.step-head-top' },
      { key: 'h1', c: '.hero h1', p: '.surface.plan h1' },
      { key: 'page', c: '.page', p: 'main.page' },
      { key: 'stepMain', c: '.step-main', p: '.step-main' },
      { key: 'stepHead', c: '.step-head', p: '.step-head' },
      { key: 'trackLabels', c: '.track-labels', p: '.step .track' },
    ],
  },
  readiness: {
    canonical: 'docs/design/approved/mfa-readiness-v2.html',
    route: { hash: '#/readiness' },
    breakpoints: [900, 620],
    probes: [
      { key: 'summary', c: '.summary', p: '.readiness-summary' },
      { key: 'summaryMain', c: '.summary-main', p: '.readiness-summary .summary-main' },
      { key: 'stat1', c: '.summary-stat:nth-of-type(1)', p: '.readiness-summary .summary-stat:nth-of-type(1)' },
      { key: 'tableHead', c: '.table-head', p: '.surface.readiness table.datatable thead' },
      { key: 'row', c: '.row', p: '.surface.readiness table.datatable tbody tr' },
      { key: 'cellKey', c: null, p: '.surface.readiness .cell-key' },
      { key: 'callout', c: '.callout', p: '.surface.readiness .callout .callout-body' },
      { key: 'h1', c: 'h1', p: '.surface.readiness .display' },
      { key: 'page', c: '.page', p: 'main.page' },
      { key: 'toolbar', c: '.toolbar', p: '.surface.readiness .toolbar' },
    ],
  },
}

/** Page-level facts every surface owes at every width. */
const DOC = `(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  worst: (() => {
    let worst = null
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      const over = Math.round(r.right - window.innerWidth)
      if (over > 1 && (!worst || over > worst.over)) {
        worst = { over, tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60) }
      }
    }
    return worst
  })(),
}))()`

// ---- Chrome, the way scripts/render-design.mjs finds and drives it ----
const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]
  .filter(Boolean)
  .find((p) => existsSync(p))
if (!CHROME) {
  console.error('responsive-probe: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}

function serve(dir) {
  const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' }
  return createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0]
    let file = join(dir, decodeURIComponent(url))
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      res.writeHead(404)
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': `${TYPES[extname(file)] ?? 'application/octet-stream'}; charset=utf-8` })
    res.end(readFileSync(file))
  })
}

const CDP_PORT = Number(process.env.PROBE_CDP_PORT ?? 9451)
const profile = `${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-probe-profile`
const chrome = spawn(
  CHROME,
  ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP_PORT}`, 'about:blank'],
  { stdio: 'ignore' },
)
let targets = []
for (let i = 0; i < 300 && targets.length === 0; i++) {
  try {
    targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json()
  } catch {
    await sleep(200)
  }
}
const target = targets.find((t) => t.type === 'page')
if (!target) {
  console.error('responsive-probe: Chrome exposed no page target within 60 s')
  chrome.kill()
  process.exit(2)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
const send = (method, params = {}) =>
  new Promise((res) => {
    const i = ++id
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
await send('Page.enable')

const evaluate = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })
  return r.result?.result?.value
}

/** Reads every probe of one surface at one width, without re-navigating. */
async function readAt(width, probes, which) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(260)
  const sel = JSON.stringify(probes.map((p) => [p.key, p[which]]))
  const out = await evaluate(`(() => {
    const read = ${READ}
    const rows = {}
    for (const [key, s] of ${sel}) rows[key] = s ? read(document.querySelector(s)) : null
    return { probes: rows, doc: ${DOC} }
  })()`)
  return out
}

const only = arg('--only')
const theme = arg('--theme', 'light')
const names = Object.keys(SURFACES).filter((n) => !only || only.split(',').includes(n))

/** Every width worth a reading: the required three, plus each side of each threshold. */
const widthsFor = (bps) => [...new Set([1280, 768, 390, ...bps.flatMap((b) => [b + 1, b, b - 1])])].sort((a, b) => b - a)

const report = {}

// ---- the canonical packs ----
for (const name of names) {
  const s = SURFACES[name]
  const url = `file:///${at(s.canonical).replace(/\\/g, '/')}`
  await send('Page.navigate', { url })
  await sleep(700)
  await evaluate('document.fonts.ready', true)
  report[name] = { canonical: {}, production: {} }
  for (const w of widthsFor(s.breakpoints)) report[name].canonical[w] = await readAt(w, s.probes, 'c')
}

// ---- the built application ----
const server = serve(at('dist'))
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port
const OPEN_STEP = `(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  for (const r of document.querySelectorAll('main.page .plan-row')) {
    r.click(); await wait(200)
    if (document.querySelector('main.page .step-body.has-rail')) return true
    r.click(); await wait(60)
  }
  return false
})()`

for (const name of names) {
  const s = SURFACES[name]
  const url = s.route.home ? `http://127.0.0.1:${port}/` : `http://127.0.0.1:${port}/planner/?demo=1${s.route.hash}`
  const setTheme = `try{localStorage.setItem('iamai.theme',${JSON.stringify(theme)})}catch(e){}`
  await send('Page.navigate', { url })
  await sleep(600)
  await evaluate(setTheme)
  await send('Page.navigate', { url })
  await sleep(1600)
  if (s.route.openStep) {
    const found = await evaluate(OPEN_STEP, true)
    if (!found) console.log(`responsive-probe: ${name} — no step with a rail opened; rail readings are not evidence`)
    await sleep(500)
  }
  await evaluate('document.fonts.ready', true)
  for (const w of widthsFor(s.breakpoints)) report[name].production[w] = await readAt(w, s.probes, 'p')
}

// ---- the report ----
for (const name of names) {
  const s = SURFACES[name]
  console.log(`\n${'='.repeat(72)}\n${name}  (canonical breakpoints ${s.breakpoints.join(', ')}; production theme ${theme})\n${'='.repeat(72)}`)
  for (const w of widthsFor(s.breakpoints)) {
    const c = report[name].canonical[w]
    const p = report[name].production[w]
    const mark = s.breakpoints.some((b) => Math.abs(w - b) <= 1) ? ' *' : ''
    console.log(`\n-- ${w}px${mark}   canonical overflow ${c.doc.overflow}   production overflow ${p.doc.overflow}${p.doc.worst ? `  <- ${p.doc.worst.tag}.${p.doc.worst.cls} +${p.doc.worst.over}` : ''}`)
    for (const probe of s.probes) {
      const cv = c.probes[probe.key]
      const pv = p.probes[probe.key]
      const fmt = (v) => (v === null ? 'ABSENT' : `${v.visible ? '' : 'HIDDEN '}${v.display}${v.cols !== 'none' ? ` cols=${v.cols}` : ''}${v.display === 'flex' ? ` dir=${v.flexDirection}` : ''} fs=${v.fontSize} bl=${v.borderLeft} bt=${v.borderTop} ta=${v.textAlign} w=${v.w}`)
      console.log(`   ${probe.key.padEnd(13)} C: ${fmt(cv)}`)
      console.log(`   ${''.padEnd(13)} P: ${fmt(pv)}`)
    }
  }
}

const jsonOut = arg('--json')
if (jsonOut) {
  writeFileSync(at(jsonOut), JSON.stringify(report, null, 1))
  console.log(`\nresponsive-probe: wrote ${jsonOut}`)
}

server.close()
ws.close()
chrome.kill()
process.exit(0)
