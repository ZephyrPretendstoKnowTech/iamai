// Renders a design authority, so a later pack can compare what it built with
// what the owner approved (task 030).
//
//   node scripts/render-design.mjs                 both sets
//   node scripts/render-design.mjs --canonical     the four approved HTML packs
//   node scripts/render-design.mjs --production    the built application shell
//   node scripts/render-design.mjs --list          what it would write, no browser
//   node scripts/render-design.mjs --production --only plan,plan-step   named shots only
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

/**
 * `--only a,b` narrows a production run to named shots. A restoration pack
 * iterates on one surface and re-shooting all of them takes minutes; the
 * evidence a task commits is still a full run, so the two sets it compares were
 * shot in the same order.
 */
const ONLY = process.argv.indexOf('--only') !== -1 ? process.argv[process.argv.indexOf('--only') + 1] : null

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
  // The Plan with one step open. The approved Plan pack's subject is the
  // EXPANDED step — the row it attaches to, the head, the lifecycle track, the
  // main column and the right rail — and a collapsed-roadmap plate cannot be
  // evidence for any of it (task 034). The step is opened the way an operator
  // opens one: the first roadmap row is clicked.
  { name: 'plan-step', hash: '#/plan', after: `(() => { const r = document.querySelector('main.page .plan-row'); if (r) r.click(); return !!r })()` },
  // And a step that is actually on the rollout lifecycle, so the plate carries
  // the track and the rail as well as the frame. The first row that produces a
  // track is used rather than a step named here, so the evidence does not break
  // when the demo fixture changes. React renders on its own schedule, so each
  // click is given time to land before the next row is tried.
  {
    name: 'plan-step-lifecycle',
    hash: '#/plan',
    after: `(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); for (const r of document.querySelectorAll('main.page .plan-row')) { r.click(); await wait(180); if (document.querySelector('main.page .step .track')) return true; r.click(); await wait(60) } return false })()`,
  },
  // A step that actually has findings, with its More opened: the pack's finding
  // cards and the two-column small-card grammar inside the disclosure are the
  // subject of pack 035, and neither appears on a step that has nothing to
  // report or on a closed disclosure. The row is found rather than named, so
  // the evidence survives a change to the demo fixture.
  {
    name: 'plan-step-findings',
    hash: '#/plan',
    after: `(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); for (const r of document.querySelectorAll('main.page .plan-row')) { r.click(); await wait(180); const step = document.querySelector('main.page .step'); if (step && step.querySelector('.findings')) { const more = step.querySelector('details.more'); if (more) more.open = true; await wait(120); return true } r.click(); await wait(60) } return false })()`,
  },
  // The remaining canonical variants, end to end (task 036). A restoration pack
  // cannot claim "all variants" from one polished implement plate, and the five
  // below are the cases the approved pack draws that the shots above do not
  // reach: the In-place step and its existing-implementation rail, the blocked
  // step and its attention panel, the baseline conflict, a step whose action is
  // a decision only a person can make, and a deployed policy that no longer
  // means what the plan asked for.
  //
  // Each is FOUND rather than named: the driver opens roadmap rows until the
  // opened step satisfies a predicate about what it contains, so the evidence
  // survives a change to the demo fixture and cannot silently shoot the wrong
  // step. The In-place rows live behind the footer's own disclosure, so that is
  // opened first.
  //
  // The predicates MUTUALLY EXCLUDE each other, and that is the point (task 036
  // correction 1). A step waiting on a person also lists what is outstanding,
  // so a blocked predicate that asks only for the attention panel and its list
  // matches the decision step too — and the first row satisfying both then
  // produced two plates of one step, byte for byte, under two names each
  // claiming to be evidence for a different variant. The ordinary blocker is
  // now the one that is NOT a decision, so the pair proves what it says.
  //
  // `pre` is what the driver does before it starts opening rows.
  ...[
    ['plan-step-inplace', `!!s.querySelector('.step-side .metric-name')`],
    ['plan-step-blocked', `!!s.querySelector('.callout') && !!s.querySelector('.blocking') && !s.querySelector('.decision .dlabel')`],
    ['plan-step-conflict', `!!s.querySelector('.callout-danger, .callout.danger') && !s.querySelector('.blocking')`],
    ['plan-step-decision', `!!s.querySelector('.decision .dlabel')`],
    // The review-required variant (the approved pack's V3), which is the one
    // state no single scan produces: a policy is held for review because what
    // it MEANS is no longer what the plan asked for, and that is a comparison
    // between two scans of one tenant.
    //
    // The demo is exactly that — two snapshots of one sample org — and
    // selecting the follow-up scan carries day one's record into it
    // (ui/demo.ts `nextDemoRecord`), observations and all, so the sample's own
    // progression renders the variant. Nothing about the sample tenant is
    // changed to obtain it: the driver waits for day one's plan to record what
    // it saw, puts the demo's snapshot bookkeeping back to what a visitor who
    // has not opened week two yet has (the follow-up scan holds no record of
    // its own), and presses the selector a visitor presses. Every id it writes
    // is the sample tenant's (ui/demoMode.ts); no real tenant has a row here.
    //
    // Without that one line the shot is order-dependent: the first pass writes
    // a record for the follow-up scan, and every pass after it reads week two
    // against week two's own observations, which is a tenant nothing changed in.
    [
      'plan-step-review',
      `!!s.querySelector('.condition-review-required')`,
      `await wait(2500)
       await new Promise((done) => {
         const open = indexedDB.open('iamai')
         open.onsuccess = () => {
           const d = open.result
           if (!d.objectStoreNames.contains('plan')) { d.close(); return done() }
           const t = d.transaction('plan', 'readwrite')
           t.objectStore('plan').put({ tenantId: 'demo-sample-tenant#snapshots', current: 'initial', records: {} })
           t.oncomplete = () => { d.close(); done() }
           t.onerror = () => { d.close(); done() }
         }
         open.onerror = () => done()
       })
       const pick = document.querySelector('.demo-snapshots button[aria-pressed="false"]')
       if (!pick) return false
       pick.click()
       await wait(3000)`,
    ],
  ].map(([name, test, pre = '']) => ({
    name,
    hash: '#/plan',
    after: `(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms))
      ${pre}
      for (const d of document.querySelectorAll('main.page .plan-footer details')) d.open = true
      await wait(200)
      for (const r of document.querySelectorAll('main.page .plan-row')) {
        r.click(); await wait(180)
        const s = r.parentElement && r.parentElement.querySelector('.step') || document.querySelector('main.page .step')
        if (s && (${test})) { r.scrollIntoView({ block: 'start' }); await wait(120); return true }
        r.click(); await wait(60)
      }
      return false
    })()`,
  })),
  { name: 'readiness', hash: '#/readiness' },
  // Export is governed by no pack, and it is the one surface that renders an
  // attention notice unconditionally. Task 031 added it because a renderer that
  // cannot show a shared primitive cannot be the evidence for it — the same gap
  // task 030 closed for the packs themselves.
  { name: 'export', hash: '#/export' },
  // How and Inventory, the other two surfaces no pack governs (task 040). The
  // convergence pack owes rendered evidence for all three, and a renderer that
  // can only reach one of them cannot supply it. How is the technical trust
  // surface — generated permission and read tables — and Inventory is the
  // densest table in the product, so between them they carry every table, code
  // and identifier treatment the shared layer has.
  { name: 'how', hash: '#/how' },
  { name: 'inventory', hash: '#/inventory' },
  // Inventory's People tab: the tab that actually holds tenant objects (a name
  // over a UPN, a group name, a device name), which is where long-object
  // containment either works or does not. The first tab is policies, so the tab
  // is pressed by its accessible name rather than by index.
  {
    name: 'inventory-people',
    hash: '#/inventory',
    after: `(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); const t = [...document.querySelectorAll('main.page .tab')].find((b) => /people/i.test(b.textContent || '')); if (!t) return false; t.click(); await wait(400); return true })()`,
  },
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
async function shoot(url, out, width, { before = null, after = null } = {}) {
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
  if (after) {
    // A shot of a state the operator reaches by acting — opening a Plan step —
    // rather than by a URL. It runs after the page has settled and before the
    // shutter, and it changes nothing outside the page.
    //
    // Its answer is whether it FOUND the state it was looking for. A variant
    // shot that found nothing would otherwise write a plate of the collapsed
    // Plan under a name claiming to be evidence for that variant, so it says so
    // on the run log instead (task 036).
    const found = await send('Runtime.evaluate', { expression: after, awaitPromise: true, returnByValue: true })
    if (found.result?.result?.value === false) console.log(`render-design: NOT FOUND for ${out} — the plate is not evidence for that variant`)
    await sleep(700)
  }
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
      for (const shot of PRODUCTION_SHOTS.filter((s) => ONLY === null || ONLY.split(',').includes(s.name))) {
        const url = `http://127.0.0.1:${port}/planner/${shot.noDemo ? '' : '?demo=1'}${shot.hash}`
        for (const width of WIDTHS) {
          await shoot(url, `${OUT_PRODUCTION}/${shot.name}-${theme}-${width}.png`, width, {
            before: `document.documentElement.dataset.theme = ${JSON.stringify(theme)}; localStorage.setItem('iamai-theme', ${JSON.stringify(theme)})`,
            after: shot.after ?? null,
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
