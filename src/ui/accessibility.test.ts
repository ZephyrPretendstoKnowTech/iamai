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
 * Crude on purpose: it reads `<Name ... >` with nesting on the attributes' side
 * only, which is all these assertions need.
 */
function tagsOf(src: string): { name: string; attrs: string }[] {
  const out: { name: string; attrs: string }[] = []
  for (const m of src.matchAll(/<([A-Za-z][A-Za-z0-9.]*)((?:[^<>{}]|\{[^{}]*\}|\{[^{}]*\{[^{}]*\}[^{}]*\})*?)\/?>/g)) {
    out.push({ name: m[1], attrs: m[2] })
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
  assert.match(rule(css, "header.app nav a[aria-disabled='true']") ?? '', /color:\s*var\(--ink-3\)/)
})

test('no surface builds an application header of its own', () => {
  for (const f of uiFiles()) {
    if (f === 'src/ui/shell/AppShell.tsx') continue
    assert.doesNotMatch(read(f), /<header\b/, `${f} draws a header; the shell owns the one header`)
  }
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

test('the tab strip scrolls sideways without clipping the ring on its end tabs', () => {
  const strip = rule(css, '.tabs') ?? ''
  assert.match(strip, /overflow-x:\s*auto/)
  assert.match(strip, /padding:\s*0 2px/, 'the scroll box reserves the 2px the ring needs')
})

test('closing the readiness guidance puts focus back on the control that opened it', () => {
  assert.match(readiness, /trigger\.current = e\.currentTarget/)
  assert.match(readiness, /trigger\.current\?\.focus\(\)/)
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
  assert.match(contentStep, /import \{ Picker, TabList, onePanelProps \}/)
  assert.doesNotMatch(contentStep, /role="tablist"/, 'the step reuses the shared strip rather than hand-rolling one')
  const ids = [...(contentStep.match(/const DO_TABS: TabItem\[\] = \[[\s\S]*?\]/)?.[0] ?? '').matchAll(/id: '([a-z]+)'/g)].map((m) => m[1])
  assert.deepEqual(ids, ['portal', 'json', 'ps'])
  assert.match(contentStep, /<TabList base=\{doBase\}[\s\S]*?panelId=\{\(\) => `\$\{doBase\}-panel`\}/)
  assert.match(contentStep, /<div \{\.\.\.onePanelProps\(doBase, tab\)\}>/)
  // Availability is unchanged: the machine channels still render only where
  // every object the body names exists, and Download JSON is still gated on it.
  assert.match(contentStep, /tab === 'json' && jsonOffered\(step\) && <pre className="mono">/)
  assert.match(contentStep, /tab === 'ps' && jsonOffered\(step\) && <pre className="mono">/)
  assert.match(contentStep, /\{jsonOffered\(step\) && \(/)
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
      if (!native && !component && !/role="combobox"/.test(t.attrs)) offenders.push(`${f}: <${t.name}>`)
    }
  }
  assert.deepEqual(offenders, [], 'aria-expanded on something that is not a control')
  assert.match(readiness, /aria-controls=\{GUIDE_PANEL_ID\}/)
  assert.match(read('src/ui/surfaces/Plan.tsx'), /aria-expanded=\{showSettings\} aria-controls=\{PLAN_SETTINGS_ID\}/)
  assert.match(read('src/ui/surfaces/Connect.tsx'), /aria-expanded=\{open\} aria-controls=\{BASELINE_CHOICES_ID\}/)
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
    ['src/ui/surfaces/Connect.tsx', 5],
    ['src/ui/surfaces/MfaReadiness.tsx', 1],
    ['src/ui/shell/AppShell.tsx', 1],
    ['src/ui/scan/ScanProgress.tsx', 1],
  ] as const
  for (const [f, n] of sites) {
    const src = read(f)
    const errors = [...src.matchAll(/\{[^\n]*\berror[^\n]*&& <(?:p|span) className="quiet[^"]*"([^>]*)>/g)]
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
  assert.match(rule(css, '.group-tile.on .group-title::before') ?? '', /content:/)
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

test('ordinary content cannot widen the page', () => {
  // A UPN, a GUID, a policy name or a group name breaks rather than pushing the
  // column out.
  assert.match(rule(css, 'main.page') ?? '', /overflow-wrap:\s*anywhere/)
  assert.match(rule(homeCss, 'main.page') ?? '', /overflow-wrap:\s*anywhere/)
  assert.match(rule(css, 'main.page img,\nmain.page svg,\nmain.page table,\nmain.page pre') ?? rule(css, 'main.page pre') ?? '', /max-width:\s*100%/)
  // Five destinations wrap onto a second line rather than scrolling the page.
  assert.match(rule(css, 'header.app nav') ?? '', /flex-wrap:\s*wrap/)
  // A grid track with a fixed minimum wider than a phone is a page-wide overflow.
  assert.match(rule(css, '.export-grid') ?? '', /minmax\(min\(20rem, 100%\), 1fr\)/)
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
  assert.match(narrow(640), /\.group-counts[\s\S]*grid-template-columns:\s*1fr/, 'the readiness counts stack')
  assert.match(narrow(640), /\.plan-row-main \.status[\s\S]*flex:\s*0 0 auto/, 'the status column gives way to a long status word')
  assert.match(narrow(700), /\.tiles[\s\S]*grid-template-columns:\s*repeat\(2/, 'the stat tiles halve')
  assert.match(narrow(700), /header\.app \{[\s\S]*flex-wrap:\s*wrap/, 'the header wraps')
  assert.match(homeCss.match(/@media \(max-width: 700px\) \{[\s\S]*?\n\}/)?.[0] ?? '', /header\.app/, 'the home header wraps')
})

// ------------------------------------------------ G. table semantics at any width

test('a data table stays a table, and its labels are DOM structure rather than CSS content', () => {
  assert.match(dataTable, /<table className="datatable">/)
  assert.match(dataTable, /<th\n\s+key=\{c\.key\}\n\s+scope="col"/, 'a column header is a column header')
  assert.doesNotMatch(dataTable, /role=\{c\.sortValue \? 'button' : undefined\}/, 'the header role is not replaced by the sort control')
  assert.match(dataTable, /aria-sort=/)
  // Nothing turns a cell's label into pseudo-content, which no screen reader
  // reads: there is one table at every width, and it scrolls if it must.
  assert.doesNotMatch(css, /td::before\s*\{[^}]*content:\s*attr\(/)
  assert.doesNotMatch(css, /data-label/)
})

// --------------------------------------------------------- H. Plan authority kept

test('the accessibility repair left the step body deciding nothing', () => {
  // The one action, the decision gate and the contract are read exactly where
  // they were; only the markup around them moved.
  assert.match(contentStep, /const contract = stepContract\(step, ctx, ex as Record<string, unknown>\)/)
  assert.match(contentStep, /<WhatToDoLead contract=\{contract\} \/>/)
  assert.match(contentStep, /\{d && \(typeof d\.applies !== 'string' \|\| truthy\(ex\[d\.applies\]\)\) && <Decision/)
})
