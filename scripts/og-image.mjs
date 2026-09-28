// The picture a link to getiamai.com shows where it is shared (LinkedIn, Teams,
// Slack): the brand's lockup, Home's eyebrow and headline, and the address. It
// is drawn from the same sources as Home (pages.home in content.json, the dark
// mark, the self-hosted Plex faces and the dark palette in the brand manifest),
// so it is made again whenever the headline changes:
//
//   node scripts/og-image.mjs        writes home/og.png (1200 x 630)
//
// Chrome draws a page with everything inlined (fonts as data URIs), so nothing
// is fetched while it renders.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const OUT = resolve(root, 'home/og.png')
const home = JSON.parse(readFileSync(resolve(root, 'docs/design/content.json'), 'utf8')).pages.home
const brand = JSON.parse(readFileSync(resolve(root, 'docs/brand/brand-manifest.json'), 'utf8'))
const dark = brand.palette.dark
const mark = readFileSync(resolve(root, brand.logo.assets.dark), 'utf8').replace(/<title>[\s\S]*?<\/title>|<desc>[\s\S]*?<\/desc>/g, '')
const font = (file) => `data:font/woff2;base64,${readFileSync(resolve(root, 'public/fonts', file)).toString('base64')}`
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')

const CHROME = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean).find((p) => existsSync(p))
if (!CHROME) {
  console.error('og-image: no Chrome binary found; set CHROME=/path/to/chrome')
  process.exit(2)
}

const page = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'IBM Plex Sans'; font-weight: 700; src: url(${font('IBMPlexSans-Bold-Latin1.woff2')}) format('woff2') }
@font-face { font-family: 'IBM Plex Sans'; font-weight: 600; src: url(${font('IBMPlexSans-SemiBold-Latin1.woff2')}) format('woff2') }
@font-face { font-family: 'IBM Plex Serif'; font-weight: 700; src: url(${font('IBMPlexSerif-Bold-Latin1.woff2')}) format('woff2') }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden }
body { background: ${dark.canvas}; color: ${dark.primaryText}; font-family: 'IBM Plex Sans', sans-serif; box-sizing: border-box; padding: 72px 84px; display: flex; flex-direction: column }
.lockup { display: flex; align-items: center; gap: ${brand.logo.wordmark.gapEmOfMark * 44}px }
.lockup svg { width: 44px; height: 44px; display: block }
.lockup span { font-weight: 700; font-size: 40px; letter-spacing: ${brand.logo.wordmark.letterSpacingEm}em }
.eyebrow { margin: 96px 0 0; color: ${dark.brandPrimary}; font-weight: 600; font-size: 24px; letter-spacing: 0.08em; text-transform: uppercase }
h1 { margin: 20px 0 0; font-family: 'IBM Plex Serif', serif; font-weight: 700; font-size: 66px; line-height: 1.12; max-width: 1000px }
.site { margin-top: auto; color: ${dark.secondaryText}; font-weight: 600; font-size: 26px }
</style></head><body>
<div class="lockup">${mark}<span>${esc(home.brand)}</span></div>
<p class="eyebrow">${esc(home.eyebrow)}</p>
<h1>${esc(home.h1)}</h1>
<div class="site">getiamai.com</div>
</body></html>`

const dir = mkdtempSync(join(tmpdir(), 'iamai-og-'))
try {
  const html = join(dir, 'og.html')
  writeFileSync(html, page)
  const run = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', `--user-data-dir=${join(dir, 'profile')}`, `--screenshot=${OUT}`, pathToFileURL(html).href], { stdio: 'pipe', timeout: 60_000 })
  if (run.status !== 0 || !existsSync(OUT)) {
    console.error(`og-image: Chrome did not write the picture (exit ${run.status})\n${run.stderr}`)
    process.exit(1)
  }
  console.log(`og-image: wrote ${OUT}`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
