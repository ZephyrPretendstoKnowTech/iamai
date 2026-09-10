// The task-030 foundation: what the theme, the type system and the shell must
// be able to do before a restoration pack can reproduce an approved surface.
//
// Everything here is a fact about a file the browser runs — the generated token
// sheet, the stylesheet, the shell's markup, the renderer, the manifests — and
// not about a rendering. The rendered evidence is separate and derived
// (scripts/render-design.mjs; docs/design/reports/030-theme-typography-shell-foundation.md).
//
// What this file deliberately does NOT assert: that Home, Connect, Plan or MFA
// Readiness look like their packs. They do not, and saying so here would be the
// exact failure task 028 was written to stop. Packs 031-038 own composition.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { DISPLAY, LAYOUT, ROUTE_WIDTHS } from './tokens.ts'
import { MARK_GEOMETRY, MARK_VIEWBOX } from '../brand/logo/mark.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const tokensCss = read('src/ui/tokens.css')
const css = read('src/ui/app.css')
const homeCss = read('home/home.css')
const homeHtml = read('home/index.html')
const shell = read('src/ui/shell/AppShell.tsx')
const mark = read('src/ui/components/Mark.tsx')
const brand = JSON.parse(read('docs/brand/brand-manifest.json')) as {
  brand: { tagline: null; name: string }
  logo: { family: string; variant: number; wordmark: { text: string; family: string; weight: number; descriptorUnderWordmark: boolean } }
  production: Record<string, boolean | string>
}
const content = JSON.parse(read('docs/design/content.json')) as {
  pages: { app: { shell: { product: { wordmark: string; name: string }; tabs: Record<string, string> } } }
}

// ------------------------------------------------------------------ typography

test('the three IBM Plex roles are served from this origin, and nothing asks a CDN', () => {
  for (const family of ['IBM Plex Serif', 'IBM Plex Sans', 'IBM Plex Mono']) {
    assert.ok(tokensCss.includes(`font-family: '${family}'`), `${family} has no @font-face`)
  }
  for (const m of tokensCss.matchAll(/src: url\('([^']+)'\)/g)) {
    assert.match(m[1], /^\/fonts\/IBMPlex/, `${m[1]} is not a local IBM Plex face`)
    assert.ok(existsSync(`public${m[1]}`), `${m[1]} is declared but not published`)
  }
  assert.doesNotMatch(tokensCss, /https?:/, 'a remote font URL in the token sheet')
})

test('the display ceiling is gone: the ramp reaches the approved packs, and a size can only be a token', () => {
  // The old scale stopped at --t-6, 26px, and design-lint rule 4 required every
  // font-size to be one of --t-1 .. --t-6. The approved Home h1 is 50px, so the
  // lint made the approved design unreachable rather than merely unbuilt.
  assert.ok(Math.max(...(Object.values(DISPLAY) as number[])) >= 50)
  assert.match(tokensCss, /--d-1: 50px;/)
  assert.match(css, /\.display \{[\s\S]*?font-size: var\(--display-size\)/, 'a display role a pack can size from the ramp')
  const lint = read('src/ui/design-lint.test.ts')
  assert.match(lint, /var\\\(--d-\\d\+\\\)/, 'the lint admits the display ramp')
  assert.doesNotMatch(lint, /--t-\[1-6\]/, 'the old six-step ceiling is gone from the lint')
})

test('a weight above 500 is reachable only by naming its brand role', () => {
  for (const role of ['display', 'body', 'strong', 'wordmark']) {
    assert.match(tokensCss, new RegExp(`--weight-${role}: \\d+;`), `--weight-${role} is missing`)
  }
  assert.match(tokensCss, /--weight-wordmark: 700;/)
  assert.match(tokensCss, /--weight-strong: 600;/)
})

// ---------------------------------------------------------------------- widths

test('each approved surface resolves to the column its pack sets, and prose does not', () => {
  // Task 040 moved the width from `main.page[data-route=…]` onto the shell as
  // `--route-width`, so the page and the footer read ONE value per route. The
  // fact this test asserts is unchanged: which column each route resolves to.
  const width = (route: string, token: string) =>
    assert.match(
      css,
      new RegExp(`\\.shell\\[data-route='${route}'\\] \\{\\s*\\n\\s*--route-width: var\\(--${token}\\);`),
      `${route} does not resolve to var(--${token})`,
    )
  width('connect', 'w-connect')
  width('plan', 'w-plan')
  width('readiness', 'w-readiness')
  assert.match(tokensCss, new RegExp(`--w-connect: ${ROUTE_WIDTHS.connect}px;`))
  assert.match(tokensCss, new RegExp(`--w-plan: ${ROUTE_WIDTHS.plan}px;`))
  assert.match(tokensCss, new RegExp(`--w-readiness: ${ROUTE_WIDTHS.readiness}px;`))
  // Home is a separate build path with its own sheet, and the same token.
  assert.match(homeCss, /max-width: calc\(var\(--w-home\) \+ 2 \* var\(--pad\)\)/)
  assert.match(tokensCss, new RegExp(`--w-home: ${ROUTE_WIDTHS.home}px;`))
  // A route with no width of its own keeps the prose page, and so does a page
  // rendered outside the shell.
  assert.match(css, /\.shell \{\s*\n\s*--route-width: var\(--page\);/)
  assert.match(css, /main\.page \{[\s\S]*?max-width: calc\(var\(--route-width, var\(--page\)\) \+ 2 \* var\(--pad\)\)/)
  assert.match(tokensCss, new RegExp(`--page: ${ROUTE_WIDTHS.default}px;`))
  // The three surfaces no pack governs resolve to a width chosen by content
  // role (task 040). These are engineering choices, not owner decisions: the
  // test holds them to ONE authority, not to an approved value.
  width('export', 'w-export')
  width('how', 'w-how')
  width('inventory', 'w-inventory')
  assert.match(tokensCss, new RegExp(`--w-export: ${ROUTE_WIDTHS.export}px;`))
  assert.match(tokensCss, new RegExp(`--w-how: ${ROUTE_WIDTHS.how}px;`))
  assert.match(tokensCss, new RegExp(`--w-inventory: ${ROUTE_WIDTHS.inventory}px;`))
  // The frame is the page's own column: the footer reads the same value, so a
  // 1040px How and a 1240px Inventory cannot share one fixed footer width.
  assert.match(css, /footer\.app \{\s*\n\s*width: 100%;\s*\n\s*max-width: calc\(var\(--route-width, var\(--page\)\) \+ 2 \* var\(--pad\)\);/)
})

test('the reading measure is separate from the page, so a wide page is not a wide sentence', () => {
  assert.match(tokensCss, new RegExp(`--measure: ${LAYOUT.measureCh}ch;`))
  assert.match(tokensCss, new RegExp(`--measure-lead: ${LAYOUT.leadPx}px;`))
  assert.ok(LAYOUT.leadPx < ROUTE_WIDTHS.plan && LAYOUT.leadPx < ROUTE_WIDTHS.readiness)
  // Connect went from a 760px page to a 1040px one; its prose did not.
  assert.match(css, /\.surface\.connect p,\n\.surface\.connect ul,\n\.surface\.connect ol \{\s*\n\s*max-width: var\(--measure-lead\);/)
})

// ----------------------------------------------------------------------- shell

test('the shell wears the brand lockup: the Threshold mark and the wordmark, with no tagline', () => {
  assert.match(shell, /<BrandMark size=\{20\} \/>\s*\n\s*\{planner\.wordmark\}/, 'the lockup is the mark beside the wordmark')
  assert.equal(content.pages.app.shell.product.wordmark, 'IAMAI')
  assert.equal(brand.brand.tagline, null, 'there is no tagline')
  assert.equal(brand.logo.wordmark.descriptorUnderWordmark, false)
  assert.equal(brand.logo.family, 'Threshold')
  // The mark is the master's geometry, not a second drawing of it.
  assert.equal(MARK_VIEWBOX, '0 0 100 100')
  const master = read('src/brand/logo/iamai-threshold-master.svg')
  for (const path of [...MARK_GEOMETRY.matchAll(/d="([^"]+)"/g)].map((m) => m[1])) {
    assert.ok(master.includes(path), 'the shell mark carries geometry the master does not')
  }
  assert.match(mark, /from '\.\.\/\.\.\/brand\/logo\/mark\.ts'/, 'the component imports the derived module rather than drawing')
  // No forbidden tagline reached an asset or the shell.
  for (const line of ['PLAN PROGRESS ACHIEVE', "FROM HERE TO WHAT'S NEXT", 'IDENTITY ROADMAP', 'PLAN WITH EVIDENCE', 'GUIDED PROGRESSION']) {
    assert.ok(!shell.includes(line) && !homeHtml.includes(line), `${line} is not IAMAI's`)
  }
})

test('the wordmark is the brand, the tab title is the product', () => {
  // IAMAI Planner is the registered Entra application and the document title;
  // it is not the wordmark (docs/brand/brand-manifest.json logo.coreLockup).
  assert.equal(content.pages.app.shell.product.name, 'IAMAI Planner')
  assert.doesNotMatch(shell, /planner\.name/, 'the header must not set the product name in the lockup')
  assert.match(css, /header\.app \.wordmark \{[\s\S]*?font-family: var\(--font-sans\);[\s\S]*?font-weight: var\(--weight-wordmark\);/)
  assert.match(homeCss, /header\.app \.wordmark \{[\s\S]*?font-weight: var\(--weight-wordmark\);/, 'the home page composes the same lockup')
})

test('the product hierarchy in the header is unchanged, How stays supporting, and Today is gone', () => {
  const tabs = content.pages.app.shell.tabs
  assert.deepEqual(Object.values(tabs), ['Connect', 'Plan', 'MFA Readiness', 'Export', 'How'])
  const header = shell.slice(shell.indexOf('<header className="app">'), shell.indexOf('</header>'))
  const order = [...header.matchAll(/SHELL\.tabs\.(\w+)/g)].map((m) => m[1])
  assert.deepEqual(order, ['connect', 'plan', 'readiness', 'export', 'how'])
  assert.ok(!/Today/.test(header), 'Today was replaced by MFA Readiness (task 012)')
  // How is offered before a scan; the three that read tenant evidence wait.
  assert.match(header, /<Tab href="#\/how" active=\{route === 'how'\} enabled>/)
})

test('the theme control is a named, reachable button and the preference is local', () => {
  assert.match(shell, /<button type="button" className="text-control" onClick=\{toggleTheme\} title=\{SHELL\.themeTooltip\}>/)
  assert.match(shell, /THEME_KEY = 'iamai-theme'/)
  assert.match(shell, /localStorage\.setItem\(THEME_KEY, theme\)/)
  assert.match(shell, /document\.documentElement\.dataset\.theme = theme/)
  // Both themes exist as values, and the system decides before a choice is stored.
  assert.match(tokensCss, /:root\[data-theme='dark'\] \{/)
  assert.match(tokensCss, /@media \(prefers-color-scheme: dark\) \{\s*\n\s*:root:not\(\[data-theme\]\) \{/)
})

// -------------------------------------------------------------- shape and depth

test('the shape hierarchy and the one panel shadow exist as roles, not as a rounded card wall', () => {
  assert.match(tokensCss, new RegExp(`--radius: ${LAYOUT.radiusPx}px;`))
  assert.match(tokensCss, new RegExp(`--radius-control: ${LAYOUT.radiusControlPx}px;`))
  assert.match(tokensCss, new RegExp(`--radius-panel: ${LAYOUT.radiusPanelPx}px;`))
  assert.match(css, /\.panel \{[\s\S]*?border-radius: var\(--radius-panel\);/)
  assert.match(css, /\.panel-key \{\s*\n\s*box-shadow: var\(--shadow-panel\);/)
  // Dark leans on surface tone and border; its shadow is depth, not a glow.
  assert.match(tokensCss, /--shadow-panel: 0 10px 30px rgba\(29, 37, 40, 0\.08\);/)
  assert.match(tokensCss, /--shadow-panel: 0 18px 45px rgba\(0, 0, 0, 0\.32\);/)
  // Four surface depths, so a pack never invents a fifth.
  for (const t of ['--canvas', '--surface', '--secondary-surface', '--code-surface']) {
    assert.ok(tokensCss.includes(`${t}: #`), `${t} is not a value`)
  }
})

test('a sticky planner topbar is possible without a second navigation shell', () => {
  // The approved Plan pack's topbar sticks. The capability is a class on the
  // one shell; the Plan packs activate it with the anatomy that expects it.
  assert.match(css, /\.shell\.shell-sticky header\.app \{[\s\S]*?position: sticky;[\s\S]*?top: 0;/)
  assert.match(css, /\.shell\.shell-sticky \[id\] \{\s*\n\s*scroll-margin-top: calc\(var\(--header\) \+ 8px\);/)
  // And there is still exactly one header in the product.
  assert.equal((css.match(/^header\.app \{/gm) ?? []).length, 1)
})

// -------------------------------------------------------------- print and paper

test('print stays light, high contrast and economical whatever the screen theme is', () => {
  const printTokens = tokensCss.slice(tokensCss.indexOf('@media print'))
  assert.match(printTokens, /:root,\s*\n\s*:root\[data-theme='dark'\] \{/, 'print overrides the dark theme too')
  assert.match(printTokens, /--canvas: #f7f4ee;/, 'print uses the light canvas, never a dark one')
  assert.match(printTokens, /--primary-text: #1d2528;/)
  const printApp = css.slice(css.indexOf('@media print'))
  assert.match(printApp, /main\.page \{\s*\n\s*max-width: none;/, 'print is not held to a screen column')
  assert.match(printApp, /\.brand-mark \{\s*\n\s*color: var\(--brand-primary\);/)
})

// ------------------------------------------------------- the rendered reference

test('the renderer takes the canonical HTML at all three widths, and writes derived images only', () => {
  const renderer = read('scripts/render-design.mjs')
  assert.match(renderer, /export const WIDTHS = \[1280, 768, 390\]/)
  // It reads the manifest rather than listing the four packs a second time.
  assert.match(renderer, /manifest\.surfaces\.map/)
  assert.match(renderer, /format: 'png'/)
  const manifest = JSON.parse(read('docs/design/approved/manifest.json')) as {
    renderedEvidence: { mechanism: string; widths: number[]; output: string }
    authority: { canonicalHtmlIsApplicationDesignAuthority: boolean; renderedReferenceIsDerivedOnly: boolean }
  }
  assert.equal(manifest.renderedEvidence.mechanism, 'scripts/render-design.mjs')
  assert.deepEqual(manifest.renderedEvidence.widths, [1280, 768, 390])
  assert.equal(manifest.authority.canonicalHtmlIsApplicationDesignAuthority, true)
  assert.equal(manifest.authority.renderedReferenceIsDerivedOnly, true)
  // The reference exists, under the surface names the manifest uses.
  for (const surface of ['home', 'connect', 'plan', 'mfa-readiness']) {
    for (const w of [1280, 768, 390]) {
      assert.ok(existsSync(`docs/design/approved/rendered/${surface}/${w}.png`), `no rendered reference for ${surface} at ${w}`)
    }
  }
})

test('the brand manifest says what production actually switched on, and no more', () => {
  assert.equal(brand.production.paletteApplied, true)
  assert.equal(brand.production.typographyApplied, true)
  assert.equal(brand.production.shellLogoApplied, true)
  // Task 030 applied the skin and said so; it explicitly had NOT restored the
  // anatomy, and this flag was false to say it. Packs 031-040 then restored all
  // four surfaces onto their packs and converged the three no pack governs, so
  // task 041 set it true: a flag reading false here now would be the brand
  // authority stating something false about its own repository.
  assert.equal(brand.production.pageCompositionRestored, true)
  assert.equal(brand.production.pageCompositionRestoredBy, '031-040')
  const designManifest = JSON.parse(read('docs/design/approved/manifest.json')) as { surfaces: { implementationState: string; productionAssumedConformant: boolean }[] }
  for (const s of designManifest.surfaces) {
    assert.equal(s.implementationState, 'restored')
    // Restored is not the same as certified. `productionAssumedConformant`
    // stays false on every surface for good: what a flag records is what
    // landed, and conformance is re-earned by the two-sided anatomy tests and
    // the rendered comparison every time the surface changes.
    assert.equal(s.productionAssumedConformant, false)
  }
})

test('the task 030 report exists and names its evidence', () => {
  const report = 'docs/design/reports/030-theme-typography-shell-foundation.md'
  assert.ok(existsSync(report), `${report} is the task's handoff artifact and is not optional`)
  const text = read(report)
  // By file NAME, not by directory. The four packs moved into
  // docs/design/approved/anatomy/ when the design folder was cleaned, and a
  // report written in the past is a record of what a past task did: it is not
  // edited to keep a later directory layout true. What must stay true is that
  // the report names the four authorities it worked against, and the hash.
  for (const needed of [
    'home-v2.html',
    'connect-v3.html',
    'plan-step-v1.html',
    'mfa-readiness-v2.html',
    '88b9a3a5907e78ad83f7c31dca00b86a2bdd741b9b4efca575254567d6e55a50',
    'scripts/render-design.mjs',
    'src/ui/tokens.ts',
  ]) {
    assert.ok(text.includes(needed), `the report does not name ${needed}`)
  }
})
