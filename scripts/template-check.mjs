// The step template check: every step from 1.1 through 5.1 (Register Security
// Info Protected, s-goal-register-info-protected) read against the template the
// owner set on 1.1–1.4 (docs/plans/roadmap-flow/step-template.md), on the demo
// tenant's Initial and Follow-up scans at 1440px.
//
//   npm run template:check                (from any worktree's root)
//   node scripts/template-check.mjs [--reuse]
//
// It builds the smoke's bundle (scripts/smokeBuild.ts) and serves it with vite
// preview, as scripts/smoke.mjs does, on its own ports (TEMPLATE_PORT, default
// 5197; TEMPLATE_CDP_PORT, default 9447) so it can run beside a smoke. --reuse
// serves the bundle an earlier run left in dist-smoke/<port>/ instead of
// building. CHROME=/path/to/chrome overrides the browser.
//
// It checks what the template makes mechanically checkable and nothing else:
// the frame (eyebrow, no caption, the rail and its surface, the milestone in
// words, the divider, the instruction once before the controls, no control in
// the main column, the sections in order in one heading style, the footer strip
// with the Scan and no Close) and the content (no inline Learn in About, a
// Completed step's Tasks Remaining and Implementation Tasks, Satisfied cards,
// the tab set, Source checked beside Learn, Completion Criteria's length, the
// row's Impact as a count, and the strings no step may carry). Every task in
// the task selector is read on every tab.
//
// It prints one line per deviation, "<number> <step id> | <rule> | <what it
// found>", a deviation seen on both scans once with both scans named, then a
// count per step. A rule marked "(owner to judge)" is a difference the template
// leaves to the owner (a tab beyond Entra and AI Info, a control in the footer
// beside the Scan), not a failure. It exits 0 always: a report, not a gate.
// scripts/smoke.mjs keeps its own 1.1–1.4 check, which is the gate.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { STEP_GROUPS } from '../src/roadmap/stepGroups.ts'
import { CDP_DEADLINE_MS, withDeadline } from './smokeEvidence.mjs'
import { SMOKE_MODE, smokeOutDir } from './smokeBuild.ts'

// ---- what is checked ----

/** The last step checked: 5.1. */
const LAST_STEP = 's-goal-register-info-protected'
/** The reference step: every other step's rail surface, divider and heading style is compared with it. */
const REFERENCE_STEP = 's-prereq-break-glass'
/** Every step in the Plan's section order (stepGroups.ts) up to and including LAST_STEP. */
const TARGETS = (() => {
  const out = []
  for (const g of STEP_GROUPS) {
    for (const id of g.members) {
      out.push({ id, anatomy: g.anatomy })
      if (id === LAST_STEP) return out
    }
  }
  return out
})()

const SECTIONS = {
  task: ['About this Step', 'Tasks Remaining', 'Implementation Tasks', 'Completion Criteria'],
  decision: ['About this Step', 'Questions', 'Completion Criteria'],
}
const SCAN_NOTE = 'After making changes, select Scan to update the plan.'
const TABS = ['Entra', 'AI Info']
// A day in any form the tool prints one: "Oct 15", "Oct 15, 2026", "2026-10-15".
const DATE = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}\b|\b\d{4}-\d{2}-\d{2}\b/
const LANE_WORDS = /^(Ready|Up Next|On Hold|Deferred|Completed|Blocked|Needs decision)\b/
const NO_OP = [/no change (is )?needed/i, /\bno new\b[^.]{0,60}\bis needed\b/i, /\bscan again\b[^.]{0,60}\bto verify\b/i, /no save needed/i]
const SATISFIED_BANNED = [/no change needed/i, /not reviewed yet/i, /\bto review\b/i]
// The strings no step may carry (template rule 12). The phrases are matched in
// any case; the workflow-check labels as labels, capitalised, so prose such as
// "record the outcome" is not taken for the Outcome field.
const BANNED = [
  ['could not', /\bcould(?: not|n['’]t)\b/i],
  ['cannot be worked out', /\bcannot be worked out\b/i],
  ['not established', /\bnot established\b/i],
  ['none found', /\bnone found\b/i],
  ['Waiting on you to confirm', /\bwaiting on you to confirm\b/i],
  ['Workflow Check', /\bWorkflow Check\b/],
  ['Outcome', /\bOutcome\b/],
  ['Tested On', /\bTested On\b/],
  ['Save Check', /\bSave Check\b/],
  ['Reviewed Accounts', /\bReviewed Accounts\b/],
  ['Answered in', /\banswered in\b/i],
]

// ---- the harness: the smoke's own (scripts/smoke.mjs), on this script's ports ----

const PORT = Number(process.env.TEMPLATE_PORT ?? 5197)
const CDP_PORT = Number(process.env.TEMPLATE_CDP_PORT ?? 9447)
const BASE = `http://localhost:${PORT}/?dev=1&mock=1`
const REUSE = process.argv.includes('--reuse')
const CHROME = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((p) => existsSync(p))

/** A harness failure: no report was made. Still exit 0 (a report, not a gate), but say so plainly. */
const noReport = (why, said = '') => {
  console.error(`template-check: harness — ${why}. NO REPORT.`)
  if (said) console.error(said)
  process.exit(0)
}
if (!CHROME) noReport('no Chrome binary found; set CHROME=/path/to/chrome')

const tailOf = (limit = 40) => {
  const lines = []
  return {
    push: (chunk) => {
      for (const l of String(chunk).split('\n')) if (l.trim()) lines.push(l.trimEnd())
      while (lines.length > limit) lines.shift()
    },
    text: () => lines.join('\n'),
  }
}

const childEnv = { ...process.env, SMOKE_PORT: String(PORT) }
delete childEnv.VITE_BASE
delete childEnv.BASE_PATH
if (!REUSE || !existsSync(`${smokeOutDir(PORT)}/index.html`)) {
  console.error(`template-check: building the smoke bundle into ${smokeOutDir(PORT)}`)
  const built = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', SMOKE_MODE, '--logLevel', 'warn'], { encoding: 'utf8', env: childEnv })
  if (built.status !== 0) noReport(`the build failed (${built.error?.message ?? `exit ${built.status}`})`, `${built.stdout ?? ''}${built.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n'))
}
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--mode', SMOKE_MODE, '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], env: childEnv })
const viteOut = tailOf()
vite.stdout?.on('data', (d) => viteOut.push(d))
vite.stderr?.on('data', (d) => viteOut.push(d))
let chrome = null
const stopAll = () => {
  chrome?.kill()
  vite.kill()
}
let up = false
for (let i = 0; i < 100 && !up; i++) {
  try {
    up = (await fetch(`http://localhost:${PORT}/`)).ok
  } catch {
    await sleep(200)
  }
}
if (!up) {
  stopAll()
  noReport(`the preview server did not start on port ${PORT} within 20 s`, viteOut.text())
}

const profile = `${process.env.TMPDIR ?? process.env.TEMP ?? '/tmp'}/iamai-template-profile-${PORT}`
rmSync(profile, { recursive: true, force: true })
chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${profile}`,
  `--remote-debugging-port=${CDP_PORT}`, '--window-size=1440,1000', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })
const chromeErr = tailOf()
chrome.stderr?.on('data', (d) => chromeErr.push(d))
let targets = []
for (let i = 0; i < 300 && targets.length === 0; i++) {
  try {
    targets = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json()
  } catch {
    await sleep(200)
  }
}
const pageTarget = targets.find((t) => t.type === 'page')
if (!pageTarget) {
  stopAll()
  noReport('Chrome exposed no page target within 60 s', chromeErr.text())
}
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let msgId = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
}
const send = (method, params = {}) => {
  const i = ++msgId
  const answer = new Promise((res) => {
    pending.set(i, res)
    ws.send(JSON.stringify({ id: i, method, params }))
  })
  return withDeadline(answer, CDP_DEADLINE_MS, `DevTools ${method}`).finally(() => pending.delete(i))
}
const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
  return r.result.result.value
}
/** A page-side function called with JSON arguments: its source goes over as written, so no regex loses a backslash in a template literal. */
const call = (fn, ...args) => evaluate(`(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(', ')})`)
const waitFor = async (expr, ms = 15000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    let hit = false
    try {
      hit = (await evaluate(expr)) === true
    } catch {
      hit = false
    }
    if (hit) return true
    await sleep(100)
  }
  return false
}

// ---- page-side readers (serialised by `call`; they run in the page) ----

/** Every row on the board: its `<section>.<row>` number, lane and Impact. */
function readBoard() {
  const out = {}
  for (const g of document.querySelectorAll('main.page .plan-group')) {
    const section = ((g.querySelector('h2 .plan-group-number') || {}).textContent || '').trim()
    for (const r of g.querySelectorAll('.plan-row')) {
      const id = r.dataset.step
      if (!id || out[id]) continue
      const n = ((r.querySelector('.plan-row-number') || {}).textContent || '').trim()
      out[id] = {
        number: section && n ? `${section}.${n}` : '?',
        lane: ((r.querySelector('.lane') || {}).textContent || '').trim(),
        who: r.querySelector('.who') ? r.querySelector('.who').textContent.trim() : null,
      }
    }
  }
  return out
}

/** One opened step, read whole: frame, sections, controls, and every task on every tab. */
async function readStep(id) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim()
  // Text with a space at every element boundary (a <wbr> joins), so a label and
  // the option under it never run together into one word.
  const spaced = (el) => {
    let s = ''
    for (const n of el.childNodes) {
      if (n.nodeType === 3) s += n.textContent
      else if (n.nodeType === 1 && n.tagName !== 'WBR' && n.tagName !== 'svg' && !(n.tagName === 'DIALOG' && !n.open)) s += ` ${spaced(n)} `
    }
    return s
  }
  const text = (el) => (el ? norm(spaced(el)) : '')
  const st = document.querySelector(`main.page .step[data-step-id="${id}"]`)
  if (!st) return { missing: 'the step did not open' }
  const body = st.querySelector(':scope > .step-body')
  const head = st.querySelector(':scope > .step-head')
  const rowEl = document.querySelector(`main.page .plan-row[data-step="${id}"]`)
  const out = { rowText: text(rowEl) }

  // Header: the eyebrow, the title, the badge; nothing else.
  const lead = head ? head.querySelector('.step-head-lead') : null
  out.eyebrow = norm((head && head.querySelector('.eyebrow') || {}).textContent)
  out.headExtra = []
  if (lead) for (const c of lead.children) if (!c.classList.contains('eyebrow') && !c.matches('h3.step-title')) out.headExtra.push(`${c.tagName.toLowerCase()}.${c.className} "${text(c).slice(0, 80)}"`)
  if (head) for (const c of head.children) if (!c.classList.contains('step-head-top')) out.headExtra.push(`${c.tagName.toLowerCase()}.${c.className} "${text(c).slice(0, 80)}"`)

  // The rail.
  const rail = body ? body.querySelector(':scope > .step-action-column') : null
  out.rail = null
  if (rail) {
    const rs = getComputedStyle(rail)
    const block = rail.querySelector(':scope > .side-block')
    const bs = block ? getComputedStyle(block) : null
    const metric = block ? block.querySelector('.metric') : null
    const r = rail.getBoundingClientRect()
    const b = body.getBoundingClientRect()
    const controlSel = 'select, input, textarea, button, [role=combobox], .picker, details'
    const controls = [...rail.querySelectorAll(controlSel)].filter((el) => !el.parentElement.closest('.picker, details'))
    const instr = [...rail.querySelectorAll('.rail-instruction')]
    const first = controls[0] || null
    out.rail = {
      bg: rs.backgroundColor,
      rule: `${rs.borderLeftWidth} ${rs.borderLeftStyle} ${rs.borderLeftColor}`,
      fills: Math.abs(r.top - b.top) <= 1 && Math.abs(r.bottom - b.bottom) <= 1,
      height: `${Math.round(r.height)} of ${Math.round(b.height)}px`,
      firstIsBlock: rail.firstElementChild === block,
      label: norm((block && block.querySelector('.key-label') || {}).textContent),
      headline: metric ? norm(metric.textContent) : null,
      headlineType: metric ? `${getComputedStyle(metric).fontSize} ${getComputedStyle(metric).fontWeight}` : null,
      bar: bs ? `${bs.borderBottomWidth} ${bs.borderBottomStyle} ${bs.borderBottomColor}` : null,
      controls: controls.length,
      // Where the step takes a choice: a decision in the rail with a control in
      // it (the smoke's reading of the 1.1–1.4 template). An Answered-in block
      // carries a link, not a choice; a fold such as 1.3's is not a choice either.
      choices: [...rail.querySelectorAll('.decision')].filter((d) => !d.closest('.answered-in-direction') && d.querySelector('select, input, textarea, button, [role=combobox], .picker')).length,
      instr: instr.map((x) => norm(x.textContent)),
      instrAfterBlock: instr.length > 0 && !!block && block.nextElementSibling === instr[0],
      instrBeforeControls: instr.length > 0 && (!first || !!(instr[0].compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING)),
      otherLines: [...rail.querySelectorAll('.reason')].filter((x) => !x.classList.contains('rail-instruction') && !x.closest('.answered-in-direction') && norm(x.textContent) !== '').map((x) => norm(x.textContent)),
    }
    out.instrOccurrences = out.rail.instr.length === 1 ? norm(st.textContent).split(out.rail.instr[0]).length - 1 : 0
  }

  // The main column: its sections, in DOM order, and their heading style.
  const mains = body ? [...body.querySelectorAll(':scope > .step-main')] : []
  const sections = mains.flatMap((m) => [...m.children])
  const h4Style = (h) => {
    const s = getComputedStyle(h)
    return `${s.fontSize} ${s.fontWeight} ${s.textTransform} ${s.letterSpacing} ${s.color}`
  }
  out.heads = []
  out.foldBeforeCriteria = []
  let seenCriteria = false
  for (const s of sections) {
    const h = s.querySelector(':scope > h4')
    if (h) {
      out.heads.push({ text: norm(h.textContent), style: h4Style(h) })
      if (norm(h.textContent) === 'Completion Criteria') seenCriteria = true
    } else if (s.tagName === 'DETAILS' && !seenCriteria) out.foldBeforeCriteria.push(norm((s.querySelector(':scope > summary') || {}).textContent))
  }
  const sectionNamed = (name) => sections.find((s) => norm((s.querySelector(':scope > h4') || {}).textContent) === name) || null
  const whereIn = (el) => {
    const s = sections.find((x) => x.contains(el))
    if (!s) return 'main column'
    const h = s.querySelector(':scope > h4, :scope > summary')
    return h ? norm(h.textContent) : 'main column'
  }

  // Interactive controls in the main column, less the ones the template keeps
  // there: the Implementation tabs, the task selector, the copy and open
  // buttons, the support line's links, and a fold's summary.
  const allowed = (el) =>
    (el.getAttribute('role') === 'tab' && !!el.closest('.implementation-section .impl-tabs')) ||
    (el.tagName === 'SELECT' && !!el.closest('.implementation-section .emergency-task-toolbar')) ||
    (el.classList.contains('icon-btn') && !!el.closest('.implementation-section') && /copy|expand|open/i.test(`${el.title} ${el.getAttribute('aria-label') || ''}`)) ||
    (el.tagName === 'BUTTON' && !!el.closest('.implementation-section .impl-support'))
  out.mainControls = []
  for (const m of mains) {
    for (const el of m.querySelectorAll('select, input, textarea, button, [role=combobox], .picker, [contenteditable=true]')) {
      if (el.parentElement.closest('.picker') || el.closest('dialog:not([open])') || allowed(el)) continue
      const what = el.classList.contains('picker') ? 'picker' : el.tagName === 'BUTTON' ? `button "${norm(el.textContent) || el.title || el.getAttribute('aria-label') || '?'}"` : el.tagName.toLowerCase()
      out.mainControls.push({ where: whereIn(el), what })
    }
  }

  // The footer strip.
  const footers = [...st.querySelectorAll(':scope > .step-footer')]
  const footer = footers[0] || null
  const scan = footer ? footer.querySelector('button.step-footer-scan') : null
  const fr = footer ? footer.getBoundingClientRect() : null
  const br = body ? body.getBoundingClientRect() : null
  out.footer = {
    count: footers.length,
    afterBody: !!footer && !!body && !!(body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING),
    scan: scan ? norm(scan.textContent) : null,
    fullWidth: !!fr && !!br && fr.width >= br.width - 2,
    scanAtRight: !!scan && !!fr && scan.getBoundingClientRect().right >= fr.right - 64,
    others: footer ? [...footer.querySelectorAll('button, select, input, a')].filter((x) => x !== scan).map((x) => norm(x.textContent) || x.tagName.toLowerCase()) : [],
  }
  out.close = [...st.querySelectorAll('button')].filter((x) => norm(x.textContent) === 'Close').length

  // About: no inline Learn.
  const about = sectionNamed('About this Step')
  out.aboutLearn = about ? [...about.querySelectorAll('a, button')].filter((a) => /learn/i.test(a.textContent)).map((a) => norm(a.textContent)) : []

  // Tasks Remaining, its Scan helper, and Satisfied.
  const tasks = sectionNamed('Tasks Remaining')
  out.tasks = tasks
    ? {
        clear: /No tasks remaining/.test(tasks.textContent),
        open: [...tasks.querySelectorAll('.emergency-account-status-grid:not(.satisfied) > article, .readiness-strip.unresolved > li')].filter((x) => !x.closest('details')).map((x) => text(x).slice(0, 90)),
        scanNote: norm((tasks.querySelector('.emergency-account-scan-note') || {}).textContent) || null,
      }
    : null
  out.satisfied = []
  for (const d of st.querySelectorAll('details.readiness-satisfied')) {
    for (const card of d.querySelectorAll('.emergency-account-status-grid.satisfied > article, .readiness-strip.satisfied > li')) out.satisfied.push(text(card))
  }

  // Completion Criteria.
  const criteria = sectionNamed('Completion Criteria')
  out.criteria = criteria ? [...criteria.children].filter((c) => c.tagName !== 'H4').flatMap((c) => (c.tagName === 'UL' || c.tagName === 'OL' ? [...c.children] : [c])).map((c) => norm(c.textContent)).filter(Boolean) : null

  // Implementation Tasks: the support line, the folds, and every task on every tab.
  const implOf = () => st.querySelector('.implementation-section')
  const impl = implOf()
  out.impl = null
  if (impl) {
    const support = impl.querySelector('.impl-support')
    const panels = []
    const tabsSeen = []
    const taskSelect = () => {
      const i = implOf()
      const label = i ? [...i.querySelectorAll('.emergency-task-toolbar label')].find((l) => norm((l.querySelector('span') || {}).textContent) === 'Task') : null
      return label ? label.querySelector('select') : null
    }
    const tabs = () => [...((implOf() || document).querySelectorAll('.impl-tabs [role=tab]'))]
    const pick = async (sel, value) => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, value)
      sel.dispatchEvent(new Event('change', { bubbles: true }))
      await wait(80)
    }
    const firstTab = async () => {
      const t = tabs()[0]
      if (t && t.getAttribute('aria-selected') !== 'true') t.click()
      await wait(80)
    }
    await firstTab()
    const start = taskSelect()
    const values = start ? [...start.options].map((o) => o.value) : [null]
    for (const v of values) {
      await firstTab()
      const s = taskSelect()
      if (v !== null && s && s.value !== v) await pick(s, v)
      const now = taskSelect()
      const task = now ? norm(now.selectedOptions[0] && now.selectedOptions[0].textContent) : '(no task selector)'
      const names = tabs().map((t) => norm(t.textContent))
      for (const n of names) if (!tabsSeen.includes(n)) tabsSeen.push(n)
      for (let j = 0; j < names.length; j++) {
        const t = tabs()[j]
        if (!t) continue
        t.click()
        await wait(80)
        const i = implOf()
        const panel = i && i.querySelector('.impl-preview')
        panels.push({ task, tab: names[j], first: j === 0, text: text(panel) })
      }
    }
    await firstTab()
    if (start && values[0] !== null && taskSelect() && taskSelect().value !== values[0]) await pick(taskSelect(), values[0])
    const i = implOf()
    const rest = i.cloneNode(true)
    for (const p of rest.querySelectorAll('.impl-preview')) p.remove()
    out.impl = {
      tabs: tabsSeen,
      learn: !!support && [...support.querySelectorAll('a')].some((a) => /Microsoft Learn/.test(a.textContent)),
      source: support ? norm((support.querySelector('.impl-support-source') || {}).textContent) || null : null,
      referenceFolds: [...i.querySelectorAll('details > summary')].map((s) => norm(s.textContent)).filter((s) => /^reference\b/i.test(s)),
      panels,
      rest: text(rest),
    }
  }

  // Where the words are, for the strings no step may carry.
  out.regions = [{ where: 'row', text: out.rowText }, { where: 'header', text: text(head) }]
  for (const s of sections) {
    if (s.classList.contains('implementation-section')) continue
    out.regions.push({ where: norm((s.querySelector(':scope > h4, :scope > summary') || {}).textContent) || 'main column', text: text(s) })
  }
  if (rail) out.regions.push({ where: 'rail', text: text(rail) })
  if (footer) out.regions.push({ where: 'footer', text: text(footer) })
  if (out.impl) {
    out.regions.push({ where: 'Implementation Tasks', text: out.impl.rest })
    for (const p of out.impl.panels) out.regions.push({ where: `Implementation · ${p.tab} · ${p.task}`, text: p.text })
  }
  return out
}

// ---- judging one read ----

const snippet = (text, re) => {
  const m = re.exec(text)
  if (!m) return ''
  const from = Math.max(0, m.index - 40)
  return `${from > 0 ? '…' : ''}${text.slice(from, m.index + m[0].length + 40).trim()}${m.index + m[0].length + 40 < text.length ? '…' : ''}`
}
const q = (s, n = 90) => `"${String(s).length > n ? `${String(s).slice(0, n)}…` : s}"`

/** Deviations of one read, as [rule, found, judge?]. `ref` is 1.1's read on the same scan. */
function judge(t, row, anatomy, ref) {
  const out = []
  const add = (rule, found, judgeOnly = false) => out.push({ rule, found, judge: judgeOnly })
  if (t.missing) {
    add('opened', t.missing)
    return out
  }
  const done = /^Completed\b/.test(row.lane)
  const expected = SECTIONS[anatomy ?? 'task']

  // Frame.
  if (!t.eyebrow) add('eyebrow', 'no step-type eyebrow over the title')
  for (const x of t.headExtra) add('caption', `under the title: ${x}`)
  if (!t.rail) add('rail', 'no rail (.step-action-column)')
  else {
    const r = t.rail
    if (ref?.rail && r.bg !== ref.rail.bg) add('rail', `background ${r.bg}, 1.1 has ${ref.rail.bg}`)
    if (ref?.rail && r.rule !== ref.rail.rule) add('rail', `left rule ${r.rule}, 1.1 has ${ref.rail.rule}`)
    if (!/^[1-9][0-9.]*px solid/.test(r.rule)) add('rail', `no left rule (${r.rule})`)
    if (!r.fills) add('rail', `does not run the body's height (${r.height})`)
    if (!r.firstIsBlock || !/^next milestone$/i.test(r.label)) add('milestone', `the rail does not lead with NEXT MILESTONE (${q(r.label)})`)
    if (!r.headline) add('milestone', 'no headline')
    else if (DATE.test(r.headline)) add('milestone', `headline is a date: ${q(r.headline)}`)
    else if (done && r.headline !== 'Completed') add('milestone', `the row is Completed, the headline reads ${q(r.headline)}`)
    else if (!done && LANE_WORDS.test(r.headline)) add('milestone', `headline is a lane word: ${q(r.headline)} on a row reading "${row.lane}"`)
    if (ref?.rail && r.headlineType !== ref.rail.headlineType) add('milestone', `headline type ${r.headlineType}, 1.1 has ${ref.rail.headlineType}`)
    if (!/^[1-9][0-9.]*px solid/.test(r.bar ?? '')) add('divider', `no divider under the milestone (${r.bar})`)
    else if (ref?.rail && r.bar !== ref.rail.bar) add('divider', `${r.bar}, 1.1 has ${ref.rail.bar}`)
    if (r.instr.length > 1) add('instruction', `${r.instr.length} instruction lines: ${r.instr.map((x) => q(x, 50)).join(', ')}`)
    if (r.instr.length === 1 && (!r.instrAfterBlock || !r.instrBeforeControls)) add('instruction', `${q(r.instr[0], 60)} is not between the divider and the controls`)
    if (r.instr.length === 1 && t.instrOccurrences > 1) add('instruction', `${q(r.instr[0], 60)} appears ${t.instrOccurrences} times in the step`)
    if (r.instr.length === 0 && r.choices > 0) add('instruction', `the rail takes a choice (${r.choices} decision${r.choices === 1 ? '' : 's'} with controls) and has no instruction line before it`)
    for (const l of r.otherLines) add('instruction', `a second instruction-style line in the rail: ${q(l)}`)
  }
  if (t.mainControls.length > 0) {
    const by = new Map()
    for (const c of t.mainControls) {
      const k = `${c.where}: ${c.what}`
      by.set(k, (by.get(k) ?? 0) + 1)
    }
    add('control in main column', [...by].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join('; '))
  }
  const heads = t.heads.map((h) => h.text)
  if (JSON.stringify(heads) !== JSON.stringify(expected)) add('sections', `${heads.join(' · ') || '(none)'}; the template has ${expected.join(' · ')}`)
  for (const f of t.foldBeforeCriteria) add('sections', `fold ${q(f)} before Completion Criteria`)
  const styles = [...new Set(t.heads.map((h) => h.style))]
  if (styles.length > 1) add('heading style', `${styles.length} styles: ${t.heads.map((h) => `${h.text}=${h.style}`).join('; ')}`)
  else if (ref && ref.heads[0] && styles[0] && styles[0] !== ref.heads[0].style) add('heading style', `${styles[0]}, 1.1 has ${ref.heads[0].style}`)
  const f = t.footer
  if (f.count !== 1 || !f.afterBody) add('footer', `${f.count} footer strip${f.count === 1 ? '' : 's'}${f.count > 0 && !f.afterBody ? ', not under the body' : ''}`)
  if (f.count > 0 && f.scan !== 'Scan to update the plan') add('footer', `no "Scan to update the plan" (${q(f.scan)})`)
  if (f.count > 0 && !f.fullWidth) add('footer', 'the strip is narrower than the body')
  if (f.count > 0 && f.scan && !f.scanAtRight) add('footer', 'the Scan is not at the right')
  if (t.close > 0) add('footer', `${t.close} Close button${t.close === 1 ? '' : 's'}`)
  if (f.others.length > 0) add('footer (owner to judge)', `beside the Scan: ${f.others.map((x) => q(x, 40)).join(', ')}`, true)

  // About ends "Learn →" on 1.1–1.4: that is the template, not a deviation.
  if (anatomy !== 'decision' && t.tasks) {
    if (done && !t.tasks.clear) add('tasks remaining (Completed)', 'no "No tasks remaining"')
    if (done && t.tasks.open.length > 0) add('tasks remaining (Completed)', `${t.tasks.open.length} open card${t.tasks.open.length === 1 ? '' : 's'}: ${t.tasks.open.map((x) => q(x, 60)).join(', ')}`)
    if (t.tasks.scanNote !== SCAN_NOTE) add('scan helper', `under Tasks Remaining: ${q(t.tasks.scanNote ?? '(none)')}`)
  }
  for (const card of t.satisfied) {
    const hit = SATISFIED_BANNED.find((re) => re.test(card))
    if (hit) add('satisfied', `card ${q(card, 70)} reads ${q(snippet(card, hit).trim(), 60)}`)
  }
  if (anatomy !== 'decision') {
    if (!t.impl) add('implementation', 'no Implementation Tasks section')
    else {
      const missing = TABS.filter((x) => !t.impl.tabs.includes(x))
      const extra = t.impl.tabs.filter((x) => !TABS.includes(x))
      if (missing.length > 0) add('tabs', `missing ${missing.join(', ')} (tabs: ${t.impl.tabs.join(', ') || 'none'})`)
      if (extra.length > 0) add('tabs (owner to judge)', `beyond Entra and AI Info: ${extra.join(', ')}`, true)
      if (!t.impl.learn) add('source checked', 'no Microsoft Learn link under Implementation Tasks')
      else if (!/^Source checked \S/.test(t.impl.source ?? '')) add('source checked', `no Source checked line beside the Learn link (${q(t.impl.source ?? '(none)')})`)
      for (const r of t.impl.referenceFolds) add('implementation', `a Reference fold: ${q(r)}`)
      for (const p of t.impl.panels.filter((x) => x.first)) {
        for (const re of NO_OP) if (re.test(p.text)) add(`implementation${done ? ' (Completed)' : ''}`, `${p.tab} · ${p.task}: ${q(snippet(p.text, re), 120)}`)
      }
    }
  }
  // A missing Completion Criteria is reported under sections.
  if (t.criteria && t.criteria.length === 0) add('completion criteria', 'empty')
  else if (t.criteria && t.criteria.length > 2) add('completion criteria', `${t.criteria.length} lines: ${t.criteria.map((x) => q(x, 50)).join(' / ')}`)
  if (row.who === null) add('impact', 'the row draws no Impact')
  else if (!/^(\d|no )/i.test(row.who)) add('impact', `${q(row.who)} is a label, not a count`)
  for (const [name, re] of BANNED) {
    const hits = t.regions.filter((r) => re.test(r.text))
    if (hits.length === 0) continue
    const first = hits[0]
    add('banned string', `"${name}" in ${[...new Set(hits.map((h) => h.where))].join('; ')}: ${q(snippet(first.text, re), 110)}`)
  }
  return out
}

// ---- the walk ----

// Per step: its board number on each scan, each scan's deviations, and the scans whose board lacks it.
const reads = new Map()
for (const t of TARGETS) reads.set(t.id, { numbers: {}, scans: {}, absent: [] })

const openStep = async (id) => {
  await evaluate(`location.hash = ${JSON.stringify(`#/plan/${id}`)}`)
  const sel = `main.page .step[data-step-id="${id}"]`
  if (!(await waitFor(`!!document.querySelector(${JSON.stringify(`${sel} > .step-body > .step-action-column`)})`, 8000))) {
    if (!(await waitFor(`!!document.querySelector(${JSON.stringify(`${sel} > .step-body`)})`, 2000))) return false
  }
  // The step's lower half (Implementation Tasks, Completion Criteria) may be a chunk away.
  await waitFor(`[...document.querySelectorAll(${JSON.stringify(`${sel} h4`)})].some((h) => h.textContent.trim() === 'Completion Criteria')`, 4000)
  await sleep(200)
  return true
}

const showAllWork = () =>
  evaluate(`(() => { const t = [...document.querySelectorAll('main.page .plan-controls [role=tab]')].find((x) => (x.textContent || '').replace((x.querySelector('.tab-badge') || {}).textContent || '', '').trim() === 'All work'); if (t && t.getAttribute('aria-selected') !== 'true') t.click(); return !!t })()`)

const shownSnapshot = () => evaluate(`((document.querySelector('.demo-banner .demo-snapshots button[aria-pressed="true"]') || {}).textContent || '').trim()`)

const readScan = async (scan) => {
  await showAllWork()
  await sleep(300)
  const board = await call(readBoard)
  console.error(`template-check: ${scan} scan, ${Object.keys(board).length} rows on the board`)
  let ref = null
  const pendingJudge = []
  for (const target of TARGETS) {
    const entry = reads.get(target.id)
    const row = board[target.id]
    if (!row) {
      entry.absent.push(scan)
      continue
    }
    entry.numbers[scan] = row.number
    let read
    try {
      read = (await openStep(target.id)) ? await call(readStep, target.id) : { missing: 'the step did not open' }
    } catch (e) {
      read = { missing: `reading it threw: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}` }
    }
    if (target.id === REFERENCE_STEP && !read.missing) ref = read
    pendingJudge.push({ target, row, read })
  }
  for (const { target, row, read } of pendingJudge) reads.get(target.id).scans[scan] = { row, deviations: judge(read, row, target.anatomy, ref) }
}

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  // No alert or print may block the headless page.
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.alert = function () {}; window.print = function () {};' })
  // Into the demo by the link a visitor clicks, as the smoke does.
  await send('Page.navigate', { url: `${BASE}&state=signedOut#/connect` })
  if (!(await waitFor(`/Try it with sample data/.test(document.body ? document.body.innerText : '')`, 30000))) throw new Error('Connect never offered "Try it with sample data"')
  await evaluate(`(() => { const b = [...document.querySelectorAll('main.page a, main.page button')].find((x) => /Try it with sample data/.test(x.textContent)); if (b) b.click(); return !!b })()`)
  if (!(await waitFor(`location.hash === '#/plan' && /Sample data/.test(document.body.innerText) && document.querySelectorAll('main.page .plan-row').length > 0`, 30000))) throw new Error('the demo plan never drew')
  await sleep(600)
  if ((await shownSnapshot()) !== 'Initial scan') throw new Error(`the demo opened on "${await shownSnapshot()}", not the Initial scan`)
  const initialRows = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((r) => r.textContent.trim()).join(' ~ ')`)
  await readScan('Initial')

  // The Follow-up scan: Connect's Scan again, as the smoke does.
  await evaluate(`location.hash = '#/connect'`)
  if (!(await waitFor(`[...document.querySelectorAll('main.page .connect-step button')].some((b) => /^Scan again$/.test((b.textContent || '').trim()))`, 15000))) throw new Error('Connect offered no Scan again')
  await evaluate(`(() => { const b = [...document.querySelectorAll('main.page .connect-step button')].find((x) => /^Scan again$/.test((x.textContent || '').trim())); if (b) b.click(); return !!b })()`)
  if (!(await waitFor(`((document.querySelector('.demo-banner .demo-snapshots button[aria-pressed="true"]') || {}).textContent || '').trim() === 'Follow-up scan'`, 15000))) throw new Error('Scan again never reached the Follow-up scan')
  await evaluate(`location.hash = '#/plan'`)
  await waitFor(`document.querySelectorAll('main.page .plan-row').length > 0`, 15000)
  // The follow-up plan re-derives asynchronously: wait until the rows are not the Initial scan's.
  for (let i = 0; i < 40; i++) {
    const now = await evaluate(`[...document.querySelectorAll('main.page .plan-row')].map((r) => r.textContent.trim()).join(' ~ ')`)
    if (now && now !== initialRows) break
    await sleep(200)
  }
  await sleep(400)
  await readScan('Follow-up')
} catch (e) {
  ws.close()
  stopAll()
  noReport(`the walk stopped: ${e instanceof Error ? e.message : String(e)}`)
}
ws.close()
stopAll()

// ---- the report ----

const SCANS = ['Initial', 'Follow-up']
// A step's lines in the order the template reads: frame, then content.
const RULE_ORDER = ['opened', 'eyebrow', 'caption', 'rail', 'milestone', 'divider', 'instruction', 'control in main column', 'sections', 'heading style', 'footer', 'about', 'tasks remaining', 'scan helper', 'satisfied', 'implementation', 'tabs', 'source checked', 'completion criteria', 'impact', 'banned string']
const lines = []
const counts = []
let total = 0
let totalJudge = 0
for (const target of TARGETS) {
  const e = reads.get(target.id)
  const nums = [...new Set(SCANS.map((s) => e.numbers[s]).filter(Boolean))]
  const label = `${nums.join('/') || '–'} ${target.id}`
  // One line per deviation; the same deviation on both scans once, naming both.
  const merged = new Map()
  for (const scan of SCANS) {
    for (const d of e.scans[scan]?.deviations ?? []) {
      const k = `${d.rule}\n${d.found}`
      if (!merged.has(k)) merged.set(k, { ...d, scans: [] })
      merged.get(k).scans.push(scan)
    }
  }
  const order = (d) => RULE_ORDER.findIndex((r) => d.rule.startsWith(r))
  for (const d of [...merged.values()].sort((a, b) => order(a) - order(b))) lines.push(`${label} | ${d.rule} | [${d.scans.join(', ')}] ${d.found}`)
  if (e.absent.length > 0) lines.push(`${label} | (note) | [${e.absent.join(', ')}] not on the board, so not checked`)
  const fails = [...merged.values()].filter((d) => !d.judge).length
  const judged = merged.size - fails
  total += fails
  totalJudge += judged
  counts.push(e.absent.length === SCANS.length ? `${label}  not on either scan's board` : `${label}  ${fails} deviation${fails === 1 ? '' : 's'}${judged > 0 ? `, ${judged} to judge` : ''}`)
}
console.log(`template-check: ${TARGETS.length} steps, 1.1 through 5.1, on the demo tenant's Initial and Follow-up scans at 1440px`)
console.log('against docs/plans/roadmap-flow/step-template.md; "step | rule | [scans] what it found"\n')
for (const l of lines) console.log(l)
console.log('\nPer step:')
for (const c of counts) console.log(`  ${c}`)
console.log(`\ntemplate-check: ${total} deviation${total === 1 ? '' : 's'} and ${totalJudge} for the owner to judge, over ${TARGETS.length} steps`)
process.exit(0)
