// Contrast and responsive audit (prompt 39 §7, §8).
//
// Two questions no unit test can answer, because both are about what the
// browser actually computed rather than what the source says:
//
//   L5  Does every piece of text, every chip and every card border clear the
//       WCAG AA contrast ratio, in BOTH themes? The light palette was added
//       later than the dark one, and the review found the sidebar, the "done"
//       chips and the Do this next card still carrying dark-theme treatment.
//
//   L6  At 360, 700, 1024, 1440 and 1920, does the page reflow? The review
//       found nothing reflowed at 700: the sidebar kept full width, tables
//       overflowed the page rather than their own container, and nothing
//       collapsed.
//
// Exits non-zero on a failure, so CI can run it. Known failures are waived by
// review id, the same way the copy lint waives its own, and a waiver that stops
// matching fails the run rather than rotting.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const PORT = Number(process.env.AUDIT_PORT ?? 5202)
const CDP_PORT = Number(process.env.AUDIT_CDP_PORT ?? 9447)
const BASE = `http://localhost:${PORT}/rollout/?dev=1&mock=1`

/** Every page a user can reach, by hash. */
const PAGES = ['/start', '/connect', '/baseline', '/scan', '/mapping', '/coverage', '/roadmap', '/reads', '/checks', '/licensing']
const WIDTHS = [360, 700, 1024, 1440, 1920]
/** Below this the sidebar must stop taking a column of its own (§8). */
const COLLAPSE_BELOW = 1024

// Known failures. Each names the finding that will remove it.
const WAIVED = [
  // (empty: this is the first run; anything found is reported, not waived)
]

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
  console.error('layout-audit: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
let up = false
for (let i = 0; i < 120 && !up; i++) {
  try {
    up = (await fetch(`http://localhost:${PORT}/rollout/`)).ok
  } catch {
    await sleep(200)
  }
}
if (!up) {
  console.error('layout-audit: dev server did not start')
  vite.kill()
  process.exit(2)
}

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
    `--user-data-dir=${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-audit-profile`,
    `--remote-debugging-port=${CDP_PORT}`, '--window-size=1440,1200', 'about:blank',
  ],
  { stdio: 'ignore' },
)
let targets = []
for (let i = 0; i < 120 && targets.length === 0; i++) {
  try {
    targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json()
  } catch {
    await sleep(200)
  }
}
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
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
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
  return r.result.result.value
}
await send('Page.enable')
await send('Runtime.enable')

const resize = (width) =>
  send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 700 })
const goto = async (hash) => {
  await send('Page.navigate', { url: `${BASE}#${hash}` })
  await sleep(1300)
}
const setTheme = async (theme) => {
  await evaluate(`(() => { try { localStorage.setItem('iamai-theme', ${JSON.stringify(theme)}) } catch {} })()`)
  await send('Page.reload')
  await sleep(1300)
}

// ---- the contrast probe, injected into the page ----
//
// Ratios are computed from what the browser actually painted, walking up for a
// background because most elements are transparent. Text under 24px (or under
// 18.66px bold) needs 4.5; larger text and non-text edges need 3.
const CONTRAST = `(() => {
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/)
    if (!m) return null
    const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n))
    return { r, g, b, a: a === undefined ? 1 : a }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }
  // The painted background: the nearest ancestor that is not transparent.
  const bgOf = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0.5) return c
    }
    return { r: 255, g: 255, b: 255, a: 1 }
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'
  }
  const label = (el) => (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 48)
  const out = []
  const seen = new Set()
  const record = (kind, el, got, need, detail) => {
    const key = kind + '|' + detail
    if (seen.has(key)) return
    seen.add(key)
    out.push({ kind, got: Math.round(got * 100) / 100, need, detail })
  }

  // Text. Leaf elements only, so a container's own colour is not tested twice.
  for (const el of document.querySelectorAll('main.page *, nav.stepper *')) {
    if (!visible(el) || el.closest('.devtools, .print-only')) continue
    if ([...el.children].some((c) => (c.textContent || '').trim().length > 0)) continue
    const text = label(el)
    if (!text) continue
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    if (!fg || fg.a < 0.5) continue
    const size = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
    const r = ratio(fg, bgOf(el))
    if (r < need) record('text', el, r, need, el.className + ' :: ' + text)
  }

  // Chips carry their own background, which is where a light-theme palette
  // most often washes out.
  for (const el of document.querySelectorAll('.chip')) {
    if (!visible(el)) continue
    const cs = getComputedStyle(el)
    const fg = parse(cs.color)
    const bg = bgOf(el)
    if (!fg) continue
    const r = ratio(fg, bg)
    if (r < 4.5) record('chip', el, r, 4.5, el.className + ' :: ' + label(el))
  }

  // Edges, at two bars, because WCAG asks two different things of them.
  //
  // 1.4.11 requires 3:1 for "visual information required to identify user
  // interface components and their states" — a control's outline, a focus ring,
  // an input's edge. It does not cover a decorative boundary, and holding every
  // grouping container to 3:1 would mean outlining the whole interface.
  //
  // So: controls at 3, containers at 1.5. 1.5 is not a standard, it is the
  // point at which an edge is perceptible rather than theoretical, and the
  // review's complaint about the light theme was precisely that its card edges
  // were not perceptible (they measured 1.21:1).
  const edges = [
    { sel: 'button, input, select, textarea, .btn', kind: 'control edge', need: 3 },
    { sel: '.card, .callout, table', kind: 'container edge', need: 1.5 },
  ]
  for (const { sel, kind, need } of edges) {
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue
      const cs = getComputedStyle(el)
      if (parseFloat(cs.borderTopWidth) < 0.5) continue
      const edge = parse(cs.borderTopColor)
      if (!edge || edge.a < 0.5) continue
      const r = ratio(edge, bgOf(el.parentElement ?? el))
      if (r < need) record(kind, el, r, need, el.className || el.tagName)
    }
  }
  return out
})()`

/** Overflow, sidebar and table behaviour at one width. */
const LAYOUT = `(() => {
  const de = document.documentElement
  const nav = document.querySelector('nav.stepper')
  const navRect = nav ? nav.getBoundingClientRect() : null
  const main = document.querySelector('main.page') || document.querySelector('main')
  const mainRect = main ? main.getBoundingClientRect() : null
  // Collapsed means stacked: the nav sits above the content rather than taking
  // a column beside it. A full-width nav is the collapsed state, not a failure —
  // the first version of this check read it as one.
  const navBeside = navRect && mainRect ? navRect.bottom > mainRect.top + 4 : false
  const wide = [...document.querySelectorAll('table')]
    .filter((t) => t.getBoundingClientRect().width > 1)
    .filter((t) => {
      // A table wider than the viewport is fine as long as some ancestor
      // actually clips and scrolls it. The first version of this check looked
      // for a fixed list of class names and matched the table itself, so it
      // reported tables that were correctly wrapped. Ask the computed style
      // instead: is there an ancestor that scrolls horizontally and is
      // narrower than its own content?
      if (t.scrollWidth <= de.clientWidth) return false
      for (let n = t.parentElement; n && n !== document.body; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX
        if ((ox === 'auto' || ox === 'scroll') && n.clientWidth < n.scrollWidth) return false
      }
      return true
    })
    .map((t) => (t.className || 'table') + ' ' + Math.round(t.scrollWidth) + 'px')
  return {
    pageOverflow: Math.max(0, Math.round(de.scrollWidth - de.clientWidth)),
    navWidth: navRect ? Math.round(navRect.width) : 0,
    navBeside,
    tables: wide,
  }
})()`

const findings = []
const add = (where, what) => findings.push({ where, what })

// ---- L5: contrast, both themes, every page ----
for (const theme of ['dark', 'light']) {
  await resize(1440)
  await goto(PAGES[0])
  await setTheme(theme)
  for (const hash of PAGES) {
    await goto(hash)
    const rows = await evaluate(CONTRAST)
    for (const r of rows ?? []) add(`${theme} ${hash}`, `${r.kind} ${r.got}:1 (needs ${r.need}) — ${r.detail}`)
  }
}

// ---- L6: reflow at five widths ----
await setTheme('dark')
for (const width of WIDTHS) {
  await resize(width)
  for (const hash of PAGES) {
    await goto(hash)
    const l = await evaluate(LAYOUT)
    if (!l) continue
    if (l.pageOverflow > 2) add(`${width}px ${hash}`, `the page scrolls sideways by ${l.pageOverflow}px`)
    for (const t of l.tables) add(`${width}px ${hash}`, `a table overflows the page rather than its own container: ${t}`)
    // Below the breakpoint the sidebar must not hold a column of its own.
    if (width < COLLAPSE_BELOW && l.navBeside) add(`${width}px ${hash}`, `the sidebar still takes a column beside the content (${l.navWidth}px of ${width}px)`)
  }
}

// ---- report ----
mkdirSync('docs/qa', { recursive: true })
const unwaived = findings.filter((f) => !WAIVED.some((w) => `${f.where} ${f.what}`.includes(w.match)))
const lines = [
  '# Contrast and responsive audit',
  '',
  'Generated by `npm run layout-audit`. Contrast is computed from what the browser',
  'painted, in both themes, at 1440. Reflow is checked at 360, 700, 1024, 1440 and 1920.',
  '',
  `${findings.length} findings, ${unwaived.length} unwaived.`,
  '',
]
const byWhere = new Map()
for (const f of findings) byWhere.set(f.where, [...(byWhere.get(f.where) ?? []), f.what])
for (const [where, what] of byWhere) {
  lines.push(`## ${where}`, '')
  for (const w of what) lines.push(`- ${w}`)
  lines.push('')
}
writeFileSync('docs/qa/layout-audit.md', lines.join('\n'))
console.log(`layout-audit: ${findings.length} findings (${unwaived.length} unwaived) -> docs/qa/layout-audit.md`)
for (const f of unwaived.slice(0, 40)) console.log(`  ${f.where}: ${f.what}`)

const stale = WAIVED.filter((w) => !findings.some((f) => `${f.where} ${f.what}`.includes(w.match)))
for (const w of stale) console.error(`layout-audit: waiver ${w.id} no longer matches anything; delete it`)

ws.close()
chrome.kill()
vite.kill()
process.exit(unwaived.length > 0 || stale.length > 0 ? 1 : 0)
