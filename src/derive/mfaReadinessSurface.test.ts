// MFA Readiness, the surface that replaced Today (task 012; Step 7; prompt 62), and its one
// link to the Plan.
//
// The page is a consumer. Everything it shows is a view over evidence other
// modules settle — the readiness state (scoring/phishingResistant.ts, carried on
// the scored person), the population (derive/population.ts through the
// partition), the roles (src/roles.ts) — and this file's job is to prove that it
// stays one:
//
//   A  the same readiness authority, on every fixture
//   B  Ready + the rest = the active people, and nobody else is in it
//   C  the states are true of the evidence, and unknown stays unknown
//   D  admins come from directory roles
//   E  a filter narrows the rows and moves no number
//   F  a step's handoff is that step's own gate, and this page's Ready is never it
//   G  one surface, and the old route reaches it, and the checks read its words
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../roadmap/fixtures/index.ts'
import type { FixtureName } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { EXPLAINED, SHOW_KEYS, readinessView, scoredPeople, showKeyOf, shows } from './mfaReadiness.ts'
import type { ShowKey } from './mfaReadiness.ts'
import { stepMfaHold } from './stepMfaReadiness.ts'
import { KINDS, ladder, methodClassesOf } from './ladder.ts'
import { READINESS_STATES, isQualifying, isReady } from '../scoring/phishingResistant.ts'
import { adminUserIds } from '../roles.ts'
import { adminReady, goalFamily, mfaReady } from '../roadmap/readiness.ts'
import { enforcementHeld } from '../roadmap/operations.ts'
import { affectedIds } from './whoLine.ts'
import { reached } from './population.ts'
import { nextCell, rowCells, stateTitle } from '../ui/surfaces/readinessCells.ts'
import { readinessHref, readinessStepHref, resolveHash, showFromReadinessHash, stepFromReadinessHash } from '../ui/shell/routes.ts'
import { pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { RE, headerTabsLine } from '../content/contentChecks.ts'

const TENANTS: FixtureName[] = ['demo', 'getiamai', 'mid', 'messy', 'hostile']

// ---- A. one readiness authority ------------------------------------------------

test('the page reads the one readiness authority, not a second reading of the same evidence', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
    // Every state on the page is the scored person's readiness, never a label of the view's own.
    for (const r of v.rows) {
      if (!r.active) continue
      assert.equal(r.state, r.viability!.readiness.state, `${name}/${r.user.id}: the row's state is scoring/phishingResistant.ts's`)
    }
    // The partition places each person in the state their own methods and records earn.
    for (const state of READINESS_STATES) {
      for (const p of l.states[state]) {
        const row = v.rows.find((x) => x.user.id === p.id)!
        // A guest is scored for the Plan's gates and spoken for at tenant level here (option B), never counted.
        if (row.guest) { assert.equal(row.state, null, `${name}/${p.id}: a guest is not counted`); continue }
        assert.equal(row.state, state, `${name}/${p.id}: ${state}`)
        assert.equal(mfaReady(p.viability), isReady(state), `${name}/${p.id}: only Ready and Seamless are ready for the gate`)
      }
    }
  }
})

test('Confirm it, Needs a device and Ready read a phishing-resistant method the inventory holds, and Needs a method means none usable is held: a record never suggests one', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const r of v.rows) {
      if (r.state === null || r.state === 'unknown') continue
      // Read the inventory independently of the row: the method rows, or the registration report.
      const held = (methodClassesOf(f.snapshot, r.user.id) ?? []).some(isQualifying) || f.snapshot.registrationDetails.some((x) => x.id === r.user.id && x.methodsRegistered.includes('x509Certificate'))
      const usable = (r.readiness?.credentials ?? []).filter((c) => c.allowedNow !== 'no')
      if (r.state === 'method' || r.state === 'blocked') {
        assert.equal(usable.length, 0, `${name}/${r.user.id}: ${r.state} means no usable phishing-resistant method`)
        if (!held) assert.deepEqual(r.readiness?.credentials, [], `${name}/${r.user.id}: nothing held, nothing claimed`)
      } else {
        assert.equal(held, true, `${name}/${r.user.id}: ${r.state} only over an observed phishing-resistant method`)
        assert.ok(usable.length > 0, `${name}/${r.user.id}: ${r.state} only over a usable one`)
      }
    }
  }
})

test('a method inventory nobody could read leaves readiness unknown, never Needs a method', () => {
  const f = fixture('hostile')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(v.counts.method + v.counts.blocked, 0, 'nothing is claimed about a method nobody could look for')
  assert.equal(v.counts.unknown, v.people, 'every active person is explicitly Unknown')
  for (const r of v.rows) if (r.active) {
    assert.equal(r.readiness?.unknown, 'methods', `${r.user.id}: unknown because the methods were not read`)
    assert.deepEqual(r.readiness?.next, { kind: 'rescan', reason: 'methods' }, `${r.user.id}: the fix is the next scan, never a finding`)
  }
  // The demo, read: the only Unknown is the one person whose own read failed.
  const read = fixture('demo')
  const dv = readinessView(read.snapshot, read.snapshot.asOf, read.mapping)
  const unknown = dv.rows.filter((r) => r.state === 'unknown')
  assert.ok(unknown.length > 0 && unknown.length < dv.people)
  for (const r of unknown) assert.equal(read.snapshot.authMethods[r.user.id], 'unknown', `${r.user.id}: unknown only where the methods read failed`)
})

// ---- B. the headline denominator ----------------------------------------------

test('Ready plus the rest is the active people, and no emergency or service account is in it', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.equal(READINESS_STATES.reduce((n, s) => n + v.counts[s], 0), v.people, `${name}: the states are the active people`)
    // The active people are the campaign's population, which is the partition's:
    // the emergency accounts and the service accounts are outside it (task 001).
    for (const id of f.mapping.breakGlassUserIds) {
      const row = v.rows.find((r) => r.user.id === id)
      if (!row) continue
      assert.equal(row.active, false, `${name}: a confirmed emergency account is not in the denominator`)
      assert.equal(row.state, null, `${name}: and is never an end-user remediation target`)
      assert.equal(nextCell(row), '', `${name}: nothing is asked of it here`)
    }
    for (const id of f.mapping.serviceAccountUserIds) {
      const row = v.rows.find((r) => r.user.id === id)
      if (!row) continue
      assert.equal(row.state, null, `${name}: a service account is not a failed employee adoption`)
    }
    // A person outside the sign-in window keeps their readiness and is counted nowhere.
    for (const r of v.rows) if (r.kind === 'person' && !r.active) assert.equal(r.state, null, `${name}/${r.user.id}: not active, not counted`)
  }
})

// ---- C. the states, in words ---------------------------------------------------

test('the readiness cell says the state, and the next step is the one action or nothing', () => {
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const W = pages.readiness as unknown as { states: Record<string, { title: string }>; show: Record<string, string>; counted: Record<string, string> }
  assert.deepEqual(READINESS_STATES.map((s) => W.states[s].title), ['Blocked by setup', 'Needs a method', 'Confirm it', 'Needs a device', 'Unknown', 'Ready', 'Seamless'])
  for (const r of v.rows) {
    if (r.state !== null) {
      assert.equal(rowCells(r)[3], stateTitle(r.state), `${r.user.id}: the cell is the state's word`)
      const next = r.readiness!.next
      // Somebody Ready is asked for nothing; at most the Seamless upgrade is recommended.
      if (isReady(r.state)) assert.equal(next.kind, 'none', `${r.user.id}: a Ready person has no required action`)
      else assert.notEqual(next.kind, 'none', `${r.user.id}: somebody not Ready has one next action`)
      assert.ok(nextCell(r).length > 0)
    } else if (r.kind !== 'person') {
      assert.equal(rowCells(r)[3], W.show[r.kind])
    } else {
      assert.equal(rowCells(r)[3], W.counted[r.explained!])
    }
  }
  // The surface carries no hand-written setup instruction or Microsoft link.
  const src = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.doesNotMatch(src, /aka\.ms|learn\.microsoft\.com/, 'no setup instruction or Microsoft link is hand-written on the surface')
})

// ---- D. admins ----------------------------------------------------------------

test('the admin filter is the directory role authority, and it returns those people', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const admins = adminUserIds(f.snapshot.roles ?? { active: {} })
    assert.deepEqual(
      v.rows.filter((r) => r.admin).map((r) => r.user.id).sort(),
      v.rows.filter((r) => admins.has(r.user.id)).map((r) => r.user.id).sort(),
      `${name}: the Admin tag is src/roles.ts and nothing else`,
    )
    // Never a guess from a name or an address; the Admins filter is those counted admins.
    for (const r of v.rows) if (r.admin) assert.ok(admins.has(r.user.id), `${name}/${r.user.id}: tagged from the role assignment`)
    assert.deepEqual(v.rows.filter((r) => shows(r, 'admins')).map((r) => r.user.id), v.rows.filter((r) => r.admin && r.state !== null).map((r) => r.user.id))
  }
})

// ---- E. filters ---------------------------------------------------------------

test('a filter narrows the rows and changes no number', () => {
  const f = fixture('mid')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const numbers = (x: typeof v) => JSON.stringify({ facts: x.facts, counts: x.counts, explained: x.explained, lapsing: x.lapsing, admins: x.admins })
  const before = numbers(v)
  const keys: ShowKey[] = [...SHOW_KEYS, 'lapsing', ...READINESS_STATES, 'notActive', ...KINDS, 'guests']
  for (const key of keys) {
    const shown = v.rows.filter((r) => shows(r, key, v.lapsing))
    assert.ok(shown.length <= v.rows.length, `${key}: a filter only removes rows`)
    for (const r of shown) assert.ok(v.rows.includes(r), `${key}: every shown row is one of the page's own`)
  }
  const after = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(numbers(after), before, 'the counts above the table are the whole tenant, filtered or not')
  // Every key the URL can carry resolves, so the control always says what is on screen.
  for (const key of keys) assert.equal(showKeyOf(key), key, `${key} resolves`)
  for (const e of EXPLAINED) assert.equal(showKeyOf(e), null, `${e} is a reason, reached through Not counted`)
  assert.equal(showKeyOf('rung-5'), null)
  assert.equal(showKeyOf(''), null)
})

// ---- F. the Plan handoff -------------------------------------------------------

test("a step's handoff is that step's own gate over its own reach", () => {
  let sawMfa = 0
  let sawAdmin = 0
  let sawNonMfa = 0
  for (const name of TENANTS) {
    const f = fixture(name)
    const run = runFixture(f)
    const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const step of run.steps) {
      const hold = stepMfaHold(step, scored)
      const family = goalFamily(step.goalId)
      if (!enforcementHeld(step) || family === 'device' || family === 'block' || family === 'location' || family === 'risk' || family === 'other') {
        // A step nothing is holding, and a step held on something that is not an
        // authentication method, get no MFA callout at all.
        assert.equal(hold, null, `${name}/${step.id}: no MFA handoff on a ${family} step`)
        if (enforcementHeld(step)) sawNonMfa += 1
        continue
      }
      assert.ok(hold, `${name}/${step.id}: an MFA-family step held on readiness names its people`)
      const target = step.methodPreparation
      assert.ok(target, `${name}/${step.id}: new plans store the actual target measurement`)
      if (!target.completeScope) { assert.equal(hold.ids, null); continue }
      assert.deepEqual(hold.ids, target.ids.filter(id => !target.readyIds.includes(id)), `${name}/${step.id}: handoff and percentage use identical evidence`)
      if (family === 'admin') sawAdmin += 1
      else sawMfa += 1

    }
  }
  assert.ok(sawMfa > 0 && sawAdmin > 0 && sawNonMfa > 0, `the sweep saw all three shapes: ${sawMfa} MFA, ${sawAdmin} admin, ${sawNonMfa} held on something else`)
})

test('the MFA handoff uses accepted target methods rather than generic phishing-resistant proof', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find(s => s.goalId === 'register-info-protected')!
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const target = step.methodPreparation!
  assert.ok(target.completeScope)
  const hold = stepMfaHold(step, scored)!
  assert.deepEqual(hold.ids, target.ids.filter(id => !target.readyIds.includes(id)))
  const reversed = scored.map(v => ({ ...v, readiness: { ...v.readiness, state: 'ready' as const } }))
  assert.deepEqual(stepMfaHold(step, reversed), hold, 'changing a generic page score cannot change an already assessed target requirement')
})

test('a step whose readiness this scan could not measure names nobody, and never zero people', () => {
  const f = fixture('hostile')
  const run = runFixture(f)
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  let seen = 0
  for (const step of run.steps) {
    const hold = stepMfaHold(step, scored)
    if (!hold) continue
    assert.equal(step.readiness.unmeasured, 'unreadable', `${step.id}: the hostile tenant measures nothing`)
    assert.deepEqual(hold.ids, step.methodPreparation?.completeScope ? step.methodPreparation.ids : null, `${step.id}: known people with unread methods remain identifiable`)
    seen += 1
  }
  assert.ok(seen > 0, 'the hostile tenant holds MFA steps on readiness it could not measure')
})

test("the handoff names the actual method cohort, independently of the goal population", () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find(s => s.goalId === 'register-info-protected')!
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const target = step.methodPreparation!
  const held = target.ids.filter(id => !target.readyIds.includes(id))
  assert.ok(held.length > 0)
  const changedGoal = { ...step, population: { ...step.population, ids: [] } }
  assert.deepEqual(stepMfaHold(changedGoal, scored)!.ids, held)
  const narrowed = { ...step, methodPreparation: { ...target, ids: held.slice(1) } }
  assert.deepEqual(stepMfaHold(narrowed, scored)!.ids, held.slice(1), 'removing a person from the actual target removes them from its handoff')
})

test("a policy scope this scan could not settle is an unknown reach, never the goal's people", () => {
  let seen = 0
  for (const name of ['demo', 'demo-week2', 'messy', 'midflight'] as const) {
    const f = fixture(name)
    const run = runFixture(f)
    const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
    for (const step of run.steps) {
      const hold = stepMfaHold(step, scored)
      if (!hold || step.methodPreparation?.completeScope !== false) continue
      assert.notEqual(step.population.ids.length, 0, `${name}/${step.id}: the goal did hand it people`)
      assert.equal(hold.ids, null, `${name}/${step.id}: an unsettled scope names nobody`)
      seen += 1
    }
  }
  assert.ok(seen > 0, 'the fixtures hold MFA steps whose policy scope could not be settled')
})

test('a reach this scan settled as empty stays an empty list, and is not unknown', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const step = run.steps.find((s) => s.goalId === 'register-info-protected')!
  const empty = { ...step, methodPreparation: { ids: [], readyIds: [], unknownIds: [], completeScope: true }, cohort: { total: 0, active: 0, admins: 0, guests: 0, ids: [], activeIds: [] } }
  const hold = stepMfaHold(empty, scored)!
  assert.ok(hold, 'the step is still held on its own readiness')
  assert.deepEqual(hold.ids, [], 'nobody is waiting, and that is known')
  assert.notEqual(hold.ids, null, 'a known-empty reach is not unknown')
  const handoff = readFileSync('src/ui/surfaces/MfaHandoff.tsx', 'utf8')
  assert.match(handoff, /if \(n === 0\) return null/, 'nobody to hand off, so no line')
})

test('the handoff link carries the step and nothing about the people', () => {
  const href = readinessStepHref('s-goal-mfa-all-users')
  assert.equal(href, '#/readiness/step/s-goal-mfa-all-users')
  assert.equal(stepFromReadinessHash(href), 's-goal-mfa-all-users')
  assert.equal(showFromReadinessHash(href), null, 'a step scope is not a Show filter')
  assert.equal(resolveHash(href).route, 'readiness')
  assert.equal(resolveHash(href).redirect, null)
  const src = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(src, /const scored = data\.computed\?\.viability \?\? \[\]/, 'the scoring is the plan the page computes')
  assert.match(src, /stepMfaHold\(step, scored\)/, 'the affected people come from that scoring')
  assert.doesNotMatch(src, /displayName.*hash|hash.*displayName/, 'no display name is read from the URL')
  const handoff = readFileSync('src/ui/surfaces/MfaHandoff.tsx', 'utf8')
  assert.match(handoff, /readinessStepHref\(step\.id\)/, 'the Plan links by step id')
})

test('an unknown reach keeps the step it came from, and never becomes a tenant-wide filter', () => {
  const f = fixture('hostile')
  const run = runFixture(f)
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const unknown = run.steps.filter(step => stepMfaHold(step, scored)).map(step => ({ ...step, methodPreparation: { ids: [], readyIds: [], unknownIds: [], completeScope: false } }))
  assert.ok(unknown.length > 0, 'the hostile tenant holds MFA steps on readiness it could not measure')
  for (const step of unknown) {
    const href = readinessStepHref(step.id)
    assert.equal(stepFromReadinessHash(href), step.id, `${step.id}: the link names the step it came from`)
    assert.equal(showFromReadinessHash(href), null, `${step.id}: unknown reach is not a Show filter`)
    assert.notEqual(href, readinessHref('needsAction'), `${step.id}: and not the tenant-wide needs-action population`)
  }
  const handoff = readFileSync('src/ui/surfaces/MfaHandoff.tsx', 'utf8')
  assert.doesNotMatch(handoff, /readinessHref/, 'the handoff has no second destination')
  assert.equal(handoff.match(/href=\{readinessStepHref\(step\.id\)\}/g)?.length, 1, 'and the one it has is the step route')
  // And the page it lands on has the unknown state to render, and the way back.
  const page = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(page, /context\.ids === null \? fillText\(T\.planContext\.unknown, \{ step: context\.title \}\)/, 'the step-scoped page says the reach is unknown')
  assert.match(page, /T\.planContext\.back/, 'and offers the way back to the step')
})

// ---- G. one surface ------------------------------------------------------------

test('there is one MFA Readiness surface, and the old Today route reaches it', () => {
  assert.equal(readinessHref('needsAction'), '#/readiness', 'the bare page is the default filter')
  assert.equal(readinessHref('all'), '#/readiness/all')
  assert.equal(readinessHref('confirm'), '#/readiness/confirm')
  assert.deepEqual(resolveHash('#/readiness'), { route: 'readiness', redirect: null })
  assert.deepEqual(resolveHash('#/readiness/confirm'), { route: 'readiness', redirect: null })
  // The old name resolves to the same route and rewrites to the new hash, filter kept.
  assert.deepEqual(resolveHash('#/today'), { route: 'readiness', redirect: '#/readiness' })
  assert.deepEqual(resolveHash('#/today/needsProof'), { route: 'readiness', redirect: '#/readiness/needsProof' })
  assert.equal(showKeyOf(showFromReadinessHash('#/today/needsProof')), 'confirm', 'and the filter it carried still lands on its successor')
  const app = readFileSync('src/ui/App.tsx', 'utf8')
  assert.match(app, /<MfaReadiness scan=\{lastScan\} baseline=\{baseline\} \/>/)
  assert.equal((app.match(/<MfaReadiness/g) ?? []).length, 1, 'rendered once')
  assert.doesNotMatch(app, /route === 'today'/, 'no second route branch')
  const shell = pages.app as unknown as { shell: { tabs: Record<string, string> } }
  assert.equal(shell.shell.tabs.readiness, 'MFA Readiness')
  assert.equal((pages.readiness as { h1: string }).h1, 'MFA Readiness')
  const appShell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  assert.match(appShell, /\{SHELL\.tabs\.readiness\}/)
  assert.doesNotMatch(appShell, /tabs\.today/)
})

// The checks CI runs must read the words the page ships, not a copy of them.
// The expectations live in src/content/contentChecks.ts, which `npm test` runs
// and walk.mjs imports; this asserts the walk holds no copy of its own and that
// the smoke's copy still reads the shipped sentence.
test('the walk and the smoke read the shipped words: the tabs from the content, the summary at a count of one and above', () => {
  const walk = readFileSync('scripts/walk.mjs', 'utf8')
  const smoke = readFileSync('scripts/smoke.mjs', 'utf8')
  const checks = readFileSync('src/content/contentChecks.ts', 'utf8')
  assert.match(walk, /const HEADER_TABS = headerTabsLine\(\)/, 'the walk asks the shared authority for the header tabs')
  assert.match(checks, /pages\.app\.shell\.tabs\.\$\{k\}/, 'and that authority builds the line from the words the header renders')
  const headerTabs = (pages.app as unknown as { shell: { tabs: Record<string, string> } }).shell.tabs
  assert.equal(headerTabsLine(), `${headerTabs.connect} · ${headerTabs.plan} · ${headerTabs.readiness} · ${headerTabs.export} · ${headerTabs.how}`)
  assert.doesNotMatch(walk, /Today . Plan . Export/, 'and holds no retired tab name')
  const T = pages.readiness as unknown as { summary: string }
  const one = fillText(T.summary, { ready: 1, active: 30 })
  const many = fillText(T.summary, { ready: 4, active: 30 })
  assert.match(one, RE.readinessSummary, 'the walk reads the summary at a count of one')
  assert.match(many, RE.readinessSummary, 'the walk reads it above one')
  assert.doesNotMatch(walk, /ready for phishing-resistant sign-in\\\./, 'and holds no copy of the sentence')
  const lit = (smoke.match(/\/\(\\d\+\) of [^\n]*?ready for phishing-resistant sign-in\\\.\//) ?? [])[0]
  assert.ok(lit, 'the smoke still checks the summary sentence')
  const re = new RegExp(lit.slice(1, -1))
  assert.match(one, re, 'the smoke reads the summary at a count of one')
  assert.match(many, re, 'the smoke reads it above one')
})
