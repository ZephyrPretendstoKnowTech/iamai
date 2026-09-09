// Cross-surface accessibility, shell and reflow (task 017).
//
// The product has no DOM test harness — every test here reads the source the
// browser runs, the stylesheet it paints from, and the contract the walk
// measures against. That is enough for what this task is protecting: these are
// structural promises (a native control, a role that agrees with its keyboard,
// a state that is not the accent alone, a box that scrolls instead of widening
// the page), and each of them is a fact about the file, not about a rendering.
//
// What is deliberately not here: pixel measurements, snapshots of markup, and a
// second accessibility framework. The walk drives the real browser; this fails
// before the push.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { headerTabsLine, HEADER_TAB_KEYS } from '../content/contentChecks.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { statusOf } from './surfaces/statusWord.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const css = read('src/ui/app.css')
const homeCss = read('home/home.css')
const appShell = read('src/ui/shell/AppShell.tsx')
const tabs = read('src/ui/components/Tabs.tsx')
const picker = read('src/ui/components/Picker.tsx')
const dataTable = read('src/ui/components/DataTable.tsx')
const infoTip = read('src/ui/components/InfoTip.tsx')
const button = read('src/ui/components/Button.tsx')
const contentStep = read('src/ui/surfaces/ContentStep.tsx')
const readiness = read('src/ui/surfaces/MfaReadiness.tsx')
const contracts = JSON.parse(read('docs/qa/page-contracts.json')) as {
  surfaces: { id: string; allow: Record<string, string[]> }[]
}

/** Every .tsx under the shell and the surfaces: the markup a browser runs. */
function uiFiles(): string[] {
  const out: string[] = []
  for (const dir of ['src/ui/shell', 'src/ui/surfaces', 'src/ui/components', 'src/ui/scan']) {
    for (const f of readdirSync(dir)) if (f.endsWith('.tsx')) out.push(join(dir, f).replace(/\\/g, '/'))
  }
  return out
}

/**
 * Every JSX opening tag in a source file, as its name and its attribute text.
 *
 * It walks the attributes rather than matching them, because a handler nests
 * braces as deep as it likes and a depth-limited pattern does not fail on the
 * tag it cannot read — it drops it. The Plan row, whose keydown handler is
 * three braces deep, was invisible to every assertion below until this counted
 * properly (task 017).
 */
function tagsOf(src: string): { name: string; attrs: string }[] {
  const out: { name: string; attrs: string }[] = []
  for (const m of src.matchAll(/<([A-Za-z][A-Za-z0-9.]*)/g)) {
    const from = (m.index ?? 0) + m[0].length
    let depth = 0
    let quote = ''
    let i = from
    for (; i < src.length; i++) {
      const c = src[i]
      if (quote) {
        if (c === quote) quote = ''
        continue
      }
      if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
      else if (c === '<' && depth === 0) break
    }
    if (src[i] === '>') out.push({ name: m[1], attrs: src.slice(from, i).replace(/\/$/, '') })
  }
  return out
}

/**
 * Every declaration a stylesheet makes for a selector, at-rules flattened and
 * the blocks joined: a selector is written more than once here (a base rule and
 * a narrow-width or print override), and what these tests ask is whether the
 * sheet declares something, not which block declared it.
 */
function rule(sheet: string, selector: string): string | null {
  const stripped = sheet.replace(/\/\*[\s\S]*?\*\//g, '')
  const found: string[] = []
  for (const m of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1]
      .split(',')
      .map((x) => x.trim().split('\n').at(-1)?.trim() ?? '')
    if (sels.includes(selector)) found.push(m[2])
  }
  return found.length > 0 ? found.join('\n') : null
}

/**
 * The stylesheet's rules in source order — one entry per selector in a list,
 * with its declarations and the at-rule it sits under.
 *
 * `rule()` above answers "does the sheet say this anywhere", which is the wrong
 * question for a focus indicator: the sheet said it, and a later, more specific
 * `all: unset` took it away again. What follows is enough of a cascade to ask
 * what a control's focus indicator actually is once the whole sheet has been
 * read (task 017).
 */
type CssRule = { sel: string; decls: Record<string, string>; media: string; order: number }

function parseRules(sheet: string): CssRule[] {
  const src = sheet.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: CssRule[] = []
  const at: string[] = []
  let buf = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '{') {
      const prelude = buf.trim()
      buf = ''
      if (prelude.startsWith('@')) {
        at.push(prelude)
        i++
        continue
      }
      let depth = 1
      let j = i + 1
      for (; j < src.length && depth > 0; j++) {
        if (src[j] === '{') depth++
        else if (src[j] === '}') depth--
      }
      const decls: Record<string, string> = {}
      for (const d of src.slice(i + 1, j - 1).split(';')) {
        const colon = d.indexOf(':')
        if (colon < 0) continue
        decls[d.slice(0, colon).trim().toLowerCase()] = d.slice(colon + 1).trim()
      }
      for (const sel of prelude.split(',')) out.push({ sel: sel.trim().replace(/\s+/g, ' '), decls, media: at.join(' '), order: out.length })
      i = j
      continue
    }
    if (ch === '}') {
      at.pop()
      buf = ''
      i++
      continue
    }
    buf += ch
    i++
  }
  return out
}

/** One compound of a selector: `th`, `.th-sort`, `.tab[aria-selected='true']`. */
type Compound = { tag: string; classes: string[]; attrs: string[]; pseudo: string[] }

function compound(part: string): Compound | null {
  const c: Compound = { tag: '', classes: [], attrs: [], pseudo: [] }
  for (const m of part.matchAll(/\[[^\]]*\]|::?[a-z-]+(?:\([^)]*\))?|\.[A-Za-z0-9_-]+|\*|[A-Za-z][A-Za-z0-9-]*/g)) {
    const t = m[0]
    if (t.startsWith('[')) c.attrs.push(t)
    else if (t.startsWith('::')) return null
    else if (t.startsWith(':')) c.pseudo.push(t)
    else if (t.startsWith('.')) c.classes.push(t)
    else if (t !== '*') c.tag = t
  }
  return c
}

/**
 * A probe is a focused control written as a plain descendant selector — `th
 * .th-sort` is "a .th-sort inside a th, with focus and nothing else". A rule
 * applies to it when every compound the rule names is one the probe has, and
 * the only state it asks for is the focus the probe is in.
 */
function applies(sel: string, probe: Compound[]): boolean {
  if (/[+~]/.test(sel)) return false
  const parts = sel.replace(/\s*>\s*/g, ' ').split(' ').filter(Boolean).map(compound)
  if (parts.some((p) => p === null)) return false
  const cs = parts as Compound[]
  const describes = (r: Compound, p: Compound, self: boolean): boolean =>
    (!r.tag || r.tag === p.tag) &&
    r.classes.every((x) => p.classes.includes(x)) &&
    r.attrs.every((x) => p.attrs.includes(x)) &&
    r.pseudo.every((x) => self && (x === ':focus-visible' || x === ':focus'))
  if (!describes(cs[cs.length - 1], probe[probe.length - 1], true)) return false
  let k = probe.length - 2
  for (let n = cs.length - 2; n >= 0; n--) {
    while (k >= 0 && !describes(cs[n], probe[k], false)) k--
    if (k < 0) return false
    k--
  }
  return true
}

/** What the sheet leaves a focused control's `outline` or `box-shadow` set to. */
function effective(rules: CssRule[], probeSel: string, forced: boolean, prop: 'outline' | 'box-shadow'): string {
  const probe = probeSel.split(' ').map(compound) as Compound[]
  let best: { b: number; c: number; order: number; value: string } | null = null
  for (const r of rules) {
    // The ordinary theme is the sheet outside every at-rule; the forced-colours
    // pass is that sheet with its one media block laid over the top.
    if (r.media && !(forced && /forced-colors: active/.test(r.media))) continue
    if (!applies(r.sel, probe)) continue
    const value = r.decls[prop] ?? r.decls.all
    if (value === undefined) continue
    const cs = r.sel.replace(/\s*>\s*/g, ' ').split(' ').filter(Boolean).map(compound) as Compound[]
    const b = cs.reduce((n, c) => n + c.classes.length + c.attrs.length + c.pseudo.length, 0)
    const c = cs.reduce((n, x) => n + (x.tag ? 1 : 0), 0)
    if (!best || b > best.b || (b === best.b && (c > best.c || (c === best.c && r.order > best.order)))) best = { b, c, order: r.order, value }
  }
  return best?.value ?? ''
}

/** One `<div>` element of a source file, from its opening tag to its close. */
function divAt(src: string, openTag: string): string {
  const start = src.indexOf(openTag)
  assert.ok(start >= 0, `no ${openTag}`)
  let depth = 0
  for (const m of src.slice(start).matchAll(/<div\b|<\/div>/g)) {
    depth += m[0] === '</div>' ? -1 : 1
    if (depth === 0) return src.slice(start, start + (m.index ?? 0) + m[0].length)
  }
  assert.fail(`${openTag} is never closed`)
}

// ---------------------------------------------------------------- A. the shell

test('the header names the five destinations once each, in the product order, with the Plan before MFA Readiness', () => {
  const line = headerTabsLine().split(' · ')
  assert.deepEqual([...HEADER_TAB_KEYS], ['connect', 'plan', 'readiness', 'export', 'how'])
  assert.deepEqual(line, ['Connect', 'Plan', 'MFA Readiness', 'Export', 'How'])
  // The shell renders one Tab per key, in the same order the walk reads them off
  // `header.app nav a`.
  const nav = appShell.match(/<nav aria-label=\{SHELL\.navLabel\}>[\s\S]*?<\/nav>/)
  assert.ok(nav, 'the shell has one labelled primary nav')
  const rendered = [...nav[0].matchAll(/SHELL\.tabs\.([a-z]+)/g)].map((m) => m[1])
  assert.deepEqual(rendered, [...HEADER_TAB_KEYS], 'the header renders the tabs in the content order')
  assert.equal(appShell.match(/<nav\b/g)?.length, 1, 'one primary nav in the shell')
})

test('the current page is marked programmatically and by shape, and a tab with no data yet says so', () => {
  assert.match(appShell, /aria-current=\{active \? 'page' : undefined\}/, 'the active tab carries aria-current')
  // Shape, not colour: the active tab is the one with an accent underline where
  // the others have a transparent one.
  assert.match(rule(css, 'header.app nav a.active') ?? '', /border-bottom-color/)
  assert.match(rule(css, '.tab.active') ?? '', /border-bottom-color/)
  // Unavailable is aria-disabled and the app's disabled ink, never an item that
  // looks live and does nothing.
  assert.match(appShell, /aria-disabled="true"/)
  assert.match(rule(css, "header.app nav a[aria-disabled='true']") ?? '', /color:\s*var\(--quiet-text\)/)
})

test('no surface builds an application header of its own', () => {
  // `<header>` is a sectioning element as well as the page's banner: an
  // `<article>` may head itself, and the approved Plan pack's opened step does
  // exactly that (`.step-head`, task 034). What must stay singular is the
  // APPLICATION header — `header.app`, the one the shell renders with the
  // wordmark, the destinations and the account menu. So the rule is about that
  // one, and a sectioning header inside a surface has to name the section it
  // heads rather than claiming the page.
  for (const f of uiFiles()) {
    if (f === 'src/ui/shell/AppShell.tsx') continue
    for (const m of read(f).matchAll(/<header\b[^>]*>/g)) {
      assert.doesNotMatch(m[0], /className="app"|className={`app/, `${f} draws an application header; the shell owns the one header`)
      assert.match(m[0], /className="[a-z-]+-head"/, `${f} draws a header that does not say which section it heads`)
    }
  }
  // And the application header itself is written once, in the shell.
  assert.equal(uiFiles().filter((f) => /className="app"/.test(read(f))).join(), 'src/ui/shell/AppShell.tsx')
})

test('the shell page contract lists exactly the header the shell renders', () => {
  const shell = contracts.surfaces.find((s) => s.id === 'shell')
  assert.ok(shell, 'the contract measures the header')
  assert.deepEqual([...shell.allow.tabs].sort(), headerTabsLine().split(' · ').sort())
})

test('no page contract still freezes a visible Today', () => {
  for (const s of contracts.surfaces) {
    for (const [kind, list] of Object.entries(s.allow)) {
      const stale = list.filter((v) => v === 'Today' || /(^|\s)Today(\s|$)/.test(v))
      assert.deepEqual(stale, [], `${s.id}.${kind} still allows the retired Today surface`)
    }
  }
})

// ------------------------------------------------- B. keyboard-operable controls

test('a click handler in the UI is on a native control, or on an element made operable by keyboard', () => {
  const NATIVE = new Set(['button', 'a', 'input', 'select', 'summary', 'label', 'textarea', 'option', 'details'])
  const offenders: string[] = []
  for (const f of uiFiles()) {
    for (const t of tagsOf(read(f))) {
      if (!/\bonClick=/.test(t.attrs)) continue
      // A component decides its own element; only intrinsic tags are read here.
      if (t.name[0] === t.name[0].toUpperCase()) continue
      if (NATIVE.has(t.name)) continue
      const operable = /\btabIndex=/.test(t.attrs) && /\bonKeyDown=/.test(t.attrs)
      // An option in a listbox is driven from the combobox's own key handling,
      // so it is deliberately not a tab stop.
      const listboxOption = /role="option"/.test(t.attrs)
      if (!operable && !listboxOption) offenders.push(`${f}: <${t.name}>`)
    }
  }
  assert.deepEqual(offenders, [], 'a pointer-only control')
})

test('the shared controls are native elements, not ARIA imitations of them', () => {
  assert.match(button, /<button\n?\s+className=\{`btn/, 'Button is a button')
  assert.match(button, /<a href=\{href\}/, 'LinkButton is a link')
  assert.match(tabs, /<button\n\s+key=\{t\.id\}\n\s+type="button"\n\s+role="tab"/, 'a tab is a button')
  assert.match(picker, /<input\n\s+type="search"/, 'the picker searches with an input')
  assert.match(infoTip, /<button\n\s+type="button"\n\s+className="infotip-btn"/, 'the info tip trigger is a button')
  assert.match(dataTable, /<button type="button" className="th-sort"/, 'a sortable column header holds a button')
})

// ------------------------------------------------------------------- C. focus

test('focus is visible, and survives a mode that does not paint box-shadows', () => {
  assert.match(rule(css, ':focus-visible') ?? '', /box-shadow:\s*var\(--focus-ring\)/)
  assert.match(rule(homeCss, ':focus-visible') ?? '', /box-shadow:\s*var\(--focus-ring\)/)
  // A forced-colours mode drops box-shadow; without this the one focus
  // indicator the interface has would be invisible there.
  const forced = css.match(/@media \(forced-colors: active\)\s*\{[\s\S]*?\n\}/)
  assert.ok(forced, 'app.css carries a forced-colours focus fallback')
  assert.match(forced[0], /:focus-visible[\s\S]*outline:\s*2px solid/)
  // Nothing suppresses the ring itself.
  for (const m of css.matchAll(/([^{}]*:focus[^{}]*)\{([^{}]*)\}/g)) {
    assert.doesNotMatch(m[2], /box-shadow:\s*none/, `${m[1].trim()} removes the focus ring`)
  }
})

test('no reset later in the sheet erases the focus indicator it left behind', () => {
  // The ring is declared once, near the top. Every `all: unset` control reset
  // below it is later and at least as specific, so each one is a chance to lose
  // the ring in the ordinary theme and the outline in a forced-colours one.
  // Every such reset is probed, so a reset added tomorrow cannot erase either
  // one quietly — the question here is what the whole sheet leaves, not whether
  // some block in it says the right thing.
  const rules = parseRules(css)
  const probes = new Set(['button', 'a', 'input', '.btn', '.group-count'])
  for (const r of rules) if (r.decls.all === 'unset') probes.add(r.sel)
  assert.ok([...probes].some((p) => p.includes('th-sort')), 'the sortable column header is among the probed resets')
  assert.ok([...probes].some((p) => p.includes('infotip-btn')), 'the info tip trigger is among the probed resets')
  assert.ok([...probes].some((p) => p.includes('tab')), 'a tab is among the probed resets')
  for (const p of probes) {
    assert.equal(effective(rules, p, false, 'box-shadow'), 'var(--focus-ring)', `${p}: the sheet leaves it with no focus ring`)
    assert.match(effective(rules, p, true, 'outline'), /\bsolid\b/, `${p}: the sheet leaves it with no focus outline in a forced-colours mode`)
  }
})

test('the home sheet leaves its own controls a focus indicator in a forced-colours mode', () => {
  // Home is a separate page with its own stylesheet, and it suppresses the
  // native outline the same way the app does. The app's fallback is in
  // src/ui/app.css, which this page never loads, so without one of its own the
  // CTA, the demo link, the theme control and the source links have no visible
  // focus at all in a forced-colours mode (task 017 correction).
  const forced = homeCss.match(/@media \(forced-colors: active\)\s*\{[\s\S]*?\n\}/)
  assert.ok(forced, 'home.css carries a forced-colours focus fallback')
  assert.match(forced[0], /:focus-visible[\s\S]*outline:\s*2px solid/)
  const rules = parseRules(homeCss)
  for (const p of ['a', '.lnk', '.btn', '.btn-primary', '.btn-secondary', '.btn-tertiary', 'header.app .right .text-control']) {
    assert.equal(effective(rules, p, false, 'box-shadow'), 'var(--focus-ring)', `${p}: the home sheet leaves it with no focus ring`)
    assert.match(effective(rules, p, true, 'outline'), /\bsolid\b/, `${p}: the home sheet leaves it with no focus outline in a forced-colours mode`)
  }
})

test('the tab strip scrolls sideways without clipping the ring on its end tabs', () => {
  const strip = rule(css, '.tabs') ?? ''
  assert.match(strip, /overflow-x:\s*auto/)
  assert.match(strip, /padding:\s*0 2px/, 'the scroll box reserves the 2px the ring needs')
})

test('closing the readiness guidance puts focus back on the control that opened it', () => {
  assert.match(readiness, /trigger\.current = e\.currentTarget/)
  assert.match(readiness, /trigger\.current\?\.focus\(\)/)
})

test('closing Plan settings puts focus back on the link that opened it', () => {
  // Close is inside the panel, and closing unmounts the panel: without this the
  // focused button leaves the document and focus falls to the body, which on a
  // long plan is the top of the page (task 017).
  const plan = read('src/ui/surfaces/Plan.tsx')
  assert.match(plan, /const settingsLink = useRef<HTMLAnchorElement>\(null\)/)
  assert.match(plan, /<a ref=\{settingsLink\} href="#\/plan" aria-expanded=\{showSettings\}/)
  assert.match(plan, /onClose=\{\(\) => \{ setShowSettings\(false\); settingsLink\.current\?\.focus\(\) \}\}/)
})

// -------------------------------------------------------- D. programmatic state

test('a tablist keeps the keyboard behaviour its role promises, and its panels are named', () => {
  assert.match(tabs, /role="tablist"/)
  assert.match(tabs, /aria-selected=\{active === t\.id\}/)
  assert.match(tabs, /aria-controls=\{panelId\(t\.id\)\}/)
  assert.match(tabs, /tabIndex=\{active === t\.id \? 0 : -1\}/, 'the strip is one tab stop, not one per tab')
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.match(tabs, new RegExp(`'${key}'`), `${key} moves between tabs`)
  assert.match(tabs, /role: 'tabpanel' as const/)
  assert.match(tabs, /'aria-labelledby': tabId\(base, active\)/)
  // Inactive panels are out of the accessibility tree, not merely out of sight.
  assert.match(rule(css, '.tab-panel') ?? '', /display:\s*none/)
})

test("the Plan step's three implementation channels are one tab set, and all three stay offered", () => {
  assert.match(contentStep, /import \{ Callout, Picker, TabList, onePanelProps \}/)
  assert.doesNotMatch(contentStep, /role="tablist"/, 'the step reuses the shared strip rather than hand-rolling one')
  const ids = [...(contentStep.match(/const DO_TABS: TabItem\[\] = \[[\s\S]*?\]/)?.[0] ?? '').matchAll(/id: '([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(ids, ['portal', 'json', 'ps'])
  assert.match(contentStep, /<TabList base=\{doBase\}[\s\S]*?panelId=\{\(\) => `\$\{doBase\}-panel`\}/)
  // Task 035 gave the panel the approved pack's instruction-block edge. It is
  // still one panel, still labelled by whichever tab is selected, and still
  // reachable: a panel of prose or a scrolling code block holds nothing else a
  // keyboard can land on.
  assert.match(contentStep, /<div className="instruction" \{\.\.\.onePanelProps\(doBase, tab\)\}>/)
  // Availability is unchanged in meaning and is read from ONE authority: the
  // machine channels render only where Foundation A offers an implementation,
  // and Download JSON is gated on the same answer. The surface asks the Step
  // Contract, which asked `implementationOffered` once, rather than asking the
  // engine again itself (task 035).
  assert.match(contentStep, /tab === 'json' && contract\.implementation\.offered && <pre className="mono">/)
  assert.match(contentStep, /tab === 'ps' && contract\.implementation\.offered && <pre className="mono">/)
  assert.match(contentStep, /\{contract\.implementation\.offered && \(/)
  assert.doesNotMatch(contentStep, /jsonOffered\(/, 'the surface re-reads the implementation gate instead of the contract it was handed')
})

test('the picker is one coherent combobox: the input keeps focus and names the option it is on', () => {
  assert.match(picker, /role="combobox"/)
  assert.match(picker, /aria-activedescendant=\{showList && list\[at\] \? optionId\(at\) : undefined\}/)
  assert.match(picker, /aria-controls=\{listId\}/)
  assert.match(picker, /id=\{listId\}/)
  // The listbox holds options and nothing else: the heading, the searching note
  // and the Done row are siblings of it, not children.
  const listbox = divAt(picker, '<div role="listbox"')
  assert.doesNotMatch(listbox, /picker-heading|picker-footer|picker-count/, 'prose inside the listbox')
  assert.match(listbox, /role="option"/)
  assert.match(picker, /role="option"/)
  // Authority is untouched: what is selected, what is offered and when the
  // caller hears about it are all still the caller's.
  assert.match(picker, /onChange\(single \? \[o\] : \[\.\.\.selected, o\]\)/)
  assert.match(picker, /const list = \(empty \? suggestions : options\)\.filter\(\(o\) => !selectedIds\.has\(o\.id\)\)\.slice\(0, 8\)/)
})

test('a decision names the question its options answer', () => {
  assert.match(contentStep, /role=\{radios \? 'radiogroup' : 'group'\} aria-labelledby=\{labelledBy\}/)
  assert.match(contentStep, /<div className="dlabel" id=\{`\$\{base\}-decision`\}>/)
  assert.match(contentStep, /<div className="dlabel" id=\{`\$\{base\}-question`\}>/)
  assert.match(picker, /role="group" aria-labelledby=\{labelledBy\}/)
})

test('every expanded/collapsed state sits on a control a keyboard reaches, and names what it opens', () => {
  const offenders: string[] = []
  for (const f of uiFiles()) {
    for (const t of tagsOf(read(f))) {
      if (!/\baria-expanded=/.test(t.attrs)) continue
      const native = ['button', 'a', 'summary'].includes(t.name)
      const component = t.name[0] === t.name[0].toUpperCase()
      const operable = /\btabIndex=/.test(t.attrs) && /\bonKeyDown=/.test(t.attrs)
      // An element that says it is a button has to behave like one. A table row
      // carries its expanded state as a row, which is the one shape that leaves
      // the table a table.
      const declared = /role="button"/.test(t.attrs) || t.name === 'tr' ? operable : /role="combobox"/.test(t.attrs)
      if (!native && !component && !declared) offenders.push(`${f}: <${t.name}>`)
    }
  }
  assert.deepEqual(offenders, [], 'aria-expanded on something that is not a control')
  assert.match(readiness, /aria-controls=\{GUIDE_PANEL_ID\}/)
  assert.match(read('src/ui/surfaces/Plan.tsx'), /aria-expanded=\{showSettings\} aria-controls=\{PLAN_SETTINGS_ID\}/)
  assert.match(read('src/ui/surfaces/Connect.tsx'), /aria-expanded=\{open\} aria-controls=\{BASELINE_CHOICES_ID\}/)
})

test('the one Plan row says it is a control and whether the step under it is open', () => {
  // Every ordinary Plan row and every Cleanup row is this one element, so what
  // it does or does not say it is, it says about the whole Plan. It was a
  // focusable div: reachable, operable, and announced as a line of text that
  // promised nothing (task 017).
  const src = read('src/ui/surfaces/StepSections.tsx')
  const from = src.indexOf('export function PlanRow(')
  assert.ok(from >= 0, 'StepSections still draws the one Plan row')
  const row = src.slice(from, src.indexOf('\n}\n', from))
  const div = tagsOf(row).find((t) => /className="plan-row"/.test(t.attrs))
  assert.ok(div, 'the row is one element')
  assert.equal(div.name, 'div')
  assert.match(div.attrs, /role="button"/, 'the row does not say it is a control')
  assert.match(div.attrs, /aria-expanded=\{open\}/, 'the row does not say whether the step under it is open')
  // The role is only true because the keyboard behaviour under it is unchanged.
  assert.match(div.attrs, /tabIndex=\{0\}/)
  assert.match(div.attrs, /onClick=\{onToggle\}/)
  assert.match(div.attrs, /e\.key === 'Enter' \|\| e\.key === ' '/)
  assert.match(div.attrs, /e\.preventDefault\(\)/)
  // Every Step Contract fact the row carried is still on it, in the four zones
  // the approved pack draws (task 033): the state, the title with its quiet
  // reason under it, who it touches, when. A zone that disappears takes a fact
  // with it.
  const spans = [...row.matchAll(/className="(?:plan-row-status|plan-row-title|step-title|who|plan-row-reason)"/g)]
  assert.equal(spans.length, 5, 'the row lost or gained a column')
  // The reason belongs to the title it explains, not to the row as a whole: a
  // screen reader and a sighted reader both meet it under the step's name.
  assert.ok(row.indexOf('className="plan-row-title"') < row.indexOf('className="plan-row-reason"'), 'the reason is no longer inside the title zone')
  assert.ok(row.indexOf('className="plan-row-reason"') < row.indexOf('className="who"'), 'the reason is no longer read before who and when')
  assert.match(row, /className=\{`when\$\{whenReason \? ' when-reason' : ''\}`\}/)
  assert.match(row, /<Status tone=\{tone\}>\{word\}<\/Status>/)
  assert.match(row, /<span className="next-mark" aria-label=\{nextLabel\}>/)
})

test('an info tip opens on a tap as well as a hover, and its text is announced', () => {
  // A tap fires focus and click in one gesture; deciding from the state before
  // the gesture is what stops the click closing what the focus just opened.
  assert.match(infoTip, /openBeforePress\.current = open/)
  assert.match(infoTip, /e\.detail === 0.*setOpen\(\(o\) => !o\).*\n.*setOpen\(!openBeforePress\.current\)/s)
  assert.match(infoTip, /aria-describedby=\{open \? id : undefined\}/)
  assert.match(infoTip, /if \(e\.key === 'Escape'\) setOpen\(false\)/)
})

test("an action's failure is text where the action was, and is announced", () => {
  // One live region per action, never per status line: a failure is the one
  // result the pressed control does not itself show.
  const sites = [
    // Six: the signed-out sign-in failure under the primary button, the two
    // signed-in tiles, the scan's own failure line, and the two baseline lines.
    ['src/ui/surfaces/Connect.tsx', 6],
    ['src/ui/surfaces/MfaReadiness.tsx', 1],
    ['src/ui/shell/AppShell.tsx', 1],
    ['src/ui/scan/ScanProgress.tsx', 1],
  ] as const
  for (const [f, n] of sites) {
    const src = read(f)
    // `actionError` as well as `error`: reading only the lower-case word is how
    // the signed-out sign-in failure was counted as absent (task 017).
    const errors = [...src.matchAll(/\{[^\n]*[eE]rror[^\n]*&& <(?:p|span) className="quiet[^"]*"([^>]*)>/g)]
    assert.equal(errors.length, n, `${f}: ${errors.length} rendered action errors`)
    for (const m of errors) assert.match(m[1], /role="status"/, `${f}: an action error that is drawn but never announced`)
  }
  // The scan in flight is already one region under the header; nothing else adds
  // a second announcement of it.
  assert.equal(read('src/ui/shell/AppShell.tsx').match(/role="status"/g)?.length, 4)
})

// ---------------------------------------------------------- E. not colour alone

test('every plan status is a word, not only a coloured dot', () => {
  const r = runFixture(fixture('demo-week2'))
  assert.ok(r.steps.length > 0, 'the fixture builds a plan')
  for (const s of r.steps) {
    const view = statusOf(s)
    assert.match(view.word, /\S/, `${s.id}: a status with no word`)
  }
  // The dot's colour lives in .status and nowhere else, so the word is what
  // carries the meaning everywhere else on the page (design lint 5).
  assert.match(rule(css, '.status::before') ?? '', /background:\s*var\(--idle\)/)
})

test('an active filter says so in shape as well as colour', () => {
  assert.match(rule(css, ".surface .toolbar .btn[aria-pressed='true']::before") ?? '', /content:/)
  // MFA Readiness's filters are the approved toolbar's pills (task 037), so the
  // one pressed rule above governs them too; the boxed counts that carried a
  // pressed treatment of their own are gone with the tiles.
  assert.doesNotMatch(css, /\.group-tile|\.group-count/, 'a dead pressed rule for a control the page no longer draws')
  assert.match(readiness, /aria-pressed=\{show === k\}/, 'a Show filter says whether it is pressed')
  assert.match(readiness, /aria-pressed=\{on\}/)
  assert.match(readiness, /aria-pressed=\{adminsOnly\}/)
})

test("Connect's progression marks the current stage with a word", () => {
  assert.match(read('src/ui/surfaces/Connect.tsx'), /stage === 'current' && <span className="next">\{W\.next\}<\/span>/)
})

test('the readiness rung badge carries its title where assistive technology can read it', () => {
  assert.match(readiness, /role=\{rung \? 'img' : undefined\} title=\{rung \? rungWords\(rung\)\.title : undefined\} aria-label=/)
})

// ------------------------------------------------------------- F. reflow / width

test('ordinary content cannot widen the page, and ordinary prose is not broken to achieve it', () => {
  // A UPN, a GUID, a policy name or a group name breaks rather than pushing the
  // column out — but the page as a whole gets `break-word`, not `anywhere`
  // (task 030). Both break a word too long for its column; only `anywhere` also
  // lets a flex or grid track shrink below the longest word, which turns
  // ordinary prose into a ladder of broken words in a narrow track. The strings
  // that really are unbreakable carry `anywhere` themselves.
  for (const sheet of [css, homeCss]) {
    const page = rule(sheet, 'main.page') ?? ''
    assert.match(page, /overflow-wrap:\s*break-word/)
    assert.doesNotMatch(page, /overflow-wrap:\s*anywhere/, 'the page-wide rule must not squeeze prose below a word')
  }
  const tenant = rule(css, '.tenant-object') ?? ''
  assert.match(tenant, /overflow-wrap:\s*anywhere/, 'a tenant object, a policy name and a technical face break anywhere')
  assert.match(tenant, /min-width:\s*0/, 'and can shrink inside a flex or grid parent so the break can happen')
  assert.match(rule(css, 'main.page a[href]') ?? '', /overflow-wrap:\s*anywhere/, 'a long URL breaks')
  assert.match(rule(homeCss, 'main.page a[href]') ?? '', /overflow-wrap:\s*anywhere/)
  assert.match(rule(css, 'main.page img,\nmain.page svg,\nmain.page table,\nmain.page pre') ?? rule(css, 'main.page pre') ?? '', /max-width:\s*100%/)
  // Five destinations wrap onto a second line rather than scrolling the page.
  assert.match(rule(css, 'header.app nav') ?? '', /flex-wrap:\s*wrap/)
  // A grid track with a fixed minimum wider than a phone is a page-wide
  // overflow, which is what Export's auto-filling grid had to guard against
  // with `minmax(min(20rem, 100%), 1fr)`. Task 040 made the group one panel of
  // rows, and a single `1fr` track cannot exceed its parent at any width — the
  // guarantee is now structural rather than a minimum that has to be capped.
  assert.match(rule(css, '.export-grid') ?? '', /grid-template-columns: 1fr;/)
  assert.doesNotMatch(rule(css, '.export-grid') ?? '', /minmax\(\s*\d/, 'a fixed track minimum is a phone-width overflow')
  // Control rows wrap; nothing that holds several controls is nowrap.
  for (const sel of ['.plan-start label.rows', '.plan-settings label.rows', '.datatable-footer', '.surface .toolbar', '.surface .actions', '.export-card .actions', '.picker-chips']) {
    assert.match(rule(css, sel) ?? '', /flex-wrap:\s*wrap/, `${sel} does not wrap`)
  }
  assert.match(rule(homeCss, '.actions') ?? '', /flex-wrap:\s*wrap/, 'the home page CTAs stack')
})

test('the wide regions scroll inside themselves, and JSON and PowerShell wrap rather than widen', () => {
  assert.match(rule(css, '.surface .datatable-wrap') ?? '', /overflow-x:\s*auto/)
  const pre = rule(css, 'pre') ?? ''
  assert.match(pre, /overflow:\s*auto/)
  assert.match(pre, /white-space:\s*pre-wrap/, 'a policy body wraps inside its box')
  const mono = rule(css, '.step-body pre.mono') ?? ''
  assert.match(mono, /overflow-x:\s*auto/)
  assert.match(mono, /max-width:\s*100%/)
  // A box that scrolls has to be reachable by keyboard, and only while it does.
  assert.match(dataTable, /tabIndex=\{scrolls \? 0 : undefined\}/)
  assert.match(dataTable, /el\.scrollWidth > el\.clientWidth \+ 1/)
})

test('the narrow layouts collapse rather than compress', () => {
  const narrow = (max: number): string => css.match(new RegExp(`@media \\(max-width: ${max}px\\) \\{[\\s\\S]*?\\n\\}`, 'g'))?.join('\n') ?? ''
  // MFA Readiness collapses at its own pack's two breakpoints (task 037): the
  // integrated summary halves at 900 with the main cell spanning both tracks,
  // and becomes one column at 620.
  assert.match(narrow(900), /\.readiness-summary \{[\s\S]*grid-template-columns:\s*1fr 1fr/, 'the readiness summary does not halve')
  assert.match(narrow(900), /\.readiness-summary \.summary-main \{[\s\S]*grid-column:\s*1 \/ -1/, 'and its main cell does not span the row')
  assert.match(narrow(620), /\.readiness-summary \{[\s\S]*grid-template-columns:\s*1fr/, 'the readiness summary does not become one column')
  // The Plan row collapses at the pack's own breakpoint: four zones become two,
  // and who and when drop under the state and the title rather than being
  // squeezed into slivers of one line (task 033).
  assert.match(narrow(940), /\.plan-row \{[\s\S]*grid-template-columns:\s*110px minmax\(0, 1fr\)/, 'the roadmap row does not collapse to two tracks')
  assert.match(narrow(940), /\.plan-row \.who,\s*\n\s*\.plan-row \.when \{[\s\S]*text-align:\s*left/, 'who and when do not left-align once they move below')
  assert.match(narrow(940), /\.plan-row \.status[\s\S]*white-space:\s*normal/, 'the status column gives way to a long status word')
  assert.match(narrow(700), /\.tiles[\s\S]*grid-template-columns:\s*repeat\(2/, 'the stat tiles halve')
  assert.match(narrow(700), /header\.app \{[\s\S]*flex-wrap:\s*wrap/, 'the header wraps')
  // Home collapses at its own pack's two breakpoints (task 038): the product
  // section and its rail become one column at 760, and at 560 the gutters
  // tighten and the header gives back its gap. The header wraps at every width
  // rather than pushing the way into the product off the side.
  assert.match(homeCss, /header\.app \{[\s\S]*?flex-wrap: wrap;/, 'the home header wraps')
  const homeNarrow = (max: number): string => homeCss.match(new RegExp(`@media \\(max-width: ${max}px\\) \\{[\\s\\S]*?\\n\\}`))?.[0] ?? ''
  assert.match(homeNarrow(760), /\.product \{\s*grid-template-columns: 1fr;/, 'the home product section does not collapse')
  assert.match(homeNarrow(760), /\.side \{[\s\S]*?border-left: 0;\s*border-top: 1px solid/, "the home rail's border does not move above it")
  assert.match(homeNarrow(560), /header\.app/, "the home header does not give way at the pack's own breakpoint")
})

// ------------------------------------------------ G. table semantics at any width

test('a data table stays a table, and its labels are DOM structure rather than CSS content', () => {
  assert.match(dataTable, /<table className=\{`datatable/, 'the element is still a table')
  assert.match(dataTable, /<th\n\s+key=\{c\.key\}\n\s+scope="col"/, 'a column header is a column header')
  assert.doesNotMatch(dataTable, /role=\{c\.sortValue \? 'button' : undefined\}/, 'the header role is not replaced by the sort control')
  assert.match(dataTable, /aria-sort=/)
  // Nothing turns a cell's label into pseudo-content, which no screen reader
  // reads. MFA Readiness stacks its rows below the approved pack's breakpoint
  // (task 037), and the label it shows there is a real element with real text.
  assert.doesNotMatch(css, /td::before\s*\{[^}]*content:\s*attr\(/)
  assert.doesNotMatch(css, /data-label/)
  assert.doesNotMatch(css, /\.cell-key::before\s*\{[^}]*content:/, "the stacked cell's key is text, not generated content")
  assert.match(dataTable, /<span className="cell-key key-label" aria-hidden="true">\n\s+\{c\.header\}/, 'the stacked label is a real element carrying the column header')
  // A CSS `display` that stops being `table` takes the table's semantics with
  // it, so a stacked table restates them: the head/cell relationship a screen
  // reader announces is what makes the visible key safe to hide from it.
  for (const [el, role] of [
    ['table className', 'table'],
    ['thead', 'rowgroup'],
    ['tbody', 'rowgroup'],
    ['th', 'columnheader'],
    ['td', 'cell'],
  ] as const) {
    void el
    assert.match(dataTable, new RegExp(`role=\\{stacked \\? '${role}' : undefined\\}`), `a stacked table does not restate its ${role} role`)
  }
  // The head goes out of sight and stays in the accessibility tree: it is the
  // element the stacked cell is still associated with.
  const stacked = css.match(/@media \(max-width: 900px\) \{[\s\S]*?\n\}/g)?.join('\n') ?? ''
  assert.match(stacked, /table\.datatable thead \{[\s\S]*clip-path:\s*inset\(50%\)/, 'the stacked head is hidden by display:none rather than clipped')
  assert.doesNotMatch(stacked, /table\.datatable thead \{[\s\S]*display:\s*none/)
  assert.match(stacked, /\.surface\.readiness \.cell-key \{[\s\S]*display:\s*block/, 'the stacked cell key never becomes visible')
})

// --------------------------------------------------------- H. Plan authority kept

test('the accessibility repair left the step body deciding nothing', () => {
  // The one action, the decision gate and the contract are read exactly where
  // they were; only the markup around them moved.
  assert.match(contentStep, /const contract = stepContract\(step, ctx, ex as Record<string, unknown>\)/)
  assert.match(contentStep, /<WhatToDoLead contract=\{contract\} \/>/)
  assert.match(contentStep, /\{d && \(typeof d\.applies !== 'string' \|\| truthy\(ex\[d\.applies\]\)\) && <Decision/)
})
