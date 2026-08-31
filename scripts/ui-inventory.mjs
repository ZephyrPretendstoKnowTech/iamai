// The UI inventory (prompt 36 §1): every user-facing string in the app, by the
// surface it appears on, plus two cross-surface tables that make duplicate
// concepts visible without a reviewer having to remember them.
//
//   npm run inventory        (writes docs/qa/ui-inventory.md)
//
// Extraction is from the rendered DOM, not from the copy modules. Copy is
// shared between pages, so only the DOM can answer "which surfaces does this
// label appear on" — and only the DOM shows a single string rendered seven
// times. Surfaces below page level (a Setup question, a Roadmap tab, an opened
// step) are walked as their own surfaces for the same reason.
//
// Runs against the synthetic tenant (?dev=1&mock=1). The dev panel that flag
// also enables is excluded by selector, as is anything print-only.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { sourceFingerprint } from '../src/fingerprint.ts'

// A fingerprint of everything that can put a string on screen. The lint tests
// refuse to run against an inventory whose fingerprint no longer matches the
// source: a stale inventory would let the rules pass on copy nobody has seen,
// which is worse than no rules at all.

const PORT = Number(process.env.INVENTORY_PORT ?? 5201)
const CDP_PORT = Number(process.env.INVENTORY_CDP_PORT ?? 9446)
const BASE = `http://localhost:${PORT}/rollout/?dev=1&mock=1`
const OUT = 'docs/qa/ui-inventory.md'
// The surface contract (prompt 46 Part 1). Every surface it marks built is
// reached the way it says and captured under its name; the lint then holds
// each capture to the contract's allow lists and budgets. Claude Code never
// edits the contract; the env override exists so lint-mutations can point the
// walk at a scratch copy and prove the machinery fires.
const CONTRACTS = process.env.CONTRACTS_JSON ?? 'docs/qa/page-contracts.json'
const contracts = JSON.parse(readFileSync(CONTRACTS, 'utf8'))

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
  console.error('inventory: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}

// ---- dev server ----
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
  console.error('inventory: dev server did not start')
  vite.kill()
  process.exit(2)
}

// ---- browser ----
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-inventory-profile`,
  `--remote-debugging-port=${CDP_PORT}`, '--window-size=1440,1200', 'about:blank',
], { stdio: 'ignore' })
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

const goto = async (hash) => {
  await send('Page.navigate', { url: `${BASE}#${hash}` })
  await sleep(1400)
}
const rehash = async (hash) => {
  await evaluate(`location.hash = ${JSON.stringify(hash)}`)
  await sleep(900)
}
// Scoped to the page: the header carries a Plan tab of its own (prompt 47 Part 3), and a
// walk that means the Roadmap's Plan tab must not find the header's first.
const clickText = (selector, re) =>
  evaluate(
    `(() => { const r = document.querySelector('main.page') ?? document; const el = [...r.querySelectorAll(${JSON.stringify(selector)})].find(x => ${re}.test((x.textContent || '').trim())); if (el) el.click(); return !!el })()`,
  )

// ---- the extractor, injected into the page ----
//
// One function so the classification lives in exactly one place. Anything
// dev-only, print-only or off-screen is skipped: the inventory describes what a
// user sees.
// `rootExpr` resolves the element to read; `excludeSel`, when given, drops any
// descendant inside it (used to keep Setup's page chrome apart from the eight
// questions, each of which is walked as its own surface).
const extractIn = (rootExpr = `document.querySelector('main.page')`, excludeSel = '', opts = {}) => `(() => {
  const root = ${rootExpr}
  if (!root) return null
  const EXCLUDE = ${JSON.stringify(excludeSel)}
  // Contract inputs (prompt 46 Part 1). The repeater selectors and the forbid
  // list come from the contract file, never from this script, so the walk and
  // the lint cannot disagree about what a row is.
  const REPEATERS = ${JSON.stringify(opts.repeaters ?? null)}
  const FORBID = ${JSON.stringify(opts.forbid ?? [])}
  const skipped = (el) =>
    el.closest('.devtools, .print-only, [hidden]') !== null || (EXCLUDE !== '' && el.closest(EXCLUDE) !== null)
  // checkVisibility sees what offsetParent cannot: a closed <details> keeps
  // its children laid out under content-visibility, so they have an
  // offsetParent and are still not on the page (prompt 47 Part 6).
  const shown = (el) => (typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null)
  const vis = (el) => !skipped(el) && (shown(el) || el.tagName === 'SUMMARY')
  // Read the label without the furniture rendered inside it: a tab's count
  // badge, a stat tile's number, an info-tip button, an icon. Reading
  // textContent straight off the element glues those on ("Here's what's
  // working2", "0Looks healthy") and corrupts every comparison downstream.
  // The inventory is a record of copy, not of tenant data. A rendered clock
  // time changes on every run and would fill the diff with noise on a file
  // that is regenerated by every prompt touching the UI, so volatile values
  // are collapsed to a token. The sentence shape, which is what is being
  // reviewed, survives intact.
  const stabilise = (s) =>
    s
      .replace(/\\b[A-Z][a-z]{2} \\d{1,2}, \\d{4}, \\d{1,2}:\\d{2}\\s?[AP]M\\b/g, '<date and time>')
      .replace(/\\b[A-Z][a-z]{2} \\d{1,2}, \\d{4}\\b/g, '<date>')
      .replace(/\\b\\d{1,2}:\\d{2}\\s?[AP]M\\b/g, '<time>')
      .replace(/\\b\\d{1,2}:\\d{2}\\b/g, '<time>')

  const txt = (el) => {
    const c = el.cloneNode(true)
    c.querySelectorAll('.tab-badge, .stat-num, .infotip, .icon, svg, .ring-mark').forEach((n) => n.remove())
    return stabilise((c.textContent || '').replace(/\\s+/g, ' ').trim())
  }
  const uniq = (a) => [...new Set(a.filter(Boolean))]

  // An element matching .step-title is a title, measured against the contract's
  // stepTitleMaxWords, never a heading (page-contracts.json, $comment).
  const headings = uniq([...root.querySelectorAll('h1,h2,h3,h4')].filter(vis).filter((e) => !e.classList.contains('step-title')).map(txt))
  const titles = uniq([...root.querySelectorAll('.step-title')].filter(vis).map(txt))
  // A tab is a tab (prompt 47 Part 3): the element that carries it is not
  // also counted as a button or a link, whichever element renders it.
  const isTab = (e) => e.matches('[role=tab], .tab')
  const tabs = uniq([...root.querySelectorAll('[role=tab], .tab')].filter(vis).map((e) => txt(e)))
  // A button inside a Setup question is an answer, not a page action.
  const allButtons = [...root.querySelectorAll('button, a.btn, a.button-like, [role=button]')]
    .filter(vis)
    // A sortable column header carries role=button for the keyboard; it is a column.
    .filter((e) => !e.classList.contains('infotip-btn') && !isTab(e) && e.tagName !== 'TH')
  const options = uniq(allButtons.filter((e) => e.closest('.setup-question, .workload-card, .picker')).map(txt))
  const buttons = uniq(allButtons.filter((e) => !e.closest('.setup-question, .workload-card, .picker')).map(txt))
  const links = uniq([...root.querySelectorAll('a[href]')].filter(vis).filter((e) => !e.classList.contains('btn') && !isTab(e)).map(txt))
  const chips = uniq([...root.querySelectorAll('.chip')].filter(vis).map(txt))
  const columns = uniq([...root.querySelectorAll('th')].filter(vis).map(txt))
  const tiles = uniq([...root.querySelectorAll('.stat-label')].filter(vis).map(txt))
  const empty = uniq([...root.querySelectorAll('.empty-state, .empty')].filter(vis).map(txt))
  const summaries = uniq([...root.querySelectorAll('summary')].filter((e) => !skipped(e)).map(txt))
  // Info tips carry their definition in the title attribute or an adjacent panel.
  const tips = uniq(
    [...root.querySelectorAll('.infotip')].filter((e) => !skipped(e)).map((e) => {
      const btn = e.querySelector('.infotip-btn')
      const label = btn && (btn.getAttribute('aria-label') || btn.getAttribute('title'))
      return label || txt(e)
    }),
  )
  // Body prose: paragraphs and list items, minus anything already classified.
  const claimed = new Set([...headings, ...buttons, ...options, ...links, ...chips, ...columns, ...tiles, ...tabs, ...summaries])
  // Leaf blocks only. A callout that contains paragraphs would otherwise be
  // read as well as its children: the same prose counted twice, and the
  // children's text concatenated without a separator, which glues two sentences
  // into one ("…the exact change.5 goals need…") and reports it as one long
  // sentence that nobody wrote.
  const BLOCK = 'p, li, .sub, .reason, .advisor, .muted, .callout'
  const blockEls = [...root.querySelectorAll(BLOCK)].filter(vis).filter((e) => e.querySelector(BLOCK) === null)
  const blocks = blockEls.map(txt).filter((t) => t.length > 0 && !claimed.has(t))
  const sentences = uniq(
    blocks.flatMap((t) => t.split(/(?<=[.!?])\\s+(?=[A-Z0-9"'])/)).map((s) => s.trim()).filter((s) => s.length > 1),
  )

  // Where the page's forward action sits. Two placements across the app is two
  // continue patterns, which no list of labels would show.
  const nav = [...root.querySelectorAll('button, a.btn')]
    .filter(vis)
    .filter((e) => /^(next|continue|back|get started|start)\\b/i.test(txt(e)))
    .map((e) => {
      const box = e.getBoundingClientRect()
      const page = root.getBoundingClientRect()
      const rel = page.height > 0 ? (box.top - page.top) / page.height : 0
      return { label: txt(e), at: rel < 0.34 ? 'top' : rel > 0.66 ? 'bottom' : 'middle', inFooterSlot: e.closest('.step-next') !== null }
    })

  // Lint inputs (prompt 36 §2). Rules 6, 7 and 11 need facts about how a thing
  // is rendered, which no list of strings carries.
  const primary = [...root.querySelectorAll('.btn-primary')].filter(vis).map(txt).filter(Boolean)
  const tables = [...root.querySelectorAll('.datatable-footer')].filter(vis).map((f) => {
    const label = (f.querySelector('span')?.textContent || '').replace(/\\s+/g, ' ').trim()
    // The page indicator renders only when there is more than one page. A
    // button in the footer proves nothing: the CSV export lives there too.
    return { label, paginated: /page \\d+ of \\d+/i.test(label) }
  })
  // Sentence occurrences before de-duplication: rule 11 asks whether a claim is
  // printed twice on one surface, which a unique list can never answer.
  //
  // Counted twice over, because the naive count is mostly noise. A list of
  // eight steps that each state their own blocked reason repeats that sentence
  // eight times and is not a defect; a page that states one claim about the
  // tenant twice is. Anything inside a repeating container is an item, not a
  // claim, so only page-level prose is eligible.
  const REPEATER = '.step-tile, tr, .workload-card, .setup-question, .week-event, .bulletin, .journey-col, .tool-card'
  const sentencesOf = (el) =>
    (txt(el) || '').split(/(?<=[.!?])\\s+(?=[A-Z0-9"'])/).map((s) => s.trim()).filter((s) => s.length > 25)
  const occurrencesAll = {}
  const occurrences = {}
  for (const el of blockEls) {
    const isItem = el.closest(REPEATER) !== null
    for (const s of sentencesOf(el)) {
      occurrencesAll[s] = (occurrencesAll[s] || 0) + 1
      if (!isItem) occurrences[s] = (occurrences[s] || 0) + 1
    }
  }

  const words = (list) => list.join(' ').split(/\\s+/).filter(Boolean).length

  // ---- contract measurements (prompt 46 Part 1 item 3) ----
  //
  // rows: every element matching a contract repeater, measured on its own text
  // with nested repeaters removed, so a wave header is measured apart from the
  // plan rows inside it and a table apart from its rows.
  const repSel = REPEATERS && REPEATERS.length > 0 ? REPEATERS.join(', ') : null
  const rows = []
  if (repSel) {
    for (const el of [...root.querySelectorAll(repSel)].filter(vis)) {
      const c = el.cloneNode(true)
      c.querySelectorAll(repSel).forEach((n) => n.remove())
      c.querySelectorAll('.tab-badge, .stat-num, .infotip, .icon, svg, .ring-mark').forEach((n) => n.remove())
      const text = stabilise((c.textContent || '').replace(/\\s+/g, ' ').trim())
      if (!text) continue
      const ss = text.split(/(?<=[.!?])\\s+(?=[A-Z0-9"'])/).map((x) => x.trim()).filter((x) => x.length > 1)
      rows.push({ selector: REPEATERS.find((r) => el.matches(r)) ?? repSel, text: text.slice(0, 140), sentences: ss.length, words: words([text]) })
    }
  }
  // forbidHits: a contract forbid string anywhere in the surface's own text,
  // exact case. The lists are authored precisely; a case-insensitive match on
  // "History" would fire on prose about history.
  const rootClone = root.cloneNode(true)
  if (EXCLUDE !== '') rootClone.querySelectorAll(EXCLUDE).forEach((n) => n.remove())
  rootClone.querySelectorAll('.devtools, .print-only, [hidden]').forEach((n) => n.remove())
  const rootText = stabilise((rootClone.textContent || '').replace(/\\s+/g, ' '))
  const forbidHits = FORBID.filter((f) => rootText.includes(f))
  // pageProse: sentences and words outside every repeater, which is what the
  // contract's budget bounds. Rows are budgeted separately.
  const proseSel = repSel ?? REPEATER
  const pageTexts = blockEls.filter((e) => e.closest(proseSel) === null).map(txt).filter((t) => t.length > 0 && !claimed.has(t))
  const pageSentences = pageTexts.flatMap((t) => t.split(/(?<=[.!?])\\s+(?=[A-Z0-9"'])/)).map((x) => x.trim()).filter((x) => x.length > 1)
  const pageProse = { sentences: pageSentences.length, words: words(pageSentences) }
  // Controls a screen reader would announce as nameless (prompt 40 §23). The
  // sidebar chevron was reported unlabelled; it is not, and capturing the check
  // here is what makes that answer hold rather than be re-argued each review.
  const accName = (el) => {
    const aria = el.getAttribute('aria-label')
    if (aria && aria.trim()) return aria.trim()
    const by = el.getAttribute('aria-labelledby')
    if (by) { const t = by.split(/\\s+/).map((i) => document.getElementById(i)?.textContent ?? '').join(' ').trim(); if (t) return t }
    const text = (el.textContent ?? '').trim()
    if (text) return text
    // A form control is named by its label, whether the label wraps it or points
    // at it by id. Missing that reported three labelled inputs as nameless.
    const forId = el.id ? document.querySelector('label[for=' + JSON.stringify(el.id) + ']') : null
    const wrap = el.closest('label')
    const lab = ((forId?.textContent ?? '') + ' ' + (wrap?.textContent ?? '')).trim()
    if (lab) return lab
    const title = el.getAttribute('title')
    if (title && title.trim()) return title.trim()
    const svgTitle = el.querySelector('svg > title')
    return svgTitle && svgTitle.textContent.trim() ? svgTitle.textContent.trim() : ''
  }
  const unnamedControls = [...root.querySelectorAll('button, a[href], [role="button"], summary, input, select')]
    .filter((el) => !el.closest('.dev-panel, [hidden], .print-only'))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0 })
    .filter((el) => !accName(el))
    .map((el) => el.outerHTML.slice(0, 120).replace(/\\s+/g, ' '))
  const sections = { headings, tabs, buttons, options, links, chips, columns, tiles, empty, summaries, tips, sentences }
  const wordCounts = {}
  for (const [k, v] of Object.entries(sections)) wordCounts[k] = words(v)
  wordCounts.total = Object.values(wordCounts).reduce((a, b) => a + b, 0)
  return { ...sections, titles, nav, primary, tables, occurrences, occurrencesAll, wordCounts, unnamedControls, rows, forbidHits, pageProse }
})()`

const surfaces = []
const capture = async (name, note = '', rootExpr, excludeSel, extra = {}, opts = {}) => {
  const data = await evaluate(extractIn(rootExpr, excludeSel, opts))
  if (!data) {
    console.warn(`inventory: ${name} rendered nothing`)
    return
  }
  surfaces.push({ name, note, ...data, ...extra })
  console.log(`  ${name}: ${data.wordCounts.total} words`)
}

// ---- the walk ----
console.log('inventory: walking surfaces')

// #/start and #/baseline redirect to Connect since prompt 47 Part 3; the
// pages they named are gone from the walk.
await goto('/connect');          await capture('Connect')

// A tabbed page is captured as chrome plus one surface per panel. Capturing the
// whole page once per tab counts the title, the banner and the Next button once
// per tab, which inflates every cross-surface count by the number of tabs.
const VISIBLE_PANEL = `[...document.querySelectorAll('main.page .tab-panel')].find((p) => p.offsetParent !== null)`

// Today and Inventory are contract surfaces (prompt 47 Part 5): the contract walk below reaches them.

// Setup: every question is its own surface, read from inside its own element
// rather than by expanding one at a time. The questions render open, so
// toggling would fight React and produce eight identical captures; containment
// gives true attribution, which is the whole point of the opt-out table.
await goto('/mapping')
await capture('Setup', 'page chrome only; each question is its own surface below', undefined, '.setup-question')
const questionCount = await evaluate(`document.querySelectorAll('main.page .setup-question').length`)
for (let i = 0; i < questionCount; i++) {
  const title = await evaluate(
    `(() => {
      const q = [...document.querySelectorAll('main.page .setup-question')][${i}]
      const s = q && q.querySelector('summary')
      if (!s) return 'question ${i + 1}'
      const raw = (s.textContent || '').replace(/\\s+/g, ' ').trim()
      // The summary carries the question title plus its status chip; keep the title.
      return raw.replace(/(Required|Answered|Needs attention|\\d+ (must fix|recommended|to fix)).*$/i, '').replace(/^Question \\d+ · /, '').trim().slice(0, 54)
    })()`,
  )
  await capture(
    `Setup / Q${i + 1} — ${title}`,
    'one question',
    `[...document.querySelectorAll('main.page .setup-question')][${i}]`,
  )
}

await goto('/coverage')
await capture('Findings', 'page chrome; tab panels are their own surfaces', undefined, '.tab-panel')
await capture('Findings / Summary tab', 'panel only', VISIBLE_PANEL)
for (const tab of ['working', 'attention', 'Details']) {
  if (await clickText('.tab, [role=tab]', `/${tab}/`)) { await sleep(900); await capture(`Findings / ${tab} tab`, 'panel only', VISIBLE_PANEL) }
}

await goto('/roadmap')
await capture('Roadmap', 'page chrome; tab panels are their own surfaces', undefined, '.tab-panel')
for (const tab of ['^Progress', '^Plan', '^Watch', '^Schedule', '^Export']) {
  if (await clickText('.tab, [role=tab]', `/${tab}/`)) {
    await sleep(1100)
    await capture(`Roadmap / ${tab.replace('^', '')} tab`, 'panel only', VISIBLE_PANEL)
  }
}
// One opened step: the twelve-part body is the densest surface in the app.
if (await clickText('.tab, [role=tab]', '/^Plan/')) {
  await sleep(900)
  if (await clickText('a.step-tile', '/./')) {
    await sleep(1100)
    await capture('Roadmap / Plan / one step opened', 'panel only, first step expanded', VISIBLE_PANEL)
  }
}

await goto('/licensing');        await capture('Licensing guide')
await goto('/reads');            await capture('What IAMAI reads')
await goto('/checks');           await capture('Every check IAMAI runs')
await goto('/naming');           await capture('Naming policies and groups')
await goto('/recovery');         await capture('Recovery card')
await goto('/roadmap/prompts');  await capture('Prompt pack')

// ---- the contract walk (prompt 46 Part 1 item 1) ----
//
// Every surface the contract marks built is reached the way the contract says:
// its route, its mock state, its click actions, its root and its exclusions.
// Planned surfaces are skipped. Until enforceAll is true the legacy walk above
// keeps running unchanged, so the lint keeps seeing the pages that still exist.
const built = (contracts.surfaces ?? []).filter((c) => c.status === 'built')
console.log(`inventory: ${built.length} built surface(s) in the contract, ${(contracts.surfaces ?? []).length - built.length} planned`)

const gotoState = async (route, state) => {
  await send('Page.navigate', { url: `${BASE}&state=${encodeURIComponent(state ?? 'scanned')}#${route}` })
  await sleep(1600)
}
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const clickNth = (selector, nth) =>
  evaluate(
    `(() => { const r = document.querySelector('main.page') ?? document; const els = [...r.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.offsetParent !== null || e.tagName === 'SUMMARY'); const el = els[${Number(nth) - 1}]; if (el) el.click(); return !!el })()`,
  )
const rootExprOf = (root) => {
  if (root === undefined || root === null || root === 'main.page') return undefined
  if (root === 'visiblePanel') return VISIBLE_PANEL
  return `document.querySelector(${JSON.stringify(root)})`
}
for (const c of built) {
  const r = c.reach ?? {}
  await gotoState(r.route ?? '/plan', r.state)
  for (const a of r.actions ?? []) {
    const ok = a.nth ? await clickNth(a.click, a.nth) : await clickText(a.click, `/${escapeRe(a.text ?? '')}/`)
    if (!ok) console.warn(`inventory: ${c.name}: nothing matched action ${JSON.stringify(a)}`)
    await sleep(700)
  }
  const meta = { contract: c.id, state: r.state ?? 'scanned', route: r.route ?? '/plan' }
  const opts = { repeaters: contracts.repeaters ?? [], forbid: c.forbid ?? [] }
  if (r.eachTab) {
    const tabLabels = await evaluate(
      `[...document.querySelectorAll('main.page [role=tab], main.page .tab')].filter((e) => e.offsetParent !== null).map((e) => (e.textContent || '').replace(/\\s+/g, ' ').replace(/\\d+$/, '').trim())`,
    )
    for (const label of tabLabels ?? []) {
      if (!(await clickText('.tab, [role=tab]', `/^${escapeRe(label)}/`))) continue
      await sleep(900)
      await capture(`${c.name} — ${label}`, `contract ${c.id}`, rootExprOf(r.root ?? 'visiblePanel'), r.exclude, meta, opts)
    }
  } else {
    await capture(c.name, `contract ${c.id}`, rootExprOf(r.root), r.exclude, meta, opts)
  }
}

// ---- cross-surface tables ----
//
// The point of the whole exercise: a label is only visibly duplicated when its
// surfaces are listed beside it.
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

const index = (kinds) => {
  const map = new Map()
  for (const s of surfaces) {
    for (const kind of kinds) {
      for (const label of s[kind] ?? []) {
        const key = norm(label)
        if (!key) continue
        if (!map.has(key)) map.set(key, { label, kind, surfaces: [] })
        const e = map.get(key)
        if (!e.surfaces.includes(s.name)) e.surfaces.push(s.name)
      }
    }
  }
  return map
}

const actions = index(['buttons', 'options'])
// A negative answer: the option that declines, defers or denies the question.
const NEGATIVE = /^(not applicable|nobody needs|not sure|none|no |n\/a|doesn.?t exist|skip|no thanks|dismiss|later|leave it|nothing)/i
const negatives = new Map()
for (const [key, e] of index(['options', 'buttons'])) {
  if (NEGATIVE.test(e.label) || /not applicable|nobody needs|not sure|doesn.?t exist/i.test(e.label)) negatives.set(key, e)
}

const rows = (map) =>
  [...map.values()]
    .sort((a, b) => b.surfaces.length - a.surfaces.length || a.label.localeCompare(b.label))
    .map((e) => `| ${e.label.replace(/\|/g, '\\|')} | ${e.surfaces.length} | ${e.surfaces.join('; ')} |`)
    .join('\n')

// ---- near-duplicate detection ----
//
// A flat list sorted by frequency hides the case this inventory most needs to
// catch: several labels, each used once, that mean the same thing. Two passes,
// neither of which knows any specific label.
//
// 1. Intent class, from small lemma sets. Any class holding more than one
//    distinct label is one concept wearing several names.
// 2. Lexical overlap, for labels that share content words without sharing an
//    intent lemma.
const INTENT = {
  'confirms what is shown': ['right', 'correct', 'accurate', 'yes', 'confirm', 'confirmed', 'true', 'agreed', 'ok'],
  'declines the question': ['not applicable', 'nobody', 'none', 'not sure', 'no one', 'nothing', 'unsure'],
  'defers the answer': ['not yet', 'exist yet', 'later', 'skip', 'skipped', 'remind'],
  'moves to the next step': ['next', 'continue', 'get started', 'go to'],
}
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'to', 'of', 'in', 'on', 'for', 'this', 'that', 'it', 'us', 'my', 'your', 'and', 'or'])
const contentWords = (s) => norm(s).split(' ').filter((w) => w.length > 2 && !STOP.has(w))

// Whole words only. A substring test matches "ok" inside "looks" and "broken",
// which drags every status chip into the confirm cluster.
const intentOf = (label) => {
  const n = norm(label)
  const words = n.split(' ')
  for (const [intent, lemmas] of Object.entries(INTENT)) {
    const hit = lemmas.some((l) => (l.includes(' ') ? n.includes(l) : words.includes(l)))
    if (hit) return intent
  }
  return null
}

const byIntent = new Map()
for (const e of actions.values()) {
  const intent = intentOf(e.label)
  if (!intent) continue
  if (!byIntent.has(intent)) byIntent.set(intent, [])
  byIntent.get(intent).push(e)
}

const jaccard = (a, b) => {
  const A = new Set(contentWords(a))
  const B = new Set(contentWords(b))
  if (A.size === 0 || B.size === 0) return 0
  const inter = [...A].filter((w) => B.has(w)).length
  return inter / new Set([...A, ...B]).size
}
const lexicalPairs = []
const actionList = [...actions.values()]
for (let i = 0; i < actionList.length; i++) {
  for (let j = i + 1; j < actionList.length; j++) {
    const score = jaccard(actionList[i].label, actionList[j].label)
    if (score >= 0.34) lexicalPairs.push({ a: actionList[i], b: actionList[j], score })
  }
}
lexicalPairs.sort((x, y) => y.score - x.score)

const intentTable = [...byIntent.entries()]
  .filter(([, list]) => list.length > 1)
  .sort((a, b) => b[1].length - a[1].length)
  .map(([intent, list]) => {
    const labels = list
      .sort((a, b) => b.surfaces.length - a.surfaces.length)
      .map((e) => `${e.label} (${e.surfaces.length})`)
      .join(' · ')
    return `| ${intent} | **${list.length}** | ${labels} |`
  })
  .join('\n')

const lexicalTable = lexicalPairs
  .slice(0, 40)
  .map((p) => `| ${p.a.label} | ${p.b.label} | ${p.score.toFixed(2)} |`)
  .join('\n')

// Continue patterns: label plus where it sits.
const navMap = new Map()
for (const s of surfaces) {
  for (const n of s.nav ?? []) {
    const key = `${n.at}|${n.inFooterSlot}`
    if (!navMap.has(key)) navMap.set(key, { at: n.at, footer: n.inFooterSlot, labels: new Set(), surfaces: [] })
    const e = navMap.get(key)
    e.labels.add(n.label)
    if (!e.surfaces.includes(s.name)) e.surfaces.push(s.name)
  }
}
const navTable = [...navMap.values()]
  .sort((a, b) => b.surfaces.length - a.surfaces.length)
  .map((e) => `| ${e.at}${e.footer ? ', in the step footer slot' : ', loose in the page'} | ${e.surfaces.length} | ${[...e.labels].join(' · ')} | ${e.surfaces.join('; ')} |`)
  .join('\n')

// ---- the document ----
const esc = (s) => s.replace(/\|/g, '\\|')
const section = (title, list) =>
  list.length === 0 ? '' : `\n**${title}** (${list.length})\n\n${list.map((x) => `- ${esc(x)}`).join('\n')}\n`

const body = surfaces
  .map((s) => {
    const w = s.wordCounts
    return [
      `### ${s.name}`,
      s.note ? `\n_${s.note}_\n` : '',
      `\nWords: **${w.total}** — headings ${w.headings}, prose ${w.sentences}, buttons ${w.buttons}, options ${w.options}, links ${w.links}, chips ${w.chips}, columns ${w.columns}, tiles ${w.tiles}, tips ${w.tips}.\n`,
      section('Headings', s.headings),
      section('Tabs', s.tabs),
      section('Buttons', s.buttons),
      section('Options', s.options),
      section('Collapsed section headers', s.summaries),
      section('Links', s.links),
      section('Chips', s.chips),
      section('Table columns', s.columns),
      section('Stat tiles', s.tiles),
      section('Empty states', s.empty),
      section('Info tips', s.tips),
      section('Body sentences', s.sentences),
    ].join('')
  })
  .join('\n')

// Contract budgets (prompt 46 Part 1 item 6): measured against allowed, per
// built surface, so a reviewer can see headroom without running anything.
const matchesAllow = (item, allow) => allow.some((a) => (a.startsWith('re:') ? new RegExp(a.slice(3)).test(item) : a === item))
const KINDS = ['headings', 'tabs', 'tiles', 'columns', 'chips', 'buttons', 'summaries', 'links']
const contractRows = surfaces
  .filter((s) => s.contract)
  .map((s) => {
    const c = (contracts.surfaces ?? []).find((x) => x.id === s.contract)
    if (!c) return `| ${s.name} | _no contract_ | | | | |`
    const misses = KINDS.flatMap((k) => (s[k] ?? []).filter((item) => !matchesAllow(item, c.allow?.[k] ?? [])).map((item) => `${k}: ${item}`))
    const rb = c.rowBudget ?? { sentences: contracts.rules.rowMaxSentences, words: contracts.rules.rowMaxWords }
    const overRows = (s.rows ?? []).filter((r) => r.sentences > rb.sentences || r.words > rb.words).length
    const prose = s.pageProse ?? { sentences: 0, words: 0 }
    const fmt = (n, max) => (n > max ? `**${n}** / ${max}` : `${n} / ${max}`)
    return `| ${s.name} | ${fmt(prose.sentences, c.budget.sentences)} | ${fmt(prose.words, c.budget.words)} | ${overRows} of ${(s.rows ?? []).length} | ${(s.forbidHits ?? []).length} | ${misses.length}${misses.length ? ` (${misses.slice(0, 3).join('; ')})` : ''} |`
  })
const contractTable = contractRows.length > 0 ? contractRows.join('\n') : '| _no built surfaces yet_ | | | | | |'

const totalWords = surfaces.reduce((n, s) => n + s.wordCounts.total, 0)
const doc = `# UI inventory

Generated by \`npm run inventory\` (scripts/ui-inventory.mjs) from the rendered
DOM against the synthetic tenant. Do not edit by hand: regenerate it.

Extraction is from the DOM rather than from \`src/copy\`, because copy modules
are shared between pages and only the DOM can say which surfaces a label
actually appears on. Surfaces below page level (each Setup question, each
Roadmap tab, an opened step) are walked separately for the same reason: a single
string rendered seven times is seven rows here and one row in the source.

**${surfaces.length} surfaces, ${totalWords} words.**

## Candidate duplicate concepts

Found by clustering, not by a list of known offenders: nothing in this section
knows any specific label, so a new synonym lands in the right row without anyone
adding it to a list.

**Each row is a candidate, not a verdict.** Two labels can share an intent and
still drive different state: on this build "Not applicable to us" opens a
required reason box and suppresses the question's checks, while "Nobody needs
special care" is a one-click answer that leaves the checks running. Clustering
sees the shared intent and cannot see the difference. Read the source before
merging anything here.

### By intent

Labels grouped by what they do, using small lemma sets. More than one label in a
row is a prompt to go and check whether they are one concept.

| Intent | Labels | Which |
|---|---|---|
${intentTable || '| _none_ | | |'}

### By shared wording

Label pairs that share content words. Catches the cases the intent lemmas miss.

| Label | Near-duplicate | Overlap |
|---|---|---|
${lexicalTable || '| _none_ | | |'}

### Continue patterns

Where the forward action sits. More than one row is more than one pattern.

| Placement | Surfaces | Labels | Where |
|---|---|---|---|
${navTable || '| _none_ | | | |'}

## Contract budgets

Measured against \`docs/qa/page-contracts.json\`, one row per built surface. Bold
means over budget; the lint fails on it. Planned surfaces are not walked.

| Surface | Prose sentences / budget | Prose words / budget | Rows over row budget | Forbid hits | Allow-list misses |
|---|---|---|---|---|---|
${contractTable}

## Cross-surface: every action label

Buttons and answer options, with the surfaces they appear on. Two rows that mean
the same thing are a duplicate concept.

| Label | Surfaces | Where |
|---|---|---|
${rows(actions)}

## Cross-surface: every negative or opt-out option

The answer that declines, defers or denies. One concept should have one label
and, where it is legitimate at all, one home.

| Label | Surfaces | Where |
|---|---|---|
${rows(negatives)}

## Words per surface

| Surface | Words |
|---|---|
${surfaces.map((s) => `| ${s.name} | ${s.wordCounts.total} |`).join('\n')}

## Surfaces

${body}
`

const fingerprint = sourceFingerprint()
mkdirSync('docs/qa', { recursive: true })
writeFileSync(OUT, `<!-- source-fingerprint: ${fingerprint} -->\n${doc}`)
// The machine copy. The lint rules read this rather than parsing the markdown:
// the markdown is for a person, and a rule that depends on a heading level is a
// rule that breaks when the document is reformatted.
writeFileSync(OUT.replace(/\.md$/, '.json'), JSON.stringify({ fingerprint, surfaces }, null, 1))
console.log(`inventory: ${surfaces.length} surfaces, ${totalWords} words -> ${OUT}`)
console.log(`inventory: ${actions.size} distinct action labels, ${negatives.size} distinct negative options`)

ws.close()
chrome.kill()
vite.kill()
process.exit(0)
