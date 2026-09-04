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
// pages.home and the planner's tokens; this script only substitutes the tool
// path, so the path lives in exactly one place.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const TOOL_PATH = process.env.TOOL_PATH ?? 'rollout'
const dist = join(root, 'dist')
const home = join(root, 'home')

if (!existsSync(join(dist, TOOL_PATH, 'index.html'))) {
  console.error(`assemble-site: dist/${TOOL_PATH}/index.html is missing. Run the app build first.`)
  process.exit(1)
}

const html = readFileSync(join(home, 'index.html'), 'utf8').replaceAll('{{TOOL_PATH}}', TOOL_PATH)

if (html.includes('{{')) {
  console.error('assemble-site: a placeholder was left unsubstituted in the home page.')
  process.exit(1)
}

mkdirSync(dist, { recursive: true })
writeFileSync(join(dist, 'index.html'), html)

// Everything else in home/ except the template. Text files get the same
// substitution, so the tool path stays in one place there too.
for (const name of readdirSync(home)) {
  if (name === 'index.html') continue
  if (/\.(css|js|svg|txt|webmanifest)$/.test(name)) {
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
