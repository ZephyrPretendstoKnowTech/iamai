// The demo is a consumer of the product, not a second product (task 026).
//
// Everything a visitor sees in sample mode — the Plan's rows and their states,
// the readiness rungs, the artifacts, the floor group, the blockers — is derived
// by the same modules a real tenant's scan is derived by. The only thing the
// demo supplies is the input: one synthetic small-business tenant, in two
// explicit snapshots. These tests hold that line from both sides:
//
//   - structurally, that no demo file carries a second implementation of a
//     product conclusion, and that the demo's module graph never reaches
//     Microsoft sign-in or the collector;
//   - behaviourally, that the sample's states are what the production engines
//     return over the sample's facts, and that the follow-up snapshot's
//     movement follows a change in those facts and nothing else.
//
// The convention here is the project's: there is no DOM harness, so a promise
// about a surface is read from the source the browser runs, and a promise about
// a derivation is made by running the derivation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { generateRoadmap } from '../roadmap/generate.ts'
import { floorRows, floorGroupIds } from './surfaces/planRows.ts'
import { FLOOR_GOAL_IDS } from '../roadmap/floor.ts'
import { hasPortablePhishingResistant, ladder, methodsOf, rungIds, windowsHelloOnly } from '../derive/ladder.ts'
import { scoredPeople } from '../derive/mfaReadiness.ts'
import { stepMfaHold } from '../derive/stepMfaReadiness.ts'
import { notPeopleIds } from '../derive/sets.ts'
import { jsonOffered, missingObjects, policyJsonText } from './surfaces/stepJson.ts'
import { statusOf } from './surfaces/statusWord.ts'
import { readinessStepHref, resolveHash, PLAN_HREF, READINESS_HREF, VALID } from './shell/routes.ts'
import { DEMO_TENANT_ID, DEMO_PARAM } from './demoMode.ts'
import { demoTenant } from './demo.ts'
import type { Step } from '../roadmap/types.ts'

const read = (p: string): string => readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

/** A module's code with its prose taken out: a comment naming `fetch` is not a call to it. */
const code = (p: string): string => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Every source file in src, forward slashes. */
const sources = (dir = 'src'): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name).split('\\').join('/')
    return e.isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : []
  })

/**
 * The demo's own files: the switches, the sample tenant and the build-time
 * facts. Everything else the demo runs is the product's. A new file here is the
 * thing this task is watching for, so the list is spelled out rather than
 * matched by name.
 */
const DEMO_FILES = ['src/ui/demo.ts', 'src/ui/demoMode.ts', 'src/ui/demoFacts.ts']

/** A module's runtime imports: `import type` and inline `type` specifiers are erased at build time and load nothing. */
function runtimeImports(file: string): string[] {
  const src = read(file)
  const out: string[] = []
  for (const m of src.matchAll(/^\s*import\s+(?!type\b)([^\n]*?)from\s+'([^']+)'/gm)) {
    const clause = m[1]
    // `import { type A, type B } from` is entirely types: nothing is loaded.
    const named = /^\s*\{([^}]*)\}\s*$/.exec(clause)
    if (named && named[1].split(',').every((s) => s.trim() === '' || /^type\s/.test(s.trim()))) continue
    out.push(m[2])
  }
  for (const m of src.matchAll(/\bimport\('([^']+)'\)/g)) out.push(m[1])
  return out
}

/** Everything a module loads, transitively, within src. A bare specifier is reported as itself. */
function moduleGraph(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop() as string
    for (const spec of runtimeImports(file)) {
      if (!spec.startsWith('.')) {
        if (!seen.has(spec)) seen.add(spec)
        continue
      }
      const resolved = resolve(dirname(file), spec).split('\\').join('/').replace(`${process.cwd().split('\\').join('/')}/`, '')
      if (seen.has(resolved)) continue
      seen.add(resolved)
      if (/\.(ts|tsx)$/.test(resolved)) queue.push(resolved)
    }
  }
  return seen
}

// ---------------------------------------------------------------------------
// A. No Microsoft sign-in and no Graph read
// ---------------------------------------------------------------------------

test('A: the sample tenant loads nothing that can sign in or read a tenant', () => {
  const graph = moduleGraph('src/ui/demo.ts')
  // The sign-in library and the collector's runner: neither may be reachable
  // from the sample, because a module that is loaded is a module that can run.
  const libs = [...graph].filter((m) => /msal/i.test(m) || m === 'src/graph/auth.ts' || m === 'src/graph/collect/runScan.ts')
  assert.deepEqual(libs, [], `the demo chunk reaches sign-in or the collector: ${libs.join(', ')}`)
  // And nothing it does load can reach a tenant: no request, no token. A
  // constants or types module under graph/ is fine — it is a table of names.
  const reaches = [...graph]
    .filter((m) => /^src\/.*\.tsx?$/.test(m))
    .filter((m) => /\bfetch\s*\(|XMLHttpRequest|acquireToken|sendBeacon|new WebSocket/.test(code(m)))
  assert.deepEqual(reaches, [], `a module the demo loads can reach the network: ${reaches.join(', ')}`)
  // The switches every page reads are lighter still: they load nothing at all,
  // so reading them outside the demo cannot pull the sample in behind them.
  assert.equal(/^\s*import\b/m.test(read('src/ui/demoMode.ts')), false)
})

test('A: building the sample tenant makes no network call', () => {
  // Nothing here may reach out: the sample is bytes in the bundle. A fetch is
  // the one thing that would turn a sample into a request, so it is taken away
  // for the duration and the whole tenant is built without it.
  const realFetch = globalThis.fetch
  globalThis.fetch = (() => {
    throw new Error('the demo fetched')
  }) as typeof fetch
  try {
    const d = demoTenant(false)
    assert.equal(d.snapshot.tenantId, DEMO_TENANT_ID)
    assert.ok(d.snapshot.users.length > 0)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('A: entering the demo is a URL, never a stored flag, and never an account', () => {
  const mode = read('src/ui/demoMode.ts')
  assert.equal(DEMO_PARAM, 'demo')
  assert.ok(/new URLSearchParams\(search\)\.get\(DEMO_PARAM\)/.test(mode), 'isDemo reads the query and nothing else')
  assert.equal(/localStorage|sessionStorage|indexedDB/.test(mode), false, 'demo mode is never read from storage')
  const app = read('src/ui/App.tsx')
  const branch = app.slice(app.indexOf('if (DEMO) {'), app.indexOf('if (MOCK) {'))
  assert.ok(branch.length > 0 && branch.includes("import('./demo.ts')"), 'App loads the sample tenant on demand')
  assert.equal(/signIn|acquireToken|restoreSession|startScan|handleRedirect/.test(branch), false, 'the demo branch starts no sign-in and no scan')
  assert.ok(/return \(\) => \{/.test(branch), 'the demo branch returns before the mock and the real sign-in path')
})

test('A: nothing in the demo offers a Microsoft sign-in or a Microsoft sign-out', () => {
  // The two actions that reach the sign-in library are Connect's tile 1 and the
  // header's Account menu. In the demo there is no Microsoft account: one would
  // start a real redirect and the other would clear the real sign-in cache in
  // this tab, which is the demo reaching into a real tenant's session.
  const connect = read('src/ui/surfaces/Connect.tsx')
  assert.ok(/isDemo\(\) \? sampleTile\(/.test(connect), 'the demo still renders the signed-in account tile')
  const actions = connect.slice(connect.indexOf('<div className="actions">', connect.indexOf('const t1 = isDemo()')))
  const block = actions.slice(0, actions.indexOf('</div>'))
  assert.ok(/isDemo\(\) \? \(/.test(block) && /exitDemoUrl\(\)/.test(block), "tile 1's actions are not branched for the demo")
  const demoArm = block.slice(block.indexOf('isDemo() ? ('), block.indexOf(') : ('))
  assert.equal(/signInAnother|signOut/.test(demoArm), false, 'tile 1 offers a Microsoft action in the demo')
  const shell = read('src/ui/shell/AppShell.tsx')
  assert.ok(/signedIn && !isDemo\(\) && <AccountMenu/.test(shell), 'the header offers the Account menu in the demo')
})

// ---------------------------------------------------------------------------
// B. One Plan, derived once
// ---------------------------------------------------------------------------

test('B: there is one plan generator, and no demo file calls or copies it', () => {
  const definers = sources().filter((p) => /^export function generateRoadmap\b/m.test(read(p)))
  assert.deepEqual(definers, ['src/roadmap/generate.ts'], 'the plan is generated in exactly one module')
  for (const f of DEMO_FILES) {
    const src = read(f)
    // A demo file may name the plan id helper (the sample's policy tags carry
    // it); it may not derive a step, a state, a status or a coverage result.
    assert.equal(/generateRoadmap|computeCoverage|applyProgress|annotateStateReasons|scoreMfaViability|stepContract|settleForecast/.test(src), false, `${f} derives a product conclusion`)
  }
})

test('B: the sample tenant supplies facts only — a snapshot, a mapping, groups and the pinned baseline', () => {
  const d = demoTenant(false)
  assert.deepEqual(Object.keys(d).sort(), ['baseline', 'checkpoints', 'decisions', 'groups', 'mapping', 'operatorId', 'snapshot'].sort())
  // Nothing that looks like a rendered conclusion travels with the sample.
  const json = JSON.stringify({ snapshot: d.snapshot, mapping: d.mapping })
  for (const word of ['"lifecycle"', '"readyToEnforce"', '"blockers"', '"stepId"', '"rung"']) {
    assert.equal(json.includes(word), false, `the sample tenant carries ${word}, which is a conclusion the engines make`)
  }
})

test('B: the sample Plan is what generateRoadmap returns over the sample facts', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  assert.ok(run.steps.length > 10, `the sample plan has ${run.steps.length} steps`)
  // The run is generateRoadmap's own output shape: the same keys the app renders.
  assert.equal(typeof generateRoadmap, 'function')
  for (const s of run.steps) {
    assert.ok(s.state, `${s.id} has no Foundation B state`)
    assert.ok(statusOf(s).word.length > 0, `${s.id} has no status word`)
  }
})

test('B: the sample Plan shows a useful mix, and every part of it is derived', () => {
  const run = runFixture(fixture('demo'))
  const by = (p: (s: Step) => boolean) => run.steps.filter(p)
  // Work already done: a control the tenant's own policies satisfy.
  const satisfied = by((s) => s.state.satisfied === true && s.state.inPlace === true)
  assert.ok(satisfied.length >= 2, `the sample has ${satisfied.length} controls already in place`)
  // Work still to do.
  assert.ok(by((s) => s.status !== 'done').length >= 5, 'the sample has controls that still need work')
  // A real prerequisite, named by the step that holds it — not a label.
  const held = by((s) => (s.blockers ?? []).some((b) => b.kind === 'step'))
  assert.ok(held.length >= 1, 'no sample step is held by another step')
  assert.ok(
    held.every((s) => (s.blockers ?? []).every((b) => b.kind !== 'step' || run.steps.some((x) => x.id === b.stepId))),
    'a blocker names a step the sample plan does not hold',
  )
  // The baseline conflict on the sample is the pinned package's own reading, not
  // a fixture invention: the demo runs on the product's pinned baseline.
  const conflicted = by((s) => s.state.condition === 'baseline-conflict')
  assert.equal(conflicted.length, 1, 'the sample carries exactly the conflict the pinned package defines')
})

// ---------------------------------------------------------------------------
// C. One readiness ladder
// ---------------------------------------------------------------------------

test('C: the sample people are scored by the ladder, with the mix MFA Readiness is for', () => {
  const f = fixture('demo')
  const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
  assert.ok(l.active >= 20, `the sample has ${l.active} active people`)
  // Proven phishing-resistant, and an administrator: the top of the page.
  assert.ok(rungIds(l, 5).length >= 1, 'no sample person has proven a passkey or a security key')
  assert.ok(l.rungs[5].some((p) => p.admin), 'the sample passkey holder is not an administrator')
  // A strong method configured whose proof does not travel: Windows Hello alone.
  assert.ok(rungIds(l, 3).length >= 1, 'no sample person holds a strong method that is not portable')
  // People who still need the target method.
  assert.ok(rungIds(l, 1).length >= 1, 'every sample person already has a method')
  // Emergency access and the non-person accounts are beside the denominator, never in it.
  const notPeople = notPeopleIds(f.mapping)
  assert.ok(l.kinds.emergency.length >= 1 && l.kinds.service.length >= 1)
  const scoredIds = new Set(Object.values(l.rungs).flat().map((p) => p.id))
  for (const id of notPeople) assert.equal(scoredIds.has(id), false, `${id} is not a person and is counted as one`)
})

test('C: generic MFA evidence does not prove a passkey, and Windows Hello keeps its meaning', () => {
  const f = fixture('demo')
  const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
  const proven = new Set(rungIds(l, 5))
  // Read through the ladder's own predicates: this is a claim about the sample's
  // facts, not a second rule about what a method proves.
  for (const id of l.viability.keys()) {
    const m = methodsOf(f.snapshot, id)
    if (!hasPortablePhishingResistant(m)) assert.equal(proven.has(id), false, `${id} reads as passkey-proven without a portable phishing-resistant method`)
  }
  assert.ok([...proven].every((id) => hasPortablePhishingResistant(methodsOf(f.snapshot, id))), 'a sample person is proven without the method behind it')
  // Windows Hello alone does not travel: the sample's Hello-only person sits
  // where the ladder puts them, below the portable methods.
  const helloOnly = [...l.viability.keys()].filter((id) => windowsHelloOnly(methodsOf(f.snapshot, id)))
  assert.ok(helloOnly.length >= 1, 'the sample has nobody holding Windows Hello alone')
  for (const id of helloOnly) assert.equal(proven.has(id), false, `${id} holds Windows Hello alone and reads as passkey-proven`)
})

test('C: a sample Plan step hands off to MFA Readiness by step id, and the people come from the same scoring', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const handoffs = run.steps.map((s) => [s, stepMfaHold(s, scored)] as const).filter(([, h]) => h !== null)
  assert.ok(handoffs.length >= 1, 'no sample step hands off to MFA Readiness')
  const [step, hold] = handoffs.find(([, h]) => h !== null && h.ids !== null && h.ids.length > 0) ?? handoffs[0]
  assert.ok(hold !== null)
  // The link carries the step and nothing about the people.
  const href = readinessStepHref(step.id)
  assert.equal(resolveHash(href).route, 'readiness')
  const scoredIds = new Set(scored.map((p) => p.userId))
  for (const id of hold.ids ?? []) assert.ok(scoredIds.has(id), `${id} is held by the step and is not one of the scored people`)
})

// ---------------------------------------------------------------------------
// D. One set of artifacts
// ---------------------------------------------------------------------------

test('D: the sample artifacts are the product\'s, held where the product holds them', () => {
  const f = fixture('demo-week2')
  const run = runFixture(f)
  const policySteps = run.steps.filter((s) => s.state.lifecycle !== null)
  assert.ok(policySteps.length >= 5)
  const sampleGroups = new Set([...f.groups.keys()])
  let offered = 0
  let held = 0
  for (const s of policySteps) {
    const missing = missingObjects(s)
    if (missing.length > 0) {
      held++
      assert.equal(jsonOffered(s), false, `${s.id} offers a policy body while it is still missing ${missing.length} object(s)`)
      continue
    }
    if (!jsonOffered(s)) continue
    offered++
    const body = policyJsonText(s)
    const parsed = JSON.parse(body) as { conditions?: { users?: { excludeGroups?: string[] } } }
    assert.ok(body.length > 0, `${s.id} offers an empty body`)
    // The body carries the sample tenant's own objects and no other tenant's:
    // every group it excludes is a group this fixture holds.
    for (const g of parsed.conditions?.users?.excludeGroups ?? []) assert.ok(sampleGroups.has(g), `${s.id} excludes ${g}, which is not one of the sample tenant's groups`)
    // The exclusions group is how a carve-out is written; never an account by name.
    assert.equal(/@demo\.example\.com/.test(body), false, `${s.id} names a person in its policy body`)
  }
  assert.ok(offered >= 1, 'no sample step offers a policy body')
  assert.ok(held >= 1, 'nothing in the sample is held for a missing object, so the hold behaviour is not exercised')
})

test('D: no demo file generates an artifact, and the export guard still redacts in demo mode', () => {
  for (const f of DEMO_FILES) {
    const src = read(f)
    assert.equal(/exportDownload|exportClipboard|policyJson|powerShell|toICS|redactIdentifiers/.test(src), false, `${f} builds an artifact of its own`)
  }
  const guard = read('src/ui/exportGuard.ts')
  // The demo adds a line saying the file is a sample; it does not change what
  // redaction does, and the unredacted branch still demands a named surface.
  assert.ok(/isDemo\(\) \?/.test(guard) && /demoWatermark/.test(guard))
  assert.ok(/d\.redact \? redactIdentifiers\(content\) : content/.test(guard), 'the demo changed how redaction is applied')
})

// ---------------------------------------------------------------------------
// E. One demo state, one way out (task 015)
// ---------------------------------------------------------------------------

test('E: one demo tenant id, stamped on the sample and on nothing else', () => {
  const d = demoTenant(false)
  assert.equal(d.snapshot.tenantId, DEMO_TENANT_ID)
  assert.equal(d.mapping.tenantId, DEMO_TENANT_ID)
  assert.equal(/^[0-9a-f]{8}-/.test(DEMO_TENANT_ID), false, 'the demo tenant id is GUID-shaped and could collide with a real tenant')
  // Every write App makes in demo mode names it, so nothing the sample stores
  // can land on a real tenant's rows.
  const app = read('src/ui/App.tsx')
  const branch = app.slice(app.indexOf('if (DEMO) {'), app.indexOf('if (MOCK) {'))
  for (const call of ['saveGroupMembersCache', 'savePlanRecord', 'loadPlanRecord']) {
    const at = branch.indexOf(call)
    assert.ok(at > 0, `the demo branch does not call ${call}`)
    assert.ok(branch.slice(at, at + 400).includes('DEMO_TENANT_ID'), `${call} in the demo branch is not keyed on the demo tenant id`)
  }
  assert.ok(/saveMappingState\(d\.mapping\)/.test(branch), 'the demo writes a mapping it did not stamp')
})

test('E: leaving the demo drops the switch and lands on Connect; sign out and forget clear the sample snapshot', () => {
  const mode = read('src/ui/demoMode.ts')
  assert.ok(/searchParams\.delete\(DEMO_PARAM\)/.test(mode) && /u\.hash = '#\/connect'/.test(mode), 'exitDemoUrl does not leave demo mode for Connect')
  assert.ok(/searchParams\.set\(DEMO_PARAM, '1'\)/.test(mode) && /u\.hash = '#\/plan'/.test(mode), 'the demo does not enter at the Plan')
  const actions = read('src/ui/actions.ts')
  // The two ways a tenant is let go of both put the sample's snapshot back to
  // its first one, so a real tenant never inherits the sample's progression.
  const signOut = actions.slice(actions.indexOf('export async function signOut'), actions.indexOf('export async function forgetTenant'))
  assert.ok(/demoWeek2: false/.test(signOut), 'Sign out leaves the sample on its follow-up snapshot')
  assert.ok(/demoWeek2: false/.test(actions.slice(actions.indexOf('export async function forgetTenant'))), 'Forget this tenant leaves the sample on its follow-up snapshot')
})

test('E: the snapshot selector changes the input and nothing else, and does nothing outside the demo', () => {
  const actions = read('src/ui/actions.ts')
  const fn = actions.slice(actions.indexOf('export function showDemoSnapshot'), actions.indexOf('export function stopScan'))
  assert.ok(/if \(!isDemo\(\)\) return/.test(fn), 'the snapshot selector acts outside the demo')
  assert.ok(/setSession\(\{ demoWeek2: followUp \}\)/.test(fn), 'the selector does not set the requested snapshot')
  // It sets the request, and nothing about the plan: no step, no status, no row.
  assert.equal(/steps|status|lifecycle|coverage/.test(fn), false, 'the selector touches a derived conclusion')
  // The demo's Scan again only ever moves forward: a control called "Scan again"
  // may not walk the sample backwards in time.
  const scan = actions.slice(actions.indexOf('export async function scan'), actions.indexOf('export function showDemoSnapshot'))
  const demoBranch = scan.slice(scan.indexOf('if (isDemo())'), scan.indexOf('if (s.scan.state ==='))
  assert.equal(/demoWeek2: !s\.demoWeek2/.test(demoBranch), false, 'the demo scan toggles the snapshot')
  assert.ok(/setSession\(\{ demoWeek2: true \}\)/.test(demoBranch), 'the demo scan does not advance to the follow-up snapshot')
})

test('E: the sample banner names the sample, names the snapshot on screen, and offers the way out', () => {
  const shell = read('src/ui/shell/AppShell.tsx')
  const banner = shell.slice(shell.indexOf('{isDemo() && ('), shell.indexOf('{signedIn && <ScanLine'))
  assert.ok(/role="status"/.test(banner) && /SHELL\.demoBanner/.test(banner), 'the sample-data line is not a live region')
  assert.ok(/SHELL\.demoLeave/.test(banner) && /exitDemoUrl\(\)/.test(banner), 'the banner does not offer to leave')
  // The progression is two named buttons, and the selected one is exposed by a
  // state a screen reader reads, not by an ink alone.
  assert.ok(/aria-pressed=\{!demoWeek2\}/.test(banner) && /aria-pressed=\{demoWeek2\}/.test(banner), 'the snapshot selector exposes no selected state')
  assert.ok(/<button type="button"/.test(banner), 'the snapshot selector is not a native control')
  assert.ok(/role="group"/.test(banner) && /aria-label=\{SHELL\.demoSnapshots\}/.test(banner), 'the two snapshot buttons are not grouped and named')
  const css = read('src/ui/app.css')
  const pressed = css.slice(css.indexOf(".demo-banner .demo-snapshots button[aria-pressed='true']"))
  assert.ok(/font-weight|text-decoration/.test(pressed.slice(0, 200)), 'the selected snapshot is marked by colour alone')
})

// ---------------------------------------------------------------------------
// The two snapshots: the follow-up moves because the facts moved
// ---------------------------------------------------------------------------

test('the follow-up snapshot is a complete second scan of the same tenant, dated coherently', () => {
  const a = fixture('demo')
  const b = fixture('demo-week2')
  assert.equal(a.snapshot.tenantId, b.snapshot.tenantId, 'the two snapshots are not the same tenant')
  assert.equal(a.snapshot.users.length, b.snapshot.users.length, 'the sample tenant gained or lost people between scans')
  assert.ok((b.snapshot.config.caPolicies?.rows ?? []).length > (a.snapshot.config.caPolicies?.rows ?? []).length, 'the follow-up scan found no new policy')
  // Every observation window opens before the scan that read it, and every
  // person seen in a policy's records is an account the same directory holds.
  const ids = new Set(b.snapshot.users.map((u) => u.id))
  for (const r of b.snapshot.evidencePolicyResults ?? []) {
    assert.ok(Date.parse(r.firstReportOnlyAt ?? b.snapshot.asOf) <= Date.parse(b.snapshot.asOf), `${r.displayName} started reporting after the scan read it`)
    for (const list of Object.values(r.affectedUserIds ?? {})) for (const id of list) assert.ok(ids.has(id), `${id} is in a policy's records and not in the directory`)
    assert.ok((b.snapshot.config.caPolicies?.rows ?? []).some((p) => (p as { id?: string }).id === r.policyId), `${r.displayName} has records and no policy`)
  }
})

test('a person\'s readiness rises on the follow-up scan only because new proof arrived', () => {
  const a = fixture('demo')
  const b = fixture('demo-week2')
  const before = ladder(a.snapshot, a.mapping, a.snapshot.asOf)
  const after = ladder(b.snapshot, b.mapping, b.snapshot.asOf)
  const rungOf = (l: typeof before, id: string): number => Number(Object.entries(l.rungs).find(([, ps]) => ps.some((p) => p.id === id))?.[0] ?? 0)
  const moved = [...before.viability.keys()].filter((id) => rungOf(after, id) > rungOf(before, id))
  assert.ok(moved.length >= 1, 'nobody improved on the follow-up scan')
  for (const id of moved) {
    const was = a.snapshot.signInEvidence[id]?.lastMfaSuccess ?? null
    const now = b.snapshot.signInEvidence[id]?.lastMfaSuccess ?? null
    const methodsChanged = JSON.stringify(a.snapshot.authMethods?.[id] ?? []) !== JSON.stringify(b.snapshot.authMethods?.[id] ?? [])
    assert.ok((was === null && now !== null) || methodsChanged, `${id} moved up a rung with no new method and no new proof`)
  }
  // And the people whose facts did not move did not move either.
  const still = [...before.viability.keys()].filter((id) => !moved.includes(id))
  for (const id of still) assert.equal(rungOf(after, id), rungOf(before, id), `${id} changed rung with no change in its facts`)
})

test('a policy advances on the follow-up scan only where the evidence the product asks for is there', () => {
  const before = runFixture(fixture('demo'))
  const after = runFixture(fixture('demo-week2'))
  const stateOf = (run: { steps: Step[] }, id: string) => run.steps.find((s) => s.id === id)?.state ?? null
  // Report-only with a window still open: observing, not ready.
  const observing = after.steps.filter((s) => s.state.lifecycle === 'report-only')
  assert.ok(observing.length >= 1, 'no sample policy is in report-only on the follow-up scan')
  // A window that closed on clean records: ready to enforce, and only then.
  const ready = after.steps.filter((s) => s.state.lifecycle === 'ready-to-enforce')
  assert.ok(ready.length >= 1, 'no sample policy is ready to enforce on the follow-up scan')
  for (const s of ready) {
    assert.notEqual(stateOf(before, s.id)?.lifecycle, 'ready-to-enforce', `${s.id} was already ready to enforce on the initial scan`)
    const records = (after.input.snapshot.evidencePolicyResults ?? []).filter((r) => (r.displayName ?? '').length > 0)
    assert.ok(records.length >= 1, `${s.id} is ready to enforce with no records behind it`)
  }
  // The tenant turned its own report-only policy on: in place, from the scan.
  const nowInPlace = after.steps.filter((s) => s.state.inPlace && stateOf(before, s.id)?.inPlace === false)
  assert.ok(nowInPlace.length >= 1, 'nothing came into place on the follow-up scan')
  // Nothing went backwards.
  for (const s of before.steps.filter((x) => x.state.inPlace)) {
    const now = stateOf(after, s.id)
    if (now) assert.equal(now.inPlace, true, `${s.id} was in place on the initial scan and is not on the follow-up`)
  }
})

// ---------------------------------------------------------------------------
// The floor (task 025) and the hierarchy
// ---------------------------------------------------------------------------

test('the sample floor group is the production one, generated from the active baseline', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const run = runFixture(fixture(name))
    const floor = run.steps.filter((s) => s.floor === true)
    assert.ok(floor.length >= 1, `${name}: no floor step`)
    for (const s of floor) assert.ok(FLOOR_GOAL_IDS.some((g) => s.id.endsWith(g)), `${name}: ${s.id} is in the floor group and is not a floor goal`)
    // The Plan and the print both take the group from floorRows; the demo takes
    // it from neither, it just renders through them.
    assert.deepEqual(
      floorRows(run.steps).map((s) => s.id),
      floor.filter((s) => s.status !== 'done').map((s) => s.id),
    )
    assert.deepEqual([...floorGroupIds(run.steps)].sort(), floor.map((s) => s.id).sort())
    // Emergency access stays the preparation step: it is never a floor policy.
    assert.equal(floor.some((s) => s.kind === 'prerequisite'), false, 'emergency access is in the floor group as a policy')
  }
})

test('the sample uses the pinned baseline, not a copy', () => {
  for (const f of DEMO_FILES) {
    const src = read(f)
    assert.equal(/baselines\/.*\.json|policies"\s*:/.test(src), false, `${f} embeds baseline data`)
  }
  const d = demoTenant(false)
  assert.ok((d.baseline.policies ?? []).length > 0, 'the sample has no baseline package')
  // It is the product's pinned one: the App reloads it from the pinned reader
  // rather than shipping the fixture's copy to the surfaces.
  assert.ok(/loadPinnedBaseline\(\)/.test(read('src/ui/App.tsx')))
})

test('the sample is the finished hierarchy: Connect, Plan, MFA Readiness, Export, and no Today', () => {
  assert.equal(VALID.has('today'), false, 'Today is still a destination')
  assert.equal(resolveHash('#/today').route, 'readiness', 'the old Today hash does not land on MFA Readiness')
  assert.equal(resolveHash(PLAN_HREF).route, 'plan')
  assert.equal(resolveHash(READINESS_HREF).route, 'readiness')
  assert.equal(resolveHash('#/export').route, 'export')
  // The demo enters at the Plan, which is where the product sends a scan.
  assert.ok(/u\.hash = '#\/plan'/.test(read('src/ui/demoMode.ts')))
  // The shell's tabs are the product's, and the demo renders that shell.
  const shell = read('src/ui/shell/AppShell.tsx')
  assert.equal(/>Today</.test(shell), false, 'the shell still offers a Today tab')
})
