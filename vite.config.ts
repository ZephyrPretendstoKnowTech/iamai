import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { planner } from './src/content/content.ts'
import { buildHome } from './scripts/build-home.ts'
import { demoFacts } from './src/ui/demoFacts.ts'

// Dev-only: lets the spike harness save raw result JSON to docs/spikes/raw/.
// This middleware exists only in the local dev server; the shipped app is a
// static bundle with no server (SPEC §2).
function spikeCapture(): Plugin {
  return {
    name: 'dev-spike-capture',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__spike/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const name = (new URL(req.url ?? '', 'http://localhost').searchParams.get('name') ?? 'spike')
          .replace(/[^a-z0-9-]/gi, '')
        let body = ''
        req.on('data', (chunk: string | Buffer) => {
          body += chunk
        })
        req.on('end', () => {
          const dir = resolve(import.meta.dirname, 'docs/spikes/raw')
          mkdirSync(dir, { recursive: true })
          const file = resolve(dir, `${name || 'spike'}.json`)
          writeFileSync(file, body)
          server.config.logger.info(`[spike-capture] wrote ${file}`)
          res.end('ok')
        })
      })
    },
  }
}

// The sample tenant's four facts for the signed-out Connect page, computed here
// at build time from the demo fixture through the plan engine (ui/demoFacts.ts)
// and served as `virtual:demo-facts`, four numbers: the page never loads the
// demo chunk, which loads in demo mode and nowhere else (ui/demoChunk.test.ts).
function demoFactsModule(): Plugin {
  const id = 'virtual:demo-facts'
  const resolved = '\0' + id
  return {
    name: 'demo-facts',
    resolveId(source) {
      return source === id ? resolved : null
    },
    load(moduleId) {
      return moduleId === resolved ? `export default ${JSON.stringify(demoFacts())}` : null
    },
  }
}

// The page title, from content.json's pages.home.planner (prompt 47.1 Part 4): the name
// and the descriptor, joined the way a browser tab expects.
function productTitle(): Plugin {
  return {
    name: 'product-title',
    transformIndexHtml(html) {
      return html.replace('__PRODUCT_TITLE__', `${planner.name} — ${planner.descriptor}`)
    },
  }
}

// The home page's theme file, from the same tokens as the bundle (prompt 47.1
// Part 3 item 11): written on every build so the two cannot drift.
function homeTheme(): Plugin {
  return {
    name: 'home-theme',
    apply: 'build',
    buildStart() {
      buildHome()
    },
  }
}

// The tool version a person can quote in a feedback email (prompt 34 §2).
const APP_VERSION = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')).version

// The commit this bundle was built from, and when (prompt 40 §24). Seven
// consecutive red CI runs went unnoticed across prompts 36 to 39 partly because
// nothing on the page said which commit was being looked at: a stale bundle and
// a fresh one are indistinguishable without it. GITHUB_SHA is set by Actions;
// git is the fallback locally, and 'dev' when neither answers.
function commitSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return 'dev'
  }
}
const BUILD_COMMIT = commitSha()
// Whole days only. A build time to the minute is a number nobody reads and a
// diff on every rebuild.
const BUILD_DATE = new Date().toISOString().slice(0, 10)

// Where this tool lives under the domain (prompt 35 §1). getiamai.com/ is the
// home page for IAMAI as a whole; the planner sits in a folder beside any
// future tool. One constant: if the tool is ever renamed, this changes and
// nothing else does. scripts/assemble-site.mjs reads the same value.
export const TOOL_PATH = process.env.TOOL_PATH ?? 'rollout'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
    __TOOL_PATH__: JSON.stringify(TOOL_PATH),
    __BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
  // Derived from TOOL_PATH so the base and the output folder cannot disagree.
  // VITE_BASE still overrides it for hosting that is not the custom domain
  // (the github.io fallback serves from /<repo>/); BASE_PATH stays accepted as
  // the older name. Routing is hash-based and the baseline index fetches by
  // absolute URL, so nothing else has to change between them.
  base: process.env.VITE_BASE ?? process.env.BASE_PATH ?? `/${TOOL_PATH}/`,
  build: { outDir: `dist/${TOOL_PATH}`, emptyOutDir: true },
  plugins: [react(), spikeCapture(), productTitle(), homeTheme(), demoFactsModule()],
  // Redirect URI is registered as http://localhost:5173 exactly; never fall back to another port.
  server: { port: 5173, strictPort: true },
})
