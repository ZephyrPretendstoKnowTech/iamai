// The demo chunk (demo.ts: the sample tenant, its fixture and the plan engine
// behind it) loads in demo mode and nowhere else. In code that means: the
// product imports demo.ts only on demand (App.tsx's import()), demoMode.ts
// (the switches every page reads) imports nothing, and the signed-out Connect
// page takes the sample facts from the build-time virtual module rather than
// from demoFacts.ts. The walk proves the same on the wire (no demo module in
// the page's resources outside demo mode); this keeps the boundary in source.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { demoFacts } from './demoFacts.ts'

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name).split('\\').join('/')
    return e.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : []
  })

test('demoMode.ts imports nothing: the switches are light', () => {
  const src = readFileSync('src/ui/demoMode.ts', 'utf8')
  assert.equal(/^\s*import\b/m.test(src), false, 'demoMode.ts must not import anything')
})

test('no product module imports demo.ts or demoFacts.ts statically; App.tsx reaches the demo through import() alone', () => {
  const offenders: string[] = []
  for (const p of files('src')) {
    if (/\.test\.tsx?$/.test(p) || p === 'src/ui/demoFacts.ts' || p.startsWith('src/testing/')) continue
    const src = readFileSync(p, 'utf8')
    // A type-only import is erased at build time and loads nothing.
    if (/^\s*import\s+(?!type\b)[^\n]*from\s+'[^']*\/demo(Facts)?\.ts'/m.test(src)) offenders.push(p)
  }
  assert.deepEqual(offenders, [], 'a product module imports the demo chunk statically')
  const app = readFileSync('src/ui/App.tsx', 'utf8')
  assert.ok(/import\('\.\/demo\.ts'\)/.test(app), 'App.tsx loads the demo on demand')
  const connect = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.ok(/from 'virtual:demo-facts'/.test(connect), 'the signed-out Connect page reads the build-time facts')
  assert.ok(!/demoFacts\.ts'\)/.test(connect), 'the signed-out Connect page no longer imports demoFacts.ts on demand')
})

test('the build-time facts are the engine\'s: vite.config.ts serves demoFacts() as the virtual module', () => {
  const cfg = readFileSync('vite.config.ts', 'utf8')
  assert.ok(/import \{ demoFacts \} from '\.\/src\/ui\/demoFacts\.ts'/.test(cfg))
  assert.ok(/'virtual:demo-facts'/.test(cfg) && /JSON\.stringify\(demoFacts\(\)\)/.test(cfg))
  const f = demoFacts()
  assert.ok(f.people > 0 && f.steps > 0 && f.inPlace >= 0 && f.weeks >= 1, JSON.stringify(f))
})
