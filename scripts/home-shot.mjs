// The Home page's picture of the product (OWN-B1): the sample tenant's Plan —
// its tiles, its Next line and its first section — captured from the built
// demo in both themes, so the picture can be made again whenever the Plan
// changes, and never shows a real tenant.
//
//   npm run build:site && node scripts/home-shot.mjs
//
// It drives the same Chrome over CDP that scripts/render-design.mjs drives, over
// the built site, with the demo (?demo=1): nothing is read from a tenant.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const root = resolve(import.meta.dirname, '..')
const OUT = process.env.HOME_SHOT_OUT ?? resolve(root, 'home')
const WIDTH = 1280
const HEIGHT = 820
const SCALE = 2

const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find((p) => existsSync(p))
if (!CHROME) {
  console.error('home-shot: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}
const dist = resolve(root, 'dist')
if (!existsSync(dist)) {
  console.error('home-shot: dist/ is missing; run `npm run build:site` first')
  process.exit(2)
}

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
const server = createServer((req, res) => {
  let file = join(dist, decodeURIComponent((req.url ?? '/').split('?')[0]))
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!existsSync(file)) { res.writeHead(404); res.end(); return }
  res.writeHead(200, { 'content-type': `${TYPES[extname(file)] ?? 'application/octet-stream'}; charset=utf-8` })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const CDP_PORT = Number(process.env.HOME_SHOT_CDP_PORT ?? 9448)
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${process.env.TEMP ?? process.env.TMPDIR ?? '/tmp'}/iamai-home-shot`, `--remote-debugging-port=${CDP_PORT}`, 'about:blank'], { stdio: 'ignore' })
let targets = []
for (let i = 0; i < 300 && targets.length === 0; i++) {
  try { targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json() } catch { await sleep(200) }
}
const target = targets.find((t) => t.type === 'page')
if (!target) { console.error('home-shot: Chrome exposed no page'); chrome.kill(); server.close(); process.exit(2) }
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } }
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
await send('Page.enable')

const url = `http://127.0.0.1:${port}/planner/?demo=1#/plan`
for (const theme of ['dark', 'light']) {
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: false })
  await send('Page.navigate', { url })
  await sleep(1200)
  // The app reads its theme from localStorage on mount: set it, then load again.
  await send('Runtime.evaluate', { expression: `localStorage.setItem('iamai-theme', ${JSON.stringify(theme)}); document.documentElement.dataset.theme = ${JSON.stringify(theme)}` })
  await send('Page.navigate', { url })
  await sleep(1800)
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => window.scrollTo(0, 0))', awaitPromise: true })
  await sleep(300)
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 } })
  const out = join(OUT, `plan-${theme}.png`)
  writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
  console.log(`home-shot: wrote ${out} (${WIDTH}x${HEIGHT} at ${SCALE}x)`)
}
ws.close()
chrome.kill()
server.close()
