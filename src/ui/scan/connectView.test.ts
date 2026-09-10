// Connect's four tiles (docs/design/connect-mockup.html), rendered through the
// pure view (connectView.ts): each tile's strings and button weights as the
// mockup assigns them; tile 3 (Scan) with the beats and exactly one of its
// states, tile 4 (Plan) in the state that follows, with the other states'
// strings absent. The scan's age comes from the one stored timestamp, so the
// two tiles agree and nothing else says scanned. Global Reader is the only
// role IAMAI names.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../../testing/uiSnapshot.ts'
import { gapsSnapshot, noRolesToken } from '../../testing/gapsFixture.ts'
import { coreRoleGap, rolesInToken } from '../../graph/collect/tokenRoles.ts'
import { unreadSources } from '../../graph/collect/coreSections.ts'
import { app, pages } from '../../content/content.ts'
import { accountTile, baselineTile, planTile, scanTile, tileStrings } from './connectView.ts'
import type { PlanTile, ScanTile } from './connectView.ts'
import type { PolicyChange } from '../../derive/baselineDiff.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { RUNGS, ladder } from '../../derive/ladder.ts'
import { factsOf } from '../../derive/facts.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'

const upn = 'alex@example.com'
const tenant = 'Contoso Pty Ltd'
const full = fixtureSnapshot()
const last = { snapshot: full, at: full.asOf }
const twoMinutesLater = Date.parse(full.asOf) + 120_000
// The review rows' helpers, as Connect wires them (derive/baselineDiff.ts): a file names a policy; the goal map names its steps.
const stepsFor = (c: PolicyChange): string[] => (c.key === 'admins' ? ['Require Phishing-Resistant MFA for Admins', 'Require MFA for Everyone'] : [])
const change = (over: Partial<PolicyChange>): PolicyChange => ({ key: over.key ?? 'k', identity: 'id', kind: 'changed', renamed: false, oldName: null, newName: null, deltas: [], unreviewed: [], reason: null, ...over })

const NEVER = ['Security Reader', 'Reports Reader', 'Directory Readers']
const noOtherRole = (strings: string[]): void => {
  for (const s of strings) for (const r of NEVER) assert.ok(!s.includes(r), `"${s}" names ${r}`)
}

test('tile 1, Signed in: the tenant as the state, account · role, the Global Reader line, Sign in with another account (secondary) and Sign out (tertiary)', () => {
  const t = accountTile({ tenant, upn, role: 'Global Administrator' })
  assert.equal(t.n, 1)
  assert.equal(t.title, 'Signed in')
  assert.equal(t.state, tenant)
  assert.equal(t.tone, 'done')
  assert.equal(t.line, 'alex@example.com · Global Administrator')
  assert.equal(t.note, 'Global Reader is the least privilege that reads everything IAMAI needs; a Global Administrator account works too, but sign in with less if you can. It writes nothing. The first sign-in in a tenant needs an account that can grant consent (a Global Administrator, once); every sign-in after that can be Global Reader.')
  assert.deepEqual(t.actions, [
    { label: 'Sign in with another account', weight: 'secondary' },
    { label: 'Sign out', weight: 'tertiary' },
  ])
  assert.equal(accountTile({ tenant, upn, role: null }).line, upn, 'no role known: the account alone')
  noOtherRole(tileStrings(t))
})

// Task 016: someone new to identity work should be able to read this stage and
// know what a baseline is, whose it is, why the source is credible, and what it
// aims at — without Microsoft being made to endorse any of it.
// Task 032: the approved pack nests the package's own card inside the step, so
// the step's state is the STEP's state word and the name, the size and which
// version this is are the card's. `pinned` moves into the source-and-version
// disclosure the pack draws under the card.
test('tile 2, Baseline: the nested card carries name, size and version; the step state is a word; what a baseline is, whose it is and its aim; the author-update rows; Change baseline (secondary)', () => {
  const t = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: 46, loading: null, update: null, stepsFor })
  assert.equal(t.n, 2)
  assert.equal(t.title, 'Baseline')
  assert.equal(t.state, 'selected')
  assert.ok(t.card, 'a loaded package nests a card')
  assert.equal(t.card.name, 'Jon Hope — Defense in Depth', 'the card carries the package’s own name')
  assert.equal(t.card.source, '46 policies · pinned version')
  assert.deepEqual(t.paragraphs, [], 'the explaining copy is inside the card, not loose in the step')
  assert.deepEqual(baselineTile({ name: 'Uploaded package', policyCount: 3, version: 'uploaded', loading: null, update: null, stepsFor }).card?.source, '3 policies · uploaded package')
  // Nothing loaded: no card, and the explaining copy still renders in the step.
  const none = baselineTile({ name: null, policyCount: 0, loading: null, update: null, stepsFor })
  assert.equal(none.card, null)
  assert.equal(none.source, null)
  assert.equal(none.state, 'none loaded')
  assert.equal(none.paragraphs.length, 3)
  const said = [...t.card.paragraphs, t.source?.text ?? ''].join(' ')
  assert.match(t.card.paragraphs[0], /^A baseline is the identity-security standard IAMAI plans your tenant towards/, 'the term is explained before it is used')
  for (const fact of ['Defense in Depth', 'Jon Hope', 'Microsoft MVP', 'ConditionalAccess.Tech']) assert.ok(said.includes(fact), `the baseline stage names ${fact}`)
  assert.match(t.card.paragraphs[1], /^Its aim is layered protection for a small organisation: /)
  assert.equal(t.source?.summary, 'Source and version')
  assert.match(t.source?.text ?? '', /^IAMAI pins a reviewed version of it/)
  // Source and version, said usefully (task Step 1 C): a disclosure headed
  // "Source and version" that names neither is not a disclosure. With the
  // package's own provenance it names the repository a reader can open and the
  // revision IAMAI holds; without it, it claims nothing it cannot show.
  assert.equal(t.source?.link, null, 'no provenance, no source claim')
  assert.equal(t.source?.version, null, 'no provenance, no version claim')
  const pinned = baselineTile({
    name: 'Jon Hope — Defense in Depth',
    policyCount: 46,
    pin: { repo: 'Jhope188/ConditionalAccessPolicies', url: 'https://github.com/Jhope188/ConditionalAccessPolicies', commit: '90d9b890c4b9af2ac4bc02d97c06bf8900064b4c', readAt: '2026-09-08T04:02:40.518Z' },
    loading: null,
    update: null,
    stepsFor,
  })
  assert.deepEqual(pinned.source?.link, { label: 'Jhope188/ConditionalAccessPolicies', url: 'https://github.com/Jhope188/ConditionalAccessPolicies' })
  // The date is the pin timestamp in the display zone, like every other date the product shows.
  assert.equal(pinned.source?.version, `Commit 90d9b89, read from that repository on ${absoluteDate('2026-09-08T04:02:40.518Z')}.`)
  assert.match(pinned.source?.version ?? '', /^Commit [0-9a-f]{7}, read from that repository on [A-Z][a-z]{2} \d+, \d{4}\.$/)
  // An uploaded package has no source IAMAI can name and no update it can watch
  // for, and the disclosure says exactly that rather than the pinned sentence.
  const uploaded = baselineTile({ name: 'Uploaded package', policyCount: 3, version: 'uploaded', loading: null, update: null, stepsFor })
  assert.equal(uploaded.source?.link, null, 'an uploaded package is not given a source link')
  assert.match(uploaded.source?.version ?? '', /^This package came from files you uploaded/)
  // An MVP is a person's credential. Nothing here may read as Microsoft
  // endorsing, certifying, approving or supporting IAMAI or this baseline.
  assert.doesNotMatch(said, /Microsoft(-| )(approved|certified|endorsed|recommended|official)|endorse|certifie|approved by Microsoft/i, said)
  assert.equal(t.update, null)
  assert.deepEqual(t.actions, [{ label: 'Change baseline', weight: 'secondary' }])
  const u = baselineTile({
    name: 'Jon Hope — Defense in Depth',
    policyCount: 46,
    loading: null,
    update: {
      date: '2026-09-03T10:00:00Z',
      changes: [
        change({ key: 'reg', kind: 'added', newName: 'IAC - INTUNE - GRANT - Device Registration' }),
        change({ key: 'admins', kind: 'renamedChanged', renamed: true, oldName: 'IAC - GLOBAL - GRANT - MFA - Admins', newName: 'IAC - GLOBAL - GRANT - MFA - AllAdmins', deltas: [{ field: 'authenticationStrength', kind: 'set', value: 'Modern MFA + TAP' }, { field: 'excludeGroups', kind: 'added', n: 1 }] }),
        change({ key: 'old', kind: 'removed', oldName: 'IAC - OLD - BLOCK' }),
      ],
    },
    stepsFor,
  })
  assert.ok(u.update)
  assert.match(u.update.summary, /^Updated by its author on [A-Z][a-z]{2} \d+, \d{4} · 3 policies changed · review$/)
  // Every changed policy is named (added, removed, changed), and under each the plan steps that change, one line each, or "no step changes".
  assert.deepEqual(
    u.update.rows.map((r) => [r.tag, r.policy, ...(r.was ? [r.was] : []), ...r.deltas, ...r.steps]),
    [
      ['added', 'IAC - INTUNE - GRANT - Device Registration', 'no step changes'],
      [
        'renamed and changed',
        'IAC - GLOBAL - GRANT - MFA - AllAdmins',
        'was IAC - GLOBAL - GRANT - MFA - Admins',
        'Authentication strength: now Modern MFA + TAP',
        'Excluded groups: 1 added',
        'changes Require Phishing-Resistant MFA for Admins',
        'changes Require MFA for Everyone',
      ],
      ['removed', 'IAC - OLD - BLOCK', 'no step changes'],
    ],
  )
  assert.equal(u.update.note, null, 'a complete review carries no incomplete note')
  for (const r of u.update.rows) {
    assert.ok(['added', 'removed', 'changed', 'renamed', 'renamed and changed', 'not reviewed'].includes(r.tag))
    assert.ok(r.policy.length > 3 && !/\bpolicy\b/.test(r.policy), `a row names its policy, never "policy": "${r.policy}"`)
    assert.ok(r.steps.length >= 1)
  }
  // A review IAMAI could not finish says so, and never renders as nothing to see.
  const partial = baselineTile({ name: 'x', policyCount: 46, loading: null, update: { date: '2026-09-03T10:00:00Z', changes: [], incomplete: true }, stepsFor })
  assert.ok(partial.update, 'an incomplete review with no readable change still renders')
  assert.match(partial.update.summary, /IAMAI could not read every change · review$/)
  assert.doesNotMatch(partial.update.summary, /0 polic/)
  assert.match(partial.update.note ?? '', /^IAMAI could not read every changed file/)
  // The card's size line bends to the count (src/content/render.ts pluralise).
  assert.equal(baselineTile({ name: 'synthetic baseline', policyCount: 1, loading: null, update: null, stepsFor }).card?.source, '1 policy · pinned version')
  // A load in flight is the step's state and nests no card: a card is a package that arrived.
  const loading = baselineTile({ name: null, policyCount: 0, loading: 'Jon Hope — Defense in Depth', update: null, stepsFor })
  assert.match(loading.state, /^loading Jon Hope — Defense in Depth/)
  assert.equal(loading.card, null)
  noOtherRole(tileStrings(u))
})

// The strings that belong to one Scan state and no other.
const SCAN_OWN: Record<ScanTile['kind'], string[]> = {
  complete: ['complete · '],
  gaps: ['no plan built', 'Ask whoever administers the tenant for Global Reader'],
  role: ["can't read the tenant", 'Everything IAMAI needs, read-only'],
  scanning: ['Stop'],
  ready: ['Scan tenant', 'About ten minutes'],
  sample: ['after sign-in · about a minute for a small tenant'],
}
// What the other tile carries, never the Scan tile (the fact labels are the Plan tile's).
const PLAN_STRINGS = ['Open the plan →', 'Open the last full plan', 'from the scan', 'What the sample tenant produced', 'already in place', 'Open the sample plan']
const scanOnlyItsOwn = (t: ScanTile): void => {
  const text = tileStrings(t).join('\n')
  for (const s of SCAN_OWN[t.kind]) assert.ok(text.includes(s), `${t.kind} renders "${s}"`)
  for (const [other, strings] of Object.entries(SCAN_OWN)) {
    if (other === t.kind) continue
    for (const s of strings) assert.ok(!text.includes(s), `${t.kind} must not render ${other}'s "${s}"`)
  }
  for (const s of PLAN_STRINGS) assert.ok(!text.includes(s), `the Scan tile must not render the Plan tile's "${s}"`)
  noOtherRole(tileStrings(t))
}
// The Scan tile carries no Reads / Compares / Writes beats in either state: the read-only line, the limitations and its state alone.
const noBeats = (t: ScanTile): void => {
  assert.ok(!('beats' in t), 'no beats on the tile')
  const text = tileStrings(t).join('\n')
  // The beat sentences, not the words: the ready state's own note reads "Reads the tenant into this browser".
  for (const s of ['policies, people, sign-in records and licences', 'what each baseline policy is for', 'a dated plan for the difference', '\nReads\n', '\nCompares\n', '\nWrites\n']) assert.ok(!text.includes(s), `the Scan tile must not render the beat "${s.trim()}"`)
}
const beatsOf = (t: ScanTile): void => {
  assert.equal(t.n, 3)
  assert.equal(t.title, 'Scan')
  noBeats(t)
  // No read-only line either: the limitations collapsible and the scan control alone.
  assert.ok(!('readOnly' in t) && !tileStrings(t).join('\n').includes('Read-only.'), 'no read-only line on the tile')
  assert.equal(t.limits.summary, 'IAMAI limitations')
  assert.equal(t.limits.lines.length, 5)
  assert.equal(t.limits.more, 'Permissions, every check it runs, and its limits in full:')
  assert.equal(t.limits.link.label, 'How IAMAI works →')
  assert.equal(t.limits.link.href, '#/how')
}

test('tile 3, Scan, complete: no beats, no read-only line, the five limitations and the How line, complete · N ago in the heading, Scan again (secondary) alone, the accent badge', () => {
  const t = scanTile({ kind: 'complete', at: full.asOf, now: twoMinutesLater })
  beatsOf(t)
  assert.equal(t.state, 'complete · 2 minutes ago')
  assert.equal(t.tone, 'done')
  assert.equal(t.lead, undefined)
  assert.equal(t.rows, undefined)
  assert.deepEqual(t.actions, [{ label: 'Scan again', weight: 'secondary' }])
  scanOnlyItsOwn(t)
})

test('tile 3, finished with gaps: the unread rows, one ask for Global Reader with the Microsoft link, Sign in with another account (primary), Scan again (secondary), the amber badge; no plan button', () => {
  const unread = unreadSources(gapsSnapshot())
  assert.deepEqual(unread, ['config:caPolicies', 'signInEvidence'])
  const t = scanTile({ kind: 'gaps', unread, lastScan: last })
  beatsOf(t)
  assert.equal(t.state, 'finished with gaps · no plan built')
  assert.equal(t.tone, 'wait')
  assert.equal(t.lead, '2 sections could not be read with this account. The plan needs them, so IAMAI kept your last full plan and built nothing from this scan.')
  assert.deepEqual(t.rows, [
    { name: 'Conditional Access policies', value: 'not read' },
    { name: 'Sign-in records', value: 'not read' },
  ])
  assert.equal(t.ask, 'Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing.')
  assert.equal(t.learn?.label, 'Microsoft: Global Reader')
  assert.match(t.learn?.url ?? '', /learn\.microsoft\.com.*global-reader/)
  assert.deepEqual(t.actions, [
    { label: 'Sign in with another account', weight: 'primary' },
    { label: 'Scan again', weight: 'secondary' },
  ])
  const first = scanTile({ kind: 'gaps', unread, lastScan: null })
  assert.equal(first.lead, '2 sections could not be read with this account. The plan needs them, so IAMAI built nothing from this scan.')
  assert.deepEqual(first.actions, t.actions, 'the last full plan is the Plan tile\'s, not this one\'s')
  scanOnlyItsOwn(t)
})

test('tile 3, not started: the account, one row asking for Global Reader, Sign in with another account (primary) alone, the red badge', () => {
  const gap = coreRoleGap(rolesInToken(noRolesToken()))
  assert.ok(gap)
  const t = scanTile({ kind: 'role', upn, gap })
  beatsOf(t)
  assert.equal(t.state, "not started · this account can't read the tenant")
  assert.equal(t.tone, 'stop')
  assert.equal(t.lead, 'alex@example.com holds none of the roles that read Conditional Access policies, people and sign-in records.')
  assert.deepEqual(t.rows, [{ name: 'Everything IAMAI needs, read-only', value: 'ask for Global Reader' }])
  assert.deepEqual(t.actions, [{ label: 'Sign in with another account', weight: 'primary' }])
  scanOnlyItsOwn(t)
})

test('tile 3, scanning: one line with the elapsed time, Stop (tertiary), no state colour; ready: Scan tenant (primary) and the ten-minute line', () => {
  const s = scanTile({ kind: 'scanning', lane: 'Reading sign-in records', elapsed: '8s' })
  beatsOf(s)
  assert.equal(s.state, 'reading sign-in records · 8s')
  assert.equal(s.tone, null)
  assert.deepEqual(s.actions, [{ label: 'Stop', weight: 'tertiary' }])
  scanOnlyItsOwn(s)
  const r = scanTile({ kind: 'ready' })
  beatsOf(r)
  assert.equal(r.state, 'not started')
  assert.equal(r.tone, null)
  assert.equal(r.note, 'About ten minutes. Reads the tenant into this browser; nothing is sent anywhere.')
  assert.deepEqual(r.actions, [{ label: 'Scan tenant', weight: 'primary' }])
  scanOnlyItsOwn(r)
})

// The strings that belong to one Plan state and no other.
const PLAN_OWN: Record<PlanTile['kind'], string[]> = {
  ready: ['from the scan', 'Open the plan →'],
  last: ['last full plan · ', 'Open the last full plan'],
  waiting: [],
  sample: ['What the sample tenant produced', 'already in place', 'Open the sample plan'],
}
const planOnlyItsOwn = (t: PlanTile): void => {
  const text = tileStrings(t).join('\n')
  assert.equal(t.n, 4)
  assert.equal(t.title, 'Plan')
  for (const s of PLAN_OWN[t.kind]) assert.ok(text.includes(s), `${t.kind} renders "${s}"`)
  for (const [other, strings] of Object.entries(PLAN_OWN)) {
    if (other === t.kind) continue
    for (const s of strings) assert.ok(!text.includes(s), `${t.kind} must not render ${other}'s "${s}"`)
  }
  for (const s of ['Scan again', 'Scan tenant', 'Stop', 'no plan built', "can't read the tenant", 'Reads']) assert.ok(!text.includes(s), `the Plan tile must not render the Scan tile's "${s}"`)
  noOtherRole(tileStrings(t))
}

const NO_MAPPING = { breakGlassUserIds: [] as string[], serviceAccountUserIds: [] as string[] }
const L = factsOf(ladder(full, NO_MAPPING, full.asOf))

test('tile 4, Plan, ready: "ready · N steps, N done · from the scan N ago", one line of what was built, Open the plan (primary) alone, the accent badge; no facts row, no drop line', () => {
  const t = planTile({ kind: 'ready', at: full.asOf, counts: { steps: 33, done: 8 }, now: twoMinutesLater })
  assert.equal(t.state, 'ready · 33 steps, 8 done · from the scan 2 minutes ago')
  assert.equal(t.tone, 'done')
  assert.equal(t.lead, 'Built from this scan: every step in order, who it touches, and when to make it.')
  assert.equal(t.facts, undefined, 'the facts row left the tile')
  assert.deepEqual(t.actions, [{ label: 'Open the plan →', weight: 'primary' }])
  // Until the plan has computed, the state carries the age alone: never a placeholder count.
  const counting = planTile({ kind: 'ready', at: full.asOf, counts: null, now: twoMinutesLater })
  assert.equal(counting.state, 'ready · from the scan 2 minutes ago')
  const page = tileStrings(t).join('\n')
  assert.ok(!/→ \d|\d →|licence|sign-in records|policies/.test(page), `no drop line, no window, no facts: ${page}`)
  planOnlyItsOwn(t)
})

// Task 016: Plan is the destination after the first successful scan, so the
// Plan stage carries one way on and no person-level readiness diagnostic. The
// rung counts belong to MFA Readiness, which comes after the plan, not before.
test('the Plan stage routes to the plan and to nothing before it', () => {
  const t = planTile({ kind: 'ready', at: full.asOf, counts: { steps: 33, done: 8 } })
  assert.deepEqual(
    t.actions.map((a) => a.label),
    ['Open the plan →'],
    'one way on, and it is the plan',
  )
  assert.ok(!('ladder' in t), 'no readiness ladder on the Plan stage')
  const words = JSON.stringify(pages.connect)
  for (const rung of RUNGS) assert.ok(!words.includes(`rung-${rung}`), 'Connect names no readiness rung')
  assert.ok(!words.includes('MFA Readiness'), 'Connect does not send the operator to MFA Readiness before the plan')
  // The counts the ladder drew are the same fact, on the surface that owns it.
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const counted = factsOf(ladder(f.snapshot, f.mapping, f.snapshot.asOf))
    assert.deepEqual(counted, readinessView(f.snapshot, f.snapshot.asOf, f.mapping).facts, `${name}: MFA Readiness still counts them`)
    assert.equal(
      RUNGS.reduce((n, r) => n + counted.rungs[r], 0),
      counted.active,
      `${name}: the rungs sum to the active people`,
    )
  }
})

test('tile 4 after a scan with gaps: last full plan · date and Open the last full plan (date) (tertiary) alone, no state colour; with nothing before it, it waits', () => {
  const t = planTile({ kind: 'last', at: full.asOf })
  assert.match(t.state, /^last full plan · [A-Z][a-z]{2} \d+$/)
  assert.equal(t.tone, null)
  assert.equal(t.facts, undefined)
  assert.equal(t.actions.length, 1)
  assert.match(t.actions[0].label, /^Open the last full plan \([A-Z][a-z]{2} \d+\)$/)
  assert.equal(t.actions[0].weight, 'tertiary')
  assert.equal(t.actions[0].label, `Open the last full plan (${t.state.replace('last full plan · ', '')})`, 'the state and the button name the same date')
  planOnlyItsOwn(t)
  const w = planTile({ kind: 'waiting' })
  assert.equal(w.state, 'after the scan')
  assert.equal(w.tone, null)
  assert.deepEqual(w.actions, [])
  assert.equal(w.facts, undefined)
  planOnlyItsOwn(w)
})

test("the page renders the scan's age from the one stored timestamp: Scan says complete · N ago, Plan says from the scan N ago with the same words, and no words say scanned", () => {
  const now = Date.parse(full.asOf) + 57 * 60_000
  const scan = scanTile({ kind: 'complete', at: full.asOf, now })
  const plan = planTile({ kind: 'ready', at: full.asOf, counts: { steps: 33, done: 8 }, now })
  assert.equal(scan.state, 'complete · 57 minutes ago')
  assert.equal(plan.state, 'ready · 33 steps, 8 done · from the scan 57 minutes ago')
  const age = scan.state.replace('complete · ', '')
  assert.ok(plan.state.endsWith(age), 'the two tiles read the same age')
  const page = [...tileStrings(accountTile({ tenant, upn, role: 'Global Administrator' })), ...tileStrings(scan), ...tileStrings(plan)].join('\n')
  assert.equal((page.match(/\b\d+ minutes ago\b/g) ?? []).length, 2, 'the age renders in the Scan and the Plan tile, nowhere else')
  assert.ok(!/scanned/i.test(page), 'the tiles do not say scanned')
  // The header and the Plan surface carry neither the scan's age nor the tenant: Connect alone does (docs/design/connect-mockup.html).
  const shell = JSON.stringify(app.shell)
  assert.ok(!/scanned|Re-scan|\{age\}/.test(shell), 'the header words carry no scan age or scan control')
  // The Plan's header words: the steps line and its variants, never the tenant or the scan's age (its second line left with docs/design/mockups/plan-top-v2.html).
  const planWords = JSON.stringify(pages.plan)
  assert.ok(!/\{tenant\}|\{age\}/.test(planWords))
  assert.ok(!('line2' in (pages.plan as Record<string, unknown>)), 'pages.plan.line2 was retired')
})
