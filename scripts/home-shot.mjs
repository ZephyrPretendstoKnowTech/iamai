// The Home page's picture of the product (OWN-B1): the sample tenant's Plan —
// its tiles, its Next line and its first section — captured from the built
// demo in both themes, so the picture can be made again whenever the Plan
// changes, and never shows a real tenant.
//
//   npm run build:site && node scripts/home-shot.mjs
//
// It drives the same Chrome over CDP that scripts/render-design.mjs drives, over
// the built site, with the demo (?demo=1): nothing is read from a tenant. Each
// theme is a real page load with the theme already stored (the app reads it once
// on mount), and a shot is written only once the Plan has rendered in that
// theme: its header's theme control names the other theme.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { TOOL_PATH } from './toolPath.ts'

const root = resolve(import.meta.dirname, '..')
const OUT = process.env.HOME_SHOT_OUT ?? resolve(root, 'home')
const WIDTH = 1280
const HEIGHT = 820
const SCALE = 2
const content = JSON.parse(readFileSync(resolve(root, 'docs/design/content.json'), 'utf8'))
// On a light page the control offers the dark theme, and the other way round (AppShell.tsx).
const CONTROL = { light: content.pages.app.shell.darkTheme, dark: content.pages.app.shell.lightTheme }
const PLAN = content.pages.plan.h1

const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find((p) => existsSync(p))
if (!CHROME) {
  console.error('home-shot: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}
const dist = resolve(root, 'dist')
if (!existsSync(join(dist, TOOL_PATH, 'index.html'))) {
  console.error('home-shot: the built planner is missing; run `npm run build:site` first')
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
const CDP_PORT = Number(process.env.HOME_SHOT_CDP_PORT ?? 9448)
let chrome = null
let ws = null
let failed = false
try {
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars', `--user-data-dir=${process.env.TEMP ?? process.env.TMPDIR ?? '/tmp'}/iamai-home-shot-${Date.now()}`, `--remote-debugging-port=${CDP_PORT}`, 'about:blank'], { stdio: 'ignore' })
  let targets = []
  for (let i = 0; i < 300 && targets.length === 0; i++) {
    try { targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json() } catch { await sleep(200) }
  }
  const target = targets.find((t) => t.type === 'page')
  if (!target) throw new Error('Chrome exposed no page')
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await Promise.race([new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('CDP socket failed')) }), sleep(20_000).then(() => { throw new Error('CDP socket timed out') })])
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } }
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: false })
  for (const theme of ['dark', 'light']) {
    // The theme is in storage before the app's first script runs, and each theme is its own URL, so each is a full load.
    const script = await send('Page.addScriptToEvaluateOnNewDocument', { source: `try { localStorage.setItem('iamai-theme', ${JSON.stringify(theme)}) } catch {}` })
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/${TOOL_PATH}/?demo=1&shot=${theme}#/plan` })
    let ready = false
    for (let i = 0; i < 100 && !ready; i++) {
      await sleep(200)
      ready = await evaluate(`(() => { const h = document.querySelector('main.page h1'); const c = [...document.querySelectorAll('header.app button')].map((b) => (b.textContent || '').trim()); return !!h && h.textContent.trim() === ${JSON.stringify(PLAN)} && c.includes(${JSON.stringify(CONTROL[theme])}) && document.querySelectorAll('.plan-row').length > 0 })()`) === true
    }
    if (!ready) throw new Error(`the Plan never rendered in the ${theme} theme (its header control should read "${CONTROL[theme]}")`)
    await evaluate('document.fonts.ready.then(() => window.scrollTo(0, 0))')
    await sleep(400)
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 } })
    const out = join(OUT, `plan-${theme}.png`)
    writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
    console.log(`home-shot: wrote ${out} (${WIDTH}x${HEIGHT} at ${SCALE}x)`)
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script.result.identifier })
  }
} catch (e) {
  failed = true
  console.error(`home-shot: ${e instanceof Error ? e.message : String(e)}; nothing more was written`)
} finally {
  try { ws?.close() } catch {}
  chrome?.kill()
  server.close()
}
process.exit(failed ? 1 : 0)
