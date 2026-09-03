// The walk (prompt 53 Unit 0): the reviewer's eyes, as a script.
//
//   npm run walk             (CHROME=/path/to/chrome to override the binary)
//
// Renders every surface of the demo at desktop width (1280) in
// headless Chrome, opens every plan row one by one, and writes the innerText of
// <main> and a screenshot for each into walk/<sha>/…; diffs the text against
// the surface contract (docs/qa/page-contracts.json: allowed headings, buttons,
// summaries, links, chips, forbidden words, budgets); checks the invariants the
// reviewer checked by hand in docs/reports/walk-51.md; scans the private
// GetIAMAI plan file's saved steps offline where it exists (the file carries no
// tenant snapshot, so the app cannot regenerate that plan without a sign-in);
// and writes docs/reports/walk-<sha>.md in walk-51.md's shape: P0 / P1 / P2.
//
// Nothing here writes tenant data to disk unredacted: every finding that quotes
// the plan file passes through the same UPN/GUID redaction the spike harness
// uses. Exit code 1 when a P0 remains, so a unit is done only when its findings
// are gone from the next walk.
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import { extname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { absentStepIds } from '../src/roadmap/baselineScope.ts'
import { isFloorGoal } from '../src/roadmap/floor.ts'
import { steps as contentSteps } from '../src/content/content.ts'
import goalsData from '../data/goals.json' with { type: 'json' }
import { contentFindings, contentLearnUrls, probe } from './walkContent.mjs'

const PORT = Number(process.env.WALK_PORT ?? 5203)
const CDP_PORT = Number(process.env.WALK_CDP_PORT ?? 9448)
const WIDTHS = [1280]
const SHA = (() => {
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'dev'
  }
})()
const OUT = join('walk', SHA)
const REPORT = join('docs', 'reports', `walk-${SHA}.md`)
const PLAN_FILE = process.env.WALK_PLAN_FILE ?? 'fixtures/private/getiamai.plan.json'
const contracts = JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8'))
const RULES = contracts.rules
const FORBID_EVERY = contracts.forbidEverywhere ?? []
const REPEATERS = contracts.repeaters ?? []
const contractById = Object.fromEntries((contracts.surfaces ?? []).map((c) => [c.id, c]))

// The titles and goal names that must never appear as a plan row: the content
// steps absent from the pinned baseline, and the catalogue names of the goals
// the pinned map does not hold.
// The floor (target-state §13) renders registration protection and the legacy block
// from Microsoft's templates when the baseline lacks them; they are not absent.
const ABSENT_STEP_IDS = new Set(absentStepIds().filter((id) => !isFloorGoal(id)))
const ABSENT_TITLES = new Set(contentSteps.filter((s) => ABSENT_STEP_IDS.has(s.id)).map((s) => s.title))
const CATALOGUE_TITLES = new Map(goalsData.goals.map((g) => [g.id, g.name]))
const ABSENT_GOAL_NAMES = new Set([...ABSENT_STEP_IDS].flatMap((id) => (CATALOGUE_TITLES.has(id) ? [CATALOGUE_TITLES.get(id)] : [])))
const FORBIDDEN_PHRASES = ['an account IAMAI could not name', 'an unnamed account', '168h', 'undefined', '[object Object]', 'NaN']
// The steps an answered question adds to the plan (generate.ts carve-outs): each has a content entry.
const CARVE_OUT_IDS = ['s-question-travel', 's-question-partner', 's-question-mail-devices']
// The policy steps whose content carries a "before" line (a setting to change
// before the policy exists) that the step keeps above the translator's portal
// lines: the device-settings toggle, the Intune compliance settings, password
// writeback, the SharePoint access control. Read from the content, so a content
// file without the lines fails here before any step is opened.
const BEFORE_STEP_IDS = ['device-registration-mfa', 'require-managed-device', 'user-risk', 'user-risk-medium', 'unmanaged-browser']
const BEFORE_LINES = BEFORE_STEP_IDS.map((id) => {
  const s = contentSteps.find((x) => x.id === id)
  const lines = (s?.whatToDo?.before ?? []).filter((l) => typeof l === 'string')
  return { id, title: s?.title ?? id, lines }
})

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
  console.error('walk: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}

// ---- findings ----
const findings = { P0: [], P1: [], P2: [] }
const seen = new Set()
const add = (level, text) => {
  const key = `${level}:${text}`
  if (seen.has(key)) return
  seen.add(key)
  findings[level].push(text)
}
const log = (m) => console.log(`walk: ${m}`)

// Redaction for anything that came from the private plan file (CLAUDE.md: no
// UPNs, user object ids or tenant GUIDs in a findings doc).
const redact = (s) =>
  String(s)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<guid>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<upn>')

// ---- dev server ----
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] })
let up = false
for (let i = 0; i < 120 && !up; i++) {
  try {
    up = (await fetch(`http://localhost:${PORT}/rollout/`)).ok
  } catch {
    await sleep(200)
  }
}
if (!up) {
  console.error('walk: dev server did not start')
  vite.kill()
  process.exit(2)
}

// ---- browser ----
const profile = `${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-walk-profile`
rmSync(profile, { recursive: true, force: true })
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${CDP_PORT}`, '--window-size=1280,1400', 'about:blank',
], { stdio: 'ignore' })
let targets = []
for (let i = 0; i < 300 && targets.length === 0; i++) {
  try {
    targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json()
  } catch {
    await sleep(200)
  }
}
const page = targets.find((t) => t.type === 'page')
if (!page) {
  console.error('walk: Chrome exposed no page target within 60 s (a slow runner, or a Chrome that could not start)')
  chrome.kill()
  vite.kill()
  process.exit(2)
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
const consoleErrors = []
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
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

const setWidth = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: 1400, deviceScaleFactor: 1, mobile: width < 600 })
const waitFor = async (expr, ms = 15000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if ((await evaluate(expr)) === true) return true
    await sleep(120)
  }
  return false
}
/** Wait until the page's text stops changing (two identical reads 250 ms apart). */
const settle = async () => {
  let last = ''
  for (let i = 0; i < 40; i++) {
    const now = await evaluate(`(document.querySelector('main.page') || document.body).innerText`)
    if (now === last && now.length > 0) return
    last = now
    await sleep(250)
  }
}
const mainText = () => evaluate(`(document.querySelector('main.page') || document.body).innerText`)
const shot = async (path) => {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  writeFileSync(path, Buffer.from(r.result.data, 'base64'))
}
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const clickText = (selector, re, root = 'main.page') =>
  evaluate(`(() => { const r = document.querySelector(${JSON.stringify(root)}) ?? document; const el = [...r.querySelectorAll(${JSON.stringify(selector)})].find(x => ${re}.test((x.textContent || '').trim())); if (el) { el.scrollIntoView({ block: 'center' }); el.click() } return !!el })()`)

// ---- the in-page extractor (the inventory's classification, trimmed to the contract diff) ----
const extractIn = (rootExpr, excludeSel = '') => `(() => {
  const root = ${rootExpr}
  if (!root) return null
  const EXCLUDE = ${JSON.stringify(excludeSel)}
  const REPEATERS = ${JSON.stringify(REPEATERS)}
  const skipped = (el) => el.closest('.devtools, .print-only, [hidden]') !== null || (EXCLUDE !== '' && el.closest(EXCLUDE) !== null)
  const shown = (el) => (typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.offsetParent !== null)
  const vis = (el) => !skipped(el) && (shown(el) || el.tagName === 'SUMMARY')
  const txt = (el) => { const c = el.cloneNode(true); c.querySelectorAll('.tab-badge, .stat-num, .infotip, .icon, svg, .ring-mark').forEach((n) => n.remove()); return (c.textContent || '').replace(/\\s+/g, ' ').trim() }
  const uniq = (a) => [...new Set(a.filter(Boolean))]
  const headings = uniq([...root.querySelectorAll('h1,h2,h3,h4')].filter(vis).filter((e) => !e.classList.contains('step-title')).map(txt))
  const titles = uniq([...root.querySelectorAll('.step-title')].filter(vis).map(txt))
  const isTab = (e) => e.matches('[role=tab], .tab')
  const tabs = uniq([...root.querySelectorAll('[role=tab], .tab')].filter(vis).map(txt))
  // Controls inside a repeater are items, measured under rows, never against
  // the surface's allow lists (page-contracts.json $comment).
  const repSelAll = REPEATERS.length > 0 ? REPEATERS.join(', ') : null
  const inRepeater = (e) => repSelAll !== null && e.closest(repSelAll) !== null && !e.matches(repSelAll)
  const allButtons = [...root.querySelectorAll('button, a.btn, a.button-like, [role=button]')].filter(vis).filter((e) => !e.classList.contains('infotip-btn') && !isTab(e) && e.tagName !== 'TH')
  const buttons = uniq(allButtons.filter((e) => !e.closest('.setup-question, .workload-card, .picker, .decision') && !inRepeater(e)).map(txt))
  const links = uniq([...root.querySelectorAll('a[href]')].filter(vis).filter((e) => !e.classList.contains('btn') && !isTab(e) && !inRepeater(e)).map(txt))
  const chips = uniq([...root.querySelectorAll('.chip')].filter(vis).filter((e) => !inRepeater(e) && !e.closest('.picker')).map(txt))
  const summaries = uniq([...root.querySelectorAll('summary')].filter((e) => !skipped(e)).map(txt))
  const claimed = new Set([...headings, ...buttons, ...links, ...chips, ...tabs, ...summaries])
  const BLOCK = 'p, li, .sub, .reason, .advisor, .muted, .callout'
  const blockEls = [...root.querySelectorAll(BLOCK)].filter(vis).filter((e) => e.querySelector(BLOCK) === null)
  const words = (list) => list.join(' ').split(/\\s+/).filter(Boolean).length
  const repSel = REPEATERS.length > 0 ? REPEATERS.join(', ') : null
  const rows = []
  if (repSel) for (const el of [...root.querySelectorAll(repSel)].filter(vis)) {
    const c = el.cloneNode(true)
    c.querySelectorAll(repSel).forEach((n) => n.remove())
    c.querySelectorAll('.tab-badge, .stat-num, .infotip, .icon, svg, .ring-mark').forEach((n) => n.remove())
    const text = (c.textContent || '').replace(/\\s+/g, ' ').trim()
    if (!text) continue
    const ss = text.split(/(?<=[.!?])\\s+(?=[A-Z0-9"'])/).map((x) => x.trim()).filter((x) => x.length > 1)
    rows.push({ selector: REPEATERS.find((r) => el.matches(r)) ?? repSel, text: text.slice(0, 160), sentences: ss.length, words: words([text]) })
  }
  const rootClone = root.cloneNode(true)
  if (EXCLUDE !== '') rootClone.querySelectorAll(EXCLUDE).forEach((n) => n.remove())
  rootClone.querySelectorAll('.devtools, .print-only, [hidden]').forEach((n) => n.remove())
  const rootText = (rootClone.textContent || '').replace(/\\s+/g, ' ')
  const proseClone = root.cloneNode(true)
  proseClone.querySelectorAll('.devtools, .print-only, [hidden], pre, code, .mono, .code-block').forEach((n) => n.remove())
  const proseText = (proseClone.textContent || '').replace(/\\s+/g, ' ')
  const proseSel = repSel ?? '.plan-row'
  const pageTexts = blockEls.filter((e) => e.closest(proseSel) === null).map(txt).filter((t) => t.length > 0 && !claimed.has(t))
  const pageSentences = pageTexts.flatMap((t) => t.split(/(?<=[.!?])\\s+(?=[A-Z0-9"'])/)).map((x) => x.trim()).filter((x) => x.length > 1)
  const longSentences = pageSentences.filter((s) => s.split(/\\s+/).length > ${RULES.sentenceMaxWords})
  // An empty section: a heading with nothing but another heading (or the end) after it.
  const emptySections = []
  const isEmptyList = (n) => n && /^(UL|OL)$/.test(n.tagName) && n.querySelectorAll('li').length === 0
  for (const h of [...root.querySelectorAll('h3')].filter(vis)) {
    let n = h.nextElementSibling
    while (n && (((n.tagName === 'P' || n.tagName === 'DIV') && n.classList.contains('actions')) || isEmptyList(n))) n = n.nextElementSibling
    if (!n || /^H[1-4]$/.test(n.tagName)) emptySections.push(txt(h))
  }
  // A lead that ends in a colon with no list, names or picker under it.
  const danglingLeads = []
  for (const p of [...root.querySelectorAll('p')].filter(vis)) {
    const t = txt(p)
    if (!/:$/.test(t)) continue
    // A lead may name the thing on one line (the group and its count) before what is listed under it.
    let n = p.nextElementSibling
    while (n && n.matches('p') && !/:$/.test(txt(n)) && !/^(No |Nobody |None )/.test(txt(n)) && n.nextElementSibling && n.nextElementSibling.matches('ul, ol, .names-group')) n = n.nextElementSibling
    if (!n || !n.matches('ul, ol, .names-group, .picker, .decision, p, div')) danglingLeads.push(t)
    else if (n.matches('p') && !/^(No |Nobody |None )/.test(txt(n))) danglingLeads.push(t)
  }
  const emptyLists = [...root.querySelectorAll('ul, ol')].filter(vis).filter((l) => l.querySelectorAll('li').length === 0).length
  return { headings, titles, tabs, buttons, links, chips, summaries, rows, rootText, proseText, pageProse: { sentences: pageSentences.length, words: words(pageSentences) }, longSentences, emptySections, danglingLeads, emptyLists }
})()`

// The long date form (emails only) and the other short forms one page must not mix.
const LONG_DATE = /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/
const ODD_SHORT_DATE = /\b\d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]* \d{4}\b/
// A hole is a {variable} left in prose; an API path's /{id} on How is a literal.
const HOLE = /\{[a-zA-Z0-9_:]+\}/
const holeIn = (text) => text.replace(/\/\{id\}/g, '/').match(HOLE)
// An empty value: a doubled or trailing separator, empty brackets, a doubled
// comma, "from ·" — the shapes a missing date or name leaves. A lead's colon is
// content (its list or none-branch follows), so it is not one.
const EMPTY_VALUE = /(·\s*·)|(\(\s*\))|(,\s*,)|(\bfrom\s+until\b)|(\bfrom\s*·)|(·\s*$)|(^\s*·)/m
// A variable the engine does not fill renders as nothing, and the sentence
// around it closes on a preposition or an article: "From , signing in", "over
// the next days", "Personal devices ." (the campaign email read "over the next
// days." when its window became a variable the engine did not yet fill).
const EMPTIED_VALUE = /\b(From|from|the next|after|by|before|on|until|within) (,|\.|days\b|hours\b)|\s\.(\s|$)/

const matchesAllow = (item, allow) => (allow ?? []).some((a) => (a.startsWith('re:') ? new RegExp(a.slice(3)).test(item) : a === item))

/** Diff one capture against its contract; every miss is a P1 (the contract is the maximum). */
function diffContract(label, c, d) {
  if (!c || !d) return
  for (const [kind, allowKey] of [['headings', 'headings'], ['tabs', 'tabs'], ['buttons', 'buttons'], ['summaries', 'summaries'], ['links', 'links'], ['chips', 'chips']]) {
    for (const item of d[kind] ?? []) {
      if (!matchesAllow(item, c.allow?.[allowKey])) add('P1', `${label}: ${kind.slice(0, -1)} "${item}" is not in the ${c.id} contract's allow list`)
    }
  }
  for (const f of c.forbid ?? []) if (d.rootText.includes(f)) add('P0', `${label}: forbidden string "${f}" on the surface (${c.id} forbid)`)
  for (const f of FORBID_EVERY) if (d.proseText.includes(f)) add('P0', `${label}: forbidden-everywhere string "${f}" in prose`)
  if (c.budget && (d.pageProse.sentences > c.budget.sentences || d.pageProse.words > c.budget.words)) add('P1', `${label}: page prose ${d.pageProse.sentences} sentences / ${d.pageProse.words} words, over the ${c.id} budget ${c.budget.sentences} / ${c.budget.words}`)
  const rb = c.rowBudget ?? { sentences: RULES.rowMaxSentences, words: RULES.rowMaxWords }
  for (const r of d.rows) {
    if (r.sentences <= rb.sentences && r.words <= rb.words) continue
    // The contract lists the copy box and the decision as repeaters, so an email
    // body and a picker's people rows are measured as rows against a 30-word
    // budget. A question for the reviewer, not a defect in the page.
    const level = r.selector === '.copy-box' || r.selector === '.decision' ? 'P2' : 'P1'
    add(level, `${label}: ${level === 'P2' ? '(contract question) ' : ''}row "${r.text.slice(0, 80)}…" is ${r.sentences} sentences / ${r.words} words, over ${rb.sentences} / ${rb.words}`)
  }
  for (const t of d.titles) if (t.split(/\s+/).length > RULES.stepTitleMaxWords) add('P1', `${label}: title "${t}" is over ${RULES.stepTitleMaxWords} words`)
  for (const s of d.longSentences) add('P1', `${label}: sentence over ${RULES.sentenceMaxWords} words: "${s.slice(0, 90)}…"`)
}

/** The people a row or a lead counts: a leading number; a row may also read nobody affected (0) or two short names; null otherwise. */
function countOf(text, { names = false } = {}) {
  const t = (text || '').trim()
  const m = /^(\d+)\b/.exec(t)
  if (m) return Number(m[1])
  if (!names) return null
  if (/^nobody affected/i.test(t)) return 0
  // A row names people only when two or fewer fit in 28 characters; a sentence is not a name list.
  const head = t.split(' · ')[0]
  if (!head || /[:.]$/.test(head) || head.length > 28) return null
  const parts = head.split(/, | and /)
  return parts.length <= 2 ? parts.length : null
}

/** The invariants over one capture's text. */
function checkText(label, text, { emails = false } = {}) {
  const hole = holeIn(text)
  if (hole) add('P0', `${label}: unfilled variable ${hole[0]} in the rendered text`)
  const ev = text.match(EMPTY_VALUE)
  if (ev) add('P0', `${label}: an empty value in the rendered text ("${ev[0].trim().slice(0, 30)}")`)
  const em = text.match(EMPTIED_VALUE)
  if (em) add('P0', `${label}: a variable rendered as nothing ("${em[0].trim().slice(0, 30)}")`)
  for (const p of FORBIDDEN_PHRASES) if (text.includes(p)) add('P0', `${label}: forbidden phrase "${p}"`)
  if (!emails && LONG_DATE.test(text)) add('P1', `${label}: the long date form "${text.match(LONG_DATE)[0]}" outside an email`)
  if (ODD_SHORT_DATE.test(text)) add('P1', `${label}: a second date format "${text.match(ODD_SHORT_DATE)[0]}" beside the short form`)
}

// Readiness and population values collected across surfaces, checked at the end.
// Per fixture (day one and week two legitimately differ): kind -> Set(values).
const readinessBy = new Map()
const populationsBy = new Map()
let currentFixture = 'demo'
const readinessOf = (name) => { if (!readinessBy.has(name)) readinessBy.set(name, new Map()); return readinessBy.get(name) }
const populationsOf = (name) => { if (!populationsBy.has(name)) populationsBy.set(name, new Set()); return populationsBy.get(name) }
// A readiness value is a "now" — "device readiness 30%", "(now 30%)" — never
// the threshold a line names ("reaches 80%", "waits for 90%").
const noteReadiness = (kind, value) => {
  const readiness = readinessOf(currentFixture)
  if (!readiness.has(kind)) readiness.set(kind, new Set())
  readiness.get(kind).add(value)
}
const collect = (text, { population = true } = {}) => {
  for (const m of text.matchAll(/\b(MFA|admin|device|guest)\s+readiness\s+(\d{1,3})%/gi)) noteReadiness(m[1].toLowerCase(), m[2])
  for (const m of text.matchAll(/\b(MFA|admin|device|guest)\s+readiness\s+reaches\s+\d{1,3}%\s*\(now\s+(\d{1,3})%\)/gi)) noteReadiness(m[1].toLowerCase(), m[2])
  for (const m of text.matchAll(/(?<![A-Za-z]\s)\breadiness\s+(\d{1,3})%/gi)) noteReadiness('mfa', m[1])
  if (population) for (const m of text.matchAll(/\b(\d+) active people\b/g)) populationsOf(currentFixture).add(m[1])
}

const learnLinks = new Set()

// ---- the walk of one fixture ----
async function walkFixture(fx) {
  const dir = join(OUT, fx.name)
  // The demo's week two: the header's Scan to update the plan flips the demo to
  // its week-two snapshot (App.tsx demoWeek2), then the plan is walked again.
  // The demo's Scan to update the plan toggles week two on and off, and a hash
  // navigation keeps the page alive, so entering is idempotent: click only
  // while the banner does not already say week 2.
  const ensureWeek2 = async () => {
    if (!fx.week2) return
    // The demo must have finished loading (rows on the page) before the control is used.
    await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
    if (await evaluate(`/week 2/i.test(document.body.innerText)`)) return
    const clicked = await clickText('button, a', /Scan to update the plan/, 'header.app')
    if (!clicked) add('P0', `${fx.name}: the header offers no Scan to update the plan`)
    const week2 = await waitFor(`/week 2/i.test(document.body.innerText)`, 10000)
    if (!week2) add('P0', `${fx.name}: Scan to update the plan does not advance the demo to week two`)
    await sleep(800)
  }
  mkdirSync(dir, { recursive: true })
  const summary = []
  const routeContract = { connect: 'connect.scanned', today: 'today', plan: 'plan', export: 'export', how: 'how' }
  let rowTitles = []
  let rowStatuses = []
  let rowWhens = []
  let rowReasons = []
  let rowTitlesOpen = []
  let rowReasonsOpen = []
  let rowTitlesAfter = []
  let rowReasonsAfter = []
  let exclusionBody = null
  let sawExistingCoverage = false
  for (const width of WIDTHS) {
    await setWidth(width)
    const wdir = join(dir, String(width))
    mkdirSync(wdir, { recursive: true })
    for (const route of fx.routes ?? ['plan', 'today', 'export', 'how', 'connect']) {
      const label = `${fx.name} @${width} /${route}`
      await send('Page.navigate', { url: `${fx.base}#/${route}` })
      await sleep(600)
      await ensureWeek2()
      if (route === 'plan') await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
      await settle()
      const text = await mainText()
      writeFileSync(join(wdir, `${route}.txt`), text)
      await shot(join(wdir, `${route}.png`))
      const c = contractById[routeContract[route]]
      const d = await evaluate(extractIn(`document.querySelector('main.page')`, c?.reach?.exclude ?? ''))
      if (!d) {
        add('P0', `${label}: nothing rendered in main`)
        continue
      }
      diffContract(label, c, d)
      checkText(label, text)
      collect(text)
      const overflow = await evaluate(`Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)`)
      if (overflow > 0) {
        const widest = await evaluate(`(() => { const w = document.documentElement.clientWidth; const els = [...document.querySelectorAll('main.page *')].filter((e) => e.getBoundingClientRect().right > w + 1); const e = els[0]; return e ? (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().right - w) + 'px past the edge' : '' })()`)
        add(width < 600 ? 'P1' : 'P1', `${label}: the page overflows the viewport by ${overflow}px (${widest})`)
      }
      summary.push({ width, route, words: text.split(/\s+/).filter(Boolean).length, rows: d.rows.length })
      if (route !== 'plan') continue

      // Every row, one by one: it opens; its body shares the row's title; the
      // body keeps the invariants; More opens; Learn links resolve.
      let n = await evaluate(`document.querySelectorAll('main.page .plan-row').length`)
      rowTitles = await evaluate(`[...document.querySelectorAll('main.page .plan-row .step-title')].map((e) => (e.textContent || '').trim())`)
      rowStatuses = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((e) => ((e.querySelector('.status') || {}).textContent || '').trim())`)
      rowWhens = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((e) => ((e.querySelector('.when') || {}).textContent || '').trim())`)
      rowReasons = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((e) => ((e.querySelector('.plan-row-reason') || {}).textContent || '').trim())`)
      // The rows as first seen, with every decision still open (the loop re-reads the rows after a decision moves a step).
      rowTitlesOpen = [...rowTitles]
      rowReasonsOpen = [...rowReasons]
      let inFooter = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((e) => e.closest('.plan-footer') !== null)`)
      for (let i = 0; i < n; i++) {
        if (inFooter[i]) continue
        const title = rowTitles[i]
        const slabel = `${fx.name} @${width} step "${title}"`
        // Set when a decision made on this step moved it to the footer (In place), so the rows below it moved up one.
        let decidedHere = false
        await send('Page.navigate', { url: `${fx.base}#/plan` })
        await sleep(300)
        await waitFor(`document.querySelectorAll('main.page .plan-row').length > ${i}`)
        await ensureWeek2()
        await waitFor(`document.querySelectorAll('main.page .plan-row').length > ${i}`)
        await evaluate(`(() => { const r = document.querySelectorAll('main.page .plan-row')[${i}]; r.scrollIntoView({ block: 'center' }); r.click() })()`)
        const opened = await waitFor(`document.querySelector('main.page .step-body') !== null`, 4000)
        if (!opened) {
          add('P0', `${slabel}: the row does not open`)
          continue
        }
        await settle()
        const bodyText = await evaluate(`(document.querySelector('main.page .step-body') || {}).innerText || ''`)
        // A policy in report-only says when it may be enforced, on the row and in
        // the step: the date column reads ready <date> · ready now · ready since
        // <date>, and Done when carries both gates with today's numbers.
        if (rowStatuses[i] === 'Report-only') {
          if (!/^ready (now|since .+|\S.*\d{4})$/.test(rowWhens[i] || '')) add('P0', `${slabel}: a Report-only row reads "${rowWhens[i]}" in its date column; it must say when it may be enforced (ready <date> · ready now · ready since <date>)`)
          if (!/Time: in report-only since .+, ready (on|since) /.test(bodyText)) add('P0', `${slabel}: the Done when of a Report-only step lacks the time gate with its date`)
          if (!/Evidence: .+; today (ready now: 0 failures in \d+ days|\d+ failing or interrupted, \d+ of \d+ active people seen in \d+ days)\./.test(bodyText)) add('P0', `${slabel}: the Done when of a Report-only step lacks the evidence gate with today's numbers`)
          if (rowWhens[i] === 'ready now' && !/ready now: 0 failures in \d+ days/.test(bodyText)) add('P0', `${slabel}: the row reads ready now but the step's Done when does not say so`)
        }
        // One population per step: the row's who-line count is the lead's count.
        const rowWho = await evaluate(`((document.querySelectorAll('main.page .plan-row')[${i}] || {}).querySelector ? (document.querySelectorAll('main.page .plan-row')[${i}].querySelector('.who') || {}).textContent || '' : '')`)
        const bodyLines = bodyText.split('\n').map((x) => x.trim()).filter(Boolean)
        const leadAt = bodyLines.indexOf('Who this touches')
        const rowCount = countOf(rowWho, { names: true })
        const leadCount = leadAt >= 0 ? countOf(bodyLines[leadAt + 1] || '') : null
        if (rowCount !== null && leadCount !== null && rowCount !== leadCount) add('P0', `${slabel}: the row says ${rowCount} and the step's lead says ${leadCount} (one population per step)`)
        const bodyTitle = await evaluate(`(document.querySelector('main.page .step-body .step-title') || {}).textContent || ''`)
        if (/Exclusions Group/i.test(bodyTitle)) exclusionBody = bodyText
        const safe = title.replace(/[^\w-]+/g, '-').slice(0, 60)
        writeFileSync(join(wdir, `step-${String(i + 1).padStart(2, '0')}-${safe}.txt`), bodyText)
        await shot(join(wdir, `step-${String(i + 1).padStart(2, '0')}-${safe}.png`))
        if (bodyTitle.trim() && bodyTitle.trim() !== title) add('P0', `${slabel}: the row says "${title}" and the opened step says "${bodyTitle.trim()}"`)
        const emailText = await evaluate(`[...document.querySelectorAll('main.page .step-body .copy-box')].map((e) => e.innerText).join('\\n')`)
        const outsideEmail = emailText ? bodyText.replace(emailText, '') : bodyText
        checkText(slabel, outsideEmail)
        checkText(`${slabel} (email)`, emailText, { emails: true })
        // Answers apply (E1) and the device decision (E2), on the demo. Week two
        // carries the sample technician's stored answers (fixtures/index.ts
        // decisions): New Zealand added to the allowed list, service providers
        // excluded on the guests and countries policies, the reception printer
        // in the service-accounts group; each question's effect line shows once
        // it is true, and never before. The device decision is made here, through
        // the step's own controls, so the rows before and after it are compared.
        if (fx.name.startsWith('demo')) {
          const week2 = fx.week2 === true
          if (/Allowed Countries Location/.test(title)) {
            if (week2 && !/New Zealand/.test(bodyText)) add('P0', `${slabel}: the travellers answer (Regularly: add: NZ) did not put New Zealand on the allowed list`)
            if (week2 && !/on the allowed list now/.test(bodyText)) add('P0', `${slabel}: the travellers question's effect line is missing although its answer applied`)
            if (!week2 && /on the allowed list now/.test(bodyText)) add('P0', `${slabel}: the travellers question's effect line shows before any answer`)
          }
          if (/^Require MFA for Guests$/.test(title) || /Countries Not Allowed/.test(title)) {
            if (week2 && !/Service provider users/.test(bodyText)) add('P0', `${slabel}: the partner answer (exclude service providers) is not on the policy's What to do`)
            if (week2 && !/the baseline's version/.test(bodyText)) add('P0', `${slabel}: the service-provider exclusion is not shown beside the baseline's version`)
            if (!week2 && /the baseline's version/.test(bodyText)) add('P0', `${slabel}: a deviation from the baseline shows before any answer`)
          }
          if (/^Block Legacy Authentication$/.test(title)) {
            if (week2 && !/in the service-accounts group now/.test(bodyText)) add('P0', `${slabel}: the mail-sending devices answer's effect line is missing (the printer is in the service-accounts group)`)
            if (!week2 && /in the service-accounts group now/.test(bodyText)) add('P0', `${slabel}: the mail-sending devices effect line shows before any answer`)
          }
          if (/Service Accounts Group/.test(title)) {
            if (week2 && !/MFP Reception/.test(bodyText)) add('P0', `${slabel}: the mail-sending printer named on the legacy block is not in the service-accounts group's list`)
            if (!week2 && /MFP Reception/.test(bodyText)) add('P0', `${slabel}: the printer is a service account before anyone named it`)
          }
          if (/Decide How Devices Are Managed/.test(title)) {
            if (!/phones are out of/i.test(bodyText)) add('P0', `${slabel}: the step does not say the decision is open (phones out until decided)`)
            if (/Phones leave the compliant-device policy/.test(bodyText)) add('P0', `${slabel}: the phones answer's effect line shows before any answer`)
            if (week2) {
              // Decide here: phones protected by their apps, computers hybrid-joined.
              const a = await clickText('label', /^Protect the apps only$/, 'main.page .step-body')
              const b = await clickText('label', /^Hybrid-joined is enough$/, 'main.page .step-body')
              const c = a && b ? await clickText('button', /^Save$/, 'main.page .step-body .decision') : false
              if (!a || !b || !c) add('P0', `${slabel}: the device decision cannot be made on the step (phones option ${a}, computers option ${b}, Save ${c})`)
              // Saved, the step is In place and sits in the footer; it opens there like any row, with its effect line.
              const moved = c ? await waitFor(`[...document.querySelectorAll('main.page .plan-footer .plan-row .step-title')].some((e) => /Decide How Devices Are Managed/.test(e.textContent || ''))`, 8000) : false
              if (c && !moved) add('P0', `${slabel}: the decided step did not move to the footer as In place`)
              if (moved) {
                await evaluate(`document.querySelectorAll('main.page .plan-footer details').forEach((d) => { d.open = true })`)
                // The step stays open as it moves (the page keeps the opened id); a click would close it, so click only when its body is not there.
                await evaluate(`(() => { if (document.querySelector('main.page .plan-footer .step-body')) return; const r = [...document.querySelectorAll('main.page .plan-footer .plan-row')].find((e) => /Decide How Devices Are Managed/.test((e.querySelector('.step-title') || {}).textContent || '')); if (r) { r.scrollIntoView({ block: 'center' }); r.click() } })()`)
                const applied = await waitFor(`/Phones leave the compliant-device policy/.test((document.querySelector('main.page .plan-footer .step-body') || {}).innerText || '')`, 8000)
                if (!applied) add('P0', `${slabel}: the phones answer's effect line does not show on the decided step`)
                // Device readiness is measured against the answer from here: the numbers before the decision are not the numbers after it.
                readinessOf(currentFixture).delete('device')
                decidedHere = true
              }
            }
          }
          if (/Require a Managed Device/.test(title)) {
            if (week2 && !/Device platforms → Include: Any device; Exclude: Android, iOS/.test(bodyText)) add('P0', `${slabel}: the device decision (phones protected by their apps) did not scope phones out of the compliant-device policy`)
            if (week2 && !/the baseline's version/.test(bodyText)) add('P0', `${slabel}: the platform deviation is not shown beside the baseline's version`)
            if (!week2 && /Device platforms/.test(bodyText)) add('P0', `${slabel}: a platform condition shows before the device decision`)
          }
          // The admin-sessions email says how long a session lasts (the merge
          // follow-up: {wantedLong} was unfilled, and the email vanished whole).
          if (/^Shorten Admin Sessions$/.test(title)) {
            if (!/expire after (\d+ hours|an hour|a day|a week|\d+ days) and never persist/.test(emailText)) add('P0', `${slabel}: the admin email does not say how long sessions last (expire after {wantedLong})`)
          }
          if (/MFA Registration Campaign/.test(title)) {
            if (week2 && !/· phone$/m.test(bodyText)) add('P0', `${slabel}: the campaign carries no device line per person after the device decision`)
            if (week2 && !/nothing to enrol/.test(emailText)) add('P0', `${slabel}: the campaign's email carries no device sentence after the device decision`)
            if (!week2 && /· phone$/m.test(bodyText)) add('P0', `${slabel}: the campaign carries device lines before the device decision`)
          }
        }
        // Cleanup completion (E3), on the demo. The emergency accounts signed in
        // inside the drill window with no drill recorded, so the emergency-access
        // step asks who and why; a step that found existing coverage is noted for
        // the consolidation row; the drill row's Done records today and the row
        // reads done <date>; the not-assessed row takes a note per policy.
        if (fx.name.startsWith('demo')) {
          // Day one: no drill is recorded, so the step asks. Week two: the sample's
          // technician recorded that sign-in as the drill, so it does not.
          const asksWhy = /signed in \d+ days ago, not a recorded drill: confirm who signed in and why/.test(bodyText)
          if (/Emergency Access Accounts/.test(title) && !fx.week2 && !asksWhy) add('P0', `${slabel}: an emergency account signed in inside the drill window with no drill recorded, and the step does not ask who signed in and why`)
          if (/Emergency Access Accounts/.test(title) && fx.week2 && asksWhy) add('P0', `${slabel}: the sign-in is a recorded drill in week two, and the step still asks who and why`)
          if (/already covers this with/.test(bodyText)) sawExistingCoverage = true
          if (/Emergency Access Drill/.test(title)) {
            const doneOnRow = () => waitFor(`[...document.querySelectorAll('main.page .plan-row')].some((r) => /Emergency Access Drill/.test((r.querySelector('.step-title') || {}).textContent || '') && /^done \\S.*\\d{4}$/.test((r.querySelector('.when') || {}).textContent || ''))`, 8000)
            if (fx.week2) {
              if (!(await doneOnRow())) add('P0', `${slabel}: the drill was recorded, and the row does not read done <date>`)
            } else {
              const pressed = await clickText('button', /^Done$/, 'main.page .step-body .decision')
              if (!pressed) add('P0', `${slabel}: no Done control on the Cleanup row`)
              else if (!(await doneOnRow())) add('P0', `${slabel}: Done did not put "done <date>" on the row`)
            }
          }
          if (/Did Not Assess/.test(title)) {
            const typed = await evaluate(`(() => { const i = document.querySelector('main.page .step-body .decision input[type=text]'); if (!i) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'not used here'); i.dispatchEvent(new Event('input', { bubbles: true })); return true })()`)
            const saved = typed ? await clickText('button', /^Save$/, 'main.page .step-body .decision') : false
            if (!typed || !saved) add('P0', `${slabel}: the not-assessed row takes no per-policy note (input ${typed}, Save ${saved})`)
            else if (!(await waitFor(`/: does not apply: not used here/.test((document.querySelector('main.page .step-body') || {}).innerText || '')`, 8000))) add('P0', `${slabel}: the note did not render as "<policy>: does not apply: <reason>"`)
          }
        }
        // A translator-rendered step keeps its content's "before" lines above the
        // portal lines (the merge follow-up): on the step, each line is present and
        // sits before the portal root line.
        for (const b of BEFORE_LINES) {
          if (b.title !== title || b.lines.length === 0) continue
          const root = bodyText.indexOf('Conditional Access → Policies → New policy')
          for (const line of b.lines) {
            const at = bodyText.indexOf(line.replace(/\{[a-zA-Z0-9_:]+\}/g, '').split(' ').slice(0, 6).join(' '))
            if (at < 0) add('P0', `${slabel}: the before line "${line.slice(0, 60)}…" is not on the step above the portal lines`)
            else if (root >= 0 && at > root) add('P0', `${slabel}: the before line "${line.slice(0, 60)}…" renders after the portal lines`)
          }
        }
        // A step body's counts are its own population (one population per step), checked against its row above.
        collect(bodyText, { population: false })
        const sc = contractById['plan.step']
        const sd = await evaluate(extractIn(`document.querySelector('main.page .step-body')`, sc?.reach?.exclude ?? ''))
        if (sd) {
          diffContract(slabel, sc, sd)
          // C1: frameworks return as a feature, not a chip.
          for (const c of sd.chips) if (/^CIS\b/.test(c)) add('P0', `${slabel}: a CIS chip "${c}" on the step (frameworks are not a chip)`)
          for (const h of sd.emptySections) add('P0', `${slabel}: the "${h}" section is empty`)
          if (sd.emptyLists > 0) add('P0', `${slabel}: ${sd.emptyLists} empty list(s) rendered`)
          for (const l of sd.danglingLeads) add('P1', `${slabel}: the lead "${l.slice(0, 70)}" has nothing listed under it`)
          const tabs = await evaluate(`document.querySelectorAll('main.page .step-body [role=tab]').length`)
          for (let t = 0; t < tabs; t++) {
            await evaluate(`(() => { const x = document.querySelectorAll('main.page .step-body [role=tab]')[${t}]; if (x) x.click() })()`)
            await sleep(120)
            const td = await evaluate(extractIn(`document.querySelector('main.page .step-body')`, sc?.reach?.exclude ?? ''))
            if (td) for (const f of FORBID_EVERY) if (td.proseText.includes(f)) add('P0', `${slabel}: forbidden-everywhere string "${f}" in a What-to-do tab`)
          }
          if (await clickText('summary', /^More$/, 'main.page .step-body')) {
            await sleep(250)
            const mc = contractById['plan.step.more']
            const md = await evaluate(extractIn(`document.querySelector('main.page .step-body details.more')`, ''))
            if (md) {
              diffContract(`${slabel} / More`, mc, md)
              const moreText = await evaluate(`(document.querySelector('main.page .step-body details.more') || {}).innerText || ''`)
              writeFileSync(join(wdir, `more-${String(i + 1).padStart(2, '0')}-${safe}.txt`), moreText)
              checkText(`${slabel} / More`, moreText)
              if (md.emptyLists > 0) add('P0', `${slabel} / More: ${md.emptyLists} empty list(s) rendered`)
              for (const h of md.emptySections) add('P0', `${slabel} / More: the "${h}" section is empty`)
            }
          }
        }
        // C2: every opened step and Cleanup row carries a Learn link beside its Why.
        const bodyLinks = await evaluate(`[...document.querySelectorAll('main.page .step-body a[href^="http"]')].map((a) => a.href)`)
        if (/^Why$/m.test(bodyText) && bodyLinks.length === 0) add('P0', `${slabel}: no Learn link on the opened step`)
        for (const href of bodyLinks) learnLinks.add(href)
        const overflowStep = await evaluate(`Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)`)
        if (overflowStep > 0) add('P1', `${slabel}: the opened step overflows the viewport by ${overflowStep}px`)
        if (decidedHere) {
          // The decided step is In place and sits in the footer now; the rows below it moved up one. Re-read them and take this index again.
          await sleep(300)
          rowTitles = await evaluate(`[...document.querySelectorAll('main.page .plan-row .step-title')].map((e) => (e.textContent || '').trim())`)
          rowStatuses = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((e) => ((e.querySelector('.status') || {}).textContent || '').trim())`)
          rowWhens = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((e) => ((e.querySelector('.when') || {}).textContent || '').trim())`)
          inFooter = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((e) => e.closest('.plan-footer') !== null)`)
          n = rowTitles.length
          i -= 1
        }
      }
      // The footer groups, expanded.
      await send('Page.navigate', { url: `${fx.base}#/plan` })
      await sleep(300)
      await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
      await ensureWeek2()
      await evaluate(`document.querySelectorAll('main.page .plan-footer details').forEach((d) => { d.open = true })`)
      await sleep(200)
      // The rows as they stand after every step was opened (and, on week two, after the device decision was made on its step).
      rowTitlesAfter = await evaluate(`[...document.querySelectorAll('main.page .plan-row .step-title')].map((e) => (e.textContent || '').trim())`)
      rowReasonsAfter = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((e) => ((e.querySelector('.plan-row-reason') || {}).textContent || '').trim())`)
      const fc = contractById['plan.footer']
      const fd = await evaluate(extractIn(`document.querySelector('main.page .plan-footer')`, ''))
      if (fd) {
        diffContract(`${fx.name} @${width} /plan footer`, fc, fd)
        const ft = await evaluate(`(document.querySelector('main.page .plan-footer') || {}).innerText || ''`)
        writeFileSync(join(wdir, 'plan-footer.txt'), ft)
        checkText(`${fx.name} @${width} /plan footer`, ft)
        for (const t of fd.titles) if (ABSENT_TITLES.has(t) || ABSENT_GOAL_NAMES.has(t)) add('P0', `${fx.name} @${width} /plan footer: "${t}" is a goal the baseline does not hold`)
        for (const row of fd.rows) for (const nm of ABSENT_GOAL_NAMES) if (row.text.includes(nm)) add('P0', `${fx.name} @${width} /plan footer: "${nm}" is a goal the baseline does not hold`)
      }
    }
  }
  for (const t of rowTitles) if (ABSENT_TITLES.has(t) || ABSENT_GOAL_NAMES.has(t)) add('P0', `${fx.name}: plan row "${t}" is a goal the baseline does not hold`)
  // The exclusions-group step is on every plan (In place in the footer, or Ready in
  // Preparation). On the demo it is Ready both days; week two's re-scan recognised the
  // group, so the step must check it rather than still offer the create instructions.
  if (fx.name.startsWith('demo') && !rowTitles.some((t) => /Exclusions Group/i.test(t))) add('P0', `${fx.name}: the exclusions-group step is missing; it is on every plan`)
  // The consolidation row exists whenever a step's existingCoverage line rendered, and only then (E3).
  if (fx.name.startsWith('demo') && sawExistingCoverage !== rowTitlesAfter.some((t) => /Consolidate Overlapping Policies/.test(t))) add('P0', `${fx.name}: ${sawExistingCoverage ? 'a step found existing coverage but Cleanup has no Consolidate Overlapping Policies row' : 'Cleanup has a Consolidate Overlapping Policies row but no step found existing coverage'}`)
  if (fx.week2 && exclusionBody !== null && /No exclusions group recognised|New group/.test(exclusionBody)) add('P0', `${fx.name}: the exclusions-group step still offers to create the group in week two, although the re-scan recognised it`)
  // A policy in report-only (Report-only in the status column) says when it may
  // be enforced in the date column, from two gates. The demo's week one has one
  // such row, dated from the observation window; week two reads ready now for the
  // policy whose records are clean and complete, and Enforced for the one the
  // tenant turned on. Nothing asks the person to mark anything.
  if (fx.name.startsWith('demo')) {
    const reportOnly = rowStatuses.map((s, i) => (s === 'Report-only' ? rowWhens[i] : null)).filter((w) => w !== null)
    if (reportOnly.length === 0) add('P0', `${fx.name}: no plan row reads Report-only; the demo has a policy in report-only`)
    if (!fx.week2 && !reportOnly.some((w) => /^ready \S.*\d{4}$/.test(w))) add('P0', `${fx.name}: no Report-only row reads ready <date> on week one`)
    if (fx.week2 && !reportOnly.includes('ready now')) add('P0', `${fx.name}: no Report-only row reads ready now in week two (the token protection policy's records are clean and complete)`)
    if (fx.week2 && !rowStatuses.includes('Enforced')) add('P0', `${fx.name}: no row reads Enforced in week two (the tenant turned the admins policy on)`)
  }
  // The device decision (E2): a Preparation row on the demo (phones and unjoined
  // computers sign in; the tenant holds Intune). While it is open, the
  // compliant-device and Intune-enrolment steps wait on it and nothing else does;
  // once made on its step (week two, above), nothing waits on it. Answers apply
  // (E1): each answered question's step is on the plan on week two and not before.
  if (fx.name.startsWith('demo')) {
    if (!rowTitles.some((t) => /Decide How Devices Are Managed/.test(t))) add('P0', `${fx.name}: no Preparation row decides how devices are managed, although phones and unjoined computers sign in and the tenant holds Intune`)
    const reasonsOf = (titles, reasons, re) => titles.map((t, i) => (re.test(t) ? reasons[i] || '' : null)).filter((r) => r !== null)
    const DEVICE_STEPS = [/Require a Managed Device/, /Intune Enrollment/]
    for (const [i, t] of rowTitlesOpen.entries()) if (/Decide How Devices Are Managed/.test(rowReasonsOpen[i] || '') && !DEVICE_STEPS.some((re) => re.test(t)) && !/App Protection/.test(t)) add('P0', `${fx.name}: "${t}" waits on the device decision; only the device steps do`)
    if (fx.week2) {
      // The foundations are done on week two, so the wait on the decision is the binding reason a row shows.
      for (const re of DEVICE_STEPS) {
        if (!reasonsOf(rowTitlesOpen, rowReasonsOpen, re).some((r) => /Decide How Devices Are Managed/.test(r))) add('P0', `${fx.name}: ${re.source} does not wait on the device decision while it is open`)
        if (reasonsOf(rowTitlesAfter, rowReasonsAfter, re).some((r) => /Decide How Devices Are Managed/.test(r))) add('P0', `${fx.name}: ${re.source} still waits on the device decision after it was made`)
      }
    }
    for (const id of CARVE_OUT_IDS) {
      const t = contentSteps.find((s) => s.id === id)?.title
      if (!t) add('P0', `content.json has no step ${id}: an answered question's step has no words`)
      else if (fx.week2 && !rowTitles.includes(t)) add('P0', `${fx.name}: the answered question's step "${t}" is not on the plan`)
      else if (!fx.week2 && rowTitles.includes(t)) add('P0', `${fx.name}: "${t}" is on the plan before its question was answered`)
    }
  }
  return summary
}

// ---- the offline scan of the private plan file ----
function scanPlanFile() {
  if (!existsSync(PLAN_FILE)) return { present: false, steps: 0 }
  const plan = JSON.parse(readFileSync(PLAN_FILE, 'utf8'))
  const steps = Array.isArray(plan.steps) ? plan.steps : []
  const forbid = new Set([...FORBID_EVERY, ...(contractById['plan.step']?.forbid ?? []), ...(contractById.plan?.forbid ?? []), ...FORBIDDEN_PHRASES])
  // The fields a v3 surface renders from a saved step (rows, the step body, the
  // footer). Everything else in the blob is the v2 engine's prose — rings, exit
  // criteria, what-changes, failure modes, the help desk, comms — which no
  // surface renders; it is counted once, under P2, for the export unit.
  // The plan row and the footer read the title, the gap and the blocked reason;
  // the step body reads the proposed name and the existing coverage.
  const RENDERED = ['title', 'plainTitle', 'gap', 'gapShort', 'blockedReason', 'deliveredBy']
  const walk = (v, path, stepId, level) => {
    if (typeof v === 'string') {
      const hole = holeIn(v)
      if (hole) add(level, `GetIAMAI plan file, ${stepId} ${path}: unfilled variable ${hole[0]}`)
      for (const f of forbid) if (v.includes(f)) add(level, `GetIAMAI plan file, ${stepId} ${path}: forbidden string "${f}" ("${redact(v).slice(0, 70)}…")`)
      return
    }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, stepId, level))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, stepId, level)
  }
  const v2Hits = new Set()
  const v2walk = (v, stepId) => {
    if (typeof v === 'string') {
      for (const f of forbid) if (v.includes(f)) v2Hits.add(f)
      return
    }
    if (Array.isArray(v)) v.forEach((x) => v2walk(x, stepId))
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['json', 'powershell', 'rollbackBody'].includes(k)) v2walk(x, stepId)
  }
  for (const s of steps) {
    for (const k of RENDERED) if (s[k] !== undefined) walk(s[k], k, s.id, 'P0')
    if (s.naming?.proposed) walk(s.naming.proposed, 'naming.proposed', s.id, 'P0')
    for (const k of ['whatChanges', 'impact', 'failureModes', 'helpDesk', 'comms', 'ringComms', 'forManager', 'verify', 'exitCriteria', 'rings', 'why', 'rollback', 'action', 'stateReason', 'unblockNotes', 'evidence', 'readiness', 'scenarioLines', 'dateNotes', 'cantSee']) if (s[k] !== undefined) v2walk(s[k], s.id)
    const title = s.plainTitle || s.title || ''
    if (title.split(/\s+/).length > RULES.stepTitleMaxWords) add('P1', `GetIAMAI plan file, ${s.id}: title "${title}" is over ${RULES.stepTitleMaxWords} words`)
    if (s.blockedReason && s.blockedReason.split(/\s+/).length > RULES.blockedReasonMaxWords) add('P1', `GetIAMAI plan file, ${s.id}: blocked reason over ${RULES.blockedReasonMaxWords} words`)
    // A step for a goal the baseline does not hold: the file predates item 9
    // (the app no longer generates it); the next save drops it. About the file,
    // not the product.
    if (ABSENT_STEP_IDS.has(s.goalId)) add('P2', `GetIAMAI plan file, ${s.id}: a saved step for ${s.goalId}, a goal the baseline does not hold; the file predates item 9 and the next save drops it`)
  }
  if (v2Hits.size > 0) add('P2', `GetIAMAI plan file: the saved steps' v2 fields (rings, exit criteria, what-changes, failure modes, help desk, comms) carry old vocabulary (${[...v2Hits].slice(0, 6).join(', ')}); no v3 surface renders them; the export unit decides what the file keeps`)
  return { present: true, steps: steps.length, savedAt: redact(plan.createdAt ?? '') }
}

// ---- the first load, throttled (queue item 8) ----
//
// Measured against the production bundle, served statically from dist/ (the
// dev server hands out hundreds of unbundled modules and says nothing about
// what a visitor gets), on a "Fast 3G" profile: 1.6 Mbit/s down, 150 ms round
// trip; from navigation to the first plan row on screen; over 2 s is a P1.
const started = new Date().toISOString()
let firstLoadMs = null
{
  const STATIC_PORT = PORT + 1
  let built = existsSync('dist/rollout/index.html')
  if (!built) {
    try {
      execSync('npx vite build', { stdio: 'ignore', env: { ...process.env, TOOL_PATH: 'rollout' } })
      built = existsSync('dist/rollout/index.html')
    } catch {
      built = false
    }
  }
  if (!built) add('P2', 'demo: the production bundle could not be built here, so the throttled first load was not measured')
  else {
    const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' }
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      let file = join('dist', decodeURIComponent(url.pathname))
      try {
        if (statSync(file).isDirectory()) file = join(file, 'index.html')
      } catch {
        res.statusCode = 404
        res.end()
        return
      }
      res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream')
      // GitHub Pages compresses text; so does this server, or the figure is the wire size of an uncompressed bundle.
      const body = readFileSync(file)
      if (/gzip/.test(String(req.headers['accept-encoding'] ?? '')) && /\.(html|js|css|json|svg|txt|webmanifest)$/.test(file)) {
        res.setHeader('Content-Encoding', 'gzip')
        res.end(gzipSync(body))
        return
      }
      res.end(body)
    })
    await new Promise((r) => server.listen(STATIC_PORT, r))
    await send('Network.enable')
    await send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
    const t0 = Date.now()
    await send('Page.navigate', { url: `http://localhost:${STATIC_PORT}/rollout/?demo=1#/plan` })
    const ok = await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`, 30000)
    firstLoadMs = ok ? Date.now() - t0 : null
    await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
    await send('Network.disable')
    server.close()
    if (firstLoadMs === null) add('P1', 'demo: the first load did not show a plan row within 30 s on a throttled connection (production bundle)')
    else if (firstLoadMs > 2000) add('P1', `demo: the first load took ${(firstLoadMs / 1000).toFixed(1)} s to the first plan row on a throttled connection (production bundle; over 2 s)`)
    log(`first load, throttled (production bundle): ${firstLoadMs === null ? 'no plan within 30 s' : `${firstLoadMs} ms`}`)
  }
}
const fixtures = [
  { name: 'demo', base: `http://localhost:${PORT}/rollout/?demo=1` },
  // The three-minute path's last stop: Scan to update the plan → week two (queue item 4).
  { name: 'demo-week2', base: `http://localhost:${PORT}/rollout/?demo=1`, week2: true, routes: ['plan', 'today'] },
]
const summaries = {}
for (const fx of fixtures) {
  log(`walking ${fx.name}`)
  currentFixture = fx.name
  summaries[fx.name] = await walkFixture(fx)
}
const planFile = scanPlanFile()

// The content file's own invariants (step-audit.md; scripts/walkContent.mjs runs
// them alone over any content file), and every Learn link the content carries,
// rendered on the demo or not.
const contentFile = JSON.parse(readFileSync('docs/design/content.json', 'utf8'))
const pinnedFile = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.pinned.json', 'utf8'))
for (const f of contentFindings(contentFile, pinnedFile, contracts)) add(f.level, f.text)
for (const href of contentLearnUrls(contentFile)) learnLinks.add(href)

// The before lines exist in the content for every step that carries one (the
// step check above needs the row on the plan; this fails on the content alone).
for (const b of BEFORE_LINES) if (b.lines.length === 0) add('P0', `content ${b.id}: no whatToDo.before line; the setting to change before the policy exists is not above its portal lines`)

// Cross-surface invariants.
for (const [name, readiness] of readinessBy) for (const [kind, values] of readiness) if (values.size > 1) add('P0', `${name}: ${kind} readiness reads ${[...values].map((v) => `${v}%`).join(' and ')} across rows, steps and Today (one readiness per kind)`)
for (const [name, populations] of populationsBy) if (populations.size > 1) add('P0', `${name}: the active-people count reads ${[...populations].join(' and ')} across surfaces (one population)`)
for (const e of consoleErrors.filter((x) => !/favicon|microsoftonline|net::|ERR_/.test(x))) add('P0', `demo: console error: ${e.slice(0, 160)}`)

// Learn links: every one resolves.
log(`checking ${learnLinks.size} link(s)`)
for (const href of learnLinks) {
  const r = await probe(href)
  // A 404 is a wrong fact on screen (a Learn link that opens nothing); another
  // refusal is the site's, not the link's.
  if (r.error) add('P2', `Learn link ${href} could not be checked from here (${r.error})`)
  else if (r.status === 404) add('P0', `Learn link ${href} answers 404`)
  else if (r.status >= 400) add('P1', `Learn link ${href} answers ${r.status}`)
}

// ---- the report ----
const list = (arr) => (arr.length === 0 ? '_none_\n' : arr.map((f, i) => `${i + 1}. ${f}`).join('\n') + '\n')
const table = Object.entries(summaries)
  .map(([name, rows]) => rows.map((r) => `| ${name} | ${r.width} | /${r.route} | ${r.words} | ${r.rows} |`).join('\n'))
  .join('\n')
const verdict = findings.P0.length === 0 ? 'show-ready on this walk (no P0)' : `not show-ready: ${findings.P0.length} P0`
const report = `# Walk of build ${SHA} — demo tenant, ${started.slice(0, 10)}

\`npm run walk\` (prompt 53 Unit 0): every surface of the demo at 1280, every plan row
opened one by one, the contract diff, the walk-51 invariants, the GetIAMAI plan file scanned
offline. Captures and screenshots under \`walk/${SHA}/\` (not committed).

Verdict: ${verdict}. ${findings.P1.length} P1, ${findings.P2.length} P2.

## P0 — wrong or broken facts on screen

${list(findings.P0)}
## P1 — visible, not fatal

${list(findings.P1)}
## P2 — the rest

${list(findings.P2)}
## GetIAMAI

${planFile.present
    ? `Scanned offline from the saved plan file (${planFile.steps} steps, saved ${planFile.savedAt.slice(0, 10)}): every string in every step against the forbidden lists and the hole rule; findings above are labelled "GetIAMAI plan file". The file carries the plan's steps, decisions and checkpoints and no tenant snapshot, so the app cannot regenerate GetIAMAI from it without a sign-in; the in-app walk of GetIAMAI is not possible tonight and is a question for the morning.`
    : 'No plan file at fixtures/private/getiamai.plan.json; nothing scanned.'}

## Surfaces walked

| fixture | width | route | words | rows |
|---|---|---|---|---|
${table}

First load of the demo on a throttled connection (Fast 3G, the production bundle served statically): ${firstLoadMs === null ? 'not measured' : `${(firstLoadMs / 1000).toFixed(1)} s`} to the first plan row. Readiness values seen: ${[...readinessBy].map(([name, r]) => `${name}: ${[...r].map(([k, v]) => `${k} ${[...v].map((x) => `${x}%`).join('/')}`).join(' · ')}`).join('; ') || 'none'}. Active-people counts seen: ${[...populationsBy].map(([name, p]) => `${name} ${[...p].join('/')}`).join('; ') || 'none'}. Learn links checked: ${learnLinks.size}.
`
mkdirSync('docs/reports', { recursive: true })
writeFileSync(REPORT, report)
writeFileSync(join(OUT, 'findings.json'), JSON.stringify({ sha: SHA, started, findings, readiness: Object.fromEntries([...readinessBy].map(([n, r]) => [n, Object.fromEntries([...r].map(([k, v]) => [k, [...v]]))])), populations: Object.fromEntries([...populationsBy].map(([n, p]) => [n, [...p]])) }, null, 2))
log(`wrote ${REPORT}: ${findings.P0.length} P0, ${findings.P1.length} P1, ${findings.P2.length} P2`)

chrome.kill()
vite.kill()
process.exit(findings.P0.length > 0 ? 1 : 0)
