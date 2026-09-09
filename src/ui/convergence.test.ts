// The cross-product convergence guard (task 040).
//
// Packs 031-039 restored the four surfaces the owner approved a design for.
// Export, How and Inventory have no approved HTML and this task did not invent
// any: it converged them onto the grammar the restored surfaces established —
// the display ramp, the shared panel table, the code surface, one route width
// per content role — and retired the legacy colour-alias layer task 030 left
// behind for exactly this pack.
//
// What this file protects is the DIFFERENCE between those two things. Every
// assertion here is either "the product has one name / one role / one authority
// for this fact" or "the uncovered surfaces did not acquire an authority they do
// not have". It is deliberately not a picture test: the rendered evidence lives
// under docs/screens/040, and a pixel diff in CI would fail on a font hint.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { ROUTE_WIDTHS, SOFT_TINTS, DARK, LIGHT } from './tokens.ts'

const APP = readFileSync('src/ui/app.css', 'utf8')
const TOKENS = readFileSync('src/ui/tokens.css', 'utf8')
const HOME_CSS = readFileSync('home/home.css', 'utf8')
const HOME_THEME = readFileSync('home/theme.css', 'utf8')
const TOKENS_TS = readFileSync('src/ui/tokens.ts', 'utf8')
const HOW = readFileSync('src/ui/surfaces/How.tsx', 'utf8')
const EXPORT = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')
const INVENTORY = readFileSync('src/ui/surfaces/InventoryPage.tsx', 'utf8')
const INVENTORY_ROOT = readFileSync('src/ui/surfaces/Inventory.tsx', 'utf8')
const MANIFEST = JSON.parse(readFileSync('docs/design/approved/manifest.json', 'utf8')) as {
  surfaces: { surface: string; path: string; sha256: string }[]
}

/**
 * A stylesheet with its comments removed. A comment can quote a canonical file
 * verbatim — `.eyebrow` in app.css quotes the four packs' own
 * `color:var(--muted)` — and a quotation is evidence, not a consumer. Every
 * "who still reads this name" assertion below reads the declarations only.
 */
const code = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Every stylesheet a person's browser actually loads. */
const SHEETS: [string, string][] = [
  ['src/ui/app.css', code(APP)],
  ['src/ui/tokens.css', code(TOKENS)],
  ['home/home.css', code(HOME_CSS)],
  ['home/theme.css', code(HOME_THEME)],
]

// --------------------------------------------------------------- 1. canonical

test('the four approved HTML packs are byte-for-byte what the manifest records', () => {
  // Convergence is presentation work on surfaces the packs do NOT cover. If a
  // single canonical byte moved while doing it, the authority moved with it.
  assert.equal(MANIFEST.surfaces.length, 4)
  for (const s of MANIFEST.surfaces) {
    const sha = createHash('sha256').update(readFileSync(s.path)).digest('hex')
    assert.equal(sha, s.sha256, `${s.surface}: ${s.path} is no longer the approved bytes`)
  }
})

test('no surface without an approved pack claims one', () => {
  const governed = new Set(MANIFEST.surfaces.map((s) => s.surface))
  for (const uncovered of ['export', 'how', 'inventory']) {
    assert.ok(!governed.has(uncovered), `${uncovered} must not be recorded as an approved surface`)
  }
  // And the widths those three took are engineering choices. The manifest
  // records `observed` widths read out of a pack; nothing may add one for a
  // surface with no pack to read.
  const json = readFileSync('docs/design/approved/manifest.json', 'utf8')
  for (const uncovered of ['export', 'how', 'inventory']) {
    assert.ok(!new RegExp(`"surface":\\s*"${uncovered}"`).test(json), `${uncovered} appears in the design-authority manifest`)
  }
})

// ------------------------------------------------------- 2. the legacy layer

/**
 * The names task 030 kept so the brand palette could land without rewriting
 * every stylesheet in one commit, each a `var()` reference to a canonical or
 * derived value. Task 040 migrated the pages and deleted the block.
 */
const RETIRED = [
  '--bg',
  '--bg-raised',
  '--bg-inset',
  '--ink',
  '--ink-2',
  '--ink-3',
  '--rule',
  '--rule-strong',
  '--accent',
  '--accent-tint',
  '--accent-soft',
  '--on-accent',
  '--ok',
  '--wait',
  '--stop',
  '--muted',
  '--text',
  '--raised',
  '--border',
  '--info',
  '--focus',
  '--warning',
  '--success-soft',
  '--warning-soft',
  '--danger-soft',
  '--info-soft',
  '--past',
  '--present',
  '--future',
  '--font-display',
  '--radius-card',
  '--shadow-1',
  '--max-content',
  '--gutter',
] as const

test('the legacy alias layer is gone: no sheet declares one and no sheet reads one', () => {
  for (const name of RETIRED) {
    for (const [file, css] of SHEETS) {
      assert.ok(!new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(css), `${file} still reads ${name}`)
      assert.ok(!new RegExp(`^\\s*${name}\\s*:`, 'm').test(css), `${file} still declares ${name}`)
    }
  }
  assert.ok(!/LEGACY_COLOUR_ALIASES/.test(TOKENS_TS), 'the alias record is still in the token source')
})

test('every custom property a sheet reads is one a sheet declares', () => {
  // The migration's real risk is a reference left pointing at a name that no
  // longer exists: `var(--ink-2)` with no `--ink-2` inherits nothing and paints
  // the element in whatever it would have been. This is the whole-product form
  // of the check design-lint runs on the app sheets.
  const declared = new Set<string>()
  for (const [, css] of SHEETS) for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/g)) declared.add(m[1])
  for (const [file, css] of SHEETS) {
    for (const m of css.matchAll(/var\((--[a-z0-9-]+)/g)) {
      assert.ok(declared.has(m[1]), `${file} reads ${m[1]}, which nothing declares`)
    }
  }
})

test('the soft tints are a derived family with one formula, not four hand-mixed values', () => {
  assert.deepEqual(Object.keys(SOFT_TINTS), ['--brand-tint', '--success-tint', '--attention-tint', '--danger-tint'])
  for (const [name, role] of Object.entries(SOFT_TINTS)) {
    assert.match(TOKENS, new RegExp(`\\s${name}: color-mix\\(in srgb, var\\(${role}\\) 12%, var\\(--canvas\\)\\);`), `${name} is not the shared formula`)
  }
})

// ------------------------------------------------- 3. brand and state colour

test('brand is not success, in either theme, and no alias reintroduces the pair', () => {
  // Asserted here as well as in tokens.test.ts because THIS is the task that
  // renamed every consumer: a migration that mapped a green onto the brand
  // would satisfy every other test in the repository.
  assert.notEqual(LIGHT.brandPrimary, LIGHT.success)
  assert.notEqual(DARK.brandPrimary, DARK.success)
  assert.notEqual(LIGHT.brandPrimary, LIGHT.successText)
  assert.notEqual(DARK.brandPrimary, DARK.successText)
  // And nothing in the sheets sets the brand tint where a success tone belongs.
  const successRules = [...APP.matchAll(/(\.callout-success|\.status\.ok)[^{]*\{([^}]*)\}/g)].map((m) => m[2])
  assert.ok(successRules.length > 0, 'no success tone rule to check')
  for (const body of successRules) assert.ok(!/var\(--brand-/.test(body), 'a success tone is painted in the brand colour')
})

test('a state is a word, on every surface, never a colour alone', () => {
  // Inventory's MFA-state column, How's severity chip and the Plan's status all
  // render a WORD. The rule that keeps it that way is that a state colour may
  // only be painted in a rule whose element also carries text — enforced by
  // design-lint rule 5. What is asserted here is the other half: the uncovered
  // surfaces did not gain a colour-only state while being converged.
  for (const [file, src] of [
    ['How.tsx', HOW],
    ['InventoryPage.tsx', INVENTORY],
    ['Export.tsx', EXPORT],
  ] as const) {
    assert.ok(!/style=\{\{[^}]*(background|color):/.test(src), `${file} paints a colour inline, outside the token system`)
  }
  // Inventory's readiness column stays the words it always was: no rung badge
  // was borrowed from MFA Readiness, whose rung semantics are its own.
  assert.ok(!/rung/i.test(INVENTORY), 'Inventory must not reuse the MFA rung presentation')
  assert.ok(!/rung/i.test(HOW), 'How must not reuse the MFA rung presentation')
})

// ----------------------------------------------------------- 4. route widths

test('each uncovered surface resolves one width, chosen by content role and declared once', () => {
  for (const route of ['export', 'how', 'inventory'] as const) {
    assert.match(APP, new RegExp(`\\.shell\\[data-route='${route}'\\] \\{\\s*\\n\\s*--route-width: var\\(--w-${route}\\);`))
    assert.match(TOKENS, new RegExp(`--w-${route}: ${ROUTE_WIDTHS[route]}px;`))
  }
  // Prose does not stretch to an operational column on any of them: the shared
  // measure still caps a paragraph on a surface.
  assert.match(APP, /\.surface p,\n\.surface ul,\n\.surface ol \{[^}]*max-width: var\(--measure\);/)
  // Inventory is the widest because its table is; How and Export are not wider
  // than the widest surface the owner approved.
  assert.ok(ROUTE_WIDTHS.inventory >= ROUTE_WIDTHS.how, 'the table surface is not the wider one')
  assert.ok(ROUTE_WIDTHS.export <= ROUTE_WIDTHS.plan && ROUTE_WIDTHS.how <= ROUTE_WIDTHS.plan)
  // The old per-page rule is gone: the shell is the one place a route's width
  // is named, and the page and the footer both read it from there.
  assert.ok(!/main\.page\[data-route=/.test(code(APP)), 'a route width is declared in two places again')
  assert.match(code(APP), /main\.page \{[\s\S]*?max-width: calc\(var\(--route-width, var\(--page\)\) \+ 2 \* var\(--pad\)\);/)
  assert.match(code(APP), /footer\.app \{[\s\S]*?max-width: calc\(var\(--route-width, var\(--page\)\) \+ 2 \* var\(--pad\)\);/)
  // `width: 100%` is what makes both of those apply at all: `.shell` is a
  // column flex container and an auto cross-axis margin cancels the stretch.
  assert.match(code(APP), /footer\.app \{\s*\n\s*width: 100%;/)
})

// ------------------------------------------------------- 5. shared treatment

test('the panel table is one shared role, and the surfaces that ask for it get it', () => {
  // Two of the four packs draw the same table, so the treatment is shared on
  // the evidence standard primitives.test.ts uses. Before task 040 the rule was
  // scoped to `.surface.readiness` while `DataTable`'s `panel` prop advertised
  // it as shared, so How and Inventory could ask and get nothing.
  assert.match(APP, /\.surface \.datatable-wrap\.panel \{/)
  const th = APP.match(/\.surface \.datatable-wrap\.panel table\.datatable th \{([^}]*)\}/)?.[1] ?? ''
  assert.match(th, /background: var\(--secondary-surface\);/, 'the head band lost its surface')
  assert.match(th, /text-transform: uppercase;/)
  assert.match(th, /font-size: var\(--t-micro\);/)
  assert.ok(!/\.surface\.readiness table\.datatable th \{/.test(APP), 'the head treatment is scoped to one surface again')
  // Both uncovered table surfaces take it.
  assert.match(HOW, /<DataTable\n\s*panel\n/)
  assert.equal((INVENTORY.match(/<DataTable\n\s*panel\n/g) ?? []).length, (INVENTORY.match(/<DataTable\n/g) ?? []).length)
  // A dense operational table keeps scrolling inside its own panel rather than
  // becoming a stack of cards: the stacked row stays an opt-in only MFA asks for.
  assert.match(APP, /\.surface \.datatable-wrap\.panel \{[^}]*overflow-x: auto;/)
  assert.ok(!/datatable-stacked/.test(INVENTORY), 'Inventory must not cardify its rows')
})

test('technical content sits on the one code surface the brand reserves for it', () => {
  const pre = APP.match(/\npre \{([^}]*)\}/)?.[1] ?? ''
  assert.match(pre, /background: var\(--code-surface\);/, 'a code block is on the generic inset surface')
  assert.match(pre, /white-space: pre-wrap;/, 'targeted wrapping was lost')
  assert.match(APP, /\.step-body pre\.mono \{[^}]*background: var\(--code-surface\);/)
  // And it is still IBM Plex Mono, still served from this origin.
  assert.match(APP, /pre,\nkbd,\n\.mono,\n\.policy-name,\n\.portal-path \{\n\s*font-family: var\(--font-mono\);/)
  for (const [file, css] of SHEETS) {
    assert.ok(!/@import|https?:\/\/fonts\.|cdn\./i.test(css), `${file} asks a third party for a face`)
  }
})

test('Export is one panel of rows per group, not a wall of boxes with a hole beside a lone one', () => {
  const grid = APP.match(/\n\.export-grid \{([^}]*)\}/)?.[1] ?? ''
  assert.match(grid, /grid-template-columns: 1fr;/)
  assert.match(grid, /border: 1px solid var\(--line\);/, 'the group is not the panel')
  const row = APP.match(/\.surface\.export \.export-card \{([^}]*)\}/)?.[1] ?? ''
  assert.match(row, /background: transparent;/)
  assert.match(row, /border: 0;/)
  assert.match(APP, /\.surface\.export \.export-card \+ \.export-card \{\s*\n\s*border-top: 1px solid var\(--line\);/)
  // The six artifacts are still six elements: the page's information
  // architecture did not change, only what contains it.
  assert.equal((EXPORT.match(/className="export-card"/g) ?? []).length, 6)
})

test('the three uncovered surfaces take the display ramp, and take it below every approved page', () => {
  assert.match(APP, /\.surface\.export h1,\n\.surface\.how h1,\n\.surface\.inventory h1 \{\s*\n\s*--display-size: var\(--d-9\);/)
  // --d-9 is 30px, the ramp's smallest page heading. Every approved surface is
  // larger, which is what makes these read as secondary rather than as pages
  // somebody forgot.
  const ramp = (t: string) => Number(TOKENS.match(new RegExp(`--${t}: (\\d+)px;`))?.[1])
  for (const t of ['d-1', 'd-2', 'd-3', 'd-5']) assert.ok(ramp(t) > ramp('d-9'), `${t} is not above the secondary heading`)
})

test('a surface takes its own route styling in every state it can render, not only when its data arrived', () => {
  // The ramp above is keyed on the surface class, so a branch that renders a
  // bare `.surface` renders the OLD heading: the same route would change its
  // typographic hierarchy when its data state changed. Export is the surface
  // with more than one branch (no scan, plan still computing, plan ready), and
  // two of the three did not carry the class when task 040 landed.
  for (const [name, src] of [
    ['export', EXPORT],
    ['how', HOW],
    ['inventory', INVENTORY_ROOT],
  ] as const) {
    const roots = [...src.matchAll(/<section className="surface([^"]*)"/g)].map((m) => m[1])
    assert.ok(roots.length > 0, `${name} renders no surface root`)
    for (const rest of roots) {
      assert.ok(rest.split(/\s+/).includes(name), `a ${name} branch renders <section className="surface${rest}">`)
    }
  }
  // Export's three branches are still the three states, with their own words.
  assert.equal([...EXPORT.matchAll(/<section className="surface export">/g)].length, 3)
  assert.match(EXPORT, /\{S\.scanNeedsConnect\}/)
  assert.match(EXPORT, /\{S\.loading\}/)
  assert.match(EXPORT, /\{P\.intro\}/)
})

// -------------------------------------------------- 6. what did NOT converge

test('How still derives its permission and read truth from the runtime registries', () => {
  // The single most dangerous way to make this page look tidier is to replace a
  // generated table with a hand-written list, because the page then states a
  // permission set the product does not actually request.
  assert.match(HOW, /import \{ COLLECTOR_REGISTRY \} from '\.\.\/\.\.\/graph\/collect\/registry\.ts'/)
  assert.match(HOW, /import \{ REGISTRY, ruleText, citationFor \} from '\.\.\/\.\.\/validation\/rules\.ts'/)
  assert.match(HOW, /import \{ scopeRows \} from '\.\.\/PermissionsDisclosure\.tsx'/)
  assert.match(HOW, /rows=\{permissions\}/)
  assert.match(HOW, /rows=\{COLLECTOR_REGISTRY\.filter/)
  assert.match(HOW, /rows=\{REGISTRY\.filter/)
  // No literal Graph scope or endpoint is written into the page.
  assert.ok(!/'[A-Za-z]+\.Read(Write)?\.(All|Directory)'/.test(HOW), 'a permission name is hard-coded on How')
  assert.ok(!/'\/(policies|users|devices|reports|identity)\//.test(HOW), 'an endpoint is hard-coded on How')
})

test('Export still exports what it exported, from the same authorities', () => {
  for (const src of [
    "from '../../roadmap/ics.ts'",
    "from '../../roadmap/plan.ts'",
    "from '../../roadmap/prompts.ts'",
    "from './stepExport.ts'",
    "from './inventoryTables.ts'",
    "from '../exportGuard.ts'",
  ]) {
    assert.ok(EXPORT.includes(src), `Export no longer reads ${src}`)
  }
  // The redaction gate is the one that must not be loosened by a visual pass.
  assert.match(EXPORT, /REDACTED/)
  assert.match(EXPORT, /unredactedFrom\('grounding-bundle'\)/)
  assert.match(EXPORT, /bundleRedacted \? REDACTED : unredactedFrom/)
})

test('Inventory still reads the same population, with the same filters and the same identity', () => {
  assert.match(INVENTORY, /snapshot\.config\.caPolicies\?\.rows \?\? \[\]/)
  assert.match(INVENTORY, /snapshot\.users\.map\(\(u\) => \[u\.id, u\]\)/)
  assert.match(INVENTORY, /getGroupMembers\(snapshot\.tenantId, id\)/)
  // The ten tabs, in the order the surface has always shown them.
  const tabs = [...INVENTORY.matchAll(/\{ id: '([a-z-]+)', label: C\.tabs\./g)].map((m) => m[1])
  assert.deepEqual(tabs, ['policies', 'locations', 'authentication', 'people', 'groups', 'devices', 'roles', 'apps', 'licensing', 'signins'])
  assert.match(INVENTORY_ROOT, /<InventoryPage snapshot=\{snapshot\} \/>/)
})

test('a long tenant object is still contained, and a sentence in a link is not treated as one', () => {
  assert.match(APP, /\.tenant-object,\n\.policy-name,\n\.portal-path,\ncode,\nkbd,\n\.mono \{\n\s*overflow-wrap: anywhere;\n\s*min-width: 0;/)
  assert.match(APP, /main\.page a\[href\] \{\n\s*overflow-wrap: anywhere;/)
  assert.match(APP, /main\.page td,\nmain\.page th \{\n\s*min-width: 0;/)
  // `anywhere` lets a column shrink below its longest word, which is right for
  // a Graph path and wrong for a permission name or a citation label. The
  // permission takes the fact prompt 47.1 already established for the consent
  // disclosure — one identifier, no mid-word break — declared once for both
  // places that list it; the path and the label take a floor instead.
  assert.match(APP, /\.permission-name,\n\.surface details\.permissions td:first-child code \{\n\s*white-space: nowrap;\n\s*overflow-wrap: normal;/)
  assert.match(HOW, /<code className="permission-name">\{r\.scope\}<\/code>/)
  assert.match(HOW, /minWidth: '15rem'/)
  assert.match(HOW, /minWidth: '12rem'/)
})

// --------------------------------------------- 7. nothing generated leaked in

test('no generated branding preview copy reached a converged surface', () => {
  const FORBIDDEN = [
    'Built by Jon Hope',
    'PLAN PROGRESS ACHIEVE',
    "FROM HERE TO WHAT'S NEXT",
    'IDENTITY ROADMAP',
    'PLAN WITH EVIDENCE',
    'GUIDED PROGRESSION',
    'PEOPLE + AI + A BRIGHTER TOMORROW',
  ]
  const sources = [HOW, EXPORT, INVENTORY, INVENTORY_ROOT, APP, HOME_CSS, readFileSync('docs/design/content.json', 'utf8')]
  for (const line of FORBIDDEN) for (const src of sources) assert.ok(!src.includes(line), `${line} appears in a product source`)
  // Jon Hope is credited on How as the baseline's author, which is a fact about
  // the baseline and not a brand line. It stays; a strapline does not.
  assert.match(HOW, /CA_POLICY_ANALYZER/)
})

test('the product hierarchy is unchanged and Today did not come back', () => {
  const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  const nav = shell.slice(shell.indexOf('<nav aria-label'), shell.indexOf('</nav>'))
  assert.deepEqual([...nav.matchAll(/SHELL\.tabs\.([a-z]+)/g)].map((m) => m[1]), ['connect', 'plan', 'readiness', 'export', 'how'])
  assert.ok(!/Today/.test(nav))
  // Inventory is reached from MFA Readiness, not promoted into primary nav.
  assert.ok(!/inventory/i.test(nav), 'Inventory was added to the primary navigation')
  assert.match(INVENTORY_ROOT, /href=\{READINESS_HREF\}/)
  // One shell, one header: no surface builds a second navigation.
  assert.equal((shell.match(/<header className="app">/g) ?? []).length, 1)
  for (const src of [HOW, EXPORT, INVENTORY, INVENTORY_ROOT]) assert.ok(!/<header/.test(src), 'a surface renders its own header')
})
