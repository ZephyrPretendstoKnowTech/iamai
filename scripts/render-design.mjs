// Renders a design authority, so a later pack can compare what it built with
// what the owner approved (task 030).
//
//   node scripts/render-design.mjs                 both sets
//   node scripts/render-design.mjs --canonical     the four approved HTML packs
//   node scripts/render-design.mjs --production    the built application shell
//   node scripts/render-design.mjs --list          what it would write, no browser
//
// Why this exists. Task 028 established the four approved HTML packs as the
// application-design authority, and recorded scripts/walk.mjs as the mechanism
// for rendered evidence at 1280/768/390. The walk renders the built application
// at 1280 only, and it cannot render the packs at all — so the evidence
// contract named a tool that could not produce it, and source-and-prose review
// went on passing without anybody putting the two pictures side by side. This
// script renders the authority itself, at all three widths.
//
// The hierarchy never inverts: the HTML is the authority and a PNG here is
// derived reference only. Nothing regenerates a pack from an image, and this
// script opens the canonical files read-only.
//
// It drives the same Chrome over CDP that scripts/walk.mjs, scripts/smoke.mjs
// and scripts/gen-brand.mjs already drive: no screenshot framework is added for
// twelve pictures, and everything is local — no network, no CDN, no upload.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const root = resolve(import.meta.dirname, '..')
const at = (p) => resolve(root, p)

/** The widths every restoration pack owes evidence at (docs/design/approved/manifest.json renderedEvidence). */
export const WIDTHS = [1280, 768, 390]

/** The height a full-page capture is clipped to, so one long pack cannot produce a 20 MB plate. */
const MAX_HEIGHT = 4000

const MANIFEST = 'docs/design/approved/manifest.json'
const OUT_CANONICAL = 'docs/design/approved/rendered'

/**
 * Where the production plates land. The canonical set is the authority's own
 * render and always overwrites itself — the packs do not change, so a second
 * copy would only rot. The production set is evidence *about one task*: task
 * 030 shot `docs/screens/30`, and a later pack that overwrote it would destroy
 * the before-picture its own report cites. So the directory is an argument,
 * the task-numbered convention is kept, and 030's plates stay where its report
 * says they are.
 *
 *   node scripts/render-design.mjs --production --out docs/screens/031
 *
 * Mind the numbering. `docs/screens/21` … `45` are the ORIGINAL prompt series'
 * screenshots and are still tracked; `docs/screens/30` is task 030's set
 * sharing a directory with prompt 30's. A restoration pack writes to its
 * zero-padded number (`docs/screens/031`) so it cannot land on top of a
 * historical record — 39 and 41-45 are occupied too.
 */
const outFlag = process.argv.indexOf('--out')
const OUT_PRODUCTION = outFlag !== -1 && process.argv[outFlag + 1] ? process.argv[outFlag + 1].replace(/\\/g, '/') : 'docs/screens/30'

/** The four approved packs, read from the manifest rather than listed again here. */
export function canonicalTargets() {
  const manifest = JSON.parse(readFileSync(at(MANIFEST), 'utf8'))
  return manifest.surfaces.map((s) => ({ surface: s.surface, path: s.path, out: `${OUT_CANONICAL}/${s.surface}` }))
}

/** Every file this script writes, in order. A manifest of expected outputs, without a browser. */
export function expectedOutputs() {
  return canonicalTargets().flatMap((t) => WIDTHS.map((w) => `${t.out}/${w}.png`))
}

/** The routes and themes the built application is shot in (task 030 Part Q). */
const PRODUCTION_SHOTS = [
  { name: 'connect', hash: '#/connect' },
  // Connect signed out, which is the state a first visitor lands in and the one
  // the approved pack's second flow draws. Every other shot runs the demo, so
  // without this one a restoration pack can only compare its Demo rendering
  // with the canonical (task 032). No tenant is read: the app is simply not
  // signed in.
  { name: 'connect-signedout', hash: '#/connect', noDemo: true },
  { name: 'plan', hash: '#/plan' },
  { name: 'readiness', hash: '#/readiness' },
  // Export is governed by no pack, and it is the one surface that renders an
  // attention notice unconditionally. Task 031 added it because a renderer that
  // cannot show a shared primitive cannot be the evidence for it — the same gap
  // task 030 closed for the packs themselves.
  { name: 'export', hash: '#/export' },
]
const THEMES = ['light', 'dark']

if (process.argv.includes('--list')) {
  for (const p of expectedOutputs()) console.log(p)
  process.exit(0)
}

const wantCanonical = process.argv.includes('--canonical') || !process.argv.includes('--production')
const wantProduction = process.argv.includes('--production') || !process.argv.includes('--canonical')

// ---- Chrome, the way scripts/walk.mjs finds and drives it ----
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
  console.error('render-design: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}

/**
 * A static server over the built site, so the production shots load the real
 * bundle with its real font URLs. `file://` would not: the app is served from a
 * path and its /fonts/ and /brand/ references are absolute.
 */
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

const CDP_PORT = Number(process.env.RENDER_CDP_PORT ?? 9447)
const profile = `${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-render-profile`
const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP_PORT}`, 'about:blank',
  ],
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
  console.error('render-design: Chrome exposed no page target within 60 s')
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

/**
 * One deterministic plate: a fixed viewport width, the document's own height
 * clipped to MAX_HEIGHT, fonts settled before the shutter, device scale 1.
 */
async function shoot(url, out, width, { before = null } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url })
  await sleep(900)
  if (before) {
    // The application reads its theme from localStorage on mount, so the
    // preference is written and then the page is loaded again with it in place.
    await send('Runtime.evaluate', { expression: before })
    await send('Page.navigate', { url })
    await sleep(900)
  }
  await sleep(400)
  await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
  await sleep(200)
  const measured = await send('Runtime.evaluate', {
    expression: 'Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))',
    returnByValue: true,
  })
  const height = Math.min(MAX_HEIGHT, Math.max(600, measured.result?.result?.value ?? 900))
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } })
  mkdirSync(dirname(at(out)), { recursive: true })
  writeFileSync(at(out), Buffer.from(shot.result.data, 'base64'))
  console.log(`render-design: wrote ${out} (${width}x${height})`)
}

if (wantCanonical) {
  for (const t of canonicalTargets()) {
    const url = `file:///${at(t.path).replace(/\\/g, '/')}`
    for (const width of WIDTHS) await shoot(url, `${t.out}/${width}.png`, width)
  }
}

if (wantProduction) {
  const dist = at('dist')
  if (!existsSync(dist)) {
    console.error('render-design: dist/ is missing; run `npm run build` first')
  } else {
    const server = serve(dist)
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    const port = server.address().port
    // The demo tenant, so the shell renders with a scan behind it and the tabs
    // are live. No real tenant is ever read by this script.
    for (const theme of THEMES) {
      for (const shot of PRODUCTION_SHOTS) {
        const url = `http://127.0.0.1:${port}/planner/${shot.noDemo ? '' : '?demo=1'}${shot.hash}`
        for (const width of WIDTHS) {
          await shoot(url, `${OUT_PRODUCTION}/${shot.name}-${theme}-${width}.png`, width, {
            before: `document.documentElement.dataset.theme = ${JSON.stringify(theme)}; localStorage.setItem('iamai-theme', ${JSON.stringify(theme)})`,
          })
        }
      }
    }
    // The home page is a separate build path with its own shell.
    const home = at('dist/home')
    if (existsSync(home) || existsSync(at('dist/index.html'))) {
      for (const theme of THEMES) {
        for (const width of WIDTHS) {
          await shoot(`http://127.0.0.1:${port}/`, `${OUT_PRODUCTION}/home-${theme}-${width}.png`, width, {
            before: `localStorage.setItem('iamai-theme', ${JSON.stringify(theme)}); document.documentElement.dataset.theme = ${JSON.stringify(theme)}`,
          })
        }
      }
    }
    server.close()
  }
}

ws.close()
chrome.kill()
