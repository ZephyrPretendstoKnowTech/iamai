// Screenshots of every page, both themes, at 700 and 1440 (prompt 39 finishing).
// Reuses the audit's browser plumbing; writes docs/screens/<label>/.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const LABEL = process.argv[2] ?? '39'
const OUT = `docs/screens/${LABEL}`
const PORT = Number(process.env.SHOTS_PORT ?? 5203)
const CDP_PORT = Number(process.env.SHOTS_CDP_PORT ?? 9448)
const BASE = `http://localhost:${PORT}/rollout/?dev=1&mock=1`
const PAGES = ['/start', '/connect', '/baseline', '/scan', '/mapping', '/coverage', '/roadmap', '/reads', '/checks', '/licensing']
const WIDTHS = [700, 1440]

const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium',
].filter(Boolean).find((p) => existsSync(p))
if (!CHROME) { console.error('screens: no Chrome found'); process.exit(2) }

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let up = false
for (let i = 0; i < 120 && !up; i++) {
  try { up = (await fetch(`http://localhost:${PORT}/rollout/`)).ok } catch { await sleep(200) }
}
if (!up) { console.error('screens: dev server did not start'); vite.kill(); process.exit(2) }

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-shots-profile`,
  `--remote-debugging-port=${CDP_PORT}`, '--window-size=1440,1200', 'about:blank',
], { stdio: 'ignore' })
let targets = []
for (let i = 0; i < 120 && targets.length === 0; i++) {
  try { targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json() } catch { await sleep(200) }
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
await send('Page.enable')
await send('Runtime.enable')

mkdirSync(OUT, { recursive: true })
let n = 0
for (const theme of ['dark', 'light']) {
  await send('Page.navigate', { url: `${BASE}#/start` })
  await sleep(1200)
  await evaluate(`(() => { try { localStorage.setItem('iamai-theme', ${JSON.stringify(theme)}) } catch {} })()`)
  for (const width of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false })
    for (const hash of PAGES) {
      await send('Page.navigate', { url: `${BASE}#${hash}` })
      await sleep(1300)
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      const name = `${hash.replace(/\//g, '') || 'start'}-${theme}-${width}.png`
      writeFileSync(`${OUT}/${name}`, Buffer.from(shot.result.data, 'base64'))
      n += 1
    }
  }
}
console.log(`screens: ${n} screenshots -> ${OUT}`)
ws.close()
chrome.kill()
vite.kill()
