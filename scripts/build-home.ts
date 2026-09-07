// Writes home/theme.css and home/index.html from the tool's own sources
// (prompt 47.1 Part 3 item 11; prompt 52 Part 1; the owner-approved Home v2
// direction, task 016). The home page wears the same palette, type scale and
// fonts as the planner (theme.css from the tokens), and every sentence it shows
// is a string in docs/design/content.json (pages.home; the footer is the app's,
// pages.footer; the theme control's labels are the app's, pages.app.shell),
// generated here so the home page and the app cannot drift. home.test.ts fails
// while either generated file and its source disagree, the way tokens.test.ts
// guards tokens.css.
//
// The page is six sections in one column, separated by rules rather than by
// boxes: the hero (the outcome, what IAMAI does about it, the two ways in), What
// it does (Reads / Compares / Plans), the standard it plans towards, what it
// catches before a change goes live, what it does with your tenant, and About.
// The one pair of actions is in the hero; no section repeats them, and the tool
// card, its Preview pill and the Tools grid left with the v2 direction.
//
// The fonts and the planner hrefs are referenced through the {{TOOL_PATH}}
// placeholder that scripts/assemble-site.mjs substitutes, so the path lives in
// one place (/planner/… on the published site).
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderTokensCss } from '../src/ui/tokens.ts'
import { pages } from '../src/content/content.ts'

/** The planner and its sample-data view, under the substituted tool path. */
const PLANNER_HREF = '/{{TOOL_PATH}}/#/connect'
const DEMO_HREF = '/{{TOOL_PATH}}/?demo=1#/plan'

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

/** One beat of what IAMAI does: the verb, then the rest of the sentence. */
export type HomeBeat = { verb: string; text: string }
/** One trust claim: what it is called, what it actually means, and where to check. */
export type HomeTrust = { title: string; body: string; link?: string; href?: string }
type HomeContent = {
  metaTitle: string
  metaDescription: string
  brand: string
  h1: string
  siteLine: string
  open: string
  demo: string
  heroNote: string
  workLabel: string
  work: HomeBeat[]
  baselineLabel: string
  baseline: string
  baselineGoal: string
  baselineNote: string
  catchesLabel: string
  catches: string[]
  trustLabel: string
  trust: HomeTrust[]
  aboutLabel: string
  about: string
  aboutLinks: { text: string; href: string }[]
}
type Link = { text: string; href: string }

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A button in one of the three weights (docs/design/connect-mockup.html): primary filled, secondary outlined, tertiary muted. */
function button(text: string, href: string, weight: 'primary' | 'secondary' | 'tertiary'): string {
  return `<a class="btn btn-${weight}" href="${href}">${esc(text)}</a>`
}

/**
 * One section of the page: a heading and its body, separated from the one above
 * it by a rule. Six of these and the hero are the whole page — the v2 direction
 * puts the hierarchy in the type and the spacing, not in a wall of boxes.
 */
function section(id: string, title: string, body: string): string {
  return `<section class="band" aria-labelledby="${id}-heading">
        <h2 id="${id}-heading">${esc(title)}</h2>
        ${body}
      </section>`
}

/** Reads / Compares / Plans: the verb in the page's weight, the rest after it. */
export function beatList(beats: HomeBeat[]): string {
  return `<ul class="beats">
          ${beats.map((b) => `<li><b>${esc(b.verb)}</b> ${esc(b.text)}</li>`).join('\n          ')}
        </ul>`
}

/** What IAMAI catches before a change goes live: a plain list, no cards. */
export function catchList(items: string[]): string {
  return `<ul class="catch">
          ${items.map((c) => `<li>${esc(c)}</li>`).join('\n          ')}
        </ul>`
}

/**
 * What IAMAI does with the tenant: each claim named, then said in terms someone
 * can check. Specific architecture, not reassurance — a definition list, so the
 * claim and its evidence stay attached.
 */
export function trustList(items: HomeTrust[]): string {
  return `<dl class="trust">
          ${items
            .map(
              (t) =>
                `<dt>${esc(t.title)}</dt>\n          <dd>${esc(t.body)}${t.link && t.href ? ` <a class="lnk" href="${t.href}">${esc(t.link)}</a>` : ''}</dd>`,
            )
            .join('\n          ')}
        </dl>`
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
  const aboutButtons = h.aboutLinks.map((l, i) => button(l.text, l.href, i === 0 ? 'secondary' : 'tertiary')).join('\n          ')
  // The footer is the app's (AppShell's Footer, pages.footer): the same four links, joined the same way; the home link and the mail link open in place.
  const footerLinks = footer.links
    .map((l, i) => `${i > 0 ? ' | ' : ''}<a href="${l.href}"${/^https:\/\/getiamai\.com\/?$/.test(l.href) || l.href.startsWith('mailto:') ? '' : ' target="_blank" rel="noopener noreferrer"'}>${esc(l.text)}</a>`)
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
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%23FBF9F5'/%3E%3Ccircle cx='16' cy='16' r='3.5' fill='%230B5B57'/%3E%3Cpath d='M16 7 A9 9 0 1 1 7 16' fill='none' stroke='%230B5B57' stroke-width='2.4' stroke-linecap='round'/%3E%3C/svg%3E"
    />
    <!-- The planner's tokens (home/theme.css, written by scripts/build-home.ts), then this page's few rules. -->
    <link rel="stylesheet" href="/theme.css" />
    <link rel="stylesheet" href="/home.css" />
  </head>
  <body>
    <header class="app">
      <a class="wordmark" href="/">
        <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <circle cx="16" cy="16" r="4" fill="currentColor" />
          <path d="M16 6 A10 10 0 1 1 6 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
        </svg>
        ${esc(h.brand)}
      </a>
      <div class="right">
        <!-- The theme control is text, not a button face, the way the app's is (AppShell). -->
        <button class="text-control" id="theme" type="button" title="${esc(shell.themeTooltip)}">${esc(shell.darkTheme)}</button>
      </div>
    </header>

    <main class="page">
      <!-- The outcome, what IAMAI does about it, and the two ways in. The only
           actions on the page: no section below repeats them. -->
      <div class="hero">
        <h1>${esc(h.h1)}</h1>
        <p class="site-line">${esc(h.siteLine)}</p>
        <p class="actions">
          ${button(h.open, PLANNER_HREF, 'primary')}
          ${button(h.demo, DEMO_HREF, 'secondary')}
        </p>
        <p class="note">${esc(h.heroNote)}</p>
      </div>

      ${section('work', h.workLabel, beatList(h.work))}

      ${section('baseline', h.baselineLabel, `<p>${esc(h.baseline)}</p>\n        <p>${esc(h.baselineGoal)}</p>\n        <p class="note">${esc(h.baselineNote)}</p>`)}

      ${section('catches', h.catchesLabel, catchList(h.catches))}

      ${section('trust', h.trustLabel, trustList(h.trust))}

      ${section('about', h.aboutLabel, `<p>${esc(h.about)}</p>\n        <p class="actions">\n          ${aboutButtons}\n        </p>`)}
    </main>

    <footer class="app">
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
