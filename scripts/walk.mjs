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
import { pages, steps as contentSteps, stepById } from '../src/content/content.ts'
import { fillText } from '../src/content/render.ts'
import * as todayModel from '../src/derive/today.ts'
import goalsData from '../data/goals.json' with { type: 'json' }
import { contentFindings, contentLearnUrls, probe } from './walkContent.mjs'
import { RETIRED_OPENER } from './build-home.ts'

// The ladder's five rung titles, top to bottom (pages.ladder; derive/ladder.ts
// RUNGS): Today's rows, the Plan strip's tiles and Connect's tiles read them.
// Read through the namespace so a build without the model still walks.
const RUNG_TITLES = (todayModel.SHOW_KEYS ?? []).filter((k) => k.startsWith('rung-')).map((k) => pages.ladder.rungs[`r${k.slice(5)}`].title)

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
// The pinned package's policy count (baselines/*.pinned.json): the Baseline tile's one count, signed in and out.
const PINNED_COUNT = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.pinned.json', 'utf8')).policies.length

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
  // A P0 fails the CI job: say it in the job log as it is found, so the log alone names the cause.
  if (level === 'P0') console.log(`walk: P0 ${text}`)
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
// The dev server fetches hundreds of modules; the resource timing buffer must hold them all for the demo-chunk invariant.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `performance.setResourceTimingBufferSize(20000)` })
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
  // The demo's week two: Scan again on Connect's Scan tile flips the demo to
  // its week-two snapshot (App.tsx demoWeek2; the header has no scan control),
  // then the plan is walked again. Scan again toggles week two on and off, and
  // a hash navigation keeps the page alive, so entering is idempotent: click
  // only while the banner does not already say week 2, then come back to the route.
  const ensureWeek2 = async (route) => {
    if (!fx.week2) return
    if (await evaluate(`/week 2/i.test(document.body.innerText)`)) return
    await evaluate(`location.hash = '#/connect'`)
    const offered = await waitFor(`[...document.querySelectorAll('main.page section.step-tile button')].some((b) => /^Scan again$/.test((b.textContent || '').trim()))`, 15000)
    if (!offered) {
      add('P0', `${fx.name}: Connect's Scan tile offers no Scan again`)
      return
    }
    await clickText('button', /^Scan again$/, 'main.page')
    const week2 = await waitFor(`/week 2/i.test(document.body.innerText)`, 10000)
    if (!week2) add('P0', `${fx.name}: Scan again does not advance the demo to week two`)
    await evaluate(`location.hash = ${JSON.stringify('#/' + route)}`)
    await sleep(800)
  }
  mkdirSync(dir, { recursive: true })
  const summary = []
  const routeContract = { connect: 'connect.signedIn', today: 'today', plan: 'plan', export: 'export', how: 'how', inventory: 'inventory', error: 'error' }
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
  let planHeaderCounts = null
  let stripCounts = null
  // Today's five rung counts by title, for the Plan strip and Connect's tiles to agree with.
  let ladderCounts = null
  for (const width of WIDTHS) {
    await setWidth(width)
    const wdir = join(dir, String(width))
    mkdirSync(wdir, { recursive: true })
    for (const route of fx.routes ?? ['plan', 'today', 'export', 'how', 'connect', 'inventory']) {
      const label = `${fx.name} @${width} /${route}`
      await send('Page.navigate', { url: `${fx.base}#/${route}` })
      await sleep(600)
      await ensureWeek2(route)
      if (route === 'plan') await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`)
      await settle()
      const text = await mainText()
      writeFileSync(join(wdir, `${route}.txt`), text)
      await shot(join(wdir, `${route}.png`))
      const c = contractById[route === 'connect' && ['signedOut', 'consent', 'personal', 'cancelled'].includes(fx.mock) ? 'connect.signedOut' : routeContract[route]]
      const d = await evaluate(extractIn(`document.querySelector('main.page')`, c?.reach?.exclude ?? ''))
      if (!d) {
        add('P0', `${label}: nothing rendered in main`)
        continue
      }
      diffContract(label, c, d)
      checkText(label, text)
      collect(text)
      // The header carries no scan control and no scan age on any page, and no
      // page but Connect says when the tenant was scanned: the tenant and the
      // scan's age are Connect's tiles', from the one stored timestamp
      // (docs/design/connect-mockup.html).
      const header = await evaluate(`((document.querySelector('header.app') || {}).innerText || '').replace(/\\s+/g, ' ')`)
      if (/scanned|Scan to update the plan|Re-scan/.test(header)) add('P0', `${label}: the header carries a scan control or the scan's age: "${header}"`)
      if (route !== 'connect' && /\bscanned\b/i.test(text)) add('P0', `${label}: the page says scanned; only Connect shows when the tenant was scanned`)
      if (route === 'plan') {
        // One header line (docs/design/mockups/plan-top-v2.html): the steps line; the second line is gone, and the tenant and the scan's age are Connect's.
        const lines = await evaluate(`[...document.querySelectorAll('main.page p.line')].map((p) => (p.textContent || '').replace(/\\s+/g, ' ').trim())`)
        const stray = lines.find((l) => /Today shows where each person stands|from the scan|\bscanned\b/.test(l))
        if (stray) add('P0', `${label}: the Plan's header carries a line that left: "${stray}" (the second line is gone; the tenant and the scan age are Connect's)`)
      }
      // The header's theme and Account controls are text, not button faces
      // (docs/design/connect-mockup.html's header): no border, no background, no padding.
      const faces = await evaluate(`[...document.querySelectorAll('header.app .right button')].map((b) => { const cs = getComputedStyle(b); return { t: (b.textContent || '').trim(), border: cs.borderTopWidth, bg: cs.backgroundColor, pad: cs.paddingLeft } })`)
      if (!faces.some((f) => /theme$/.test(f.t))) add('P0', `${label}: no theme control in the header`)
      for (const f of faces) if (f.border !== '0px' || !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(f.bg) || f.pad !== '0px') add('P0', `${label}: the header's ${f.t} control has a button face (border ${f.border}, background ${f.bg}, padding ${f.pad}); text`)
      // The demo chunk (src/ui/demo.ts, the fixture and the engine behind the
      // sample tenant) loads in demo mode and nowhere else: the page's resources
      // name it on the demo fixtures and never on the mock's.
      const demoLoaded = await evaluate(`performance.getEntriesByType('resource').some((e) => /\\/src\\/ui\\/demo\\.ts|\\/src\\/ui\\/demoFacts\\.ts|\\/assets\\/demo-[^/]*\\.js/.test(e.name))`)
      const inDemo = /[?&]demo=1/.test(fx.base)
      if (demoLoaded !== inDemo) add('P0', `${label}: the demo chunk ${demoLoaded ? 'loaded outside demo mode' : 'did not load in demo mode'}`)
      // The Start date on an unstarted plan: today in the display zone (a weekend
      // clamps to the Monday after it), never a remembered proposal, in the same
      // control as Plan settings' inputs with its label spaced from it.
      if (route === 'plan' && !fx.week2) {
        const field = await evaluate(`(() => { const l = document.querySelector('main.page .plan-start label.rows'); const i = l && l.querySelector('input[type=date]'); if (!i) return null; const cs = getComputedStyle(l); const ci = getComputedStyle(i); return { value: i.value, display: cs.display, gap: cs.columnGap, borderBottom: ci.borderBottomWidth, padTop: ci.paddingTop } })()`)
        const startedLine = /\bstarted [A-Z][a-z]{2} \d/.test(text)
        if (!field && !startedLine) add('P0', `${label}: no Start date field on an unstarted plan`)
        if (field) {
          const zone = await evaluate(`(async () => { try { const req = indexedDB.open('iamai'); const db = await new Promise((r, j) => { req.onsuccess = () => r(req.result); req.onerror = () => j(req.error) }); if (!db.objectStoreNames.contains('mapping')) { db.close(); return null } const rows = await new Promise((r) => { const q = db.transaction('mapping').objectStore('mapping').getAll(); q.onsuccess = () => r(q.result) }); db.close(); const m = rows.filter((x) => x && ((x.tenantId === 'demo-sample-tenant') === ${inDemo})).find((x) => x.displayTimeZone); return m ? m.displayTimeZone : null } catch { return null } })()`)
          const today = await evaluate(`new Intl.DateTimeFormat('en-CA', { timeZone: ${JSON.stringify(zone)} || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())`)
          const shift = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
          const dow = new Date(`${today}T12:00:00Z`).getUTCDay()
          const expected = dow === 6 ? shift(today, 2) : dow === 0 ? shift(today, 1) : today
          if (field.value !== expected) add('P0', `${label}: the Start date proposes ${field.value}; today in ${zone ?? 'the browser zone'} is ${today}${expected !== today ? ` (a weekend: the working day after is ${expected})` : ''}`)
          const saved = await evaluate(`(async () => { try { const req = indexedDB.open('iamai'); const db = await new Promise((r, j) => { req.onsuccess = () => r(req.result); req.onerror = () => j(req.error) }); if (!db.objectStoreNames.contains('plan')) { db.close(); return null } const rows = await new Promise((r) => { const q = db.transaction('plan').objectStore('plan').getAll(); q.onsuccess = () => r(q.result) }); db.close(); return rows.filter((x) => x && ((x.tenantId === 'demo-sample-tenant') === ${inDemo})).map((x) => x.startDate).filter(Boolean) } catch { return null } })()`)
          if (saved && saved.length > 0) add('P0', `${label}: the proposed start was written to the plan record (${saved.join(', ')}); it is proposed again on every visit until Start`)
          if (field.display !== 'flex' || parseFloat(field.gap) < 8) add('P0', `${label}: the Start date label is not a spaced row (display ${field.display}, gap ${field.gap})`)
          if (field.padTop !== '0px' || field.borderBottom !== '1px') add('P0', `${label}: the Start date input is not styled like Plan settings' inputs (padding-top ${field.padTop}, border-bottom ${field.borderBottom})`)
        }
      }
      // The error page (pages.app.error), reached through the mock's ?crash=1: the
      // title, the lead with its full stop, no Setup and no Start step, Reload
      // (primary), the redacted diagnostics (secondary), Start over (tertiary),
      // where to send the diagnostics; Reload reloads the page.
      if (route === 'error') {
        const e = await evaluate(`(() => { const s = document.querySelector('main.page section.error-page'); if (!s) return null; const h = s.querySelector('h1, h2'); const ps = [...s.querySelectorAll('p')].map((p) => (p.textContent || '').replace(/\\s+/g, ' ').trim()); const btns = [...s.querySelectorAll('button, a.btn')].map((b) => ({ t: (b.textContent || '').trim(), w: /btn-primary/.test(b.className) ? 'primary' : /btn-secondary/.test(b.className) ? 'secondary' : /btn-tertiary/.test(b.className) ? 'tertiary' : 'none' })); return { title: h ? (h.textContent || '').trim() : '', ps, btns, text: (s.innerText || '').replace(/\\s+/g, ' ') } })()`)
        if (!e) add('P0', `${label}: no error page for a surface that throws while drawing`)
        else {
          if (e.title !== 'This page hit an error') add('P0', `${label}: the error page's title reads "${e.title}"`)
          if (e.ps[0] !== 'Nothing in the tenant changed.') add('P0', `${label}: the error page's lead reads "${e.ps[0]}"; Nothing in the tenant changed. (with its full stop)`)
          if (/\bSetup\b|Start step/.test(e.text)) add('P0', `${label}: the error page still says Setup or Start step`)
          const order = e.btns.map((b) => `${b.t} (${b.w})`).join(' · ')
          if (order !== 'Reload (primary) · Download diagnostics (redacted) (secondary) · Start over (tertiary)') add('P0', `${label}: the error page's buttons read ${order}; Reload (primary) · Download diagnostics (redacted) (secondary) · Start over (tertiary)`)
          if (!e.ps.includes('Send the diagnostics to feedback@getiamai.com')) add('P0', `${label}: the error page lacks "Send the diagnostics to feedback@getiamai.com"`)
          await clickText('button', /^Reload$/, 'main.page')
          const reloaded = await waitFor(`(performance.getEntriesByType('navigation')[0] || {}).type === 'reload'`, 8000)
          if (!reloaded) add('P0', `${label}: Reload did not reload the page`)
        }
      }
      // A chunk that fails to load (Vite's vite:preloadError, the old page asking
      // for a file the new build no longer ships) reloads the page once per
      // session; a second failure falls through to the error page.
      if (fx.mock === 'ready' && route === 'connect') {
        await evaluate(`sessionStorage.removeItem('iamai.preloadReloaded'); window.__stillHere = 1; window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }))`)
        const reloaded = await waitFor(`(performance.getEntriesByType('navigation')[0] || {}).type === 'reload' && window.__stillHere === undefined`, 8000)
        if (!reloaded) add('P0', `${label}: a chunk load failure did not reload the page`)
        await waitFor(`document.querySelectorAll('main.page section.step-tile').length === 4`, 15000)
        const prevented = await evaluate(`(() => { const e = new Event('vite:preloadError', { cancelable: true }); window.__stillHere = 2; window.dispatchEvent(e); return e.defaultPrevented })()`)
        await sleep(1500)
        const stayed = await evaluate(`window.__stillHere === 2`)
        if (prevented || !stayed) add('P0', `${label}: a second chunk load failure in the session reloaded again (handled ${prevented}, page kept ${stayed}); once, then the error page`)
      }
      // The signed-in account is a person like any other (derive/operator.ts is
      // display only): with its directory sign-in 200 days stale it reads not
      // active on Today, like anyone else's would, and never "signed in now".
      if (fx.mock === 'operator' && route === 'today') {
        const row = await evaluate(`(() => { const tr = [...document.querySelectorAll('main.page table.datatable tbody tr')].find((r) => /Alex Morgan/.test(r.innerText)); if (!tr) return null; const tds = [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\\s+/g, ' ').trim()); return { state: tds[1] || '', evidence: tds[3] || '', text: tr.innerText.replace(/\\s+/g, ' ') } })()`)
        if (!row) add('P0', `${label}: Today has no row for the signed-in account`)
        else {
          if (!/not active/i.test(row.state)) add('P0', `${label}: Today reads the signed-in account's stale directory sign-in as "${row.state}"; not active, like anyone else's`)
          if (/signed in now/.test(row.evidence)) add('P0', `${label}: the signed-in account's evidence reads "${row.evidence}"; the population never depends on who is signed in`)
        }
      }
      const overflow = await evaluate(`Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)`)
      if (overflow > 0) {
        const widest = await evaluate(`(() => { const w = document.documentElement.clientWidth; const els = [...document.querySelectorAll('main.page *')].filter((e) => e.getBoundingClientRect().right > w + 1); const e = els[0]; return e ? (e.className || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().right - w) + 'px past the edge' : '' })()`)
        add(width < 600 ? 'P1' : 'P1', `${label}: the page overflows the viewport by ${overflow}px (${widest})`)
      }
      summary.push({ width, route, words: text.split(/\s+/).filter(Boolean).length, rows: d.rows.length })
      // Today's "n admins" is the count of rows tagged Admin (E5); the demo's
      // people fit one page, so the tags on the page are every tag. The ledger
      // line counts every account once, its kinds summing to the accounts; the
      // ladder is five boxed rungs by title (pages.ladder), the rule before the
      // three to prioritise, each rung's count the number of rows it filters to.
      if (route === 'today') {
        const ledger = text.match(/(\d+) accounts?: (.*?)\s*(?:sign-ins [A-Z][a-z]{2} \d+ → |no sign-in records)/)
        if (!ledger) add('P0', `${label}: the ledger line is missing`)
        else {
          const parts = [...ledger[2].matchAll(/(\d+) /g)].map((m) => Number(m[1]))
          if (parts.reduce((a, b) => a + b, 0) !== Number(ledger[1])) add('P0', `${label}: the ledger's kinds sum to ${parts.reduce((a, b) => a + b, 0)} and it counts ${ledger[1]} accounts ("${ledger[0].slice(0, 80)}")`)
          if (/\b0 /.test(ledger[2])) add('P0', `${label}: the ledger names a kind at zero ("${ledger[2].slice(0, 80)}")`)
        }
        const rungs = await evaluate(`[...document.querySelectorAll('main.page .ladder .ladder-row')].map((li) => { const c = li.querySelector('.rung-title').cloneNode(true); c.querySelectorAll('.infotip, .infotip-btn, button').forEach((n) => n.remove()); return { title: (c.textContent || '').replace(/\\s+/g, ' ').trim(), n: Number(((li.querySelector('.rung-n') || {}).textContent || '').trim()), rung: li.getAttribute('data-rung') } })`)
        if (rungs.length !== RUNG_TITLES.length || rungs.some((r, k) => r.title !== RUNG_TITLES[k])) add('P0', `${label}: the rungs read ${JSON.stringify(rungs.map((r) => r.title))}; pages.ladder gives ${JSON.stringify(RUNG_TITLES)}`)
        else {
          const active = Number((text.match(/of (\d+) active (?:person|people)/i) || [])[1])
          if (rungs.reduce((a, r) => a + r.n, 0) !== active) add('P0', `${label}: the rungs sum to ${rungs.reduce((a, r) => a + r.n, 0)} and the header says of ${active} active people`)
          if ((await evaluate(`document.querySelectorAll('main.page .ladder .ladder-divider').length`)) !== 1) add('P0', `${label}: the rule before the three to prioritise is missing`)
          // Clicking a rung filters the table to its people; a second click clears it.
          const rowsShown = () => evaluate(`document.querySelectorAll('main.page table.datatable tbody tr').length`)
          for (const r of rungs) {
            await evaluate(`(() => { const li = document.querySelector('main.page .ladder .ladder-row[data-rung="${r.rung}"]'); li.scrollIntoView({ block: 'center' }); li.click() })()`)
            await sleep(200)
            const shown = await rowsShown()
            if (shown !== r.n) add('P0', `${label}: "${r.title}" counts ${r.n} and the table filtered to it shows ${shown} rows`)
            await evaluate(`(() => { const li = document.querySelector('main.page .ladder .ladder-row[data-rung="${r.rung}"]'); li.click() })()`)
            await sleep(150)
          }
          ladderCounts = Object.fromEntries(rungs.map((r) => [r.title, r.n]))
        }
        // The accounts that are not people read "not a person"; with a method set
        // up they carry their rung's badge (every account with a method gets a rung),
        // with nothing set up a grey dash; the rungs' counts never include them.
        const notPeople = await evaluate(`[...document.querySelectorAll('main.page table.datatable tbody tr')].filter((tr) => /not a person/.test(tr.innerText)).map((tr) => ({ cls: (tr.querySelector('.rung-badge') || {}).className || '', method: (([...tr.querySelectorAll('td')][2] || {}).innerText || '').trim() }))`)
        for (const r of notPeople) {
          if (r.method === 'None' && !/rung-0/.test(r.cls)) add('P0', `${label}: an account that is not a person, with nothing set up, carries a rung badge (${r.cls})`)
          if (r.method !== 'None' && /rung-0/.test(r.cls)) add('P0', `${label}: an account that is not a person holds ${r.method} and shows no rung`)
        }
      }
      // The Inventory policies table carries an Exclusions column, the groups and users by name (E5).
      if (route === 'inventory') {
        const headers = await evaluate(`[...document.querySelectorAll('main.page th')].map((e) => (e.textContent || '').trim())`)
        if (!headers.includes('Exclusions')) add('P0', `${label}: the policies table has no Exclusions column`)
        else if (!/Core - Break glass/.test(text)) add('P0', `${label}: the Exclusions column names no excluded group`)
      }
      // The Plan header's counts, for the print cover to agree with (E4).
      if (route === 'plan') {
        const m = text.match(/(\d+) steps · (\d+) (?:in place|done)/)
        if (m) planHeaderCounts = { steps: m[1], inPlace: m[2] }
      }
      // Connect's refusals: the scan line never renders an empty window and says
      // "sign-ins not read" when the records were not read; a scan that could not
      // read a core section ends on "Scan finished with gaps" with the sections and
      // roles listed, withholds Open the plan, stores nothing, keeps the last good
      // plan, and offers Scan tenant; a token without the roles names the role to
      // ask for and does not start the scan.
      if (route === 'connect') {
        // Connect is four numbered tiles in both states (docs/design/connect-mockup.html):
        // one heading above them, the account (or the sign-in) tile, the baseline,
        // what happens next, and the scan in exactly one of its states; every
        // action a button in one of three weights.
        const signedOut = ['signedOut', 'consent', 'personal', 'cancelled'].includes(fx.mock)
        const tiles = await evaluate(`[...document.querySelectorAll('main.page section.step-tile')].map((s) => ({ n: ((s.querySelector('.n') || {}).textContent || '').trim(), h2: ((s.querySelector('h2') || {}).textContent || '').replace(/\\s+/g, ' ').trim(), state: ((s.querySelector('h2 .state') || {}).textContent || '').trim(), cls: s.className, buttons: [...s.querySelectorAll('button, a.btn')].filter((b) => !b.closest('.picker')).map((b) => ({ t: (b.textContent || '').trim(), w: /btn-primary/.test(b.className) ? 'primary' : /btn-secondary/.test(b.className) ? 'secondary' : /btn-tertiary/.test(b.className) ? 'tertiary' : 'none' })), text: (s.innerText || '').replace(/\\s+/g, ' '), paragraphs: [...s.querySelectorAll(':scope > p')].map((p) => (p.textContent || '').replace(/\\s+/g, ' ').trim()) }))`)
        if (tiles.length !== 4 || tiles.map((x) => x.n).join('') !== '1234') add('P0', `${label}: Connect renders ${tiles.length} tiles numbered ${tiles.map((x) => x.n).join(',')}; four, 1 to 4`)
        const [t1, t2, t3, t4] = tiles
        const btnOf = (tile, re) => (tile ? tile.buttons.find((b) => re.test(b.t)) : undefined)
        const expectBtn = (tile, re, w, what) => {
          const b = btnOf(tile, re)
          if (!b) add('P0', `${label}: ${what} has no ${re} button`)
          else if (b.w !== w) add('P0', `${label}: ${what}'s ${b.t} is ${b.w}; the mockup makes it ${w}`)
        }
        // One heading above the tiles, in both states.
        const h1 = await evaluate(`((document.querySelector('main.page h1') || {}).textContent || '').trim()`)
        if (h1 !== 'Plan the journey to your Conditional Access baseline.') add('P0', `${label}: the heading reads "${h1}"; Plan the journey to your Conditional Access baseline.`)
        if (!/IAMAI reads a Microsoft Entra tenant, compares it with a published Conditional Access baseline, and writes a dated plan to help you close the gaps without locking anyone out\. It is read-only and runs in this browser\./.test(text)) add('P0', `${label}: the line under the heading is missing or changed`)
        if (/Connect a tenant/.test(text)) add('P0', `${label}: "Connect a tenant" still renders`)
        // The ladder's five tiles are links to Today filtered (docs/design/mockups/connect-v2.html), not actions.
        const bare = await evaluate(`[...document.querySelectorAll('main.page section.step-tile a[href]:not(.btn):not(.lnk):not(.rung-tile)')].map((a) => (a.textContent || '').trim())`)
        if (bare.length > 0) add('P0', `${label}: bare link(s) on Connect: ${bare.join(' | ')}; every action is a button in one of three weights`)
        if (/Security Reader|Reports Reader|Directory Readers/.test(text)) add('P0', `${label}: a role other than Global Reader is named on screen`)
        if (/Everything the scan found is inside the plan/.test(text)) add('P0', `${label}: the "everything the scan found" line still renders`)
        if ((await evaluate(`document.querySelectorAll('main.page .footer-link').length`)) > 0) add('P0', `${label}: the footer How link still renders`)
        if (/Built for|What it catches/.test(text)) add('P0', `${label}: Built for or What it catches still renders on Connect; they moved to the home page`)
        if (/feedback@getiamai\.com/.test(text)) add('P0', `${label}: the feedback address renders on Connect; it appears on the error page and How's Limits only`)
        // The header: the brand links to Connect; signed in, no tenant tab and three tabs.
        const brand = await evaluate(`(() => { const a = document.querySelector('header.app a.wordmark'); return a ? a.getAttribute('href') : null })()`)
        if (brand !== '#/connect') add('P0', `${label}: the brand links to ${brand}; #/connect`)
        if (await evaluate(`document.querySelector('header.app .tenant') !== null`)) add('P0', `${label}: the header still shows the tenant tab`)
        if (!signedOut) {
          const tabs = await evaluate(`[...document.querySelectorAll('header.app nav a')].map((a) => (a.textContent || '').trim())`)
          if (tabs.join(' · ') !== 'Today · Plan · Export') add('P0', `${label}: the header tabs read ${tabs.join(' · ')}; Today · Plan · Export`)
        }
        const CONSENT = /The first sign-in in a tenant needs an account that can grant consent \(a Global Administrator, once\); every sign-in after that can be Global Reader\./
        const READER = /Global Reader is the least privilege that reads everything IAMAI needs; a Global Administrator account works too, but sign in with less if you can\. It writes nothing\./
        // 1 Signed in, or Sign in
        if (t1 && !signedOut) {
          if (!/^Signed in /.test(t1.h2) || !t1.state) add('P0', `${label}: tile 1 does not read Signed in with the tenant as its state: "${t1.h2}"`)
          if (!READER.test(t1.text)) add('P0', `${label}: tile 1 lacks the Global Reader line as the mockup words it`)
          if (!CONSENT.test(t1.text)) add('P0', `${label}: tile 1 lacks the consent sentence`)
          expectBtn(t1, /^Sign in with another account$/, 'secondary', 'tile 1')
          expectBtn(t1, /^Sign out$/, 'tertiary', 'tile 1')
        }
        if (t1 && signedOut) {
          const want1 = { signedOut: { state: 'no tenant connected', cls: null, lead: null, primary: 'Sign in with Microsoft' }, consent: { state: 'Microsoft asked for admin approval', cls: 'wait', lead: /^This is the first sign-in for contoso\.com, and consent has to be granted once by a Global Administrator\. Sign in with that account this one time, or send them this link; after that, Global Reader is enough\.$/, primary: 'Sign in with Microsoft' }, personal: { state: 'that is a personal Microsoft account', cls: 'stop', lead: /^someone@outlook\.com is a personal account\. IAMAI reads a Microsoft Entra tenant, so it needs a work or school account that belongs to one\.$/, primary: 'Sign in with a work or school account' }, cancelled: { state: 'sign-in was cancelled', cls: null, lead: null, primary: 'Sign in with Microsoft' } }[fx.mock]
          if (!/^Sign in /.test(t1.h2) || t1.state !== want1.state) add('P0', `${label}: tile 1 reads "${t1.h2}"; Sign in · ${want1.state}`)
          if (want1.cls && !new RegExp('\\b' + want1.cls + '\\b').test(t1.cls)) add('P0', `${label}: tile 1's badge does not carry the ${want1.cls} colour (${t1.cls})`)
          if (!want1.cls && /\b(done|wait|stop)\b/.test(t1.cls)) add('P0', `${label}: tile 1 carries a state colour (${t1.cls}) in the ${fx.mock} state`)
          if (fx.mock === 'signedOut') {
            if (!READER.test(t1.text) || !CONSENT.test(t1.text)) add('P0', `${label}: the sign-in tile lacks the Global Reader line with the consent sentence`)
          } else if (want1.lead) {
            if (!t1.paragraphs.some((p) => want1.lead.test(p))) add('P0', `${label}: the ${fx.mock} state's paragraph reads ${JSON.stringify(t1.paragraphs)}`)
            if (READER.test(t1.text)) add('P0', `${label}: the ${fx.mock} state keeps the Global Reader paragraph; the error paragraph replaces it`)
          } else if (t1.paragraphs.some((p) => p.length > 0)) add('P0', `${label}: the cancelled state carries a paragraph: ${JSON.stringify(t1.paragraphs)}; the state line only`)
          expectBtn(t1, new RegExp('^' + want1.primary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'), 'primary', 'tile 1')
          expectBtn(t1, /^Try it with sample data$/, 'secondary', 'tile 1')
          if (t1.buttons.length !== 2) add('P0', `${label}: tile 1 has ${t1.buttons.length} buttons; two`)
          if (fx.mock === 'signedOut') {
            // The permissions collapsible: the consent rows, in order, and the removal line.
            const opened = await clickText('summary', /What IAMAI asks for, and how to remove it/)
            if (!opened) add('P0', `${label}: tile 1 has no permissions collapsible`)
            await sleep(300)
            const perm = await evaluate(`(() => { const d = document.querySelector('main.page details.permissions'); if (!d) return null; return { lead: ((d.querySelector('p') || {}).textContent || '').replace(/\\s+/g, ' ').trim(), rows: [...d.querySelectorAll('.tile-rows li')].map((l) => (l.textContent || '').replace(/\\s+/g, ' ').trim()), last: (((ps) => ps[ps.length - 1])([...d.querySelectorAll('p')]) || {}).textContent || '', tables: d.querySelectorAll('table').length } })()`)
            if (!perm) add('P0', `${label}: the permissions collapsible did not open`)
            else {
              const m = perm.lead.match(/^Microsoft's consent screen will list these (\d+), in this order:$/)
              if (!m) add('P0', `${label}: the consent lead reads "${perm.lead}"`)
              else if (Number(m[1]) !== perm.rows.length) add('P0', `${label}: the consent lead counts ${m[1]} and ${perm.rows.length} rows follow`)
              if (perm.rows.length < 5) add('P0', `${label}: ${perm.rows.length} consent rows; every requested scope, in Microsoft's wording`)
              if (!/^Read all users' basic profiles \/ Read directory data/.test(perm.rows[0] || '')) add('P0', `${label}: the first consent row reads "${perm.rows[0]}"`)
              if (perm.tables > 0) add('P0', `${label}: the permissions collapsible still renders a table`)
              if (!/^Remove it any time: Entra admin center → Enterprise applications → IAMAI Planner → Delete\. Nothing it read leaves this browser unless you export it\.$/.test(perm.last.replace(/\s+/g, ' ').trim())) add('P0', `${label}: the collapsible does not end with the removal line: "${perm.last}"`)
            }
            writeFileSync(join(wdir, 'connect-permissions.txt'), await mainText())
            await shot(join(wdir, 'connect-permissions.png'))
          }
        }
        // 2 Baseline
        if (t2) {
          if (!/^Baseline .+ · \d+ polic/.test(t2.h2)) add('P0', `${label}: tile 2 does not carry the baseline name and count as its state: "${t2.h2}"`)
          // One policy count, the pinned package's, signed out and (the demo runs on it) signed in.
          if ((signedOut || inDemo) && !new RegExp(' · ' + PINNED_COUNT + ' policies$').test(t2.state)) add('P0', `${label}: tile 2 reads "${t2.state}"; the pinned package holds ${PINNED_COUNT} policies`)
          // The author's update: every changed policy named (added, removed, changed), under each the plan steps that change or "no step changes"; no row reads "policy".
          if (fx.mock === 'author') {
            const review = await evaluate(`(() => { const d = [...document.querySelectorAll('main.page section.step-tile details')].find((x) => /Updated by its author/.test((x.querySelector('summary') || {}).textContent || '')); if (!d) return null; return { summary: (d.querySelector('summary').textContent || '').replace(/\\s+/g, ' ').trim(), rows: [...d.querySelectorAll(':scope > ul.diff > li')].map((li) => ({ tag: ((li.querySelector('.tag') || {}).textContent || '').trim(), policy: ((li.querySelector('.policy') || {}).textContent || '').trim(), steps: [...li.querySelectorAll('.steps li')].map((x) => (x.textContent || '').trim()) })) } })()`)
            if (!review) add('P0', `${label}: tile 2 has no author-update review`)
            else {
              if (!/^Updated by its author on .+ · 4 policies changed · review$/.test(review.summary)) add('P0', `${label}: the review summary reads "${review.summary}"`)
              if (review.rows.length !== 4) add('P0', `${label}: the review lists ${review.rows.length} rows; one per changed policy (4)`)
              for (const r of review.rows) {
                if (!['added', 'removed', 'changed'].includes(r.tag)) add('P0', `${label}: a review row's change word is "${r.tag}"`)
                if (r.policy.length < 4 || /\bpolicy\b/.test(r.policy)) add('P0', `${label}: a review row does not name its policy: "${r.policy}"`)
                const ok = r.steps.length >= 1 && (r.steps.every((x) => /^changes .{5,}$/.test(x)) || (r.steps.length === 1 && r.steps[0] === 'no step changes'))
                if (!ok) add('P0', `${label}: the steps under "${r.policy}" read ${JSON.stringify(r.steps)}; "changes <step>" lines or "no step changes"`)
                if (/\bpolicy\b/.test(r.steps.join(' '))) add('P0', `${label}: a review row reads "policy": ${JSON.stringify(r.steps)}`)
              }
              if (!review.rows.some((r) => r.steps.some((x) => /^changes /.test(x)))) add('P0', `${label}: no review row names a step that changes, although the update touches mapped policies`)
              if (!review.rows.some((r) => r.steps[0] === 'no step changes')) add('P0', `${label}: no review row reads "no step changes", although the update touches an unmapped policy`)
            }
          }
          if (!/built and maintained by Jon Hope/.test(t2.text) || !/Its aim is layered protection/.test(t2.text)) add('P0', `${label}: tile 2 lacks the approved baseline sentences`)
          expectBtn(t2, /^Change baseline$/, 'secondary', 'tile 2')
        }
        // 3 Scan: the limitations in both states (no Reads / Compares / Writes beats, no read-only line),
        // then exactly one of its states (docs/design/connect-mockup.html); the
        // number badge carries the state colour; nothing of the other states, and
        // nothing of the Plan tile's.
        const SCAN_STATES = { complete: /^Scan complete · .+$/, gaps: /^Scan finished with gaps · no plan built$/, role: /^Scan not started · this account can't read the tenant$/, scanning: /^Scan .+ · \d+(m \d+)?s$/, ready: /^Scan not started$/, sample: /^Scan after sign-in · about a minute for a small tenant$/ }
        const want = signedOut ? 'sample' : ({ roles: 'role', gaps: 'gaps', free: 'complete', scanning: 'scanning', ready: 'ready' }[fx.mock] ?? 'complete')
        if (t3) {
          const seen = Object.entries(SCAN_STATES).filter(([, re]) => re.test(t3.h2)).map(([k]) => k)
          if (seen.length !== 1 || seen[0] !== want) add('P0', `${label}: tile 3 reads "${t3.h2}"; Scan in the ${want} state`)
          if (/What happens next/.test(t3.text)) add('P0', `${label}: tile 3 still reads What happens next`)
          for (const s of ['policies, people, sign-in records and licences', 'what each baseline policy is for', 'a dated plan for the difference']) if (t3.text.includes(s)) add('P0', `${label}: tile 3 still carries a Reads / Compares / Writes beat ("${s}")`)
          if (/Read-only\. It holds no permission/.test(t3.text)) add('P0', `${label}: tile 3 still carries the read-only line`)
          const limits = await evaluate(`(() => { const d = [...document.querySelectorAll('main.page section.step-tile details')].find((x) => /IAMAI limitations/.test((x.querySelector('summary') || {}).textContent || '')); if (!d) return null; const ps = d.querySelectorAll('p'); const tile = d.closest('section.step-tile'); return { items: d.querySelectorAll('li').length, last: ((ps[ps.length - 1] || {}).textContent || '').replace(/\\s+/g, ' ').trim(), n: tile ? ((tile.querySelector('.n') || {}).textContent || '').trim() : '' } })()`)
          if (!limits) add('P0', `${label}: tile 3 has no IAMAI limitations collapsible`)
          else {
            if (limits.n !== '3') add('P0', `${label}: the limitations collapsible sits in tile ${limits.n}; tile 3`)
            if (limits.items !== 5) add('P0', `${label}: the limitations list has ${limits.items} lines; five`)
            if (limits.last !== 'Permissions, every check it runs, and its limits in full: How IAMAI works →') add('P0', `${label}: the limitations' last line reads "${limits.last}"`)
          }
          const badge = { complete: 'done', gaps: 'wait', role: 'stop' }[want]
          if (badge && !new RegExp('\\b' + badge + '\\b').test(t3.cls)) add('P0', `${label}: tile 3's number badge does not carry the ${want} state colour (class ${badge}); it has "${t3.cls}"`)
          if (!badge && /\b(done|wait|stop)\b/.test(t3.cls)) add('P0', `${label}: tile 3 in the ${want} state carries a state colour (${t3.cls})`)
          const OTHER = { complete: [/complete · /, /^Scan again$/], gaps: [/no plan built/, /Ask whoever administers/], role: [/holds none of the roles that read/, /Everything IAMAI needs, read-only/], scanning: [/^Stop$/], ready: [/About ten minutes/, /^Scan tenant$/], sample: [/about a minute for a small tenant/] }
          for (const [k, res] of Object.entries(OTHER)) {
            if (k === want) continue
            // Scan again belongs to the complete and the gaps state both.
            for (const re of res) if (!(k === 'complete' && want === 'gaps' && String(re) === String(/^Scan again$/)) && (re.test(t3.text) || t3.buttons.some((b) => re.test(b.t)))) add('P0', `${label}: tile 3 in the ${want} state carries the ${k} state's ${re}`)
          }
          for (const re of [/Open the plan →/, /Open the last full plan/, /What the sample tenant produced/, /Open the sample plan/, /\d+ people \d+ policies/, /from the scan/]) if (re.test(t3.text) || t3.buttons.some((b) => re.test(b.t))) add('P0', `${label}: tile 3 carries the Plan tile's ${re}`)
          if (want === 'complete') {
            expectBtn(t3, /^Scan again$/, 'secondary', 'the complete Scan tile')
            if (t3.buttons.length !== 1) add('P0', `${label}: the complete Scan tile has ${t3.buttons.length} buttons; Scan again alone`)
          }
          if (want === 'gaps') {
            const rows = await evaluate(`[...document.querySelectorAll('main.page section.step-tile .tile-rows li')].map((l) => (l.textContent || '').replace(/\\s+/g, ' ').trim())`)
            if (!rows.some((r) => /^Conditional Access policies not read$/.test(r))) add('P0', `${label}: the policies section row is not marked not read: ${JSON.stringify(rows)}`)
            if (!rows.some((r) => /^Sign-in records not read$/.test(r))) add('P0', `${label}: the sign-in records row is not marked not read: ${JSON.stringify(rows)}`)
            if (!/Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing\./.test(t3.text)) add('P0', `${label}: the gaps tile lacks the one ask for Global Reader`)
            if (!(await evaluate(`[...document.querySelectorAll('main.page section.step-tile a.lnk')].some((a) => /Microsoft: Global Reader/.test(a.textContent || '') && /global-reader/.test(a.getAttribute('href') || ''))`))) add('P0', `${label}: the gaps tile lacks Microsoft's Global Reader link`)
            expectBtn(t3, /^Sign in with another account$/, 'primary', 'the gaps tile')
            expectBtn(t3, /^Scan again$/, 'secondary', 'the gaps tile')
            if (t3.buttons.length !== 2) add('P0', `${label}: the gaps tile has ${t3.buttons.length} buttons; Sign in with another account and Scan again`)
            const stored = await evaluate(`(async () => { try { const req = indexedDB.open('iamai'); const db = await new Promise((r, j) => { req.onsuccess = () => r(req.result); req.onerror = () => j(req.error) }); const n = db.objectStoreNames.contains('snapshot') ? await new Promise((r) => { const q = db.transaction('snapshot').objectStore('snapshot').count(); q.onsuccess = () => r(q.result) }) : 0; db.close(); return n } catch { return -1 } })()`)
            if (stored !== 0) add('P0', `${label}: the scan with gaps left ${stored} snapshot record(s) in the store; it is never stored`)
          }
          if (want === 'role') {
            if (!/holds none of the roles that read Conditional Access policies, people and sign-in records\./.test(t3.text)) add('P0', `${label}: the role tile does not name the account and the three sections: "${t3.text}"`)
            const rows = await evaluate(`[...document.querySelectorAll('main.page section.step-tile .tile-rows li')].map((l) => (l.textContent || '').replace(/\\s+/g, ' ').trim())`)
            if (rows.length !== 1 || !/^Everything IAMAI needs, read-only ask for Global Reader$/.test(rows[0])) add('P0', `${label}: the role tile's rows read ${JSON.stringify(rows)}; one row asking for Global Reader`)
            expectBtn(t3, /^Sign in with another account$/, 'primary', 'the role tile')
            if (t3.buttons.length !== 1) add('P0', `${label}: the role tile has ${t3.buttons.length} buttons; Sign in with another account alone`)
            if (await evaluate(`document.querySelector('main.page .progress') !== null`)) add('P0', `${label}: the scan started although the token lacks the roles`)
          }
          if (want === 'scanning') {
            // One line (the section being read · elapsed), one bar, Stop: never the caption and the line both.
            if (!(await evaluate(`document.querySelector('main.page section.step-tile .progress') !== null`))) add('P0', `${label}: the scanning tile has no bar`)
            if (await evaluate(`document.querySelector('main.page section.step-tile .progress-caption') !== null`)) add('P0', `${label}: the scanning tile renders the bar's caption beside the state line; one line only`)
            if (!/^Scan reading [a-z][^·]* · \d+(m \d+)?s$/.test(t3.h2)) add('P0', `${label}: the scanning line reads "${t3.h2}"; the section being read · elapsed`)
            if (t3.paragraphs.some((p) => /elapsed|reading/i.test(p))) add('P0', `${label}: the scanning tile repeats the lane or the elapsed time in a paragraph: ${JSON.stringify(t3.paragraphs)}`)
            expectBtn(t3, /^Stop$/, 'tertiary', 'the scanning tile')
            if (t3.buttons.length !== 1) add('P0', `${label}: the scanning tile has ${t3.buttons.length} buttons; Stop alone`)
          }
          if (want === 'ready') {
            expectBtn(t3, /^Scan tenant$/, 'primary', 'the ready tile')
            if (t3.buttons.length !== 1) add('P0', `${label}: the ready tile has ${t3.buttons.length} buttons; Scan tenant alone`)
            if (!/About ten minutes\. Reads the tenant into this browser; nothing is sent anywhere\./.test(t3.text)) add('P0', `${label}: the ready tile lacks the ten-minute line`)
          }
          if (want === 'sample' && t3.buttons.length !== 0) add('P0', `${label}: the signed-out Scan tile has ${t3.buttons.length} buttons; none`)
        }
        // 4 Plan: the state that follows the scan. Ready with the facts (the step
        // counts the way the Plan header counts them) after a complete scan, the
        // last full plan after one with gaps, waiting otherwise; before sign-in,
        // what the sample tenant produced. The scan's age is the one stored
        // timestamp's: it renders once as the Scan tile's state, and the Plan
        // tile's "from the scan" carries the same words; nothing says scanned.
        const wantPlan = signedOut ? 'sample' : want === 'complete' ? 'ready' : want === 'gaps' ? 'last' : 'waiting'
        // The ready state carries the step counts once the plan has computed (docs/design/mockups/connect-v2.html).
        const PLAN_STATES = { ready: /^Plan ready · (\d+ steps, \d+ done · )?from the scan .+$/, last: /^Plan last full plan · [A-Z][a-z]{2} \d+$/, waiting: /^Plan after the scan$/, sample: /^Plan after the scan$/ }
        if (t4) {
          if (!PLAN_STATES[wantPlan].test(t4.h2)) add('P0', `${label}: tile 4 reads "${t4.h2}"; Plan in the ${wantPlan} state`)
          if (wantPlan === 'ready' && !/\bdone\b/.test(t4.cls)) add('P0', `${label}: the ready Plan tile's badge does not carry the accent (${t4.cls})`)
          if (wantPlan !== 'ready' && /\b(done|wait|stop)\b/.test(t4.cls)) add('P0', `${label}: the ${wantPlan} Plan tile carries a state colour (${t4.cls})`)
          const PLAN_OTHER = { ready: [/^Open the plan →$/, /\d+ people \d+ policies/, /from the scan/], last: [/^Open the last full plan/, /last full plan/], waiting: [], sample: [/What the sample tenant produced/, /already in place/, /^Open the sample plan$/] }
          for (const [k, res] of Object.entries(PLAN_OTHER)) {
            if (k === wantPlan) continue
            for (const re of res) if (re.test(t4.text) || t4.buttons.some((b) => re.test(b.t))) add('P0', `${label}: tile 4 in the ${wantPlan} state carries the ${k} state's ${re}`)
          }
          for (const re of [/^Scan again$/, /^Scan tenant$/, /^Stop$/, /^Sign in with another account$/, /\bReads\b/, /IAMAI limitations/, /not read$/]) if (re.test(t4.text) || t4.buttons.some((b) => re.test(b.t))) add('P0', `${label}: tile 4 carries the Scan tile's ${re}`)
          if (wantPlan === 'ready') {
            // The state carries the step counts once the plan has computed (docs/design/mockups/connect-v2.html):
            // "ready · N steps, N done · from the scan <age>"; under it the ladder's header and five tiles, each
            // linking to Today filtered to its rung; no facts row, no drop line.
            const counted = await waitFor(`/ready · \\d+ steps, \\d+ done · from the scan /.test((document.querySelector('main.page') || {}).innerText || '')`, 20000)
            if (!counted) add('P0', `${label}: the Plan tile never counted its steps in its state line`)
            const state = await evaluate(`((document.querySelectorAll('main.page section.step-tile')[3] || {}).querySelector('h2 .state') || {}).textContent || ''`)
            const sm = state.match(/^ready · (\d+) steps, (\d+) done · from the scan /)
            if (!sm) add('P0', `${label}: the Plan tile's state reads "${state}"; ready · N steps, N done · from the scan <age>`)
            else if (Number(sm[2]) > Number(sm[1])) add('P0', `${label}: more done than steps: "${state}"`)
            if ((await evaluate(`document.querySelectorAll('main.page section.step-tile .facts').length`)) > 0) add('P0', `${label}: the Plan tile still renders a facts row`)
            if (/\d+ → \d+|\d+ → [A-Z][a-z]{2} \d+/.test(t4.text)) add('P0', `${label}: the Plan tile carries a drop line or a window: "${t4.text.slice(0, 80)}"`)
            const tiles = await evaluate(`[...document.querySelectorAll('main.page section.step-tile .rung-tiles .rung-tile')].map((t) => ({ label: ((t.querySelector('.rung-title') || {}).textContent || '').trim(), n: Number(((t.querySelector('.rung-n') || {}).textContent || '').trim()), href: t.getAttribute('href') || '' }))`)
            if (tiles.length !== 5) add('P0', `${label}: the Plan tile's ladder has ${tiles.length} tiles; five`)
            else {
              if (tiles.some((t, k) => t.label !== RUNG_TITLES[k])) add('P0', `${label}: the tiles read ${JSON.stringify(tiles.map((t) => t.label))}; pages.ladder gives ${JSON.stringify(RUNG_TITLES)}`)
              const active = Number((t4.text.match(/of (\d+) active (?:person|people)/i) || [])[1])
              if (tiles.reduce((a, t) => a + t.n, 0) !== active) add('P0', `${label}: the tiles sum to ${tiles.reduce((a, t) => a + t.n, 0)} and the header says of ${active} active people`)
              for (const [k, t] of tiles.entries()) if (!new RegExp(`#/today/rung-${5 - k}$`).test(t.href)) add('P0', `${label}: "${t.label}" links to "${t.href}"; Today filtered to its rung`)
              if (ladderCounts) for (const t of tiles) if (ladderCounts[t.label] !== undefined && ladderCounts[t.label] !== t.n) add('P0', `${label}: Connect's "${t.label}" reads ${t.n} and Today's ${ladderCounts[t.label]}`)
              if (stripCounts) for (const t of tiles) if (stripCounts[t.label] !== undefined && stripCounts[t.label] !== t.n) add('P0', `${label}: Connect's "${t.label}" reads ${t.n} and the Plan's ${stripCounts[t.label]}`)
              // One denominator (E4): the Plan header's counts, read now rather than
              // from the Plan route's capture (the walk's own clicks there mark a
              // Cleanup row done, so an earlier capture is stale by design).
              if (planHeaderCounts) {
                await evaluate(`location.hash = '#/plan'`)
                const onPlan = await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`, 15000)
                const headerNow = onPlan ? await evaluate(`((document.querySelector('main.page p.line') || {}).textContent || '').replace(/\\s+/g, ' ')`) : ''
                const hm = headerNow.match(/(\d+) steps · (\d+) (?:in place|done)/)
                if (!hm) add('P0', `${label}: the Plan header could not be read for the count check: "${headerNow}"`)
                else if (sm && (hm[1] !== sm[1] || hm[2] !== sm[2])) add('P0', `${label}: the Plan tile counts ${sm[1]} steps, ${sm[2]} done; the Plan header ${hm[1]} · ${hm[2]}`)
                await evaluate(`location.hash = '#/connect'`)
                await waitFor(`document.querySelectorAll('main.page section.step-tile').length === 4`, 15000)
              }
            }
            expectBtn(t4, /^Open the plan →$/, 'primary', 'the Plan tile')
            if (t4.buttons.length !== 1) add('P0', `${label}: the ready Plan tile has ${t4.buttons.length} buttons; Open the plan alone`)
            const age = ((t3 ? t3.state : '').match(/^complete · (.+)$/) || [])[1]
            if (!age) add('P0', `${label}: the Scan tile's state does not read complete · N ago: "${t3 ? t3.state : ''}"`)
            else if (!new RegExp(`^ready · (\\d+ steps, \\d+ done · )?from the scan ${age.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).test(t4.state)) add('P0', `${label}: the Plan tile reads "${t4.state}"; ready · N steps, N done · from the scan ${age}, the Scan tile's age`)
            // The age is the formatter's words: "this minute" for a fresh scan, "57 minutes ago", "3 days ago".
            const ageLines = (text.match(/\bcomplete · [^\n]+/g) || []).length
            if (ageLines !== 1) add('P0', `${label}: the scan's age line renders ${ageLines} times; once, as the Scan tile's state`)
          }
          if (wantPlan === 'last') {
            expectBtn(t4, /^Open the last full plan \([A-Z][a-z]{2} \d+\)$/, 'tertiary', 'the Plan tile')
            if (t4.buttons.length !== 1) add('P0', `${label}: the last-full-plan tile has ${t4.buttons.length} buttons; Open the last full plan alone`)
            const d = (t4.state.match(/^last full plan · (.+)$/) || [])[1]
            if (d && !t4.buttons.some((b) => b.t === `Open the last full plan (${d})`)) add('P0', `${label}: the Plan tile's date and its button disagree: "${t4.state}" / ${JSON.stringify(t4.buttons.map((b) => b.t))}`)
            if (/\d+ people/.test(t4.text)) add('P0', `${label}: the last-full-plan tile carries facts from a scan that built no plan`)
          }
          if (wantPlan === 'waiting' && (t4.buttons.length !== 0 || /\d+ people/.test(t4.text))) add('P0', `${label}: the waiting Plan tile carries buttons or facts: ${JSON.stringify(t4.buttons)} "${t4.text}"`)
          if (wantPlan === 'sample') {
            const facts = await evaluate(`[...document.querySelectorAll('main.page section.step-tile .facts li')].map((l) => ({ value: ((l.querySelector('b') || {}).textContent || '').trim(), label: (l.textContent || '').replace((l.querySelector('b') || {}).textContent || '', '').replace(/\\s+/g, ' ').trim() }))`)
            if (facts.map((f) => f.label).join(' · ') !== 'active people · steps · already in place · to finish') add('P0', `${label}: the sample tile's facts read ${JSON.stringify(facts)}; active people · steps · already in place · to finish`)
            else if (!facts.slice(0, 3).every((f) => /^\d+$/.test(f.value) && Number(f.value) > 0) || !/^\d+ weeks?$/.test(facts[3].value)) add('P0', `${label}: the sample tile's facts are not computed numbers: ${JSON.stringify(facts)}`)
            else if (Number(facts[2].value) > Number(facts[1].value)) add('P0', `${label}: more already in place than steps: ${JSON.stringify(facts)}`)
            if (!/What the sample tenant produced:/.test(t4.text)) add('P0', `${label}: the sample tile lacks its lead`)
            expectBtn(t4, /^Open the sample plan$/, 'secondary', 'the sample tile')
            if (t4.buttons.length !== 1) add('P0', `${label}: the sample tile has ${t4.buttons.length} buttons; Open the sample plan alone`)
          }
        }
        if (/\bscanned\b/i.test(text)) add('P0', `${label}: Connect says "scanned"; the scan's age is the Scan tile's state line`)
        writeFileSync(join(wdir, 'connect-tiles.json'), JSON.stringify(tiles, null, 2))
        if (want === 'gaps') {
          // The last good plan is kept after a scan with gaps (a navigation, so last).
          await send('Page.navigate', { url: `${fx.base}#/plan` })
          const kept = await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`, 10000)
          if (!kept) add('P0', `${label}: the last good plan is gone after a scan with gaps`)
        }
      }
      // The page tips: Today and Export keep theirs; the Plan has none.
      const tips = await evaluate(`document.querySelectorAll('main.page .page-tip').length`)
      if ((route === 'today' || route === 'export') && tips !== 1) add('P0', `${label}: the page renders ${tips} tips; it keeps one`)
      if (route === 'plan' && tips !== 0) add('P0', `${label}: the Plan still renders a page tip`)
      // The MFA readiness ladder on the Plan (docs/design/mockups/plan-top-v2.html):
      // under the steps line, the header and five tiles by title, each linking to
      // Today filtered to its rung, the numbers Today's; no expanding lists, no
      // "Clear the date" or "Starting locks" line. The counts are kept for the
      // campaign step to agree with.
      if (route === 'plan') {
        const tiles = await evaluate(`[...document.querySelectorAll('main.page .rung-tiles .rung-tile')].map((t) => ({ label: ((t.querySelector('.rung-title') || {}).textContent || '').trim(), n: Number(((t.querySelector('.rung-n') || {}).textContent || '').trim()), href: t.getAttribute('href') || '' }))`)
        if (tiles.length !== 5) add('P0', `${label}: the Plan's ladder has ${tiles.length} tiles; five`)
        else {
          if (tiles.some((t, k) => t.label !== RUNG_TITLES[k])) add('P0', `${label}: the tiles read ${JSON.stringify(tiles.map((t) => t.label))}; pages.ladder gives ${JSON.stringify(RUNG_TITLES)}`)
          stripCounts = Object.fromEntries(tiles.map((t) => [t.label, t.n]))
          if (ladderCounts) for (const t of tiles) if (ladderCounts[t.label] !== undefined && ladderCounts[t.label] !== t.n) add('P0', `${label}: the Plan's "${t.label}" reads ${t.n} and Today's ${ladderCounts[t.label]}`)
          const active = Number((text.match(/of (\d+) active (?:person|people)/i) || [])[1])
          if (tiles.reduce((a, t) => a + t.n, 0) !== active) add('P0', `${label}: the tiles sum to ${tiles.reduce((a, t) => a + t.n, 0)} and the header says of ${active} active people`)
          for (const [k, t] of tiles.entries()) if (!new RegExp(`#/today/rung-${5 - k}$`).test(t.href)) add('P0', `${label}: "${t.label}" links to "${t.href}"; Today filtered to its rung`)
        }
        if ((await evaluate(`document.querySelectorAll('main.page .readiness, main.page .readiness-people').length`)) > 0) add('P0', `${label}: the old readiness strip still renders`)
        if (/Clear the date|Starting locks the dates/.test(text)) add('P0', `${label}: a note under the start date still renders`)
      }
      // The print cover (E4): Print or save as PDF mounts the print document; its
      // statement carries the Plan header's own count (the steps and the Cleanup
      // rows), and its contents list Cleanup. window.print is stubbed so headless
      // Chrome does not block; afterprint tears the document down.
      if (route === 'export') {
        await evaluate(`window.print = function () { try { window.dispatchEvent(new Event('beforeprint')) } catch (e) {} }`)
        const printed = await clickText('button', /^Print or save as PDF$/)
        const cover = printed ? await waitFor(`document.querySelector('.print-plan .print-statement') !== null`, 8000) : false
        if (!cover) add('P0', `${label}: Print or save as PDF renders no cover`)
        else {
          const statement = await evaluate(`[...document.querySelectorAll('.print-plan .print-statement')].map((e) => e.textContent).join(' ')`)
          const m = statement.match(/(\d+) steps · (\d+) (?:in place|done)/)
          if (!m) add('P0', `${label}: the print cover's statement carries no step count ("${statement.slice(0, 80)}")`)
          else if (planHeaderCounts && m[1] !== planHeaderCounts.steps) add('P0', `${label}: the print cover counts ${m[1]} steps and the Plan header ${planHeaderCounts.steps} (Cleanup is in the header's count)`)
          // The print document is hidden on screen (print media shows it), so its innerText is empty: read textContent.
          const printText = await evaluate(`[...document.querySelectorAll('.print-plan h1, .print-plan h2, .print-plan h3, .print-plan p, .print-plan li, .print-plan td, .print-plan dd')].map((e) => e.textContent).join('\\n')`)
          if (!/\bCleanup\b/.test(printText)) add('P0', `${label}: the print does not list Cleanup`)
          checkText(`${label} (print)`, printText, { emails: true })
        }
        await evaluate(`window.dispatchEvent(new Event('afterprint'))`)
        await sleep(200)
      }
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
        await ensureWeek2('plan')
        const rowThere = await waitFor(`document.querySelectorAll('main.page .plan-row').length > ${i}`)
        if (!rowThere) {
          add('P0', `${slabel}: the row is not on the Plan`)
          continue
        }
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
        // Foundation A: a policy step offers no implementation at all — no portal
        // instructions, no JSON, no PowerShell, no download — while it names an
        // object this tenant does not have yet, or when it has nothing to create
        // because the goal is already in place (src/ui/surfaces/stepJson.ts
        // implementationOffered). It says which step comes first, or that there
        // is nothing to do but keep the policy. The checks below read the
        // instructions, so they apply only where the instructions are offered.
        const waitsOnAnObject = / first: this policy names an object /.test(bodyText) || /in place already: nothing to create/.test(bodyText)
        const emailText = await evaluate(`[...document.querySelectorAll('main.page .step-body .copy-box')].map((e) => e.innerText).join('\\n')`)
        const outsideEmail = emailText ? bodyText.replace(emailText, '') : bodyText
        checkText(slabel, outsideEmail)
        checkText(`${slabel} (email)`, emailText, { emails: true })
        // No step tip on an opened step.
        if ((await evaluate(`document.querySelectorAll('main.page .step-body .page-tip').length`)) !== 0) add('P0', `${slabel}: the step still renders a tip`)
        // The ladder's numbers are the campaign step's for the same rung.
        if (stripCounts) {
          const group = (re) => { const m = bodyText.match(re); return m ? Number(m[1]) : null }
          if (/MFA Registration Campaign/.test(title)) {
            const noMethod = group(/^(\d+) (?:people|person) at Nothing set up;/m) ?? 0
            const unproven = group(/^(\d+) (?:people|person) at Set up, never used for MFA;/m) ?? 0
            if (noMethod !== stripCounts['Nothing set up']) add('P0', `${slabel}: the campaign lists ${noMethod} at Nothing set up and the ladder counts ${stripCounts['Nothing set up']}`)
            // With Require MFA for Everyone in place (the passkey email), the campaign asks nobody for one MFA sign-in while the ladder keeps the records' fact.
            const mfaInPlace = /You already confirm sign-ins to/.test(bodyText)
            if (mfaInPlace && unproven !== 0) add('P0', `${slabel}: the campaign lists ${unproven} set up, never used although Require MFA for Everyone is in place`)
            if (!mfaInPlace && unproven !== stripCounts['Set up, never used for MFA']) add('P0', `${slabel}: the campaign lists ${unproven} set up, never used and the ladder counts ${stripCounts['Set up, never used for MFA']}`)
          }
        }
        // A count of one reads as one, noun and verb: never "1 people", never "1 person hold".
        const plural = bodyText.match(/(?<![\d,.])\b1 (people|admins|guests|users|accounts|persons)\b|(?<![\d,.])\b1 (?:of them|person|admin|guest|user|account) (hold|have|use|are|were|sign|need|do)\b/)
        if (plural) add('P0', `${slabel}: a count of one reads "${plural[0]}"`)
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
            if (week2 && !waitsOnAnObject && !/Service provider users/.test(bodyText)) add('P0', `${slabel}: the partner answer (exclude service providers) is not on the policy's What to do`)
            if (week2 && !waitsOnAnObject && !/the baseline's version/.test(bodyText)) add('P0', `${slabel}: the service-provider exclusion is not shown beside the baseline's version`)
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
          // Separate admin accounts (E6): two demo admins read mail or join Teams on
          // their admin account; the step lists them, and the admin policy names them beside it.
          if (/^Use Separate Accounts for Admin Work$/.test(title)) {
            const named = (bodyText.match(/^.+ · (Outlook|Microsoft Teams)/gm) ?? []).length
            if (named < 2) add('P0', `${slabel}: the step lists ${named} admin(s) with mail or Teams sign-ins; the demo has two`)
            if (!/^Skip this step$/m.test(await evaluate(`[...document.querySelectorAll('main.page .step-body button')].map((b) => b.textContent.trim()).join('\\n')`))) add('P0', `${slabel}: the step is not skippable`)
          }
          if (/^Require Phishing-Resistant MFA for Admins$/.test(title) && !/see Use Separate Accounts for Admin Work/.test(bodyText)) add('P0', `${slabel}: the step assumes separate admin accounts instead of naming the people and the step`)
          // The lockout list (E8): the demo's admins not yet at Passkey or security
          // key, proven are named (three or fewer), and the line counts the names it lists.
          if (/^Require Phishing-Resistant MFA for Admins$/.test(title)) {
            const m = bodyText.match(/^(\d+) admins? (?:is|are) not yet at Passkey or security key, proven; register before .+:\s*$/m)
            if (!m) add('P0', `${slabel}: the step does not say how many admins are not yet at Passkey or security key, proven today`)
            else {
              const at = bodyText.indexOf(m[0])
              const names = bodyText.slice(at + m[0].length).split('\n').map((x) => x.trim()).filter(Boolean)
              const listed = names.findIndex((x) => /^(Roles held|Today:|No session control|\d+ of them|Contoso)/.test(x))
              const count = listed < 0 ? names.length : listed
              if (count !== Number(m[1])) add('P0', `${slabel}: the line says ${m[1]} admins and names ${count}`)
            }
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
            if (week2 && !waitsOnAnObject && !/Device platforms → Include: Any device; Exclude: Android, iOS/.test(bodyText)) add('P0', `${slabel}: the device decision (phones protected by their apps) did not scope phones out of the compliant-device policy`)
            if (week2 && !waitsOnAnObject && !/the baseline's version/.test(bodyText)) add('P0', `${slabel}: the platform deviation is not shown beside the baseline's version`)
            if (!week2 && /Device platforms/.test(bodyText)) add('P0', `${slabel}: a platform condition shows before the device decision`)
          }
          // The admin-sessions email says how long a session lasts (the merge
          // follow-up: {wantedLong} was unfilled, and the email vanished whole).
          if (/^Shorten Admin Sessions$/.test(title)) {
            if (!/expire after (\d+ hours|an hour|a day|a week|\d+ days) and never persist/.test(emailText)) add('P0', `${slabel}: the admin email does not say how long sessions last (expire after {wantedLong})`)
          }
          // One definition of enough (E7): the campaign email dates the MFA
          // enforcement day and the window; the managed-device email says what a
          // personal device can still do; step 12 asks for a passkey or a key.
          if (/MFA Registration Campaign/.test(title)) {
            if (!/over the next \d+ days/i.test(emailText)) add('P0', `${slabel}: the campaign email does not say the window in days (over the next {enrolWindowDays} days)`)
            // The email dates the enforcement it warns of: the MFA policy's day while
            // MFA is not yet in place; the first passkey policy's while one remains
            // (the passkey version names it; once none remains, nothing to date).
            const LONG = '(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (January|February|March|April|May|June|July|August|September|October|November|December) \\d{1,2}'
            const passkeyVersion = /You already confirm sign-ins/.test(emailText)
            if (!passkeyVersion && !new RegExp(`^From ${LONG}, signing in`, 'm').test(emailText)) add('P0', `${slabel}: the campaign email does not date the day Require MFA for Everyone enforces ({mfaEnforceLong})`)
            if (passkeyVersion && /requires a passkey/.test(emailText) && !new RegExp(`^From ${LONG}, .+ requires a passkey\\.$`, 'm').test(emailText)) add('P0', `${slabel}: the passkey email names a policy without its date`)
            if (!/passkey or a hardware security key/.test(bodyText)) add('P0', `${slabel}: the campaign asks admins for a key as well as a passkey; either is enough`)
            // Require MFA for Everyone is in place on the demo: the email is the
            // passkey version, and on day one it names the admins policy as the
            // first one that needs a passkey (enforced by week two, so no line then).
            if (!/You already confirm sign-ins/.test(emailText) || /will ask you to confirm with the Microsoft Authenticator app/.test(emailText)) add('P0', `${slabel}: Require MFA for Everyone is in place, and the campaign email is not the passkey version`)
            if (!week2 && !/Require Phishing-Resistant MFA for Admins requires a passkey/.test(emailText)) add('P0', `${slabel}: the passkey email does not name the first policy that needs a passkey`)
          }
          // A strength policy's row carries its lockout count in the who-column
          // when it is not zero, and the count is the step's own.
          if (/^Require Phishing-Resistant MFA for Admins$/.test(title)) {
            const m = bodyText.match(/^(\d+) admins? (?:is|are) not yet at Passkey or security key, proven/m)
            const who = await evaluate(`((document.querySelectorAll('main.page .plan-row')[${i}] || {}).querySelector ? (document.querySelectorAll('main.page .plan-row')[${i}].querySelector('.who') || {}).textContent || '' : '')`)
            const suffix = who.match(/· (\d+) not yet at Passkey or security key, proven$/)
            if (m && !suffix) add('P0', `${slabel}: ${m[1]} admins are not yet at rung 5 and the row's who-column does not say so`)
            else if (m && suffix && suffix[1] !== m[1]) add('P0', `${slabel}: the row says ${suffix[1]} not yet at rung 5 and the step says ${m[1]}`)
            else if (!m && suffix) add('P0', `${slabel}: the row carries a lockout count the step does not`)
          }
          if (/Require a Managed Device/.test(title) && !/Personal devices are blocked\./.test(emailText)) add('P0', `${slabel}: the managed-device email does not say what a personal device can do ({personalDevicesClause}; this baseline holds no unmanaged-browser policy, so they are blocked)`)
          if (/^Register Your Own Passkey$/.test(title) && !/or a hardware security key/.test(bodyText)) add('P0', `${slabel}: step 12 asks for a key and a passkey; either is enough`)
          // Small engine items (E9), on the demo: the admin-portals step names the
          // developer who opened the Azure portal; the service-accounts block is
          // a step naming the group and the trusted network; the manager's
          // "nobody here used it" clause is on the blocks nobody used and off the
          // one somebody did.
          if (/^Block the Admin Portals for Non-Admins$/.test(title) && !/^1 person without a directory role signed in to Azure since /m.test(bodyText)) add('P0', `${slabel}: the step does not name the person without a directory role who signed in to Azure`)
          if (/^Restrict Service Accounts to the Trusted Network$/.test(title)) {
            if (!waitsOnAnObject && !/Users → Include: Groups: \S/.test(bodyText)) add('P0', `${slabel}: the portal lines do not name the service-accounts group`)
            if (!waitsOnAnObject && !/Conditions → Locations → Include: Any location; Exclude: \S/.test(bodyText)) add('P0', `${slabel}: the portal lines do not exclude the trusted network`)
            if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(bodyText)) add('P0', `${slabel}: an object id on the step`)
          }
          if (/^Block (Device Code Sign-in|Authentication Transfer)$/.test(title)) {
            // More is closed at this point, so its innerText is empty: read textContent.
            const more = await evaluate(`(document.querySelector('main.page .step-body details.more') || {}).textContent || ''`)
            if (!/Nobody here used it since /.test(more)) add('P0', `${slabel}: nobody on the demo used this, and the manager line does not say so`)
          }
          if (/^Block Unsupported Device Platforms$/.test(title)) {
            // More is closed at this point, so its innerText is empty: read textContent.
            const more = await evaluate(`(document.querySelector('main.page .step-body details.more') || {}).textContent || ''`)
            if (/Nobody here/.test(more)) add('P0', `${slabel}: one demo sign-in carried no platform, and the manager line says nobody did`)
            if (!/carried no platform \(Outlook Mobile\)/.test(bodyText)) add('P0', `${slabel}: the step does not name the sign-in that carried no platform`)
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
          if (b.title !== title || b.lines.length === 0 || waitsOnAnObject) continue
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
      await ensureWeek2('plan')
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
        // A done step's row shows no date word: blank, never "now".
        const doneWhens = await evaluate(`[...document.querySelectorAll('main.page .plan-footer .plan-row')].filter((r) => /^(In place|Enforced)$/.test(((r.querySelector('.status') || {}).textContent || '').trim())).map((r) => ((r.querySelector('.when') || {}).textContent || '').trim())`)
        const dated = doneWhens.filter((w) => w !== '')
        if (dated.length > 0) add('P0', `${fx.name} @${width} /plan footer: ${dated.length} done row(s) carry a date word ("${dated[0]}"); a done row is blank`)
      }
      // A started plan (E5), on day one: Start the plan locks the dates; the
      // Start date field and its note go, and "started <date>" stands in their
      // place. The start persists into week two, as a started plan's does.
      if (fx.name === 'demo') {
        const slabel = `${fx.name} @${width} /plan started`
        const pressed = await clickText('button', /^Start the plan$/)
        if (!pressed) add('P0', `${slabel}: no Start the plan control`)
        else {
          // "started <date>" once, in the header line only.
          const started = await waitFor(`/started \\S.*\\d{4}/.test((document.querySelector('main.page') || {}).innerText || '')`, 8000)
          if (!started) add('P0', `${slabel}: the plan does not read started <date> after Start the plan`)
          const field = await evaluate(`document.querySelector('main.page label.rows input[type=date]') !== null`)
          if (field) add('P0', `${slabel}: the Start date field is still shown on a started plan`)
          const after = await mainText()
          if (/Starting locks the dates/.test(after) || /Clear the date to start/.test(after)) add('P0', `${slabel}: the start note is still shown on a started plan`)
          const times = (after.match(/started \S+ \d{1,2}, \d{4}/g) ?? []).length
          if (times !== 1) add('P0', `${slabel}: "started <date>" appears ${times} times; once, in the header line`)
          if (!/^\d+ steps · \d+ done · started \S+ \d{1,2}, \d{4}/m.test(after)) add('P0', `${slabel}: the header line does not carry the start`)
          checkText(slabel, after)
        }
      }
    }
  }
  for (const t of rowTitles) if (ABSENT_TITLES.has(t) || ABSENT_GOAL_NAMES.has(t)) add('P0', `${fx.name}: plan row "${t}" is a goal the baseline does not hold`)
  // The exclusions-group step is on every plan (In place in the footer, or Ready in
  // Preparation). On the demo it is Ready both days; week two's re-scan recognised the
  // group, so the step must check it rather than still offer the create instructions.
  if (fx.name.startsWith('demo') && !rowTitles.some((t) => /Exclusions Group/i.test(t))) add('P0', `${fx.name}: the exclusions-group step is missing; it is on every plan`)
  // Small engine items (E9): the unsupported-platforms block and the admin session
  // policy are held by no readiness threshold; the service-accounts block is a row.
  if (fx.name.startsWith('demo')) {
    // The when column was captured before the steps were opened; a decision made
    // on a step moves the rows under it, so the column is read by title, not index.
    const whenByTitle = Object.fromEntries(rowTitles.map((t, k) => [t, rowWhens[k] ?? '']))
    for (const [i, t] of rowTitlesOpen.entries()) {
      if (/^Block Unsupported Device Platforms$/.test(t) && /device readiness/i.test(`${rowReasonsOpen[i] ?? ''} ${whenByTitle[t] ?? ''}`)) add('P0', `${fx.name}: Block Unsupported Device Platforms is held by device readiness; it is a block, gated on its evidence`)
      if (/^Shorten Admin Sessions$/.test(t) && /admin readiness/i.test(`${rowReasonsOpen[i] ?? ''} ${whenByTitle[t] ?? ''}`)) add('P0', `${fx.name}: Shorten Admin Sessions is held by admin readiness; a shorter session locks nobody out`)
    }
    if (!rowTitles.some((t) => /^Restrict Service Accounts to the Trusted Network$/.test(t))) add('P0', `${fx.name}: the baseline's service-accounts block is not a row, although the demo has service accounts`)
  }
  // Separate admin accounts (E6): the demo's plan carries the step while an admin reads mail or joins Teams on the admin account.
  if (fx.name.startsWith('demo') && !rowTitles.some((t) => /^Use Separate Accounts for Admin Work$/.test(t))) add('P0', `${fx.name}: no Preparation row asks for separate admin accounts, although two admins use theirs for mail or Teams`)
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

// ---- the home page (docs/design/home-mockup.html) ----
//
// getiamai.com's front page, generated from pages.home by scripts/build-home.ts
// and assembled over the bundle by scripts/assemble-site.mjs, walked from the
// static server like the bundle: the hero (the headline and the site line), the
// Tools grid with the one card and every part the mockup gives it, How these
// work as two small cards, About with its three buttons, the app's footer, the
// header's text theme control in both themes, every string a content string,
// and nothing of the retired opener.
const HOME = pages.home
const HOME_SHELL = pages.app.shell
const HOME_FOOTER = pages.footer.links
const WEIGHT = `(b) => /btn-primary/.test(b.className) ? 'primary' : /btn-secondary/.test(b.className) ? 'secondary' : /btn-tertiary/.test(b.className) ? 'tertiary' : 'none'`
const homeLeaves = (node, out = [], key = '') => {
  if (typeof node === 'string') {
    if (key !== 'href') out.push(node)
  } else if (Array.isArray(node)) node.forEach((v) => homeLeaves(v, out, key))
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) homeLeaves(v, out, k)
  return out
}
async function walkHome(url) {
  const label = 'home @1280 /'
  const wdir = join(OUT, 'home', '1280')
  mkdirSync(wdir, { recursive: true })
  await setWidth(1280)
  await send('Page.navigate', { url })
  await sleep(600)
  await settle()
  const text = await mainText()
  writeFileSync(join(wdir, 'home.txt'), text)
  await shot(join(wdir, 'home.png'))
  checkText(label, text)
  const pageText = await evaluate(`document.body.innerText.replace(/\\s+/g, ' ')`)
  for (const s of RETIRED_OPENER) if (pageText.includes(s)) add('P0', `${label}: the retired opener still renders: "${s.slice(0, 60)}"`)
  if (/Built for/.test(pageText)) add('P0', `${label}: a Built for block renders; the site line carries the audience`)
  // The hero: the headline and the site line.
  const hero = await evaluate(`(() => { const h = document.querySelector('main.page .hero'); return h ? { h1: ((h.querySelector('h1') || {}).textContent || '').trim(), line: ((h.querySelector('p.site-line') || {}).textContent || '').replace(/\\s+/g, ' ').trim() } : null })()`)
  if (!hero) add('P0', `${label}: no hero`)
  else {
    if (hero.h1 !== HOME.h1) add('P0', `${label}: the headline reads "${hero.h1}"; ${HOME.h1}`)
    if (hero.line !== HOME.siteLine) add('P0', `${label}: the site line reads "${hero.line}"; ${HOME.siteLine}`)
  }
  // The section labels, in order.
  const sections = await evaluate(`[...document.querySelectorAll('main.page h2.section')].map((h) => (h.textContent || '').trim())`)
  const wantSections = [HOME.toolsLabel, HOME.howLabel, HOME.aboutLabel]
  if (sections.join(' · ') !== wantSections.join(' · ')) add('P0', `${label}: the sections read ${sections.join(' · ')}; ${wantSections.join(' · ')}`)
  // The Tools grid: one card per tool (one column with one tool, two from the
  // second), the card being the name and its pill, the tag line, Reads /
  // Compares / Writes, What it catches closed, Open (primary), Try it with
  // sample data (secondary), and the meta line with its read-the-code link.
  const grid = await evaluate(`(() => { const g = document.querySelector('main.page .grid.tools'); if (!g) return null; const w = ${WEIGHT}; const tx = (e) => ((e || {}).textContent || '').replace(/\\s+/g, ' ').trim(); return { two: g.classList.contains('two'), cards: [...g.querySelectorAll('section.card.tool')].map((c) => ({ name: tx((c.querySelector('h3.tool-name') || {}).firstChild), pill: tx(c.querySelector('h3 .pill')), tag: tx(c.querySelector('p.tag')), beats: [...c.querySelectorAll('ul.beats li')].map((l) => ({ verb: tx(l.querySelector('b')), text: tx(l).slice(tx(l.querySelector('b')).length).trim() })), details: (() => { const d = c.querySelector('details.catches'); return d ? { open: d.open, summary: tx(d.querySelector('summary')), items: [...d.querySelectorAll('ul.catch li')].map(tx), shown: [...d.querySelectorAll('ul.catch li')].some((l) => l.checkVisibility()) } : null })(), buttons: [...c.querySelectorAll('.actions a.btn')].map((b) => ({ t: tx(b), w: w(b), href: b.getAttribute('href') })), meta: (() => { const m = c.querySelector('p.meta'); return m ? { text: tx(m), link: m.querySelector('a') ? { t: tx(m.querySelector('a')), href: m.querySelector('a').getAttribute('href') } : null } : null })() })) } })()`)
  if (!grid) add('P0', `${label}: no Tools grid`)
  else {
    if (grid.cards.length < 1) add('P0', `${label}: the Tools grid has no card`)
    if (grid.two !== grid.cards.length > 1) add('P0', `${label}: the Tools grid is ${grid.two ? 'two columns' : 'one column'} with ${grid.cards.length} tool(s); one column with one tool, two from the second`)
    const pl = HOME.planner
    const card = grid.cards[0]
    if (card) {
      if (card.name !== pl.name) add('P0', `${label}: the card is named "${card.name}"; ${pl.name}`)
      if (card.pill !== pl.label) add('P0', `${label}: the card's pill reads "${card.pill}"; ${pl.label}`)
      if (card.tag !== pl.descriptor) add('P0', `${label}: the card's tag line reads "${card.tag}"; ${pl.descriptor}`)
      const wantBeats = pl.beats.map((b) => `${b.verb} ${b.text}`)
      const gotBeats = card.beats.map((b) => `${b.verb} ${b.text}`)
      if (gotBeats.join('|') !== wantBeats.join('|')) add('P0', `${label}: the card's beats read ${gotBeats.map((b) => b.split(' ')[0]).join(' / ') || 'nothing'}; Reads / Compares / Writes, from pages.home.planner.beats`)
      if (!card.details) add('P0', `${label}: the card has no What it catches collapsible`)
      else {
        if (card.details.summary !== pl.catchesLabel) add('P0', `${label}: the collapsible is labelled "${card.details.summary}"; ${pl.catchesLabel}`)
        if (card.details.open || card.details.shown) add('P0', `${label}: What it catches is open on arrival; closed until opened`)
        if (card.details.items.join('|') !== pl.catches.join('|')) add('P0', `${label}: What it catches lists ${card.details.items.length} item(s) that differ from pages.home.planner.catches`)
        await clickText('details.catches summary', /./, 'main.page')
        await sleep(200)
        const shown = await evaluate(`[...document.querySelectorAll('main.page details.catches ul.catch li')].every((l) => l.checkVisibility())`)
        if (!shown) add('P0', `${label}: What it catches does not open on its summary`)
        await shot(join(wdir, 'home-catches.png'))
        await clickText('details.catches summary', /./, 'main.page')
      }
      const wantButtons = [{ t: pl.open, w: 'primary', href: '/rollout/#/connect' }, { t: pl.demo, w: 'secondary', href: '/rollout/?demo=1#/plan' }]
      if (JSON.stringify(card.buttons) !== JSON.stringify(wantButtons)) add('P0', `${label}: the card's buttons are ${card.buttons.map((b) => `${b.t} (${b.w}, ${b.href})`).join(', ') || 'missing'}; ${wantButtons.map((b) => `${b.t} (${b.w}, ${b.href})`).join(', ')}`)
      const wantMeta = `${pl.meta.baseline} · ${pl.meta.role} · ${pl.meta.code}`
      if (!card.meta) add('P0', `${label}: the card has no meta line`)
      else {
        if (card.meta.text !== wantMeta) add('P0', `${label}: the meta line reads "${card.meta.text}"; ${wantMeta}`)
        if (!card.meta.link || card.meta.link.t !== pl.meta.code || card.meta.link.href !== pl.meta.href) add('P0', `${label}: the meta line's read-the-code link is missing or points elsewhere`)
      }
    }
  }
  // How these work: two small cards, the second linking to the source.
  const how = await evaluate(`[...document.querySelectorAll('main.page .grid[aria-labelledby="how-heading"] section.card.small')].map((c) => ({ title: ((c.querySelector('h3') || {}).textContent || '').trim(), body: ((c.querySelector('p') || {}).textContent || '').replace(/\\s+/g, ' ').trim(), link: c.querySelector('a.lnk') ? { t: (c.querySelector('a.lnk').textContent || '').trim(), href: c.querySelector('a.lnk').getAttribute('href') } : null, two: !!c.closest('.grid.two') }))`)
  if (how.length !== HOME.how.length || how.length !== 2) add('P0', `${label}: How these work renders ${how.length} card(s); two`)
  HOME.how.forEach((c, i) => {
    const got = how[i]
    if (!got) return
    if (got.title !== c.title) add('P0', `${label}: How card ${i + 1} is titled "${got.title}"; ${c.title}`)
    if (!got.body.startsWith(c.body)) add('P0', `${label}: How card ${i + 1} reads "${got.body.slice(0, 60)}"; ${c.body.slice(0, 60)}`)
    if (c.link && (!got.link || got.link.t !== c.link || got.link.href !== c.href)) add('P0', `${label}: How card ${i + 1} lacks its source link`)
    if (!got.two) add('P0', `${label}: How card ${i + 1} is not in the two-column grid`)
  })
  // About: the paragraph and its three buttons, secondary then tertiary.
  const about = await evaluate(`(() => { const s = document.querySelector('main.page section.card.about'); if (!s) return null; const w = ${WEIGHT}; return { body: ((s.querySelector('p') || {}).textContent || '').replace(/\\s+/g, ' ').trim(), buttons: [...s.querySelectorAll('.actions a.btn')].map((b) => ({ t: (b.textContent || '').trim(), w: w(b), href: b.getAttribute('href') })) } })()`)
  if (!about) add('P0', `${label}: no About card`)
  else {
    if (about.body !== HOME.about) add('P0', `${label}: About reads "${about.body.slice(0, 60)}"; pages.home.about`)
    const wantAbout = HOME.aboutLinks.map((l, i) => ({ t: l.text, w: i === 0 ? 'secondary' : 'tertiary', href: l.href }))
    if (about.buttons.length !== 3 || JSON.stringify(about.buttons) !== JSON.stringify(wantAbout)) add('P0', `${label}: About's buttons are ${about.buttons.map((b) => `${b.t} (${b.w})`).join(', ') || 'missing'}; ${wantAbout.map((b) => `${b.t} (${b.w})`).join(', ')}`)
  }
  // The footer is the app's: pages.footer's links, joined with a bar.
  const footer = await evaluate(`(() => { const f = document.querySelector('footer.app'); return f ? { text: (f.innerText || '').replace(/\\s+/g, ' ').trim(), links: [...f.querySelectorAll('a')].map((a) => ({ text: (a.textContent || '').trim(), href: a.getAttribute('href') })) } : null })()`)
  if (!footer) add('P0', `${label}: no footer`)
  else {
    if (footer.text !== HOME_FOOTER.map((l) => l.text).join(' | ')) add('P0', `${label}: the footer reads "${footer.text}"; the app's ${HOME_FOOTER.map((l) => l.text).join(' | ')}`)
    if (JSON.stringify(footer.links) !== JSON.stringify(HOME_FOOTER)) add('P0', `${label}: the footer's links differ from pages.footer`)
  }
  // The header: the brand, and the theme control as text (no button face), in both themes.
  const brand = await evaluate(`(() => { const a = document.querySelector('header.app a.wordmark'); return a ? { t: (a.textContent || '').trim(), href: a.getAttribute('href') } : null })()`)
  if (!brand || brand.t !== HOME.brand || brand.href !== '/') add('P0', `${label}: the wordmark is ${brand ? `"${brand.t}" → ${brand.href}` : 'missing'}; ${HOME.brand} → /`)
  const faces = await evaluate(`[...document.querySelectorAll('header.app .right button')].map((b) => { const cs = getComputedStyle(b); return { t: (b.textContent || '').trim(), border: cs.borderTopWidth, bg: cs.backgroundColor, pad: cs.paddingLeft } })`)
  if (!faces.some((f) => f.t === HOME_SHELL.darkTheme || f.t === HOME_SHELL.lightTheme)) add('P0', `${label}: no theme control in the header with the app's labels`)
  for (const f of faces) if (f.border !== '0px' || !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(f.bg) || f.pad !== '0px') add('P0', `${label}: the header's ${f.t} control has a button face (border ${f.border}, background ${f.bg}, padding ${f.pad}); text`)
  const paint = () => evaluate(`(() => { const c = document.querySelector('main.page section.card.tool'); const b = document.querySelector('main.page a.btn-primary'); return { theme: document.documentElement.getAttribute('data-theme'), label: (document.getElementById('theme') || {}).textContent, page: getComputedStyle(document.body).backgroundColor, card: c ? getComputedStyle(c).backgroundColor : null, primary: b ? getComputedStyle(b).backgroundColor : null } })()`)
  const before = await paint()
  await evaluate(`document.getElementById('theme').click()`)
  await sleep(200)
  const after = await paint()
  await shot(join(wdir, `home-${after.theme ?? 'toggled'}.png`))
  await evaluate(`document.getElementById('theme').click()`)
  await sleep(200)
  const back = await paint()
  if (!after.theme || after.theme === before.theme) add('P0', `${label}: the theme control does not switch the theme (data-theme ${before.theme} → ${after.theme})`)
  if (before.page === after.page || before.card === after.card) add('P0', `${label}: the page and the card do not repaint between light and dark (page ${before.page} → ${after.page}, card ${before.card} → ${after.card})`)
  if (/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(String(after.card)) || /^rgba\(0, 0, 0, 0\)$|^transparent$/.test(String(before.card))) add('P0', `${label}: the card has no raised background in one theme`)
  if (!after.primary || after.primary === 'rgba(0, 0, 0, 0)') add('P0', `${label}: the primary button has no fill`)
  if (before.label === after.label || after.label !== (after.theme === 'dark' ? HOME_SHELL.lightTheme : HOME_SHELL.darkTheme)) add('P0', `${label}: the theme control's label reads "${after.label}" in the ${after.theme} theme`)
  if (back.theme === after.theme) add('P0', `${label}: the theme control does not switch back`)
  // Every string on the page is a content string: pages.home, the app's footer, the theme labels.
  const allowed = new Set([...homeLeaves(HOME), ...HOME_FOOTER.map((l) => l.text), HOME_SHELL.darkTheme, HOME_SHELL.lightTheme])
  const shown = await evaluate(`(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.parentElement && n.parentElement.closest('script, style')) continue; const t = (n.textContent || '').replace(/\\s+/g, ' ').trim(); if (t && t !== '·' && t !== '|') out.push(t) } return out })()`)
  const strays = shown.filter((s) => !allowed.has(s))
  if (strays.length > 0) add('P0', `${label}: string(s) on the page that are not in content.json: ${strays.map((s) => `"${s.slice(0, 40)}"`).join(', ')}`)
  for (const s of homeLeaves(HOME)) if (!shown.includes(s) && s !== HOME.metaTitle && s !== HOME.metaDescription) add('P0', `${label}: pages.home string not on the page: "${s.slice(0, 60)}"`)
  return [{ width: 1280, route: '', words: text.split(/\s+/).filter(Boolean).length, rows: grid ? grid.cards.length : 0 }]
}
let homeSummary = null

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
    // The demo chunk loads in demo mode and nowhere else, in the production
    // bundle too: the signed-out app fetches no demo-*.js; the demo just did.
    const demoChunkInDemo = await evaluate(`performance.getEntriesByType('resource').some((e) => /\\/assets\\/demo-[^/]*\\.js/.test(e.name))`)
    if (!demoChunkInDemo) add('P0', 'production bundle, demo: the demo chunk (demo-*.js) did not load in demo mode')
    await send('Page.navigate', { url: `http://localhost:${STATIC_PORT}/rollout/#/connect` })
    await waitFor(`document.querySelectorAll('main.page section.step-tile').length === 4`, 30000)
    const demoChunkSignedOut = await evaluate(`performance.getEntriesByType('resource').filter((e) => /\\/assets\\/demo(Facts)?-[^/]*\\.js/.test(e.name)).map((e) => e.name.split('/').pop())`)
    if (demoChunkSignedOut.length > 0) add('P0', `production bundle, signed out: the demo chunk loaded outside demo mode (${demoChunkSignedOut.join(', ')})`)
    // The home page, assembled over this bundle (dist/index.html) and served from the same root.
    try {
      execSync('node scripts/assemble-site.mjs', { stdio: 'ignore', env: { ...process.env, TOOL_PATH: 'rollout' } })
    } catch {
      /* reported below */
    }
    if (!existsSync('dist/index.html')) add('P2', 'home: the site could not be assembled here (scripts/assemble-site.mjs), so the home page was not walked')
    else {
      log('walking home')
      homeSummary = await walkHome(`http://localhost:${STATIC_PORT}/`)
    }
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
  // The mock tenant's Connect refusals: a token without the roles (the scan does
  // not start), a scan that could not read the policies or the sign-in records
  // (finished with gaps; the last good plan kept), and a licence without sign-in
  // records (the scan line says so). Dev-only, on the dev server the walk runs.
  { name: 'mock-roles', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&roles=none`, routes: ['connect'], mock: 'roles' },
  { name: 'mock-gaps', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&state=gaps`, routes: ['connect'], mock: 'gaps' },
  { name: 'mock-free', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&licence=free`, routes: ['connect'], mock: 'free' },
  { name: 'mock-scanning', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&state=scanning`, routes: ['connect'], mock: 'scanning' },
  { name: 'mock-ready', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&state=noScan`, routes: ['connect'], mock: 'ready' },
  // A surface that throws while drawing: the error page (pages.app.error).
  { name: 'mock-crash', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&crash=1`, routes: ['error'], mock: 'crash' },
  // The signed-in account with a stale directory sign-in: never dormant, never Not active.
  { name: 'mock-operator', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&operatorDormant=1`, routes: ['today', 'plan'], mock: 'operator' },
  // A scan that read a third of the people and policies the previous one did.
  // The demo with an author update over the pinned package: the review rows.
  // Named mock-, not demo-: the demo's plan checks key on the demo- prefix, and this fixture walks Connect alone.
  { name: 'mock-author', base: `http://localhost:${PORT}/rollout/?demo=1&author=1`, routes: ['connect'], mock: 'author' },
  // The same page before sign-in, and tile 1 after a sign-in that did not succeed.
  { name: 'mock-signedout', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&state=signedOut`, routes: ['connect'], mock: 'signedOut' },
  { name: 'mock-auth-consent', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&state=signedOut&auth=consent`, routes: ['connect'], mock: 'consent' },
  { name: 'mock-auth-personal', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&state=signedOut&auth=personal`, routes: ['connect'], mock: 'personal' },
  { name: 'mock-auth-cancelled', base: `http://localhost:${PORT}/rollout/?dev=1&mock=1&state=signedOut&auth=cancelled`, routes: ['connect'], mock: 'cancelled' },
]
const summaries = {}
for (const fx of fixtures) {
  log(`walking ${fx.name}`)
  currentFixture = fx.name
  summaries[fx.name] = await walkFixture(fx)
}
if (homeSummary) summaries.home = homeSummary
const planFile = scanPlanFile()

// The content file's own invariants (step-audit.md; scripts/walkContent.mjs runs
// them alone over any content file), and every Learn link the content carries,
// rendered on the demo or not.
const contentFile = JSON.parse(readFileSync('docs/design/content.json', 'utf8'))
const pinnedFile = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.pinned.json', 'utf8'))
for (const f of contentFindings(contentFile, pinnedFile, contracts)) add(f.level, f.text)
for (const href of contentLearnUrls(contentFile)) learnLinks.add(href)

// The pluraliser conjugates the verb with the count wherever {n} precedes a verb
// (step 15's Who line is the test): a count of one reads as one, noun and verb.
for (const [line, vals, want] of [
  [stepById['admins-phishing-resistant']?.who?.lead, { admins: 1 }, '1 person holds an admin role'],
  [stepById['admins-phishing-resistant']?.who?.lead, { admins: 3 }, '3 people hold an admin role'],
  [stepById['s-check-separate-admin-accounts']?.who?.lead, { n: 1, from: 'Aug 1' }, '1 person holds a directory role and uses that same account for mail or Teams since Aug 1:'],
  ['{n} of them have no passkey or key yet.', { n: 1 }, '1 of them has no passkey or key yet.'],
]) {
  const got = typeof line === 'string' ? fillText(line, vals) : null
  if (got !== want) add('P0', `pluraliser: "${line}" with ${JSON.stringify(vals)} reads "${got}", not "${want}"`)
}

// The before lines exist in the content for every step that carries one (the
// step check above needs the row on the plan; this fails on the content alone).
for (const b of BEFORE_LINES) if (b.lines.length === 0) add('P0', `content ${b.id}: no whatToDo.before line; the setting to change before the policy exists is not above its portal lines`)

// Cross-surface invariants.
for (const [name, readiness] of readinessBy) for (const [kind, values] of readiness) if (values.size > 1) add('P0', `${name}: ${kind} readiness reads ${[...values].map((v) => `${v}%`).join(' and ')} across rows, steps and Today (one readiness per kind)`)
for (const [name, populations] of populationsBy) if (populations.size > 1) add('P0', `${name}: the active-people count reads ${[...populations].join(' and ')} across surfaces (one population)`)
// The mock-crash fixture throws on purpose (React logs what the boundary caught); every other console error is a finding.
for (const e of consoleErrors.filter((x) => !/favicon|microsoftonline|net::|ERR_|mock crash \(\?crash=1\)/.test(x))) add('P0', `demo: console error: ${e.slice(0, 160)}`)

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
