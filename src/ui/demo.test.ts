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
import { isHeld } from '../roadmap/holds.ts'
import { generateRoadmap } from '../roadmap/generate.ts'
import { ladder } from '../derive/ladder.ts'
import { jsonOffered, missingObjects, policyJsonText } from './surfaces/stepJson.ts'
import { DEMO_TENANT_ID, DEMO_PARAM, DEMO_SNAPSHOT_STATE_ID } from './demoMode.ts'
import { demoSnapshotKey, demoTenant, nextDemoRecord } from './demo.ts'
import type { DemoPlanRecord, DemoSnapshotState, DemoTenant } from './demo.ts'
import type { Step } from '../roadmap/types.ts'
import { cleanupRecord, isRecordedDrill, recoveryEvidenceOf } from '../roadmap/cleanupDone.ts'

test('the follow-up demo keeps a recorded drill on its sign-in day at every UTC hour', (t) => {
  let now = 0
  t.mock.method(Date, 'now', () => now)
  for (let hour = 0; hour < 24; hour++) {
    now = Date.parse(`2026-09-15T${String(hour).padStart(2, '0')}:30:00.000Z`)
    const demo = demoTenant(true)
    const record = cleanupRecord(demo.checkpoints ?? [])
    for (const id of demo.mapping.breakGlassUserIds) {
      const signIn = demo.snapshot.users.find(u => u.id === id)!.lastSuccessfulSignIn!
      const { context } = recoveryEvidenceOf(demo.snapshot, demo.mapping, demo.groups, record.records ?? [], demo.snapshot.asOf, id)
      assert.equal(isRecordedDrill(signIn, record.drills, id, record.records, context), true, `hour ${hour}, account ${id}`)
    }
  }
})

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

test('A: the sample tenant loads nothing that can sign in or read a tenant, and building it makes no network call', () => {
  // A: the sample tenant loads nothing that can sign in or read a tenant.
  {
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
  }
  // A: building the sample tenant makes no network call.
  {
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
  }
})

test('A: entering the demo is a URL, never a stored flag or an account, and nothing in it offers a Microsoft sign-in or sign-out', () => {
  // A: entering the demo is a URL, never a stored flag, and never an account.
  {
    const mode = read('src/ui/demoMode.ts')
    assert.equal(DEMO_PARAM, 'demo')
    assert.ok(/new URLSearchParams\(search\)\.get\(DEMO_PARAM\)/.test(mode), 'isDemo reads the query and nothing else')
    assert.equal(/localStorage|sessionStorage|indexedDB/.test(mode), false, 'demo mode is never read from storage')
    const app = read('src/ui/App.tsx')
    const branch = app.slice(app.indexOf('if (DEMO) {'), app.indexOf('if (MOCK) {'))
    assert.ok(branch.length > 0 && branch.includes("import('./demo.ts')"), 'App loads the sample tenant on demand')
    assert.equal(/signIn|acquireToken|restoreSession|startScan|handleRedirect/.test(branch), false, 'the demo branch starts no sign-in and no scan')
    assert.ok(/return \(\) => \{/.test(branch), 'the demo branch returns before the mock and the real sign-in path')
  }
  // A: nothing in the demo offers a Microsoft sign-in or a Microsoft sign-out.
  {
    // The two actions that reach the sign-in library are Connect's tile 1 and the
    // header's Account menu. In the demo there is no Microsoft account: one would
    // start a real redirect and the other would clear the real sign-in cache in
    // this tab, which is the demo reaching into a real tenant's session.
    const connect = read('src/ui/surfaces/Connect.tsx')
    assert.ok(/isDemo\(\) \? sampleTile\(/.test(connect), 'the demo still renders the signed-in account tile')
    // Task 032 moved a step's buttons into the pack's action zone, which is a
    // prop rather than a div inside the body; the branch itself is unchanged.
    const actions = connect.slice(connect.indexOf('actions={', connect.indexOf('const t1 = isDemo()')))
    const block = actions.slice(0, actions.indexOf('</Step>'))
    assert.ok(/isDemo\(\) \? \(/.test(block) && /exitDemoUrl\(\)/.test(block), "tile 1's actions are not branched for the demo")
    const demoArm = block.slice(block.indexOf('isDemo() ? ('), block.indexOf(') : ('))
    assert.equal(/signInAnother|signOut/.test(demoArm), false, 'tile 1 offers a Microsoft action in the demo')
    const shell = read('src/ui/shell/AppShell.tsx')
    assert.ok(/signedIn && !isDemo\(\) && <AccountMenu/.test(shell), 'the header offers the Account menu in the demo')
  }
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
  assert.ok(/d\.redact \? redactIdentifiers\(content, d\.keep\) : content/.test(guard), 'the demo changed how redaction is applied')
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
  // Every plan-store key the demo reads or writes, spelled out: the sample
  // tenant's record and the demo's own row. The demo's row is derived from the
  // tenant id, so neither key can be a real tenant's.
  const keys = [...branch.matchAll(/(?:load|save)PlanRecord(?:<[^>]*>)?\(([A-Za-z_]+)/g)].map((m) => m[1])
  assert.ok(keys.length >= 3, `the demo branch reads and writes ${keys.length} plan record(s)`)
  for (const k of keys) assert.ok(k === 'DEMO_TENANT_ID' || k === 'DEMO_SNAPSHOT_STATE_ID', `the demo branch keys a plan record on ${k}`)
  assert.ok(DEMO_SNAPSHOT_STATE_ID.startsWith(DEMO_TENANT_ID), "the demo's own row is outside the demo namespace")
  assert.notEqual(DEMO_SNAPSHOT_STATE_ID, DEMO_TENANT_ID, "the demo's own row would overwrite the sample tenant's plan record")
  assert.ok(/saveMappingState\(d\.mapping\)/.test(branch), 'the demo writes a mapping it did not stamp')
})

/**
 * One visit to the sample, snapshot by snapshot: the rule App.tsx applies
 * (demo.ts nextDemoRecord) over the two fixtures' seeds, with `persist`
 * standing in for what the Plan writes back while a snapshot is on screen.
 */
function demoVisit(initial: DemoTenant, follow: DemoTenant): { show: (followUp: boolean) => DemoPlanRecord; persist: (extra: DemoPlanRecord) => void; record: () => DemoPlanRecord } {
  let live: DemoPlanRecord | null = null
  let stored: DemoSnapshotState | null = null
  return {
    show(followUp) {
      const d = followUp ? follow : initial
      const next = nextDemoRecord({ want: demoSnapshotKey(followUp), stored, live, seed: { decisions: d.decisions, checkpoints: d.checkpoints } })
      live = { ...next.record, tenantId: DEMO_TENANT_ID }
      stored = next.state
      return next.record
    },
    // What the Plan writes back while a snapshot is shown: the visitor's own
    // decisions, and what this scan saw of each policy (surfaces/planData.ts).
    persist(extra) {
      live = { ...(live ?? {}), ...extra, stepDecisions: { ...(live?.stepDecisions ?? {}), ...(extra.stepDecisions ?? {}) } }
    },
    record: () => ({ ...(live ?? {}) }),
  }
}

test('E: the sample record switches between its snapshots without losing either, and never seeds over the visitor', () => {
  // E: selecting the initial scan restores the initial scan, and the follow-up scan's inputs stay with it.
  {
    const initial = demoTenant(false)
    const follow = demoTenant(true)
    const visit = demoVisit(initial, follow)
    // Day one, first visit: the sample's own answers, and nothing else.
    const day1 = visit.show(false)
    assert.deepEqual(Object.keys(day1.stepDecisions ?? {}).sort(), Object.keys(initial.decisions ?? {}).sort())
    // The visitor answers a question, and the Plan records what day one saw.
    visit.persist({ stepDecisions: { 's-visitor-answer': { option: 'Yes', at: initial.snapshot.asOf } }, observations: { 'p-day-one': 'seen' }, startDate: '2026-10-05' })
    const mine = { ...visit.record() }
    delete mine.tenantId
    // Week two: the same tenant scanned again, so the visitor's plan comes with
    // it, and the sample technician's week-one answers arrive beside it.
    const week2 = visit.show(true)
    const followOnly = Object.keys(follow.decisions ?? {}).filter((k) => !(k in (initial.decisions ?? {})))
    assert.ok(followOnly.length > 0, 'the follow-up fixture seeds no decisions of its own')
    for (const k of followOnly) assert.ok(k in (week2.stepDecisions ?? {}), `the follow-up scan does not carry ${k}`)
    assert.ok('s-visitor-answer' in (week2.stepDecisions ?? {}), "a re-scan of one tenant restarted the visitor's plan")
    // Week two runs, and the Plan records what week two saw.
    visit.persist({ observations: { 'p-week-two': 'report-only proven' }, checkpoints: [{ kind: 'drill', done: true }] })
    // Back to the initial scan: exactly the record day one was left with.
    const back = visit.show(false)
    assert.deepEqual(back, mine, 'the initial scan did not come back as it was left')
    for (const k of followOnly) assert.equal(k in (back.stepDecisions ?? {}), false, `the follow-up scan's ${k} is still on the initial plan`)
    assert.deepEqual(back.observations, { 'p-day-one': 'seen' }, "week two's proof is still on the initial plan")
    assert.deepEqual(back.checkpoints, day1.checkpoints, "week two's checkpoints are still on the initial plan")
    // And week two is still itself: selected again, it is what it was left as.
    const again = visit.show(true)
    assert.deepEqual(again.observations, { 'p-week-two': 'report-only proven' }, 'the follow-up scan lost what it saw')
    assert.deepEqual(again.checkpoints, [{ kind: 'drill', done: true }])
  }
  // E: the sample seeds a snapshot once, and never over the visitor.
  {
    const initial = demoTenant(false)
    const follow = demoTenant(true)
    const seeded = Object.keys(initial.decisions ?? {})[0]
    assert.ok(seeded, 'the initial fixture seeds no decision')
    const visit = demoVisit(initial, follow)
    visit.show(false)
    // The visitor answers the seeded question themselves; the same snapshot shown
    // again must not put the sample's answer back over theirs.
    visit.persist({ stepDecisions: { [seeded]: { option: 'the visitor said this', at: initial.snapshot.asOf } } })
    const reload = visit.show(false)
    assert.deepEqual(reload.stepDecisions?.[seeded], { option: 'the visitor said this', at: initial.snapshot.asOf })
    // A record written before this rule existed cannot be placed in a snapshot:
    // no demo row says which one it belongs to, so the sample is seeded afresh
    // rather than opened over inputs of unknown provenance.
    const orphan = nextDemoRecord({
      want: 'initial',
      stored: null,
      live: { tenantId: DEMO_TENANT_ID, stepDecisions: { 's-from-a-previous-build': { option: 'x', at: initial.snapshot.asOf } }, observations: { 'p-unknown': 'seen' } },
      seed: { decisions: initial.decisions, checkpoints: initial.checkpoints },
    })
    assert.deepEqual(Object.keys(orphan.record.stepDecisions ?? {}).sort(), Object.keys(initial.decisions ?? {}).sort())
    assert.equal('observations' in orphan.record, false)
    assert.equal(orphan.state.current, 'initial')
  }
})

// ---------------------------------------------------------------------------
// The two snapshots: the follow-up moves because the facts moved
// ---------------------------------------------------------------------------

test('a policy advances on the follow-up scan only where the evidence the product asks for is there', () => {
  const before = runFixture(fixture('demo'))
  const after = runFixture(fixture('demo-week2'))
  const stateOf = (run: { steps: Step[] }, id: string) => run.steps.find((s) => s.id === id)?.state ?? null
  // Report-only with a window still open: observing, not ready.
  const observing = after.steps.filter((s) => s.state.lifecycle === 'report-only')
  assert.ok(observing.length >= 1, 'no sample policy is in report-only on the follow-up scan')
  // A window that closed on clean records: the gates close, and only then. On the
  // sample the policy that earned it is still held — it names a group this
  // baseline has not settled — so it stays Report-only and nothing offers the
  // change (roadmap/holds.ts): a held policy is never Ready to enforce.
  const ready = after.steps.filter((s) => s.tracking?.readyNow === true)
  assert.ok(ready.length >= 1, 'no sample policy closed its window on the follow-up scan')
  for (const s of after.steps.filter((x) => x.state.lifecycle === 'ready-to-enforce')) assert.equal(isHeld(s), false, `${s.id} is ready to enforce while something holds it`)
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
