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

const upn = 'alex@example.com'
const tenant = 'Contoso Pty Ltd'
const full = fixtureSnapshot()
const last = { snapshot: full, at: full.asOf }
const twoMinutesLater = Date.parse(full.asOf) + 120_000
const stepFor = (policy: string): string | null => (policy === 'IAC - GLOBAL - GRANT - MFA - AllAdmins' ? 'Require Phishing-Resistant MFA for Admins' : null)

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

test('tile 2, Baseline: name · count as the state, the approved sentences in two paragraphs, the author-update rows, Change baseline (secondary)', () => {
  const t = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: 46, loading: null, update: null, stepFor })
  assert.equal(t.n, 2)
  assert.equal(t.title, 'Baseline')
  assert.equal(t.state, 'Jon Hope — Defense in Depth · 46 policies')
  assert.equal(t.paragraphs.length, 2)
  assert.match(t.paragraphs[0], /^A published set of Conditional Access policies, built and maintained by Jon Hope, Microsoft MVP, at ConditionalAccess\.Tech\. IAMAI pins a reviewed version and tells you when he updates it\.$/)
  assert.match(t.paragraphs[1], /^Its aim is layered protection for a small organisation: /)
  assert.equal(t.update, null)
  assert.deepEqual(t.actions, [{ label: 'Change baseline', weight: 'secondary' }])
  const u = baselineTile({
    name: 'Jon Hope — Defense in Depth',
    policyCount: 46,
    loading: null,
    update: { date: '2026-09-03T10:00:00Z', changes: [{ policy: 'IAC - INTUNE - GRANT - Device Registration', change: 'added' }, { policy: 'IAC - GLOBAL - GRANT - MFA - AllAdmins', change: 'updated' }, { policy: 'IAC - OLD - BLOCK', change: 'removed' }] },
    stepFor,
  })
  assert.ok(u.update)
  assert.match(u.update.summary, /^Updated by its author on [A-Z][a-z]{2} \d+, \d{4} · 3 policies changed · review$/)
  assert.deepEqual(
    u.update.rows.map((r) => [r.tag, r.policy, r.step]),
    [
      ['added', 'IAC - INTUNE - GRANT - Device Registration', 'no step changes'],
      ['changed', 'IAC - GLOBAL - GRANT - MFA - AllAdmins', 'changes Require Phishing-Resistant MFA for Admins'],
      ['removed', 'IAC - OLD - BLOCK', 'no step changes'],
    ],
  )
  assert.equal(baselineTile({ name: 'synthetic baseline', policyCount: 1, loading: null, update: null, stepFor }).state, 'synthetic baseline · 1 policy')
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
// What the other tile carries, never the Scan tile (its Reads beat says "licences"; the fact label is the Plan tile's).
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
const beatsOf = (t: ScanTile): void => {
  assert.equal(t.n, 3)
  assert.equal(t.title, 'Scan')
  assert.deepEqual(
    t.beats.map((b) => b.label),
    ['Reads', 'Compares', 'Writes'],
  )
  assert.equal(t.beats[0].text, "Contoso Pty Ltd's policies, people, sign-in records and licences.")
  assert.equal(t.beats[1].text, 'what each baseline policy is for with what Contoso Pty Ltd already has.')
  assert.match(t.beats[2].text, /^a dated plan for the difference: report-only before enforced, who each change touches, what would break, and the emails to send\.$/)
  assert.equal(t.readOnly, 'Read-only. It holds no permission that can create, change or delete anything.')
  assert.equal(t.limits.summary, 'IAMAI limitations')
  assert.equal(t.limits.lines.length, 5)
  assert.equal(t.limits.more, 'Permissions, every check it runs, and its limits in full:')
  assert.equal(t.limits.link.label, 'How IAMAI works →')
  assert.equal(t.limits.link.href, '#/how')
}

test('tile 3, Scan, complete: the beats, the read-only line, the five limitations and the How line, complete · N ago in the heading, Scan again (secondary) alone, the accent badge', () => {
  const t = scanTile(tenant, { kind: 'complete', at: full.asOf, now: twoMinutesLater })
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
  const t = scanTile(tenant, { kind: 'gaps', unread, lastScan: last })
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
  const first = scanTile(tenant, { kind: 'gaps', unread, lastScan: null })
  assert.equal(first.lead, '2 sections could not be read with this account. The plan needs them, so IAMAI built nothing from this scan.')
  assert.deepEqual(first.actions, t.actions, 'the last full plan is the Plan tile\'s, not this one\'s')
  scanOnlyItsOwn(t)
})

test('tile 3, not started: the account, one row asking for Global Reader, Sign in with another account (primary) alone, the red badge', () => {
  const gap = coreRoleGap(rolesInToken(noRolesToken()))
  assert.ok(gap)
  const t = scanTile(tenant, { kind: 'role', upn, gap })
  beatsOf(t)
  assert.equal(t.state, "not started · this account can't read the tenant")
  assert.equal(t.tone, 'stop')
  assert.equal(t.lead, 'alex@example.com holds none of the roles that read Conditional Access policies, people and sign-in records.')
  assert.deepEqual(t.rows, [{ name: 'Everything IAMAI needs, read-only', value: 'ask for Global Reader' }])
  assert.deepEqual(t.actions, [{ label: 'Sign in with another account', weight: 'primary' }])
  scanOnlyItsOwn(t)
})

test('tile 3, scanning: one line with the elapsed time, Stop (tertiary), no state colour; ready: Scan tenant (primary) and the ten-minute line', () => {
  const s = scanTile(tenant, { kind: 'scanning', lane: 'Reading sign-in records', elapsed: '8s' })
  beatsOf(s)
  assert.equal(s.state, 'reading sign-in records · 8s')
  assert.equal(s.tone, null)
  assert.deepEqual(s.actions, [{ label: 'Stop', weight: 'tertiary' }])
  scanOnlyItsOwn(s)
  const r = scanTile(tenant, { kind: 'ready' })
  beatsOf(r)
  assert.equal(r.state, 'not started')
  assert.equal(r.tone, null)
  assert.equal(r.note, 'About ten minutes. Reads the tenant into this browser; nothing is sent anywhere.')
  assert.deepEqual(r.actions, [{ label: 'Scan tenant', weight: 'primary' }])
  scanOnlyItsOwn(r)
})

// The strings that belong to one Plan state and no other.
const PLAN_OWN: Record<PlanTile['kind'], string[]> = {
  ready: ['ready · from the scan', 'Open the plan →', 'licence'],
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

test('tile 4, Plan, ready: ready · from the scan N ago, people · policies · sign-in window · licence · steps and done, Open the plan (primary) alone, the accent badge', () => {
  const t = planTile({ kind: 'ready', snapshot: full, at: full.asOf, counts: { steps: 33, done: 8 }, now: twoMinutesLater })
  assert.equal(t.state, 'ready · from the scan 2 minutes ago')
  assert.equal(t.tone, 'done')
  assert.deepEqual(
    t.facts?.map((f) => f.label),
    ['people', 'policies', 'sign-in records', 'licence', 'steps · 8 done'],
  )
  assert.equal(t.facts?.[0].value, '5')
  assert.equal(t.facts?.[1].value, '3')
  assert.match(t.facts?.[2].value ?? '', /^[A-Z][a-z]{2} \d+ → [A-Z][a-z]{2} \d+$/)
  assert.match(t.facts?.[3].value ?? '', /^(P2|P1|Free)$/)
  assert.equal(t.facts?.[4].value, '33')
  assert.deepEqual(t.actions, [{ label: 'Open the plan →', weight: 'primary' }])
  const counting = planTile({ kind: 'ready', snapshot: full, at: full.asOf, counts: null })
  assert.equal(counting.facts?.length, 4, 'until the plan has computed, the four scan facts alone; never a placeholder count')
  const free = fixtureSnapshot()
  free.sources.signInEvidence = { status: 'disabled', coveredWindow: null, reason: 'not available on this licence (needs Entra ID P1)', asOf: free.asOf }
  assert.equal(planTile({ kind: 'ready', snapshot: free, at: free.asOf, counts: null }).facts?.[2].value, 'not read', 'sign-ins not read: the fact says so, never an empty window')
  planOnlyItsOwn(t)
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
  const scan = scanTile(tenant, { kind: 'complete', at: full.asOf, now })
  const plan = planTile({ kind: 'ready', snapshot: full, at: full.asOf, counts: { steps: 33, done: 8 }, now })
  assert.equal(scan.state, 'complete · 57 minutes ago')
  assert.equal(plan.state, 'ready · from the scan 57 minutes ago')
  const age = scan.state.replace('complete · ', '')
  assert.ok(plan.state.endsWith(age), 'the two tiles read the same age')
  const page = [...tileStrings(accountTile({ tenant, upn, role: 'Global Administrator' })), ...tileStrings(scan), ...tileStrings(plan)].join('\n')
  assert.equal((page.match(/\b\d+ minutes ago\b/g) ?? []).length, 2, 'the age renders in the Scan and the Plan tile, nowhere else')
  assert.ok(!/scanned/i.test(page), 'the tiles do not say scanned')
  // The header and the Plan surface carry neither the scan's age nor the tenant: Connect alone does (docs/design/connect-mockup.html).
  const shell = JSON.stringify(app.shell)
  assert.ok(!/scanned|Re-scan|\{age\}/.test(shell), 'the header words carry no scan age or scan control')
  const plan2 = (pages.plan as { line2: string }).line2
  assert.equal(plan2, 'Today shows where each person stands.')
  assert.ok(!/\{tenant\}|\{age\}/.test(plan2))
})
