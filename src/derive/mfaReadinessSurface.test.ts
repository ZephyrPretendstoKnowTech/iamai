// MFA Readiness, the surface that replaced Today (task 012), and its one link to
// the Plan.
//
// The page is a consumer. Everything it shows is a view over the evidence tasks
// 001 and 002 already settled — the rung (derive/ladder.ts), the population
// (derive/population.ts through the ladder), the roles (src/roles.ts) — and this
// file's job is to prove that it stays one:
//
//   A  the same evidence authority, on every fixture
//   B  passkey-ready + the rest = the active people, and nobody else is in it
//   C  the three groupings are true of the evidence, and unknown stays unknown
//   D  admins come from directory roles
//   E  a filter narrows the rows and moves no number
//   F  a step's handoff is that step's own requirement, never the page's target
//   G  one surface, and the old route reaches it, and the checks read its words
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../roadmap/fixtures/index.ts'
import type { FixtureName } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { COMPAT_SHOW_KEYS, SHOW_KEYS, methodInventoryRead, readinessView, scoredPeople, showKeyOf, shows } from './mfaReadiness.ts'
import type { ReadinessGroup } from './mfaReadiness.ts'
import { stepMfaHold } from './stepMfaReadiness.ts'
import { hasPortablePhishingResistant, ladder, methodsOf, rungOf } from './ladder.ts'
import { adminUserIds } from '../roles.ts'
import { adminReady, goalFamily, mfaReady } from '../roadmap/readiness.ts'
import { enforcementHeld } from '../roadmap/operations.ts'
import { affectedIds } from './whoLine.ts'
import { reached } from './population.ts'
import { groupWords, nextStateWord, readinessWord } from '../ui/surfaces/readinessCells.ts'
import { readinessHref, readinessStepHref, resolveHash, showFromReadinessHash, stepFromReadinessHash } from '../ui/shell/routes.ts'
import { pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { RE, headerTabsLine } from '../content/contentChecks.ts'

const TENANTS: FixtureName[] = ['demo', 'getiamai', 'mid', 'messy', 'hostile']

// ---- A. one evidence authority ------------------------------------------------

test('the page reads the one rung authority, not a second reading of the same evidence', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const l = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
    // Every rung on the page is the ladder's rung for that account, recomputed
    // from the snapshot rather than copied from the row.
    for (const r of v.rows) {
      if (!r.active) continue
      assert.equal(r.rung, rungOf(r.viability!), `${name}/${r.user.id}: the row's rung is derive/ladder.ts's`)
    }
    // Nothing on the page moves an account off the rung its own methods and
    // records earn it: task 002's proof rules stand behind every label.
    for (const rung of [5, 4, 3, 2, 1] as const) {
      for (const p of l.rungs[rung]) {
        const row = v.rows.find((x) => x.user.id === p.id)!
        assert.equal(row.rung, rung, `${name}/${p.id}: rung ${rung}`)
        if (rung === 5) assert.equal(row.group, 'ready', `${name}/${p.id}: rung 5 is the passkey-ready outcome and nothing else is`)
        else assert.notEqual(row.group, 'ready', `${name}/${p.id}: only rung 5 reads passkey-ready`)
      }
    }
  }
})

test('a passkey nobody observed is never suggested by a record: needs proof reads the method inventory', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    for (const r of v.rows) {
      if (r.group !== 'needsProof') continue
      // The one thing that puts a person here: a passkey or security key the
      // method inventory holds. `hasPortablePhishingResistant` reads registered
      // methods and method kinds; a sign-in record cannot reach it.
      assert.ok(hasPortablePhishingResistant(methodsOf(f.snapshot, r.user.id)), `${name}/${r.user.id}: needs proof only over an observed passkey`)
    }
    // And the other way: an observed passkey that the records have not proven is
    // never filed as "no passkey".
    for (const r of v.rows) {
      if (r.group !== 'needsPasskey') continue
      assert.equal(hasPortablePhishingResistant(methodsOf(f.snapshot, r.user.id)), false, `${name}/${r.user.id}: needs a passkey means none was observed`)
    }
  }
})

test('a registration report nobody could read leaves the passkey state unknown, never "needs a passkey"', () => {
  const f = fixture('hostile')
  assert.equal(methodInventoryRead(f.snapshot), false, 'the hostile tenant refuses the registration report')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(v.methodsRead, false)
  assert.equal(v.groups.needsPasskey, 0, 'nothing is claimed about a passkey nobody could look for')
  assert.equal(v.groups.unknown, v.facts.active, 'every active person is explicitly not known')
  // The same tenant, read: the answer changes because the evidence changed.
  const read = fixture('demo')
  assert.equal(methodInventoryRead(read.snapshot), true)
  assert.equal(readinessView(read.snapshot, read.snapshot.asOf, read.mapping).groups.unknown, 0)
})

// ---- B. the headline denominator ----------------------------------------------

test('passkey-ready plus the rest is the active people, and no emergency or service account is in it', () => {
  for (const name of TENANTS) {
    const f = fixture(name)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const groups: ReadinessGroup[] = ['ready', 'needsProof', 'needsPasskey', 'unknown']
    assert.equal(
      groups.reduce((n, g) => n + v.groups[g], 0),
      v.facts.active,
      `${name}: the groups are the active people`,
    )
    // The active people are the campaign's population, which is the ladder's:
    // the emergency accounts and the service accounts are outside it (task 001).
    for (const id of f.mapping.breakGlassUserIds) {
      const row = v.rows.find((r) => r.user.id === id)
      if (!row) continue
      assert.equal(row.active, false, `${name}: a confirmed emergency account is not in the denominator`)
      assert.equal(row.group, null, `${name}: and is never an end-user remediation target`)
      assert.equal(nextStateWord(row), '', `${name}: nothing is asked of it here`)
    }
    for (const id of f.mapping.serviceAccountUserIds) {
      const row = v.rows.find((r) => r.user.id === id)
      if (!row) continue
      assert.equal(row.group, null, `${name}: a service account is not a failed employee adoption`)
    }
    // A person outside the sign-in window keeps their rung and is counted nowhere.
    for (const r of v.rows) if (r.kind === 'person' && !r.active) assert.equal(r.group, null, `${name}/${r.user.id}: not active, not grouped`)
  }
})

// ---- C. the groupings, in words -----------------------------------------------

test('the readiness cell says the group, the badge keeps the rung, and the next state is a state', () => {
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const W = pages.readiness as unknown as { groups: Record<ReadinessGroup, { title: string; next: string }>; notAPerson: string }
  assert.equal(W.groups.ready.title, 'Passkey-ready')
  assert.equal(W.groups.ready.next, '', 'nothing is asked of somebody already there')
  assert.equal(W.groups.needsProof.next, 'Sign in once with it')
  assert.equal(W.groups.needsPasskey.next, 'Register a passkey or security key')
  for (const r of v.rows) {
    if (r.group !== null) {
      assert.equal(readinessWord(r), groupWords(r.group).title, `${r.user.id}: the cell is the group's word`)
      assert.equal(nextStateWord(r), groupWords(r.group).next)
    } else if (r.kind !== 'person') {
      assert.equal(readinessWord(r), W.notAPerson)
    }
  }
  // Task 014 added the remediation behind the state, and it added no prose: the
  // guidance and its Microsoft links are content/methodGuides.ts over
  // shared.methodGuides, never literals in the component.
  const src = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.doesNotMatch(src, /aka\.ms|learn\.microsoft\.com/, 'no setup instruction or Microsoft link is hand-written on the surface')
  assert.match(src, /from '\.\.\/\.\.\/content\/methodGuides\.ts'/, 'the panel reads the one guidance source')
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
    // Never a guess from a name or an address.
    for (const r of v.rows) {
      if (!r.admin) continue
      assert.ok(admins.has(r.user.id), `${name}/${r.user.id}: tagged from the role assignment`)
    }
  }
})

// ---- E. filters ---------------------------------------------------------------

test('a filter narrows the rows and changes no number', () => {
  const f = fixture('mid')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const before = JSON.stringify({ facts: v.facts, groups: v.groups })
  for (const key of [...SHOW_KEYS, ...COMPAT_SHOW_KEYS]) {
    const shown = v.rows.filter((r) => shows(r, key))
    assert.ok(shown.length <= v.rows.length, `${key}: a filter only removes rows`)
    for (const r of shown) assert.ok(v.rows.includes(r), `${key}: every shown row is one of the page's own`)
  }
  const after = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(JSON.stringify({ facts: after.facts, groups: after.groups }), before, 'the counts above the table are the whole tenant, filtered or not')
  // Every key the URL can carry has a word, so the control always says what is
  // on screen.
  for (const key of [...SHOW_KEYS, ...COMPAT_SHOW_KEYS]) assert.equal(showKeyOf(key), key, `${key} resolves`)
  assert.equal(showKeyOf('rung-9'), null)
  assert.equal(showKeyOf(''), null)
})

// ---- F. the Plan handoff -------------------------------------------------------

test("a step's handoff is that step's own requirement, never the page's passkey target", () => {
  let sawMfa = 0
  let sawAdmin = 0
  let sawNonMfa = 0
  for (const name of TENANTS) {
    const f = fixture(name)
    const run = runFixture(f)
    const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
    const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
    const needsPasskey = new Set(v.rows.filter((r) => r.group !== null && r.group !== 'ready').map((r) => r.user.id))
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
      // (derive/population.ts): its own policy's scope for an open policy, its
      // goal's population otherwise. A reach that could not be settled is the
      // only reason a measured step names nobody.
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
        // The admin policy asks for the phishing-resistant method, so rung 5 is
        // its measure and the list is the people below it.
        for (const id of hold.ids) assert.equal(adminReady(scored.find((s) => s.userId === id)!), false, `${name}/${step.id}/${id}: below rung 5`)
      } else {
        sawMfa += 1
        // The MFA policy asks that the person can pass MFA. Somebody who can —
        // an Authenticator app, proven — is not on this list, however far they
        // are from the page's passkey target.
        for (const id of hold.ids) {
          const scoredRow = scored.find((s) => s.userId === id)!
          assert.equal(mfaReady(scoredRow), false, `${name}/${step.id}/${id}: not ready for ordinary MFA`)
        }
        const ready = [...inScope].filter((id) => {
          const s = scored.find((x) => x.userId === id)
          return s !== undefined && mfaReady(s)
        })
        for (const id of ready) assert.ok(!hold.ids.includes(id), `${name}/${step.id}/${id}: ready for MFA, so not held by this step`)
        // The one that matters: on a tenant where somebody can pass MFA without a
        // passkey, the step's list is strictly smaller than the page's target.
        const target = [...inScope].filter((id) => needsPasskey.has(id))
        assert.ok(hold.ids.length <= target.length, `${name}/${step.id}: an MFA step never holds more people than the passkey target does`)
      }
    }
  }
  assert.ok(sawMfa > 0 && sawAdmin > 0 && sawNonMfa > 0, `the sweep saw all three shapes: ${sawMfa} MFA, ${sawAdmin} admin, ${sawNonMfa} held on something else`)
})

test('an ordinary-MFA step is not held by the passkey target: the demo proves the two lists differ', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  // A step whose reach the scan settled: the list is people, so the two can be
  // compared at all.
  const step = run.steps.find((s) => s.goalId === 'register-info-protected')!
  assert.equal(goalFamily(step.goalId), 'mfa')
  assert.ok(reached(step) !== null, 'the demo settles this policy scope')
  const hold = stepMfaHold(step, scored)!
  assert.ok(hold.ids)
  const notReady = v.facts.active - v.groups.ready
  assert.ok(hold.ids.length < notReady, `the step holds ${hold.ids.length} people; ${notReady} have not reached the passkey target`)
  // Somebody at rung 4 — Authenticator app, proven — has not reached the page's
  // target and can still meet this policy, so the step does not wait for them.
  const rung4 = v.rows.filter((r) => r.rung === 4 && r.active)
  assert.ok(rung4.length > 0, 'the demo has proven Authenticator users')
  for (const r of rung4) {
    assert.notEqual(r.group, 'ready', 'the page still asks them for a passkey')
    assert.ok(!hold.ids.includes(r.user.id), 'and the ordinary-MFA step does not hold them')
  }
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
  // The demo's register-info step is an open policy whose own scope is not its
  // goal's population: more accounts in scope, a different active set. The
  // handoff must follow the policy, because that is who the step acts on.
  for (const name of ['demo', 'demo-week2'] as const) {
    const f = fixture(name)
    const run = runFixture(f)
    const scored = scoredPeople(f.snapshot, f.mapping, f.snapshot.asOf)
    const step = run.steps.find((s) => s.goalId === 'register-info-protected')!
    const of = reached(step)
    assert.ok(of !== null)
    const policy = affectedIds(of)
    const goal = affectedIds(step.population)
    assert.notDeepEqual(policy, goal, `${name}: this fixture's policy cohort differs from its goal population`)
    const hold = stepMfaHold(step, scored)!
    assert.ok(hold.ids)
    const cohort = new Set(policy)
    for (const id of hold.ids) assert.ok(cohort.has(id), `${name}/${id}: named only because the policy reaches them`)
    // And nobody the policy reaches, who cannot pass MFA, is left out because the
    // goal's population did not list them.
    for (const id of policy) {
      const v = scored.find((x) => x.userId === id)
      if (v === undefined || v.activity !== 'active' || mfaReady(v)) continue
      assert.ok(hold.ids.includes(id), `${name}/${id}: the policy reaches them and they cannot pass MFA`)
    }
  }
  // The two directions, on a cohort built to differ from the goal's population in
  // both: the demo's fixtures happen to name the same people either way, and the
  // rule is not that they coincide.
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
  // Reached but not in the goal's population: the step acts on them, so it waits
  // on them.
  const beyond = { ...step, population: pop(held.slice(1)) }
  const sorted = (ids: readonly string[]) => [...ids].sort()
  assert.deepEqual(sorted(stepMfaHold(beyond, scored)!.ids!), sorted(held), 'a person the policy reaches is named though the goal did not list them')
  // In the goal's population but outside the policy's scope: the step does not
  // act on them, so it is not waiting on them.
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
      // Readiness measured, scope not: the old reading named the goal's people
      // here, which the step does not act on.
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
  // The same step, its policy reaching nobody: a settled fact, the opposite of a
  // scope that could not be read.
  const empty = { ...step, cohort: { total: 0, active: 0, admins: 0, guests: 0, ids: [], activeIds: [] } }
  const hold = stepMfaHold(empty, scored)!
  assert.ok(hold, 'the step is still held on its own readiness')
  assert.deepEqual(hold.ids, [], 'nobody is waiting, and that is known')
  assert.notEqual(hold.ids, null, 'a known-empty reach is not unknown')
  // The Plan renders no line for it: the handoff is about people.
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
  // Nothing about who is affected can travel in the URL: the page resolves the
  // people from the plan it computes, over the rows it already shows.
  const src = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(src, /stepMfaHold\(step, data\.computed\.viability\)/, 'the affected people come from the plan the page computes')
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
    // The same destination a measured hold gets: the page resolves the step,
    // says the reach is unknown and shows the table unfiltered.
    const href = readinessStepHref(step.id)
    assert.equal(stepFromReadinessHash(href), step.id, `${step.id}: the link names the step it came from`)
    assert.equal(showFromReadinessHash(href), null, `${step.id}: unknown reach is not a Show filter`)
    assert.notEqual(href, readinessHref('needsAction'), `${step.id}: and not the tenant-wide needs-action population`)
  }
  // One destination in the handoff, taken on both branches: the unknown line
  // differs in its words, never in where it goes.
  const handoff = readFileSync('src/ui/surfaces/MfaHandoff.tsx', 'utf8')
  assert.doesNotMatch(handoff, /readinessHref/, 'the handoff has no second destination')
  assert.equal(handoff.match(/href=\{readinessStepHref\(step\.id\)\}/g)?.length, 1, 'and the one it has is the step route')
  // And the page it lands on has the unknown state to render.
  const page = readFileSync('src/ui/surfaces/MfaReadiness.tsx', 'utf8')
  assert.match(page, /context\.ids === null \? fillText\(T\.planContext\.unknown/, 'the step-scoped page says the reach is unknown')
  assert.match(page, /T\.planContext\.back/, 'and offers the way back to the step')
})

// ---- G. one surface ------------------------------------------------------------

test('there is one MFA Readiness surface, and the old Today route reaches it', () => {
  assert.equal(readinessHref('all'), '#/readiness')
  assert.equal(readinessHref('needsProof'), '#/readiness/needsProof')
  assert.deepEqual(resolveHash('#/readiness'), { route: 'readiness', redirect: null })
  assert.deepEqual(resolveHash('#/readiness/needsProof'), { route: 'readiness', redirect: null })
  // The old name resolves to the same route and rewrites to the new hash, filter kept.
  assert.deepEqual(resolveHash('#/today'), { route: 'readiness', redirect: '#/readiness' })
  assert.deepEqual(resolveHash('#/today/rung-3'), { route: 'readiness', redirect: '#/readiness/rung-3' })
  assert.equal(showFromReadinessHash('#/today/rung-3'), 'rung-3', 'and the filter it carried still applies')
  // One page implementation: App renders the one component for the one route.
  const app = readFileSync('src/ui/App.tsx', 'utf8')
  assert.match(app, /<MfaReadiness scan=\{lastScan\} baseline=\{baseline\} \/>/)
  assert.equal((app.match(/<MfaReadiness/g) ?? []).length, 1, 'rendered once')
  assert.doesNotMatch(app, /route === 'today'/, 'no second route branch')
  // Visible naming: the tab and the heading.
  const shell = pages.app as unknown as { shell: { tabs: Record<string, string> } }
  assert.equal(shell.shell.tabs.readiness, 'MFA Readiness')
  assert.equal((pages.readiness as { h1: string }).h1, 'MFA Readiness')
  const appShell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  assert.match(appShell, /\{SHELL\.tabs\.readiness\}/)
  assert.doesNotMatch(appShell, /tabs\.today/)
})

// The checks CI runs must read the words the page ships, not a copy of them.
// Two of them held a copy: the header tabs as a literal (still "Today" after
// task 012 renamed it) and the summary in one tense, which a tenant with a
// single passkey-ready person fails — content/render.ts pluralise() writes
// "1 ... has proven" for a count of one. Both are read from the shipped words
// here, so a rename or a count of one cannot part the check from the page.
//
// Both expectations now live in src/content/contentChecks.ts, which `npm test`
// runs and walk.mjs imports, so this asserts the walk holds no copy of its own
// and that the shared authority still reads the content.
test('the walk and the smoke read the shipped words: the tabs from the content, the summary in either tense', () => {
  const walk = readFileSync('scripts/walk.mjs', 'utf8')
  const smoke = readFileSync('scripts/smoke.mjs', 'utf8')
  const checks = readFileSync('src/content/contentChecks.ts', 'utf8')
  // The tabs: one authority (app.shell.tabs), never a second list inside the check.
  assert.match(walk, /const HEADER_TABS = headerTabsLine\(\)/, 'the walk asks the shared authority for the header tabs')
  assert.match(checks, /pages\.app\.shell\.tabs\.\$\{k\}/, 'and that authority builds the line from the words the header renders')
  const headerTabs = (pages.app as unknown as { shell: { tabs: Record<string, string> } }).shell.tabs
  assert.equal(headerTabsLine(), `${headerTabs.readiness} · ${headerTabs.plan} · ${headerTabs.export}`)
  assert.doesNotMatch(walk, /Today . Plan . Export/, 'and holds no retired tab name')
  // The summary: the sentence the page renders, at a count of one and above it.
  const T = pages.readiness as unknown as { summary: string }
  const one = fillText(T.summary, { ready: 1, active: 30 })
  const many = fillText(T.summary, { ready: 4, active: 30 })
  assert.match(one, /1 of 30 active people has proven/, 'the count governs the verb')
  assert.match(many, /4 of 30 active people have proven/)
  // The walk's summary expectation is the shared one; the smoke still carries its own.
  assert.match(one, RE.readinessSummary, 'the walk reads the summary at a count of one')
  assert.match(many, RE.readinessSummary, 'the walk reads it above one')
  assert.doesNotMatch(walk, /\/\(\\d\+\) of [^\n]*? proven\//, 'and holds no copy of the sentence')
  const lit = (smoke.match(/\/\(\\d\+\) of [^\n]*? proven\//) ?? [])[0]
  assert.ok(lit, 'the smoke still checks the summary sentence')
  const re = new RegExp(lit.slice(1, -1))
  assert.match(one, re, 'the smoke reads the summary at a count of one')
  assert.match(many, re, 'the smoke reads it above one')
})
