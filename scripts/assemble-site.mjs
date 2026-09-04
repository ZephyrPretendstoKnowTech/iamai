// Assembles the published site (prompt 35 §1).
//
//   dist/                 the home page, its stylesheet, the OG image, CNAME
//   dist/<TOOL_PATH>/     the planner, built by vite with a matching base
//
// Vite copies public/ into its own outDir, which is now the tool folder, so
// CNAME is placed here instead: it has to sit at the site root or the custom
// domain is dropped.
//
// The home page is generated HTML with no framework: scripts/build-home.ts
// (run by vite build) writes it and its theme file from content.json's
// pages.home and the planner's tokens; this script substitutes the tool path,
// so the path lives in exactly one place, and publishes the stylesheets under
// their content-hashed names (assembleHome), so a changed sheet is a new URL.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { assembleHome } from './build-home.ts'

const root = resolve(import.meta.dirname, '..')
const TOOL_PATH = process.env.TOOL_PATH ?? 'rollout'
const dist = join(root, 'dist')
const home = join(root, 'home')

if (!existsSync(join(dist, TOOL_PATH, 'index.html'))) {
  console.error(`assemble-site: dist/${TOOL_PATH}/index.html is missing. Run the app build first.`)
  process.exit(1)
}

// The page and its stylesheets, the sheets under their versioned names.
const sheets = Object.fromEntries(readdirSync(home).filter((n) => n.endsWith('.css')).map((n) => [n, readFileSync(join(home, n), 'utf8')]))
const built = assembleHome(readFileSync(join(home, 'index.html'), 'utf8'), sheets, TOOL_PATH)

mkdirSync(dist, { recursive: true })
for (const [name, text] of Object.entries(built)) {
  if (text.includes('{{')) {
    console.error(`assemble-site: a placeholder was left unsubstituted in ${name}.`)
    process.exit(1)
  }
  writeFileSync(join(dist, name), text)
}

// Everything else in home/ except the template and the sheets. Text files get
// the same substitution, so the tool path stays in one place there too.
for (const name of readdirSync(home)) {
  if (name === 'index.html' || name.endsWith('.css')) continue
  if (/\.(js|svg|txt|webmanifest)$/.test(name)) {
    const text = readFileSync(join(home, name), 'utf8').replaceAll('{{TOOL_PATH}}', TOOL_PATH)
    if (text.includes('{{')) {
      console.error(`assemble-site: a placeholder was left unsubstituted in home/${name}.`)
      process.exit(1)
    }
    writeFileSync(join(dist, name), text)
    continue
  }
  cpSync(join(home, name), join(dist, name), { recursive: true })
}

// The custom domain has to be declared at the site root, not inside the tool.
cpSync(join(root, 'public', 'CNAME'), join(dist, 'CNAME'))

console.log(`assemble-site: home page at dist/index.html, planner at dist/${TOOL_PATH}/`)
