// Writes home/theme.css and home/index.html from the tool's own sources
// (prompt 47.1 Part 3 item 11; prompt 52 Part 1). The home page wears the same
// palette, type scale and fonts as the planner (theme.css from the tokens), and
// every sentence it shows is a string in docs/design/content.json (pages.home),
// generated here so the home page and the app cannot drift. home.test.ts fails
// while either generated file and its source disagree, the way tokens.test.ts
// guards tokens.css.
//
// The fonts and the planner hrefs are referenced through the {{TOOL_PATH}}
// placeholder that scripts/assemble-site.mjs substitutes, so the path lives in
// one place (/rollout/… on the published site).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderTokensCss } from '../src/ui/tokens.ts'
import { pages } from '../src/content/content.ts'

const LINKEDIN = 'https://www.linkedin.com/in/lachlanrobinette/'
const GITHUB = 'https://github.com/ZephyrPretendstoKnowTech'
const REPO = 'https://github.com/ZephyrPretendstoKnowTech/iamai'
const MAILTO = 'mailto:feedback@getiamai.com'
/** The planner and its sample-data view, under the substituted tool path. */
const PLANNER_HREF = '/{{TOOL_PATH}}/#/connect'
const DEMO_HREF = '/{{TOOL_PATH}}/?demo=1#/plan'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** A sentence with one token turned into a link (the repo, in the source bullet). */
function linkify(text: string, token: string, href: string): string {
  const i = text.indexOf(token)
  if (i < 0) return esc(text)
  return esc(text.slice(0, i)) + `<a href="${href}">${esc(token)}</a>` + esc(text.slice(i + token.length))
}

/** The href for an About or footer link, from its visible text. */
function hrefFor(label: string): string {
  if (/linkedin/i.test(label) || label === 'Lachlan Robinette') return LINKEDIN
  if (label === 'Source') return REPO
  if (/github/i.test(label)) return GITHUB
  if (label.includes('@')) return MAILTO
  return REPO
}

export function renderHomeTheme(): string {
  return renderTokensCss()
    .replace(/^\/\* GENERATED[\s\S]*?\*\/\n/, '/* GENERATED from src/ui/tokens.ts by scripts/build-home.ts (run by vite build). Do not edit by hand:\n   home.test.ts fails when this file and tokens.ts disagree. */\n')
    .replaceAll("url('/fonts/", "url('/{{TOOL_PATH}}/fonts/")
}

export function renderHomeHtml(): string {
  const h = pages.home as unknown as {
    metaTitle: string
    metaDescription: string
    h1: string
    intro: string
    toolsLabel: string
    planner: { name: string; descriptor: string; label: string; body: string; open: string; demo: string }
    howLabel: string
    how: string[]
    aboutLabel: string
    about: string
    aboutLinks: string[]
    footer: string
    footerLinks: string[]
  }
  const pl = h.planner
  const aboutLinks = h.aboutLinks.map((l) => `<a href="${hrefFor(l)}">${esc(l)}</a>`).join('\n        ')
  const footerLinks = h.footerLinks.map((l) => `<a href="${hrefFor(l)}">${esc(l)}</a>`).join('\n        ')
  // The source bullet names the repository; everything else is plain text.
  const howItems = h.how
    .map((line) => `<li>${line.includes('github.com/') ? linkify(line, 'github.com/ZephyrPretendstoKnowTech/iamai', REPO) : esc(line)}</li>`)
    .join('\n        ')
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
        IAMAI
      </a>
      <div class="right">
        <button class="btn" id="theme" type="button" title="Switch between dark and light themes">Dark theme</button>
      </div>
    </header>

    <main class="page">
      <h1>${esc(h.h1)}</h1>
      <p class="lede">${esc(h.intro)}</p>

      <h2 id="tools-heading">${esc(h.toolsLabel)}</h2>
      <div class="rows" aria-labelledby="tools-heading">
        <div class="tool-card">
          <p class="tool-name"><a href="${PLANNER_HREF}">${esc(pl.name)}</a> <span class="pill">${esc(pl.label)}</span></p>
          <p class="descriptor">${esc(pl.descriptor)}</p>
          <p class="tool-desc">${esc(pl.body)}</p>
          <p class="tool-actions">
            <a class="tool-open" href="${PLANNER_HREF}">${esc(pl.open)}</a>
            <a class="tool-demo" href="${DEMO_HREF}">${esc(pl.demo)}</a>
          </p>
        </div>
      </div>

      <h2 id="how-heading">${esc(h.howLabel)}</h2>
      <ul aria-labelledby="how-heading">
        ${howItems}
      </ul>

      <h2 id="about-heading">${esc(h.aboutLabel)}</h2>
      <p>${esc(h.about)}</p>
      <p class="links">
        ${aboutLinks}
      </p>
    </main>

    <footer class="app">
      <span>${esc(h.footer)}</span>
      <span class="footer-links">
        ${footerLinks}
      </span>
    </footer>

    <!-- The theme control shares the planner's key and labels (prompt 47.1 item 12): a choice made on either side
         carries to the other; prefers-color-scheme decides a first visit. Inline, same origin, nothing fetched. -->
    <script>
      ;(function () {
        var key = 'iamai-theme'
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
          button.textContent = (theme || system()) === 'dark' ? 'Light theme' : 'Dark theme'
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

export function buildHome(): void {
  writeFileSync('home/theme.css', renderHomeTheme())
  writeFileSync('home/index.html', renderHomeHtml())
  console.log('build-home: wrote home/theme.css and home/index.html')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) buildHome()
