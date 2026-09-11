// Task 018: the whole-product regression audit's own protection.
//
// The redesign through tasks 011-017 left three kinds of residue this file
// holds the line on, each one found by reproducing it rather than by reading:
//
//   1. work the redesign did on the way past — artifacts built during an
//      ordinary render for a person who had not asked for them;
//   2. the old implementation still reachable beside the new one;
//   3. the approved HTML packs becoming something the product loads.
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

// ---- 1. Export builds its artifacts when they are asked for --------------------

// The Export page names six artifacts and builds none of them to say so. Before
// this, its render body built the prompt pack (every prompt with the whole
// plan's grounding in it) and both CSV table sets (a row per account, per device
// and per policy) — 392 ms of a five-thousand-person tenant, repeated for every
// copy confirmation, every checkbox and every print. Nothing on screen changed
// when it did.
test('Export builds the prompt pack only when it is asked for, and the CSV tables once for the scan they read', () => {
  const src = read('src/ui/surfaces/Export.tsx')
  // The pack has one build site, and it is the on-demand one.
  assert.equal((src.match(/\bpromptPack\(/g) ?? []).length, 1, 'one place builds the pack')
  assert.match(src, /const getPack = \(\): PackItem\[\] => \{/, 'and it is behind a call, not a value the render computes')
  assert.doesNotMatch(src, /^\s*const pack = promptPack\(/m, 'the render body does not build the pack')
  // Both readers of the pack ask for it rather than closing over a built one.
  assert.match(src, /promptPackMarkdown\(getPack\(\), tenantName\)/, 'the download asks for it')
  assert.match(src, /showPrompts &&\s*\n?\s*getPack\(\)\.map\(/, 'and the preview list asks for it only while it is open')
  // The CSV tables are built for what they are made of, not for every render.
  assert.match(src, /const csvTables = useMemo\(/, 'the CSV tables are held against their inputs')
  assert.match(src, /\[snapshot, data\.mapping, data\.groups\]/, 'which are the scan, the mapping and the groups they read')
  // The grounding bundle was already on demand and stays there: it is the
  // largest artifact of the lot and the one that can carry names.
  assert.match(src, /onClick=\{\(\) => exportDownload\([^\n]*groundingBundle\(/, 'the bundle is built inside its own button')
})

// The saving above may never cost a fact. The pack is kept against the computed
// plan's own identity, and `computed` is a fresh object whenever anything the
// pack reads changes — the snapshot, the mapping, the groups, the directory,
// the saved decisions, the signature. A pack kept past any of those would speak
// for a plan that had moved.
test('the kept prompt pack is keyed to the plan it speaks for', () => {
  const src = read('src/ui/surfaces/Export.tsx')
  assert.match(src, /packCache\.current\?\.plan === c/, 'a kept pack is returned only for the same computed plan')
  assert.match(src, /packCache\.current = \{ plan: c, pack: built \}/, 'and every build records which plan it was for')
  // Everything the pack reads is an input to that plan, so its identity is the
  // whole key. planData.ts is where that list lives; it must keep holding them.
  const planData = read('src/ui/surfaces/planData.ts')
  const deps = /\}, \[snapshot, baseline, applied, groupsLoaded, loaded, groups, directory, saved, planId, version, startDate, firstDeployment, band, freeze, mappingFor, groupsFor\]/
  assert.match(planData, deps, 'the computed plan is rebuilt for every fact the pack reads')
})

// ---- 2. one implementation per surface ----------------------------------------

// The retired shells: the Roadmap step deep link and the step-page frame that
// stood in for the Plan, Export and How pages before they were built. They had
// no caller left and were still exported from the shell, where the next person
// looking for "how a step page is framed" would have found them.
test('the shell carries no framing for the pages the redesign replaced', () => {
  const shell = read('src/ui/shell/AppShell.tsx')
  for (const gone of ['StepFrame', 'useHashStepId', 'stepHref']) {
    assert.doesNotMatch(shell, new RegExp(`\\b${gone}\\b`), `${gone} was the pre-redesign step page and has no caller`)
  }
  // The old deep link itself still resolves — a link in somebody's runbook is
  // not a dead implementation, and it lands on the Plan step it names.
  const routes = read('src/ui/shell/routes.ts')
  assert.match(routes, /STEP_LINK = \/\^roadmap\\\/step/, 'the old hash still has a rule')
})

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

// ---- 3. the design packs are references, never a dependency --------------------

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
