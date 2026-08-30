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
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
const clickText = (selector, re) =>
  evaluate(
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(x => ${re}.test((x.textContent || '').trim())); if (el) el.click(); return !!el })()`,
  )

// ---- the extractor, injected into the page ----
//
// One function so the classification lives in exactly one place. Anything
// dev-only, print-only or off-screen is skipped: the inventory describes what a
// user sees.
// `rootExpr` resolves the element to read; `excludeSel`, when given, drops any
// descendant inside it (used to keep Setup's page chrome apart from the eight
// questions, each of which is walked as its own surface).
const extractIn = (rootExpr = `document.querySelector('main.page')`, excludeSel = '') => `(() => {
  const root = ${rootExpr}
  if (!root) return null
  const EXCLUDE = ${JSON.stringify(excludeSel)}
  const skipped = (el) =>
    el.closest('.devtools, .print-only, [hidden]') !== null || (EXCLUDE !== '' && el.closest(EXCLUDE) !== null)
  const vis = (el) => !skipped(el) && el.offsetParent !== null || (el.tagName === 'SUMMARY' && !skipped(el))
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

  const headings = uniq([...root.querySelectorAll('h1,h2,h3,h4')].filter(vis).map(txt))
  const tabs = uniq([...root.querySelectorAll('[role=tab], .tab')].filter(vis).map((e) => txt(e)))
  // A button inside a Setup question is an answer, not a page action.
  const allButtons = [...root.querySelectorAll('button, a.btn, a.button-like, [role=button]')]
    .filter(vis)
    .filter((e) => !e.classList.contains('infotip-btn'))
  const options = uniq(allButtons.filter((e) => e.closest('.setup-question, .workload-card, .picker')).map(txt))
  const buttons = uniq(allButtons.filter((e) => !e.closest('.setup-question, .workload-card, .picker')).map(txt))
  const links = uniq([...root.querySelectorAll('a[href]')].filter(vis).filter((e) => !e.classList.contains('btn')).map(txt))
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
  const sections = { headings, tabs, buttons, options, links, chips, columns, tiles, empty, summaries, tips, sentences }
  const wordCounts = {}
  for (const [k, v] of Object.entries(sections)) wordCounts[k] = words(v)
  wordCounts.total = Object.values(wordCounts).reduce((a, b) => a + b, 0)
  return { ...sections, nav, primary, tables, occurrences, occurrencesAll, wordCounts }
})()`

const surfaces = []
const capture = async (name, note = '', rootExpr, excludeSel) => {
  const data = await evaluate(extractIn(rootExpr, excludeSel))
  if (!data) {
    console.warn(`inventory: ${name} rendered nothing`)
    return
  }
  surfaces.push({ name, note, ...data })
  console.log(`  ${name}: ${data.wordCounts.total} words`)
}

// ---- the walk ----
console.log('inventory: walking surfaces')

await goto('/start');            await capture('Start')
await goto('/connect');          await capture('Connect')
await clickText('summary', '/What IAMAI will ask for/'); await sleep(500)
await capture('Connect / permissions disclosure', 'disclosure expanded')

await goto('/baseline');         await capture('Baseline')
// A tabbed page is captured as chrome plus one surface per panel. Capturing the
// whole page once per tab counts the title, the banner and the Next button once
// per tab, which inflates every cross-surface count by the number of tabs.
const VISIBLE_PANEL = `[...document.querySelectorAll('main.page .tab-panel')].find((p) => p.offsetParent !== null)`

await goto('/scan')
await capture('Scan', 'page chrome; tab panels are their own surfaces', undefined, '.tab-panel')
await capture('Scan / Readiness tab', 'panel only', VISIBLE_PANEL)
if (await clickText('.tab, [role=tab]', '/Inventory/')) {
  await sleep(900)
  await capture('Scan / Inventory tab', 'panel only', VISIBLE_PANEL)
}

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
await goto('/roadmap/prompts');  await capture('Prompt pack')
// #/inventory is not a page: App.tsx renders the same MfaViabilityScreen as
// #/scan with view='inventory', so it is already captured as Scan / Inventory
// tab. Walking it again would count Scan's chrome a third time.

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
