// MFA Readiness, the surface that replaced Today (task 012; Step 7), and its one
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
//   F  a step's handoff is that step's own gate, and a passkey is never it
//   G  one surface, and the old route reaches it, and the checks read its words
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../roadmap/fixtures/index.ts'
import type { FixtureName } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { COMPAT_SHOW_KEYS, SHOW_KEYS, readinessView, scoredPeople, showKeyOf, shows } from './mfaReadiness.ts'
import { stepMfaHold } from './stepMfaReadiness.ts'
import { ladder, methodClassesOf } from './ladder.ts'
import { READINESS_STATES, isQualifying } from '../scoring/phishingResistant.ts'
import { adminUserIds } from '../roles.ts'
import { adminReady, goalFamily, mfaReady } from '../roadmap/readiness.ts'
import { enforcementHeld } from '../roadmap/operations.ts'
import { affectedIds } from './whoLine.ts'
import { reached } from './population.ts'
import { actionOf, readinessWord, stateTitle } from '../ui/surfaces/readinessCells.ts'
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
        assert.equal(row.state, state, `${name}/${p.id}: ${state}`)
        assert.equal(mfaReady(p.viability), state === 'ready', `${name}/${p.id}: only Ready is ready for the gate`)
      }
    }
  }
})

test('Needs proof reads a qualifying method the inventory holds, and Needs setup means none is held: a record never suggests one', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const r of v.rows) {
      if (r.state !== 'needsProof' && r.state !== 'needsSetup' && r.state !== 'ready') continue
      // Read the inventory independently of the row: the method rows, or the registration report.
      const held = (methodClassesOf(f.snapshot, r.user.id) ?? []).some(isQualifying) || f.snapshot.registrationDetails.some((x) => x.id === r.user.id && x.methodsRegistered.includes('x509Certificate'))
      if (r.state === 'needsSetup') assert.equal(held, false, `${name}/${r.user.id}: needs setup means no qualifying method was observed`)
      else assert.equal(held, true, `${name}/${r.user.id}: ${r.state} only over an observed qualifying method`)
    }
  }
})

test('a method inventory nobody could read leaves readiness unknown, never Needs setup', () => {
  const f = fixture('hostile')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(v.counts.needsSetup, 0, 'nothing is claimed about a method nobody could look for')
  assert.equal(v.counts.unknown, v.facts.active, 'every active person is explicitly Unknown')
  for (const r of v.rows) if (r.active) assert.equal(r.readiness?.unknown, 'methods', `${r.user.id}: unknown because the methods were not read`)
  // The demo, read: the only Unknown is the one person whose own read failed.
  const read = fixture('demo')
  const dv = readinessView(read.snapshot, read.snapshot.asOf, read.mapping)
  const unknown = dv.rows.filter((r) => r.state === 'unknown')
  assert.ok(unknown.length > 0 && unknown.length < dv.facts.active)
  for (const r of unknown) assert.equal(read.snapshot.authMethods[r.user.id], 'unknown', `${r.user.id}: unknown only where the methods read failed`)
})

// ---- B. the headline denominator ----------------------------------------------

test('Ready plus the rest is the active people, and no emergency or service account is in it', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    assert.equal(READINESS_STATES.reduce((n, s) => n + v.counts[s], 0), v.facts.active, `${name}: the states are the active people`)
    // The active people are the campaign's population, which is the partition's:
    // the emergency accounts and the service accounts are outside it (task 001).
    for (const id of f.mapping.breakGlassUserIds) {
      const row = v.rows.find((r) => r.user.id === id)
      if (!row) continue
      assert.equal(row.active, false, `${name}: a confirmed emergency account is not in the denominator`)
      assert.equal(row.state, null, `${name}: and is never an end-user remediation target`)
      assert.equal(actionOf(row), null, `${name}: nothing is asked of it here`)
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

test('the readiness cell says the state, and the action is the next action or nothing', () => {
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const W = pages.readiness as unknown as { states: Record<string, { title: string }>; notAPerson: string }
  assert.deepEqual(['ready', 'needsProof', 'needsSetup', 'unknown'].map((s) => W.states[s].title), ['Ready', 'Needs proof', 'Needs setup', 'Unknown'])
  for (const r of v.rows) {
    if (r.state !== null) {
      assert.equal(readinessWord(r), stateTitle(r.state), `${r.user.id}: the cell is the state's word`)
      const a = actionOf(r)
      // Somebody Ready is asked for nothing the baseline needs; at most a passkey is recommended.
      if (r.state === 'ready') assert.ok(a === null || a.recommended, `${r.user.id}: a Ready person has no required action`)
      else assert.ok(a !== null && !a.recommended, `${r.user.id}: somebody not Ready has a required action`)
    } else if (r.kind !== 'person') {
      assert.equal(readinessWord(r), W.notAPerson)
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
  const before = JSON.stringify({ facts: v.facts, counts: v.counts, passkeys: v.passkeys })
  for (const key of [...SHOW_KEYS, ...COMPAT_SHOW_KEYS]) {
    const shown = v.rows.filter((r) => shows(r, key))
    assert.ok(shown.length <= v.rows.length, `${key}: a filter only removes rows`)
    for (const r of shown) assert.ok(v.rows.includes(r), `${key}: every shown row is one of the page's own`)
  }
  const after = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(JSON.stringify({ facts: after.facts, counts: after.counts, passkeys: after.passkeys }), before, 'the counts above the table are the whole tenant, filtered or not')
  // Every key the URL can carry has a word, so the control always says what is on screen.
  for (const key of [...SHOW_KEYS, ...COMPAT_SHOW_KEYS]) assert.equal(showKeyOf(key), key, `${key} resolves`)
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
    const notReady = new Set(v.rows.filter((r) => r.state !== null && r.state !== 'ready').map((r) => r.user.id))
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
      // The people the step reaches, from the one authority that answers it
      // (derive/population.ts). A reach that could not be settled is the only
      // reason a measured step names nobody.
      const of = reached(step)
      if (of === null) {
        assert.equal(hold.ids, null, `${name}/${step.id}: an unsettled reach is unknown, not a list`)
        continue
      }
      if (hold.ids === null) {
        assert.equal(step.readiness.unmeasured, 'unreadable', `${name}/${step.id}: only unreadable readiness makes a settled reach unknown`)
        continue
      }
      const inScope = new Set(family === 'admin' ? of.ids : affectedIds(of))
      for (const id of hold.ids) assert.ok(inScope.has(id), `${name}/${step.id}: only people the step reaches`)
      if (family === 'admin') {
        sawAdmin += 1
        for (const id of hold.ids) assert.equal(adminReady(scored.find((s) => s.userId === id)!), false, `${name}/${step.id}/${id}: not Ready`)
      } else {
        sawMfa += 1
        for (const id of hold.ids) assert.equal(mfaReady(scored.find((s) => s.userId === id)!), false, `${name}/${step.id}/${id}: not Ready`)
        const ready = [...inScope].filter((id) => {
          const s = scored.find((x) => x.userId === id)
          return s !== undefined && mfaReady(s)
        })
        for (const id of ready) assert.ok(!hold.ids.includes(id), `${name}/${step.id}/${id}: Ready, so not held by this step`)
        // The step never waits on more people than the page says are not Ready.
        const target = [...inScope].filter((id) => notReady.has(id))
        assert.ok(hold.ids.length <= target.length, `${name}/${step.id}: an MFA step never holds more people than MFA Readiness counts not Ready`)
      }
    }
  }
  assert.ok(sawMfa > 0 && sawAdmin > 0 && sawNonMfa > 0, `the sweep saw all three shapes: ${sawMfa} MFA, ${sawAdmin} admin, ${sawNonMfa} held on something else`)
})

test('the MFA gate asks for phishing-resistant readiness, never a passkey: Ready without one is not held, Authenticator only is', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const step = run.steps.find((s) => s.goalId === 'register-info-protected')!
  assert.equal(goalFamily(step.goalId), 'mfa')
  const of = reached(step)
  assert.ok(of !== null, 'the demo settles this policy scope')
  const inScope = new Set(affectedIds(of))
  const hold = stepMfaHold(step, scored)!
  assert.ok(hold.ids)
  // Somebody Ready with Windows Hello and no passkey meets the gate.
  const readyWithout = v.rows.filter((r) => r.state === 'ready' && r.readiness?.hasPasskey === false && inScope.has(r.user.id))
  assert.ok(readyWithout.length > 0, 'the demo has someone Ready without a passkey in this step\'s reach')
  for (const r of readyWithout) assert.ok(!hold.ids.includes(r.user.id), `${r.user.id}: Ready without a passkey, so not held`)
  // Somebody proven only with Authenticator does not: it is not phishing-resistant.
  const appOnly = v.rows.filter((r) => r.state === 'needsSetup' && r.readiness?.methods?.includes('authenticator') && inScope.has(r.user.id))
  assert.ok(appOnly.length > 0, 'the demo has Authenticator-only people in this step\'s reach')
  for (const r of appOnly) assert.ok(hold.ids.includes(r.user.id), `${r.user.id}: Authenticator only, so held`)
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
    assert.equal(hold.ids, null, `${step.id}: unknown reach is not an empty list`)
    seen += 1
  }
  assert.ok(seen > 0, 'the hostile tenant holds MFA steps on readiness it could not measure')
})

test("the handoff names the people the policy reaches, not the people its goal handed the step", () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    const run = runFixture(f)
    const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
    const step = run.steps.find((s) => s.goalId === 'register-info-protected')!
    const of = reached(step)
    assert.ok(of !== null)
    const policy = affectedIds(of)
    const hold = stepMfaHold(step, scored)!
    assert.ok(hold.ids)
    const cohort = new Set(policy)
    for (const id of hold.ids) assert.ok(cohort.has(id), `${name}/${id}: named only because the policy reaches them`)
    // And nobody the policy reaches, who is not Ready, is left out because the
    // goal's population did not list them.
    for (const id of policy) {
      const v = scored.find((x) => x.userId === id)
      if (v === undefined || v.activity !== 'active' || mfaReady(v)) continue
      assert.ok(hold.ids.includes(id), `${name}/${id}: the policy reaches them and they are not Ready`)
    }
  }
  // The two directions, on a cohort built to differ from the goal's population in both.
  const f = fixture('demo')
  const run = runFixture(f)
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const step = run.steps.find((s) => s.goalId === 'register-info-protected')!
  const held = affectedIds(reached(step)!).filter((id) => {
    const v = scored.find((x) => x.userId === id)
    return v !== undefined && v.activity === 'active' && !mfaReady(v)
  })
  assert.ok(held.length > 2, 'the demo holds this step on several people')
  const pop = (ids: string[]) => ({ total: ids.length, active: ids.length, admins: 0, guests: 0, ids, activeIds: ids })
  const beyond = { ...step, population: pop(held.slice(1)) }
  const sorted = (ids: readonly string[]) => [...ids].sort()
  assert.deepEqual(sorted(stepMfaHold(beyond, scored)!.ids!), sorted(held), 'a person the policy reaches is named though the goal did not list them')
  const narrow = { ...step, cohort: pop(held.slice(1)) }
  assert.deepEqual(sorted(stepMfaHold(narrow, scored)!.ids!), sorted(held.slice(1)), 'a person outside the policy scope is not named')
})

test("a policy scope this scan could not settle is an unknown reach, never the goal's people", () => {
  let seen = 0
  for (const name of ['demo', 'demo-week2', 'messy', 'midflight'] as const) {
    const f = fixture(name)
    const run = runFixture(f)
    const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
    for (const step of run.steps) {
      const hold = stepMfaHold(step, scored)
      if (!hold || reached(step) !== null) continue
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
  const empty = { ...step, cohort: { total: 0, active: 0, admins: 0, guests: 0, ids: [], activeIds: [] } }
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
  const unknown = run.steps.filter((step) => stepMfaHold(step, scored)?.ids === null)
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
  assert.equal(readinessHref('needsProof'), '#/readiness/needsProof')
  assert.deepEqual(resolveHash('#/readiness'), { route: 'readiness', redirect: null })
  assert.deepEqual(resolveHash('#/readiness/needsProof'), { route: 'readiness', redirect: null })
  // The old name resolves to the same route and rewrites to the new hash, filter kept.
  assert.deepEqual(resolveHash('#/today'), { route: 'readiness', redirect: '#/readiness' })
  assert.deepEqual(resolveHash('#/today/needsProof'), { route: 'readiness', redirect: '#/readiness/needsProof' })
  assert.equal(showFromReadinessHash('#/today/needsProof'), 'needsProof', 'and the filter it carried still applies')
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
  assert.doesNotMatch(walk, /\/\(\\d\+\) of [^\n]*? Ready\\\.\//, 'and holds no copy of the sentence')
  const lit = (smoke.match(/\/\(\\d\+\) of [^\n]*? Ready\\\.\//) ?? [])[0]
  assert.ok(lit, 'the smoke still checks the summary sentence')
  const re = new RegExp(lit.slice(1, -1))
  assert.match(one, re, 'the smoke reads the summary at a count of one')
  assert.match(many, re, 'the smoke reads it above one')
})
