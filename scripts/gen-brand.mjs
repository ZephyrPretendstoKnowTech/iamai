// Writes every derived brand asset from the master mark (task 029).
//
//   node scripts/gen-brand.mjs              the derived SVGs (no browser)
//   node scripts/gen-brand.mjs --raster     also the 32px PNG favicon (Chrome)
//   node scripts/gen-brand.mjs --evidence   also docs/screens/29/*.png (Chrome)
//
// scripts/brandDerive.ts holds the derivation itself, because src/brand/brand.test.ts
// re-runs it and fails when a committed asset drifts from the master — the
// same shape as scripts/gen-tokens.mjs and src/ui/tokens.test.ts.
//
// The SVG step is pure string work and is deterministic anywhere. The raster
// step is not: it is Chrome drawing the favicon at 32px, so the bytes depend
// on the Chrome that drew them. That is why the SVG stays the authority, the
// PNG is a convenience for browsers that will not take an SVG icon, and the
// test asserts the PNG's dimensions rather than its bytes. No rasterising
// dependency is added for one 32px icon: the browser this repository already
// drives for the walk and the smoke test is the tool.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { MASTER, MARK_COLORS, RASTER, derived, geometry, tinted, viewBox } from './brandDerive.ts'

const root = resolve(import.meta.dirname, '..')
const at = (p) => resolve(root, p)
const write = (p, text) => {
  mkdirSync(dirname(at(p)), { recursive: true })
  writeFileSync(at(p), text)
  console.log(`brand: wrote ${p}`)
}

const master = readFileSync(at(MASTER), 'utf8')
for (const { path, content } of derived(master)) write(path, content)

const wantRaster = process.argv.includes('--raster')
const wantEvidence = process.argv.includes('--evidence')
if (!wantRaster && !wantEvidence) process.exit(0)

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
  console.error('brand: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}
const CDP_PORT = Number(process.env.BRAND_CDP_PORT ?? 9446)
const profile = `${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-brand-profile`
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
  console.error('brand: Chrome exposed no page target within 60 s')
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
 * Load a local page, wait for its fonts, and write a PNG of the given box.
 * `anchor` is an element id: the shot starts at that element's top, which is how
 * one long document yields a light plate and a dark plate.
 */
async function shoot(htmlPath, out, width, height, { transparent = false, anchor = null } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
  await send('Emulation.setDefaultBackgroundColorOverride', transparent ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {})
  await send('Page.navigate', { url: `file:///${at(htmlPath).replace(/\\/g, '/')}` })
  await sleep(900)
  await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true })
  await sleep(300)
  let y = 0
  if (anchor) {
    const r = await send('Runtime.evaluate', {
      expression: `Math.round(document.getElementById(${JSON.stringify(anchor)}).getBoundingClientRect().top + scrollY)`,
      returnByValue: true,
    })
    y = r.result.result.value ?? 0
  }
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height, scale: 1 } })
  mkdirSync(dirname(at(out)), { recursive: true })
  writeFileSync(at(out), Buffer.from(shot.result.data, 'base64'))
  console.log(`brand: wrote ${out}`)
}

// Scratch pages live under walk/, which is not committed.
const scratch = (name, html) => {
  const path = `walk/brand/${name}`
  write(path, html)
  return path
}

if (wantRaster) {
  const icon = readFileSync(at('public/brand/favicon.svg'), 'utf8')
  const page = scratch(
    'raster.html',
    `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}
     svg{display:block;width:${RASTER.size}px;height:${RASTER.size}px}</style>${icon}`,
  )
  await shoot(page, RASTER.path, RASTER.size, RASTER.size, { transparent: true })
}

if (wantEvidence) {
  // The sheet draws the committed master, so the evidence cannot show a mark
  // the repository does not hold.
  const inner = geometry(master)
  const box = viewBox(master)
  const mark = (size, color) =>
    `<svg width="${size}" height="${size}" viewBox="${box}" style="color:${color};display:block">${inner}</svg>`
  const icon = (size) =>
    `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${(size * 0.22).toFixed(1)}px;background:#0C6A64">${mark(size * 0.86, '#FFFDF9')}</span>`
  const SIZES = [16, 24, 32, 64]
  const face = (family, weight, file) =>
    `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;font-display:block;src:url('../../public/fonts/${file}') format('woff2')}`
  const shell = (title, bg, fg, body) => `<!doctype html><meta charset="utf-8"><style>
    ${face('IBM Plex Sans', 400, 'IBMPlexSans-Regular-Latin1.woff2')}
    ${face('IBM Plex Sans', 700, 'IBMPlexSans-Bold-Latin1.woff2')}
    html,body{margin:0}
    body{background:${bg};color:${fg};font-family:'IBM Plex Sans',system-ui,sans-serif;padding:22px 26px}
    h1{font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin:0 0 18px;opacity:.75}
    .row{display:flex;align-items:center;gap:26px;margin-bottom:22px}
    .cap{width:118px;font-size:11px;opacity:.65}
    .lock{display:flex;align-items:center;gap:7px;font-weight:700;font-size:28px;letter-spacing:.005em}
    .check{background-image:linear-gradient(45deg,#00000014 25%,transparent 25%,transparent 75%,#00000014 75%),
      linear-gradient(45deg,#00000014 25%,transparent 25%,transparent 75%,#00000014 75%);
      background-size:16px 16px;background-position:0 0,8px 8px}
  </style><h1>${title}</h1>${body}`
  const sizeRow = (label, color) =>
    `<div class="row"><span class="cap">${label}</span>${SIZES.map((s) => mark(s, color)).join('')}</div>`
  const iconRow = `<div class="row"><span class="cap">app icon 16/24/32/64</span>${SIZES.map(icon).join('')}</div>`
  const lockRow = (color, fg) =>
    `<div class="row"><span class="cap">lockup 28px</span><span class="lock" style="color:${fg}">${mark(28, color)}<span>IAMAI</span></span></div>`

  const light = scratch('evidence-light.html', shell('Threshold — light canvas #F7F4EE', '#F7F4EE', '#1D2528',
    sizeRow('mark 16/24/32/64', '#0C6A64') + iconRow + lockRow('#0C6A64', '#1D2528') + sizeRow('monochrome ink', '#1D2528')))
  const dark = scratch('evidence-dark.html', shell('Threshold — dark canvas #0D1117', '#0D1117', '#F2F5F7',
    sizeRow('mark 16/24/32/64', '#58C8BC') + iconRow + lockRow('#58C8BC', '#F2F5F7') + sizeRow('monochrome light', '#FFFDF9')))
  const clear = scratch('evidence-transparent.html', shell('Threshold — transparent background', 'transparent', '#1D2528',
    `<div class="check" style="padding:16px;display:inline-block">${sizeRow('mark 16/24/32/64', '#0C6A64')}${sizeRow('monochrome ink', '#1D2528')}</div>`))

  await shoot(light, 'docs/screens/29/mark-light.png', 560, 400)
  await shoot(dark, 'docs/screens/29/mark-dark.png', 560, 400)
  await shoot(clear, 'docs/screens/29/mark-transparent.png', 560, 250, { transparent: true })
  // The brand system itself: the light plate from the top, the dark plate from its own band.
  await shoot('docs/brand/iamai-brand-system.html', 'docs/screens/29/brand-system-light.png', 1000, 1500)
  await shoot('docs/brand/iamai-brand-system.html', 'docs/screens/29/brand-system-dark.png', 1000, 1200, { anchor: 'dark' })
}

ws.close()
chrome.kill()
