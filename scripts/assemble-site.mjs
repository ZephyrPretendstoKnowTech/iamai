// Assembles the published site (prompt 35 §1).
//
//   dist/                 the home page, its stylesheet, the OG image, CNAME
//   dist/<TOOL_PATH>/     the planner, built by vite with a matching base
//
// Vite copies public/ into its own outDir, which is now the tool folder, so
// CNAME is placed here instead: it has to sit at the site root or the custom
// domain is dropped.
//
// The home page is hand-written HTML with no framework. Its theme file is
// written from the planner's tokens by scripts/build-home.ts (run by vite
// build); this script only substitutes the tool path and expands the tool rows
// from home/tools.json, so adding a tool later is a data change and the path
// lives in exactly one place.
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
// The status as a dot and a word, in the planner's status colours (prompt 47.1 Part 3 item 13).
const STATUS_TONE = { live: 'ok', testing: 'wait', planned: 'idle' }

/** One row per tool, in the order the data file lists them: name and descriptor, the sentence, the status. */
function toolRows() {
  const tools = JSON.parse(readFileSync(join(home, 'tools.json'), 'utf8'))
  return tools
    .map((t) => {
      // A row may name where in the tool it lands (prompt 47 Part 3: the planner opens at Connect).
      const href = t.path === null ? null : `/${t.path === '' ? TOOL_PATH : t.path}/${t.hash ?? ''}`
      const status = STATUS_LABEL[t.status] ?? t.status
      const name = href ? `<a href="${href}">${t.name}</a>` : t.name
      const descriptor = t.descriptor ? ` <span class="descriptor">${t.descriptor}</span>` : ''
      return `      <div class="tool-row">
        <p class="tool-name">${name}${descriptor}</p>
        <p class="tool-desc">${t.description}</p>
        <span class="status status-${STATUS_TONE[t.status] ?? 'idle'}">${status}</span>
      </div>`
    })
    .join('\n')
}

const html = readFileSync(join(home, 'index.html'), 'utf8')
  .replaceAll('{{TOOL_PATH}}', TOOL_PATH)
  .replace('<!-- tools -->', toolRows())

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
