import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

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

// The tool version a person can quote in a feedback email (prompt 34 §2).
const APP_VERSION = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')).version

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  // Where the app is served from. The custom domain (getiamai.com) serves the
  // site at the root, so `/` is the default; the github.io fallback serves it
  // at /<repo>/, which is what VITE_BASE is for. BASE_PATH stays accepted as
  // the older name so an existing command keeps working.
  // Routing is hash-based and the baseline index fetches by absolute URL, so
  // nothing else has to change between the two.
  base: process.env.VITE_BASE ?? process.env.BASE_PATH ?? '/',
  plugins: [react(), spikeCapture()],
  // Redirect URI is registered as http://localhost:5173 exactly; never fall back to another port.
  server: { port: 5173, strictPort: true },
})
