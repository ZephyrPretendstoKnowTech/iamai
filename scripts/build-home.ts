// Writes home/theme.css and home/index.html from the tool's own sources
// (prompt 47.1 Part 3 item 11; prompt 52 Part 1; rebuilt by task 016; the
// approved composition restored by task 038).
//
// The composition below is the owner's approved Home design,
// docs/design/approved/anatomy/home-v2.html, recorded in
// docs/design/approved/manifest.json. That file owns the anatomy — the public
// header, the hero and its meta row, the two-column product section with its
// side rail, the Reads / Compares / Plans rows, the label-and-explanation
// catches, the trust row, About and the footer, and the 760 and 560
// breakpoints. It does NOT own the words (docs/design/content.json) or the
// technical truth (what IAMAI reads, what it may not do): where the pack's
// placeholder copy and production's own accurate sentence disagree,
// production's sentence wins and the pack's shape keeps it
// (docs/design/authority-reconciliation.md).
//
// The home page wears the same palette, type scale and fonts as the planner
// (theme.css from the tokens), and every sentence it shows is a string in
// docs/design/content.json (pages.home; the footer is the app's, pages.footer;
// the theme control's labels are the app's, pages.app.shell), generated here so
// the home page and the app cannot drift. home.test.ts fails while either
// generated file and its source disagree, the way tokens.test.ts guards
// tokens.css.
//
// The page is the public header, the hero, four sections separated by rules
// rather than by boxes — what it does (with the baseline in its rail), what it
// catches, what it does with your tenant, About — and the footer. The two ways
// in are in the hero; the header and the rail carry the product entry the pack
// puts there, and nothing else on the page is a call to action.
//
// The fonts and the planner hrefs are referenced through the {{TOOL_PATH}}
// placeholder that scripts/assemble-site.mjs substitutes, so the path lives in
// one place (/planner/… on the published site).
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MARK_GEOMETRY, MARK_VIEWBOX } from '../src/brand/logo/mark.ts'
import { renderTokensCss } from '../src/ui/tokens.ts'
import { pages } from '../src/content/content.ts'

/** The planner, its sample-data view and its How page, under the substituted tool path. */
const PLANNER_HREF = '/{{TOOL_PATH}}/#/connect'
const DEMO_HREF = '/{{TOOL_PATH}}/?demo=1#/plan'
const HOW_HREF = '/{{TOOL_PATH}}/#/how'

/** The one destination that is the product itself: the header link, the hero's primary action, the rail's link. */
export const PRODUCT_ENTRY = PLANNER_HREF

/**
 * The opener the mockup retired: the old lede and the planner's old body. None
 * of these sentences may come back, on the page or in pages.home (home.test.ts
 * and the walk's home fixture both read this list).
 */
export const RETIRED_OPENER = [
  'IAMAI reads a Microsoft Entra tenant, compares it with a security baseline, and plans the rollout of that baseline',
  'catching the pitfalls of hardening',
  'the admin whose only method is a text message, the country rule that blocks its author, the account with no method at all',
  'no account to create',
  "Reads the tenant's configuration and all the available sign-in evidence",
  'readiness before either, nobody locked out',
  'Every step carries the portal clicks, the policy JSON, and the communications to send',
  'more baselines are coming, including the ability to load your own',
  'See it with sample data',
]

/** One row of what IAMAI does: the verb in the label column, the rest beside it. */
export type HomeBeat = { verb: string; text: string }
/** One thing IAMAI catches: what kind of problem it is, then the example. */
export type HomeCatch = { label: string; text: string }
/** One trust claim: what it is called, what it actually means, and where to check. */
export type HomeTrust = { title: string; body: string; link?: string; href?: string }
type Link = { text: string; href: string }
type HomeContent = {
  metaTitle: string
  metaDescription: string
  brand: string
  navHow: string
  navSource: Link
  eyebrow: string
  h1: string
  siteLine: string
  open: string
  demo: string
  heroMeta: string[]
  workLabel: string
  workHeading: string
  workLead: string
  work: HomeBeat[]
  baselineLabel: string
  baselineName: string
  baseline: string
  baselineGoal: string
  baselineNote: string
  catchesLabel: string
  catchesHeading: string
  catches: HomeCatch[]
  trustLabel: string
  trustHeading: string
  trust: HomeTrust[]
  aboutLabel: string
  aboutHeading: string
  about: string
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A button in one of the three weights (docs/design/connect-mockup.html): primary filled, secondary outlined, tertiary muted. */
function button(text: string, href: string, weight: 'primary' | 'secondary' | 'tertiary'): string {
  return `<a class="btn btn-${weight}" href="${href}">${esc(text)}</a>`
}

/** The small label over a heading, and the heading itself. */
function heading(id: string, label: string, text: string): string {
  return `<p class="eyebrow">${esc(label)}</p>
        <h2 id="${id}-heading">${esc(text)}</h2>`
}

/**
 * One section of the page: the small label the pack sets over the heading, the
 * heading itself, and the body — separated from the section above it by a rule.
 * Four of these and the hero are the whole page.
 *
 * The heading is an h2 everywhere. The pack draws the product section's as an
 * h3 with no h2 above it, which is a heading level skipped; the level is
 * production's to keep and the size is the pack's to set (`.band-lead h2`).
 */
function section(id: string, label: string, text: string, body: string): string {
  return `<section class="band" aria-labelledby="${id}-heading">
        ${heading(id, label, text)}
        ${body}
      </section>`
}

/** Reads / Compares / Plans: the verb in its own column, the rest beside it, a hairline between. */
export function beatRows(beats: HomeBeat[]): string {
  return `<div class="steps">
              ${beats.map((b) => `<div class="step"><b>${esc(b.verb)}</b><span>${esc(b.text)}</span></div>`).join('\n              ')}
            </div>`
}

/** What IAMAI catches before a change goes live: the kind of problem, then the example. */
export function catchRows(items: HomeCatch[]): string {
  return `<div class="catches">
          ${items.map((c) => `<div class="catch"><b>${esc(c.label)}</b><span>${esc(c.text)}</span></div>`).join('\n          ')}
        </div>`
}

/**
 * What IAMAI does with the tenant: each claim led by its name, then said in
 * terms someone can check. Specific architecture, not reassurance — one row of
 * short statements, the last carrying the source to read.
 */
export function trustRow(items: HomeTrust[]): string {
  return `<div class="trust">
          ${items
            .map((t) => `<span><strong>${esc(t.title)}</strong> ${esc(t.body)}${t.link && t.href ? ` <a class="lnk" href="${t.href}">${esc(t.link)}</a>` : ''}</span>`)
            .join('\n          ')}
        </div>`
}

/**
 * The side rail beside what IAMAI does: the standard the plan is measured
 * against, and the way in. Narrower than the column it sits beside, separated
 * by a left border on a wide screen and by a top border under 760.
 */
export function baselineRail(h: HomeContent): string {
  return `<aside class="side">
            <p class="label">${esc(h.baselineLabel)}</p>
            <strong>${esc(h.baselineName)}</strong>
            <p>${esc(h.baseline)}</p>
            <p>${esc(h.baselineGoal)}</p>
            <p class="small">${esc(h.baselineNote)}</p>
            <p class="small"><a class="enter" href="${PRODUCT_ENTRY}">${esc(h.open)}</a></p>
          </aside>`
}

export function renderHomeTheme(): string {
  return renderTokensCss()
    .replace(/^\/\* GENERATED[\s\S]*?\*\/\n/, '/* GENERATED from src/ui/tokens.ts by scripts/build-home.ts (run by vite build). Do not edit by hand:\n   home.test.ts fails when this file and tokens.ts disagree. */\n')
    .replaceAll("url('/fonts/", "url('/{{TOOL_PATH}}/fonts/")
}

export function renderHomeHtml(): string {
  const h = pages.home as unknown as HomeContent
  const shell = pages.app.shell as { lightTheme: string; darkTheme: string; themeTooltip: string }
  const footer = pages.footer as { links: Link[] }
  // The footer is the app's (pages.footer), in the arrangement the pack draws:
  // the product's name on the left, the public links on the right. The link
  // back to this page is the name on the left, so it is not repeated as a link
  // to itself on the right.
  const footerLinks = footer.links
    .filter((l) => !/^https:\/\/getiamai\.com\/?$/.test(l.href))
    .map((l, i) => `${i > 0 ? ' · ' : ''}<a href="${l.href}"${l.href.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${esc(l.text)}</a>`)
    .join('')
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- Never cached, for the same reason as the planner entry (prompt 40 §25). -->
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>${esc(h.metaTitle)}</title>
    <meta name="description" content="${esc(h.metaDescription)}" />
    <meta property="og:title" content="${esc(h.metaTitle)}" />
    <meta property="og:description" content="${esc(h.metaDescription)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://getiamai.com/" />
    <meta property="og:image" content="https://getiamai.com/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <!-- The Threshold app icon (task 029). One master, src/brand/logo/iamai-threshold-master.svg,
         derived by scripts/gen-brand.mjs into public/brand/ and published at the site root by
         scripts/assemble-site.mjs. What was here before was a placeholder drawn inline. -->
    <link rel="icon" type="image/svg+xml" href="/brand/favicon.svg" />
    <link rel="alternate icon" type="image/png" sizes="32x32" href="/brand/favicon-32.png" />
    <!-- The planner's tokens (home/theme.css, written by scripts/build-home.ts), then this page's few rules. -->
    <link rel="stylesheet" href="/theme.css" />
    <link rel="stylesheet" href="/home.css" />
  </head>
  <body>
    <!-- The public header the pack draws: the lockup on the left, the public
         links on the right, the product entry last. It is lighter than the
         planner's shell and carries no signed-in state — no tabs, no Account. -->
    <header class="app">
      <a class="wordmark" href="/">
        <svg width="20" height="20" viewBox="${MARK_VIEWBOX}" fill="currentColor" aria-hidden="true" focusable="false">${MARK_GEOMETRY}</svg>
        ${esc(h.brand)}
      </a>
      <div class="right">
        <nav class="links">
          <a href="${HOW_HREF}">${esc(h.navHow)}</a>
          <a href="${h.navSource.href}" target="_blank" rel="noopener noreferrer">${esc(h.navSource.text)}</a>
          <a class="enter" href="${PRODUCT_ENTRY}">${esc(h.open)}</a>
        </nav>
        <!-- The theme control is text, not a button face, the way the app's is (AppShell). -->
        <button class="text-control" id="theme" type="button" title="${esc(shell.themeTooltip)}">${esc(shell.darkTheme)}</button>
      </div>
    </header>

    <main class="page">
      <!-- The outcome, what IAMAI does about it, the two ways in, and the three
           claims the trust section below spends the rest of the page proving. -->
      <div class="hero">
        <p class="eyebrow">${esc(h.eyebrow)}</p>
        <h1>${esc(h.h1)}</h1>
        <p class="site-line">${esc(h.siteLine)}</p>
        <p class="actions">
          ${button(h.open, PRODUCT_ENTRY, 'primary')}
          ${button(h.demo, DEMO_HREF, 'secondary')}
        </p>
        <p class="meta">
          ${h.heroMeta.map((m) => `<span>${esc(m)}</span>`).join('\n          ')}
        </p>
      </div>

      <!-- What IAMAI does, and beside it the standard it is doing it against.
           The heading sits inside the wider column, not above both, so the
           rail's own label starts level with it (the pack's product grid). -->
      <section class="band band-lead" aria-labelledby="work-heading">
        <div class="product">
          <div>
            ${heading('work', h.workLabel, h.workHeading)}
            <p class="lead">${esc(h.workLead)}</p>
            ${beatRows(h.work)}
          </div>
          ${baselineRail(h)}
        </div>
      </section>

      ${section('catches', h.catchesLabel, h.catchesHeading, catchRows(h.catches))}

      ${section('trust', h.trustLabel, h.trustHeading, trustRow(h.trust))}

      ${section('about', h.aboutLabel, h.aboutHeading, `<div class="about"><p>${esc(h.about)}</p></div>`)}
    </main>

    <footer class="app">
      <span>${esc(h.brand)}</span>
      <span class="footer-links">${footerLinks}</span>
    </footer>

    <!-- The theme control shares the planner's key and labels (prompt 47.1 item 12): a choice made on either side
         carries to the other; prefers-color-scheme decides a first visit. Inline, same origin, nothing fetched. -->
    <script>
      ;(function () {
        var key = 'iamai-theme'
        var labels = ${JSON.stringify({ light: shell.lightTheme, dark: shell.darkTheme })}
        var root = document.documentElement
        var button = document.getElementById('theme')
        function stored() {
          try {
            return localStorage.getItem(key)
          } catch (e) {
            return null
          }
        }
        function system() {
          return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        }
        function apply(theme) {
          if (theme) root.setAttribute('data-theme', theme)
          else root.removeAttribute('data-theme')
          button.textContent = (theme || system()) === 'dark' ? labels.light : labels.dark
        }
        apply(stored())
        button.addEventListener('click', function () {
          var next = (stored() || system()) === 'dark' ? 'light' : 'dark'
          try {
            localStorage.setItem(key, next)
          } catch (e) {}
          apply(next)
        })
      })()
    </script>
  </body>
</html>
`
}

/**
 * A stylesheet's published name: its content hash in the file name
 * (home.css → home.3f2a9c1e.css), the way vite names the planner's assets. A
 * changed sheet is a new URL, so no edge or browser cache can dress the new
 * page in the old rules: the site's stylesheets are cached for hours where its
 * HTML is not, and a deploy that changed both once rendered the new structure
 * with no styling for everyone who held the old sheet.
 */
export function versionedName(name: string, text: string): string {
  return name.replace(/\.css$/, `.${createHash('sha256').update(text).digest('hex').slice(0, 8)}.css`)
}

/**
 * The published page over the tool path: index.html with each stylesheet link
 * pointed at the sheet's versioned name, and the sheets under those names.
 * scripts/assemble-site.mjs writes these into dist/; home.test.ts renders them.
 */
export function assembleHome(html: string, sheets: Record<string, string>, toolPath: string): Record<string, string> {
  const sub = (s: string): string => s.replaceAll('{{TOOL_PATH}}', toolPath)
  const out: Record<string, string> = {}
  let page = sub(html)
  for (const [name, text] of Object.entries(sheets)) {
    const link = `href="/${name}"`
    if (!page.includes(link)) throw new Error(`assembleHome: the page does not link /${name}`)
    const versioned = versionedName(name, sub(text))
    page = page.replaceAll(link, `href="/${versioned}"`)
    out[versioned] = sub(text)
  }
  out['index.html'] = page
  return out
}

export function buildHome(): void {
  writeFileSync('home/theme.css', renderHomeTheme())
  writeFileSync('home/index.html', renderHomeHtml())
  console.log('build-home: wrote home/theme.css and home/index.html')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) buildHome()
