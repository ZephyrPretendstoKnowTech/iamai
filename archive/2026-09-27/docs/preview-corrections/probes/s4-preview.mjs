// S4 C08 on the production bundle (local, synthetic only): `vite preview` serves
// the built dist/ at the configured base, and a local headless Chromium times the
// demo Plan — cold direct route, reload, frozen during load then resumed. External
// hosts are blocked in the browser. The dev mock does not exist in a production
// build, so this covers the demo only (s4-browser.mjs covers the dev server).
//
// Usage: npm run build; CHROME=<chrome.exe> node docs/preview-corrections/probes/s4-preview.mjs
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { TOOL_PATH } from '../../../scripts/toolPath.ts'

const PORT = 5233
const CDP = 9473
const ROOT = `http://localhost:${PORT}/${TOOL_PATH}/`
const CHROME = process.env.CHROME
const log = (k, v) => console.log(k, JSON.stringify(v))
const procs = []
const done = (code) => { for (const p of procs) { try { p.kill() } catch {} } process.exit(code) }
setTimeout(() => { log('probe', 'global timeout 240 s'); done(3) }, 240_000).unref()

procs.push(spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' }))
let up = false
for (let i = 0; i < 150 && !up; i++) { try { up = (await fetch(ROOT)).ok } catch { await sleep(200) } }
if (!up) { log('preview', 'did not start'); done(2) }
const profile = `${process.env.TEMP ?? '/tmp'}/iamai-s4-preview-profile`
rmSync(profile, { recursive: true, force: true })
procs.push(spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP}`, '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' }))
let targets = []
for (let i = 0; i < 150 && !targets.some((t) => t.type === 'page'); i++) { try { targets = await (await fetch(`http://localhost:${CDP}/json/list`)).json() } catch { await sleep(200) } }
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const errors = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
}
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value
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

// The Plan has drawn: scripts/smoke.mjs's "Plan renders at #/plan" selector.
const ROWS = `document.querySelector('main.page .plan-progress-tile')`
const text = `document.body ? document.body.innerText.slice(0, 200) : ''`
const timed = async (label, ms = 60000) => {
  const t = await waitFor(ROWS, ms)
  log(label, { msToPlan: t, text: t === null ? await evaluate(text) : undefined })
}
await send('Page.navigate', { url: `${ROOT}?demo=1#/plan` })
await timed('c08 preview demo cold direct #/plan')
await send('Page.reload', {})
await sleep(200)
await timed('c08 preview demo reload #/plan')
await send('Page.navigate', { url: `${ROOT}#/plan` })
await sleep(3000)
log('c08 preview demo -> non-demo #/plan (no tenant)', { plan: await evaluate(`!!${ROWS}`), hash: await evaluate('location.hash'), connect: await evaluate(`!!document.querySelector('.surface.connect > .callout')`) })
await send('Page.navigate', { url: 'about:blank' })
await sleep(300)
await send('Page.navigate', { url: `${ROOT}?demo=1#/plan` })
await sleep(300)
await send('Page.setWebLifecycleState', { state: 'frozen' })
await sleep(5000)
await send('Page.setWebLifecycleState', { state: 'active' })
await timed('c08 preview demo frozen 5 s during load, resumed')
log('page exceptions', errors.slice(0, 10))
done(0)
