// Task 018: the whole-product regression audit's own protection.
//
// The redesign through tasks 011-017 left residue this file holds the line on:
//
//   1. the old implementation still reachable beside the new one;
//   2. the approved HTML packs becoming something the product loads.
//
// These are structural assertions on purpose. The defect they exist to catch is
// a shape (built here, not there), and a wall-clock threshold for it would
// measure the runner's afternoon rather than the product. The measurements that
// justified the repairs are in the task handoff; what survives here is the
// structure that made them true.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string): string => readFileSync(p, 'utf8')

// ---- one implementation per surface ----------------------------------------

// One component per route in App, and no second copy of a surface reachable
// beside it. The compatibility routes task 012 kept are redirects, which is a
// hash resolving to the canonical page, not a second page.
test('every production route renders one surface, and no retired surface is reachable', () => {
  const app = read('src/ui/App.tsx')
  for (const [surface, route] of [['Connect', 'connect'], ['Plan', 'plan'], ['MfaReadiness', 'readiness'], ['Export', 'export'], ['How', 'how']] as const) {
    assert.equal((app.match(new RegExp(`<${surface}[\\s/>]`, 'g')) ?? []).length, 1, `${surface} is rendered in one place`)
    assert.ok(app.includes(`route === '${route}'`), `and it is the ${route} route that renders it`)
  }
  // The names of the surfaces the redesign retired, as components.
  for (const retired of ['Today', 'LadderTiles', 'Roadmap', 'Dashboard', 'Coverage', 'Mapping']) {
    assert.doesNotMatch(app, new RegExp(`<${retired}[\\s/>]`), `${retired} is retired and must not render`)
  }
  // And no file defines them either: a retired surface with no route is still a
  // second implementation for the next person to wire up.
  const surfaces = readdirSync('src/ui/surfaces').filter((f) => f.endsWith('.tsx'))
  for (const retired of ['Today.tsx', 'LadderTiles.tsx', 'Roadmap.tsx']) {
    assert.ok(!surfaces.includes(retired), `src/ui/surfaces/${retired} is a retired surface`)
  }
})

// ---- the design packs are references, never a dependency --------------------

// The approved packs are hierarchy and density references. A production module
// that imported or fetched one would make a mockup part of the running product,
// and its CSS would start outranking the tokens.
test('no production module loads a design-pack HTML file', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name)
      if (e.isDirectory()) return walk(p)
      return /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [p] : []
    })
  const offenders: string[] = []
  for (const file of walk('src')) {
    const src = read(file)
    // Comments cite the packs by name, and should: they say where a decision
    // came from. Only a load is a dependency.
    if (/(?:import|fetch|import\s*\()\s*\(?['"][^'"]*\.html['"]/.test(src)) offenders.push(file)
    if (/\?raw['"]/.test(src) && /\.html/.test(src)) offenders.push(file)
  }
  assert.deepEqual(offenders, [], 'a design pack is a reference, not something the product loads')
})
