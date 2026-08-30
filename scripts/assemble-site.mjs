// Assembles the published site (prompt 35 §1).
//
//   dist/                 the home page, its stylesheet, the OG image, CNAME
//   dist/<TOOL_PATH>/     the planner, built by vite with a matching base
//
// Vite copies public/ into its own outDir, which is now the tool folder, so
// CNAME is placed here instead: it has to sit at the site root or the custom
// domain is dropped.
//
// The home page is hand-written HTML with no framework and no build step. This
// script only substitutes the tool path and expands the tool cards from
// home/tools.json, so adding a tool later is a data change and the path lives
// in exactly one place.
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

const STATUS_LABEL = { live: 'Live', testing: 'In testing', planned: 'Planned' }

/** One card per tool, in the order the data file lists them. */
function toolCards() {
  const tools = JSON.parse(readFileSync(join(home, 'tools.json'), 'utf8'))
  return tools
    .map((t) => {
      const href = t.path === null ? null : `/${t.path === '' ? TOOL_PATH : t.path}/`
      const status = STATUS_LABEL[t.status] ?? t.status
      const inner = `
        <h3>${t.name}</h3>
        <p>${t.description}</p>
        <span class="chip chip-${t.status}">${status}</span>`
      return href
        ? `      <a class="tool-card" href="${href}">${inner}
      </a>`
        : `      <div class="tool-card is-inert">${inner}
      </div>`
    })
    .join('\n')
}

const html = readFileSync(join(home, 'index.html'), 'utf8')
  .replaceAll('{{TOOL_PATH}}', TOOL_PATH)
  .replace('<!-- tools -->', toolCards())

if (html.includes('{{') || html.includes('<!-- tools -->')) {
  console.error('assemble-site: a placeholder was left unsubstituted in the home page.')
  process.exit(1)
}

mkdirSync(dist, { recursive: true })
writeFileSync(join(dist, 'index.html'), html)

// Everything else in home/ except the template and its data. Text files get
// the same substitution, so the tool path stays in one place there too.
for (const name of readdirSync(home)) {
  if (name === 'index.html' || name === 'tools.json') continue
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
