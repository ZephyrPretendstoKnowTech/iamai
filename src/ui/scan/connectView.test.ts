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
import { gapsSnapshot, noRolesToken, tokenWithRoles } from '../../testing/gapsFixture.ts'
import { coreRoleGap, holdsReadEverything, rolesInToken } from '../../graph/collect/tokenRoles.ts'
import { CONFIG_KEYS, SOURCE_KEYS, coreGaps, unreadSources } from '../../graph/collect/coreSections.ts'
import { app, pages } from '../../content/content.ts'
import { accountTile, baselineTile, connectStatus, planInputOf, planTile, scanTile, tileStrings } from './connectView.ts'
import type { PlanTile, ScanTile } from './connectView.ts'
import type { PolicyChange } from '../../derive/baselineDiff.ts'
import { absoluteDate } from '../../copy/dates.ts'
import { ladder } from '../../derive/ladder.ts'
import { READINESS_STATES } from '../../scoring/phishingResistant.ts'
import { factsOf } from '../../derive/facts.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { conditionalAccessLicenceLine } from '../../derive/notLicensed.ts'
import { readFileSync } from 'node:fs'
import { fillText } from '../../content/render.ts'
import { signInProofRead } from '../../scoring/fromSnapshot.ts'

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
  assert.equal(t.note, "Global Reader is the least privilege that reads everything IAMAI needs; a Global Administrator account works too, but sign in with less if you can. It writes nothing. Before anyone in a tenant can use IAMAI, a Global Administrator approves it once by selecting “Consent on behalf of your organization” on Microsoft's screen; after that, Global Reader is enough.")
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
  assert.match(t.card.paragraphs[0], /^A baseline is a set of Conditional Access policies to measure your tenant against/, 'the term is explained before it is used')
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
  ready: ['Scan tenant', 'The scan is processed in this browser'],
  sample: ['after sign-in'],
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
  assert.deepEqual(t.actions, [{ label: 'Scan again', weight: 'secondary', does: 'scanAgain' }])
  scanOnlyItsOwn(t)
})

// S4-7 and S4-8: a scan that built a plan could still have been refused ten
// sections or have read one only in part, and the tile said "complete" and
// nothing else. The plan was built, so the tile stays done — this is not a
// failure — but it names what it was built without, and a section read in part
// says so rather than reading as one that was never read.
test('tile 3, Scan, complete with sections it did not read in full: the same complete heading and accent badge, and the sections under it, partly read told apart from not read', () => {
  const t = scanTile({
    kind: 'complete',
    at: full.asOf,
    now: twoMinutesLater,
    unread: [
      { source: 'config:caPolicies', partial: true, refused: false },
      { source: 'config:roleAssignments', partial: false, refused: false },
      { source: 'devices', partial: false, refused: false },
    ],
  })
  assert.equal(t.state, 'complete · 2 minutes ago', 'a plan was built: the scan is complete and says so')
  assert.equal(t.tone, 'done', 'not a failure, and not the gaps tile')
  assert.equal(t.lead, '3 sections were not read in full. The plan is built from what IAMAI did read, so check what is listed under Scan before you act on it.')
  assert.deepEqual(t.rows, [
    { name: 'Conditional Access policies', value: 'partly read' },
    { name: 'Role assignments', value: 'not read' },
    { name: 'Devices', value: 'not read' },
  ])
  assert.deepEqual(t.actions, [{ label: 'Scan again', weight: 'secondary', does: 'scanAgain' }], 'no Sign in with another account: the plan was built')
  scanOnlyItsOwn(t)
  // One section: the line counts itself down (content/render.ts pluralise).
  const one = scanTile({ kind: 'complete', at: full.asOf, now: twoMinutesLater, unread: [{ source: 'devices', partial: false, refused: false }] })
  assert.match(one.lead ?? '', /^1 section was not read in full/)
})

test('every section label the unread list can name is a phrase, never a Graph key', () => {
  const every = [...CONFIG_KEYS.map((k) => `config:${k}`), ...SOURCE_KEYS, 'recoveryAudit']
  const t = scanTile({ kind: 'complete', at: full.asOf, now: twoMinutesLater, unread: every.map((source) => ({ source, partial: false, refused: false })) })
  for (const row of t.rows ?? []) assert.doesNotMatch(row.name, /^config:|^[a-z]+[A-Z]/, `${row.name} reaches the operator as its Graph key`)
})

test('tile 3, finished with gaps: the unread rows, one ask for Global Reader with the Microsoft link, Sign in with another account (primary), Scan again (secondary), the amber badge; no plan button', () => {
  const unread = unreadSources(gapsSnapshot())
  assert.deepEqual(unread, [
    { source: 'config:caPolicies', partial: false, refused: false },
    { source: 'signInEvidence', partial: false, refused: true },
  ])
  const t = scanTile({ kind: 'gaps', gaps: coreGaps(gapsSnapshot()), unread, lastScan: last })
  beatsOf(t)
  assert.equal(t.state, 'finished with gaps · no plan built')
  assert.equal(t.tone, 'wait')
  assert.equal(t.lead, 'The plan needs 2 sections that could not be read in full, so IAMAI kept your last full plan and built nothing from this scan.')
  assert.deepEqual(t.rows, [
    { name: 'Conditional Access policies', value: 'not read' },
    { name: 'Sign-in records', value: 'refused to this account' },
  ])
  assert.equal(t.ask, 'Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing.')
  assert.equal(t.learn?.label, 'Microsoft: Global Reader')
  assert.match(t.learn?.url ?? '', /learn\.microsoft\.com.*global-reader/)
  assert.deepEqual(t.actions, [
    { label: 'Sign in with another account', weight: 'primary', does: 'signInAnother' },
    { label: 'Scan again', weight: 'secondary', does: 'scanAgain' },
  ])
  const first = scanTile({ kind: 'gaps', gaps: coreGaps(gapsSnapshot()), unread, lastScan: null })
  assert.equal(first.lead, 'The plan needs 2 sections that could not be read in full, so IAMAI built nothing from this scan.')
  assert.deepEqual(first.actions, t.actions, 'the last full plan is the Plan tile\'s, not this one\'s')
  scanOnlyItsOwn(t)
})

// Phase 2 audit (Connect): every unread section was said to be unread "with
// this account", and the gaps tile asked for Global Reader and offered another
// account whatever the reason. A read Microsoft throttled, or one the sign-in
// read stopped at its memory ceiling, is not the account's doing: a Global
// Reader was told to ask for Global Reader. Only a refusal (roles.ts
// isPrivilegeDenial) names this account and carries the ask, in both states.
test('a section Microsoft did not return in full is not blamed on the account; only a refusal names this account and asks for Global Reader', () => {
  const said = (t: ScanTile): string => tileStrings(t).join('\n')
  const small = fixture('small').snapshot
  // The sign-in read stopped at the memory ceiling with 9 hours of records (laneBCore.ts 'insufficient').
  const ceiling = structuredClone(small)
  ceiling.sources.signInEvidence = { status: 'insufficient', reason: 'stopped at memory ceiling with only 9 h covered (minimum 24 h)', coveredWindow: { from: '2026-09-07T15:00:00Z', to: '2026-09-08T00:00:00Z' }, asOf: ceiling.asOf }
  const stopped = scanTile({ kind: 'gaps', gaps: coreGaps(ceiling), unread: unreadSources(ceiling), lastScan: null })
  assert.deepEqual(stopped.rows, [{ name: 'Sign-in records', value: 'partly read' }], 'nine hours of records is a read in part, not nothing')
  assert.doesNotMatch(said(stopped), /this account|Global Reader/, 'a read stopped short is not blamed on the account')
  assert.equal(stopped.ask, undefined)
  assert.equal(stopped.learn, undefined)
  assert.deepEqual(stopped.actions, [{ label: 'Scan again', weight: 'secondary', does: 'scanAgain' }], 'another account reads nothing more')
  // Microsoft throttled the read and the retries ran out.
  const throttled = structuredClone(small)
  throttled.sources.signInEvidence = { status: 'error', reason: 'HTTP 429 TooManyRequests', coveredWindow: null, asOf: throttled.asOf }
  const busy = scanTile({ kind: 'gaps', gaps: coreGaps(throttled), unread: unreadSources(throttled), lastScan: null })
  assert.deepEqual(busy.rows, [{ name: 'Sign-in records', value: 'not read' }])
  assert.doesNotMatch(said(busy), /this account|Global Reader/)
  assert.deepEqual(busy.actions, [{ label: 'Scan again', weight: 'secondary', does: 'scanAgain' }])
  // A refusal is the account's: that row says so, and the ask and the other account stay.
  const refused = scanTile({ kind: 'gaps', gaps: coreGaps(gapsSnapshot()), unread: unreadSources(gapsSnapshot()), lastScan: null })
  assert.deepEqual(refused.rows, [
    { name: 'Conditional Access policies', value: 'not read' },
    { name: 'Sign-in records', value: 'refused to this account' },
  ])
  assert.equal(refused.ask, 'Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing.')
  assert.equal(refused.learn?.label, 'Microsoft: Global Reader')
  assert.deepEqual(refused.actions.map((a) => a.label), ['Sign in with another account', 'Scan again'])
  assert.doesNotMatch(refused.lead ?? '', /this account/, 'the lead counts the sections; the row names the refusal')
  // A complete scan the account was refused sections of carries the same ask (finding: "check these" alone could not be acted on).
  const denied = structuredClone(small)
  denied.sources.registrationDetails = { ...denied.sources.registrationDetails, status: 'disabled', reason: 'access denied (403)', coveredWindow: null }
  denied.sources.devices = { ...denied.sources.devices, status: 'disabled', reason: 'access denied (403)', coveredWindow: null }
  const built = scanTile({ kind: 'complete', at: full.asOf, now: twoMinutesLater, unread: unreadSources(denied) })
  assert.deepEqual(built.rows, [
    { name: 'MFA registration', value: 'refused to this account' },
    { name: 'Devices', value: 'refused to this account' },
  ])
  assert.equal(built.ask, 'Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing.')
  assert.equal(built.learn?.label, 'Microsoft: Global Reader')
  assert.deepEqual(built.actions, [{ label: 'Scan again', weight: 'secondary', does: 'scanAgain' }], 'the plan was built: Scan again alone')
  // And a complete scan whose shortfall is not a refusal says nothing about the account.
  const demo = fixture('demo').snapshot
  const partly = scanTile({ kind: 'complete', at: full.asOf, now: twoMinutesLater, unread: unreadSources(demo) })
  assert.ok((partly.rows ?? []).length > 0, 'the premise: the demo scan read a section in part')
  assert.doesNotMatch(said(partly), /this account|Global Reader/)
  assert.equal(partly.ask, undefined)
})

// Phase 2 review, round 1: a refused section still asked for Global Reader when
// the account's active roles were Global Reader or Global Administrator. Graph
// refusing such an account is not for want of a role (a permission never
// consented is one way it happens), so asking for one sends the reader after a
// role they hold. The row still says the section was refused to this account.
test('a refused section asks a Global Reader or a Global Administrator for no role they already hold', () => {
  const unread = unreadSources(gapsSnapshot())
  const held = scanTile({ kind: 'gaps', gaps: coreGaps(gapsSnapshot()), unread, lastScan: null, readsEverything: true })
  assert.equal(held.ask, undefined, 'no ask for a role the account holds')
  assert.equal(held.learn, undefined)
  assert.deepEqual(held.rows, [
    { name: 'Conditional Access policies', value: 'not read' },
    { name: 'Sign-in records', value: 'refused to this account' },
  ], 'the refusal is still stated')
  const denied = structuredClone(fixture('small').snapshot)
  denied.sources.devices = { ...denied.sources.devices, status: 'disabled', reason: 'access denied (403)', coveredWindow: null }
  const built = scanTile({ kind: 'complete', at: full.asOf, now: twoMinutesLater, unread: unreadSources(denied), readsEverything: true })
  assert.deepEqual(built.rows, [{ name: 'Devices', value: 'refused to this account' }])
  assert.equal(built.ask, undefined)
  // Without those roles, or with none known, the ask stays.
  assert.equal(scanTile({ kind: 'gaps', gaps: coreGaps(gapsSnapshot()), unread, lastScan: null, readsEverything: false }).ask, 'Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing.')
  assert.equal(scanTile({ kind: 'complete', at: full.asOf, now: twoMinutesLater, unread: unreadSources(denied) }).learn?.label, 'Microsoft: Global Reader')
  // The one reading of the token (tokenRoles.ts), the rule that also lets the scan start.
  assert.equal(holdsReadEverything(rolesInToken(tokenWithRoles(['Global Reader']))), true)
  assert.equal(holdsReadEverything(rolesInToken(tokenWithRoles(['Global Administrator']))), true)
  assert.equal(holdsReadEverything(rolesInToken(tokenWithRoles(['Security Reader']))), false)
  assert.equal(holdsReadEverything(null), false, 'a token without the claim says nothing about roles')
  const CONNECT = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.equal(CONNECT.match(/readsEverything: holdsReadEverything\(roleIds\)/g)?.length, 2, 'Connect tells the gaps and the complete scan what the token holds')
})

// Phase 2 review, round 1: the gaps tile came to offer Scan again alone where no
// section was refused, and Connect still wired the tile's buttons by their place
// in the list: the first as Sign in with another account, the second as Scan
// again. A throttled, failed or ceiling-stopped sign-in read therefore read an
// action that was not there, and the page fell to its error boundary. Each Scan
// action names what it does, and Connect wires it by that, in every state.
test('every Scan action names what it does, and Connect wires each by that, never by its place', () => {
  const small = fixture('small').snapshot
  const throttled = structuredClone(small)
  throttled.sources.signInEvidence = { status: 'error', reason: 'HTTP 429 TooManyRequests', coveredWindow: null, asOf: throttled.asOf }
  const alone = scanTile({ kind: 'gaps', gaps: coreGaps(throttled), unread: unreadSources(throttled), lastScan: null })
  assert.deepEqual(alone.actions.map((a) => [a.label, a.does]), [['Scan again', 'scanAgain']], 'the one button scans again')
  const refused = scanTile({ kind: 'gaps', gaps: coreGaps(gapsSnapshot()), unread: unreadSources(gapsSnapshot()), lastScan: null })
  assert.deepEqual(refused.actions.map((a) => [a.label, a.does]), [
    ['Sign in with another account', 'signInAnother'],
    ['Scan again', 'scanAgain'],
  ])
  const gap = coreRoleGap(rolesInToken(noRolesToken()))
  assert.ok(gap)
  assert.deepEqual(scanTile({ kind: 'role', upn, gap }).actions.map((a) => a.does), ['signInAnother'])
  assert.deepEqual(scanTile({ kind: 'complete', at: full.asOf, now: twoMinutesLater }).actions.map((a) => a.does), ['scanAgain'])
  assert.deepEqual(scanTile({ kind: 'scanning', lane: 'Sign-in records', elapsed: '1 min' }).actions.map((a) => a.does), ['stop'])
  assert.deepEqual(scanTile({ kind: 'ready' }).actions.map((a) => a.does), ['scan'])
  // Connect renders the actions the tile returns, each wired by what it does.
  const CONNECT = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.doesNotMatch(CONNECT, /t3\.actions\[/, 'Connect picks a Scan action by its place in the list')
  assert.match(CONNECT, /t3\.actions\.map\(\(a\) => <Act key=\{a\.label\} action=\{a\} onClick=\{scanDoes\[a\.does\]\} \/>\)/, 'Connect wires a Scan action by what it does')
})

// Phase 2 audit (Connect): the likeliest gaps scan, sign-in records alone,
// read "1 section could not be reads with this account. The plan needs them":
// the pluraliser conjugated the verb after "could not be", and "them" counted
// one section as many. A verb a modal or "to" governs keeps its base form, and
// the lead names its count without a pronoun.
test('a gaps scan with one section reads as one: no "be reads", no "them"', () => {
  const one = [{ source: 'signInEvidence', partial: false, refused: false }]
  const first = scanTile({ kind: 'gaps', gaps: one, unread: one, lastScan: null })
  assert.equal(first.lead, 'The plan needs 1 section that could not be read in full, so IAMAI built nothing from this scan.')
  const kept = scanTile({ kind: 'gaps', gaps: one, unread: one, lastScan: last })
  assert.equal(kept.lead, 'The plan needs 1 section that could not be read in full, so IAMAI kept your last full plan and built nothing from this scan.')
  const both = [...one, { source: 'config:caPolicies', partial: false, refused: false }]
  const two = scanTile({ kind: 'gaps', gaps: both, unread: both, lastScan: null })
  assert.equal(two.lead, 'The plan needs 2 sections that could not be read in full, so IAMAI built nothing from this scan.')
  // The pluraliser, on every surface: a count of one conjugates its own verb, never one a modal, an auxiliary or "to" governs.
  assert.equal(fillText('{n} sections could not be read', { n: 1 }), '1 section could not be read')
  assert.equal(fillText('{n} people need to register a method', { n: 1 }), '1 person needs to register a method')
  assert.equal(fillText('{n} people can hold and use it', { n: 1 }), '1 person can hold and use it')
  assert.equal(fillText('{n} people hold a directory role and use that same account', { n: 1 }), '1 person holds a directory role and uses that same account', 'a verb the count governs still bends')
})

test('tile 3, not started: the account, one row asking for Global Reader, Sign in with another account (primary) alone, the red badge', () => {
  const gap = coreRoleGap(rolesInToken(noRolesToken()))
  assert.ok(gap)
  const t = scanTile({ kind: 'role', upn, gap })
  beatsOf(t)
  assert.equal(t.state, "not started · this account can't read the tenant")
  assert.equal(t.tone, 'stop')
  assert.equal(t.lead, 'alex@example.com has no active role that reads Conditional Access policies, people and sign-in records.')
  assert.deepEqual(t.rows, [{ name: 'Everything IAMAI needs, read-only', value: 'ask for Global Reader' }])
  assert.deepEqual(t.actions, [{ label: 'Sign in with another account', weight: 'primary', does: 'signInAnother' }])
  scanOnlyItsOwn(t)
})

test('tile 3, scanning: one line with the elapsed time, Stop (tertiary), no state colour; ready: Scan tenant (primary) and the in-browser line', () => {
  const s = scanTile({ kind: 'scanning', lane: 'Reading sign-in records', elapsed: '8s' })
  beatsOf(s)
  assert.equal(s.state, 'reading sign-in records · 8s')
  assert.equal(s.tone, null)
  assert.deepEqual(s.actions, [{ label: 'Stop', weight: 'tertiary', does: 'stop' }])
  scanOnlyItsOwn(s)
  const r = scanTile({ kind: 'ready' })
  beatsOf(r)
  assert.equal(r.state, 'not started')
  assert.equal(r.tone, null)
  assert.equal(r.note, 'The scan is processed in this browser; nothing is uploaded to IAMAI.')
  assert.deepEqual(r.actions, [{ label: 'Scan tenant', weight: 'primary', does: 'scan' }])
  scanOnlyItsOwn(r)
})

// The strings that belong to one Plan state and no other.
const PLAN_OWN: Record<PlanTile['kind'], string[]> = {
  ready: ['from the scan', 'Open the plan →'],
  none: ['no plan to offer'],
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

test('tile 4, Plan, ready: "ready · N steps, N completed · from the scan N ago", one line of what was built, Open the plan (primary) alone, the accent badge; no facts row, no drop line', () => {
  // The completed count is the Completed lane's (planLanes.ts laneCountsOf, A1c): the Plan header's own word.
  const t = planTile({ kind: 'ready', at: full.asOf, counts: { steps: 33, completed: 8 }, now: twoMinutesLater })
  assert.equal(t.state, 'ready · 33 steps, 8 completed · from the scan 2 minutes ago')
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
  const t = planTile({ kind: 'ready', at: full.asOf, counts: { steps: 33, completed: 8 } })
  assert.deepEqual(
    t.actions.map((a) => a.label),
    ['Open the plan →'],
    'one way on, and it is the plan',
  )
  assert.ok(!('ladder' in t), 'no readiness ladder on the Plan stage')
  const words = JSON.stringify(pages.connect)
  assert.ok(!/rung-\d|#\/readiness\//.test(words), 'Connect names no readiness rung or state filter')
  assert.ok(!words.includes('MFA Readiness'), 'Connect does not send the operator to MFA Readiness before the plan')
  // The counts are the same fact, on the surface that owns it (Step 7: readiness states, not rungs).
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const counted = factsOf(ladder(f.snapshot, f.mapping, f.snapshot.asOf))
    assert.deepEqual(counted, readinessView(f.snapshot, f.snapshot.asOf, f.mapping).facts, `${name}: MFA Readiness still counts them`)
    assert.equal(
      READINESS_STATES.reduce((n, s) => n + counted.states[s], 0),
      counted.active,
      `${name}: the readiness states sum to the active people`,
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
  const plan = planTile({ kind: 'ready', at: full.asOf, counts: { steps: 33, completed: 8 }, now })
  assert.equal(scan.state, 'complete · 57 minutes ago')
  assert.equal(plan.state, 'ready · 33 steps, 8 completed · from the scan 57 minutes ago')
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

// Phase 2 audit (Connect): the Plan destination was 'ready' whenever the scan
// was complete. A tenant without Entra ID P1 read "ready · 2 steps" and "Ready
// to plan" over a Plan page that offers no plan at all (the two steps were
// Cleanup rows of a plan that is never drawn), with "0 active people" beside it
// over sign-in activity the licence withheld; a stored scan whose baseline
// could not be restored read ready over a Plan page that cannot compute; and a
// rescan, or an account without a reading role, hid a stored plan the Plan tab
// still opens. The destination now reads what the Plan page would draw.
test('the Plan destination is ready only when the Plan page draws a plan: no plan to offer without Entra ID P1, waiting without a baseline, the last full plan while a new scan has none', () => {
  const micro = fixture('micro').snapshot
  const at = micro.asOf
  const noPlan = conditionalAccessLicenceLine(micro)
  assert.ok(noPlan, 'the premise: the Plan page offers this tenant no plan')
  const input = planInputOf({ scan: 'complete', lastScan: { at }, baselineLoaded: true, noPlan, counts: { steps: 2, completed: 0 } })
  assert.deepEqual(input, { kind: 'none', lead: noPlan })
  const none = planTile(input)
  assert.equal(none.state, 'no plan to offer')
  assert.equal(none.lead, noPlan, "the Plan page's own sentence, from its own gate")
  assert.equal(none.tone, null)
  assert.deepEqual(none.actions, [], 'no way into a plan that does not exist')
  assert.doesNotMatch(tileStrings(none).join('\n'), /\d+ steps|Open the plan|Built from this scan|ready/)
  planOnlyItsOwn(none)
  // The strip follows the destination: a plan that does not exist is not ready to plan.
  const strip = connectStatus([true, true, true, planTile(input).kind === 'ready'], [{ title: 'Signed in', state: 'x', tone: 'done' }, { title: 'Baseline', state: 'selected', tone: 'done' }, { title: 'Scan', state: 'complete', tone: 'done' }, none])
  assert.notEqual(strip.title, 'Ready to plan')
  // Phase 2 review, round 1: nor is it "Next": the destination offers nothing to
  // do, so the strip says where it stands in the tile's own words.
  assert.deepEqual(strip, { tone: null, title: 'Plan', text: 'no plan to offer' })
  // Without a baseline the Plan page cannot compute: the destination waits, it does not offer the plan.
  assert.deepEqual(planInputOf({ scan: 'complete', lastScan: { at }, baselineLoaded: false, noPlan: null, counts: null }), { kind: 'waiting' })
  assert.deepEqual(planInputOf({ scan: 'complete', lastScan: { at }, baselineLoaded: true, noPlan: null, counts: { steps: 33, completed: 8 } }), { kind: 'ready', at, counts: { steps: 33, completed: 8 } })
  // A stored plan stays open while a new scan runs, ends with gaps, or cannot start.
  for (const scan of ['scanning', 'role', 'gaps'] as const) assert.deepEqual(planInputOf({ scan, lastScan: { at }, baselineLoaded: true, noPlan: null, counts: null }), { kind: 'last', at }, scan)
  assert.deepEqual(planInputOf({ scan: 'gaps', lastScan: null, baselineLoaded: true, noPlan: null, counts: null }), { kind: 'waiting' }, 'nothing stored: nothing to open')
  assert.deepEqual(planInputOf({ scan: 'ready', lastScan: null, baselineLoaded: true, noPlan: null, counts: null }), { kind: 'waiting' })
  // Connect wires it: the destination from planInputOf over the Plan page's own
  // gate, and the scan's counts ("0 active people", "2 plan steps") only beside a plan that is ready.
  const CONNECT = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.match(CONNECT, /const noPlan = lastScan \? conditionalAccessLicenceLine\(lastScan\.snapshot\) : null/)
  assert.match(CONNECT, /const planInput: PlanInput = planInputOf\(/)
  assert.match(CONNECT, /counts: planInput\.kind === 'ready' \? scanCounts : null/)
})

// Phase 2 audit (Connect): the gaps tile was handed every unread section and
// said the plan needed all of them. On a scan whose one blocking gap was the
// sign-in records and which was also refused MFA registration and Devices, it
// read "3 sections could not be read ... The plan needs them": two of the three
// do not stop a plan being built (the same refusals under readable sign-ins
// build one), and the one to fix could not be told apart. The lead now counts
// the core gaps (coreSections.ts coreGaps) and the rest are listed apart.
test('the gaps lead counts only the sections a plan cannot be built without, and lists the others apart', () => {
  const s = structuredClone(fixture('small').snapshot)
  s.sources.signInEvidence = { status: 'insufficient', reason: 'no sign-in records could be read', coveredWindow: null, asOf: s.asOf }
  s.sources.registrationDetails = { ...s.sources.registrationDetails, status: 'disabled', reason: 'access denied (403)', coveredWindow: null }
  s.sources.devices = { ...s.sources.devices, status: 'disabled', reason: 'access denied (403)', coveredWindow: null }
  const t = scanTile({ kind: 'gaps', gaps: coreGaps(s), unread: unreadSources(s), lastScan: null })
  assert.equal(t.lead, 'The plan needs 1 section that could not be read in full, so IAMAI built nothing from this scan.')
  assert.deepEqual(t.rows, [{ name: 'Sign-in records', value: 'not read' }], 'the section that stops the plan, alone')
  assert.equal(t.more?.lead, '2 other sections were not read in full. What is listed here does not stop a plan being built.')
  assert.deepEqual(t.more?.rows, [
    { name: 'MFA registration', value: 'refused to this account' },
    { name: 'Devices', value: 'refused to this account' },
  ])
  const said = tileStrings(t)
  assert.ok(said.includes(t.more.lead) && said.includes('Devices'), 'the view model lists the other sections')
  // A scan whose every unread section stops the plan lists no second group.
  const only = scanTile({ kind: 'gaps', gaps: coreGaps(gapsSnapshot()), unread: unreadSources(gapsSnapshot()), lastScan: null })
  assert.equal(only.more, undefined)
  assert.match(only.lead ?? '', /^The plan needs 2 sections /)
  // Connect hands the tile the runner's core gaps beside the unread list, and draws the second group.
  const CONNECT = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.match(CONNECT, /kind: 'gaps', gaps: runner\.gaps, unread: runner\.unread/)
  assert.match(CONNECT, /tile\.more\.rows\.map/)
})

// Phase 2 audit (Connect): a limitation told the admin to keep new blocks in
// report-only "across a full cycle" (a quarter, a year) while the plan turns
// them on after its observation window: 7 days, 3 for legacy authentication
// (roadmap/schedule.ts observationDaysFor). Two instructions for one act, and
// the reader could follow only one. The limitation states the fact and names
// no report-only length the plan does not use.
test('the limitations state what the records cannot show, and set no report-only length against the plan', () => {
  const lines = scanTile({ kind: 'sample' }).limits.lines
  assert.equal(lines.length, 5)
  const cycle = lines.find((l) => /quarterly invoice run/.test(l))
  assert.equal(cycle, 'Anything on a longer cycle than the records (the quarterly invoice run, the yearly renewal) has left no evidence yet, and a report-only window shorter than its cycle cannot show it either.')
  for (const l of lines) assert.doesNotMatch(l, /keep new blocks in report-only|across a full cycle/, l)
  // The same lines on the signed-in tile: one source.
  assert.deepEqual(scanTile({ kind: 'ready' }).limits.lines, lines)
})

// Phase 2 audit (Connect): the role state read the token's active roles (wids)
// and said the account "holds none of the roles", so an admin whose Global
// Reader is eligible in Privileged Identity Management, and not yet activated,
// was told to ask for a role they already hold. The tile now says what it read:
// the roles active in this sign-in, and when an eligible one counts. A fact,
// not a new instruction.
test('the role state says it read the roles active in this sign-in, and when an eligible role counts', () => {
  const gap = coreRoleGap(rolesInToken(noRolesToken()))
  assert.ok(gap)
  const t = scanTile({ kind: 'role', upn, gap })
  assert.equal(t.lead, 'alex@example.com has no active role that reads Conditional Access policies, people and sign-in records.')
  assert.equal(t.note, 'IAMAI reads the roles active in this sign-in. A role eligible in Privileged Identity Management counts once it is activated and the account signs in again.')
  assert.doesNotMatch(t.note ?? '', /^(Activate|Choose|Sign in|Ask)\b|\byou should\b/, 'a statement, not an instruction')
  assert.ok(tileStrings(t).includes(t.note ?? ''), 'the tile draws it')
})

// Phase 2 audit (Connect): with every stage done the strip said "Tenant,
// baseline and scan are ready." above a scan that listed sections it did not
// read in full, or said MFA readiness was not measured. The strip is a
// projection of the stages, so it now carries the scan's own caveat.
test('the ready strip carries the complete scan’s own caveat instead of saying the scan is ready', () => {
  const t1 = accountTile({ tenant, upn, role: 'Global Reader' })
  const t2 = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: 38, loading: null, update: null, stepsFor })
  const t4 = planTile({ kind: 'ready', at: full.asOf, counts: { steps: 33, completed: 8 } })
  const clean = scanTile({ kind: 'complete', at: full.asOf })
  assert.deepEqual(connectStatus([true, true, true, true], [t1, t2, clean, t4]), { tone: 'done', title: 'Ready to plan', text: 'Tenant, baseline and scan are ready.' })
  const unread = scanTile({ kind: 'complete', at: full.asOf, unread: [{ source: 'authMethods', partial: true, refused: false }] })
  const withUnread = connectStatus([true, true, true, true], [t1, t2, unread, t4])
  assert.equal(withUnread.title, 'Ready to plan', 'the plan was built')
  assert.equal(withUnread.text, unread.lead, 'the strip says what the scan step says')
  const degraded = scanTile({ kind: 'complete', at: full.asOf, degraded: true })
  assert.equal(connectStatus([true, true, true, true], [t1, t2, degraded, t4]).text, 'Sign-in proof not read · MFA readiness not measured')
  const both = scanTile({ kind: 'complete', at: full.asOf, degraded: true, unread: [{ source: 'devices', partial: false, refused: false }] })
  assert.equal(connectStatus([true, true, true, true], [t1, t2, both, t4]).text, `${both.lead} ${both.note}`)
  for (const s of [withUnread, connectStatus([true, true, true, true], [t1, t2, both, t4])]) assert.doesNotMatch(s.text, /scan are ready/)
})

// Phase 2 review, round 2: the strip carried the complete lead "…so check these
// before you act on it", and in the strip "these" points at rows that exist only
// in the Scan step; with one section it was also plural for one. Every beta
// visitor reads it: the demo scan read one section in part. The sentence now
// reads the same with any count, in the strip or the step.
test('the complete lead reads as one for one section, and points at the Scan step from the strip', () => {
  const one = scanTile({ kind: 'complete', at: full.asOf, unread: [{ source: 'devices', partial: false, refused: false }] })
  assert.equal(one.lead, '1 section was not read in full. The plan is built from what IAMAI did read, so check what is listed under Scan before you act on it.')
  assert.doesNotMatch(one.lead ?? '', /\b(these|them|those)\b/, 'no pronoun that counts the sections, or points at rows the strip does not draw')
  const t1 = accountTile({ tenant, upn, role: 'Global Reader' })
  const t2 = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: 38, loading: null, update: null, stepsFor })
  for (const id of ['demo', 'demo-week2'] as const) {
    const s = fixture(id).snapshot
    const t3 = scanTile({ kind: 'complete', at: s.asOf, degraded: !signInProofRead(s), unread: unreadSources(s) })
    const t4 = planTile({ kind: 'ready', at: s.asOf, counts: null })
    assert.deepEqual(connectStatus([true, true, true, true], [t1, t2, t3, t4]), {
      tone: 'done',
      title: 'Ready to plan',
      text: '1 section was not read in full. The plan is built from what IAMAI did read, so check what is listed under Scan before you act on it.',
    }, `${id}: the strip every beta visitor reads`)
  }
})

// Phase 2 audit (Connect): the scan's meta row printed String(count) beside a
// fixed plural label, so a one-person trial tenant read "1 active people" and a
// large one "4169 active people" where every other surface reads "4,169". Each
// item is now one counted string, filled like every other count.
test('the scan counts are counted words: one reads as one, and a large count carries its separator', () => {
  const at = full.asOf
  const one = scanTile({ kind: 'complete', at, counts: { people: 1, policies: 1, steps: 1 } }).meta
  assert.deepEqual(one, [
    { value: '1', label: 'active person' },
    { value: '1', label: 'baseline policy' },
    { value: '1', label: 'plan step' },
  ])
  const large = scanTile({ kind: 'complete', at, counts: { people: 4169, policies: 38, steps: 36 } }).meta ?? []
  assert.deepEqual(large[0], { value: '4,169', label: 'active people' })
  assert.equal(`${large[0].value} ${large[0].label}`, fillText('{n} active people', { n: 4169 }), 'the same reading every fillText surface gives')
  assert.deepEqual(large.slice(1), [
    { value: '38', label: 'baseline policies' },
    { value: '36', label: 'plan steps' },
  ])
})

// Phase 2 audit (Connect): the baseline says IAMAI "tells you when he updates
// it", and a check that could not run (GitHub's unauthenticated rate limit, no
// network) folded into "no update": nothing seen, said over a read that failed.
// The disclosure now says the check could not be made.
test('an author check that could not run says so in the source disclosure, never reads as no update', () => {
  const pin = { repo: 'Jhope188/ConditionalAccessPolicies', url: 'https://github.com/Jhope188/ConditionalAccessPolicies', commit: '90d9b890c4b9af2ac4bc02d97c06bf8900064b4c', readAt: '2026-09-08T04:02:40.518Z' }
  const unknown = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: 38, pin, loading: null, update: null, updateUnchecked: true, stepsFor })
  assert.equal(unknown.source?.unchecked, "The check for an update in the author's repository could not run just now, so IAMAI cannot say whether he has changed it since.")
  assert.equal(baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: 38, pin, loading: null, update: null, stepsFor }).source?.unchecked, null, 'a check that ran says nothing more')
  assert.equal(baselineTile({ name: 'Uploaded package', policyCount: 3, version: 'uploaded', loading: null, update: null, updateUnchecked: true, stepsFor }).source?.unchecked, null, 'an uploaded package has no author check')
  const CONNECT = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.match(CONNECT, /updateUnchecked: author\.unchecked/, 'Connect hands the tile the check that could not run')
  assert.match(CONNECT, /t2\.source\.unchecked &&/, 'Connect draws the line')
})

// Phase 2 audit (Connect): an incomplete author review said "Nothing changes
// here until you take an update", and no control anywhere takes one (the
// picker is held for V2). The note now says what is true: the review is
// incomplete, and IAMAI keeps the pinned version.
test('an incomplete author review names no action the page does not offer', () => {
  const partial = baselineTile({ name: 'x', policyCount: 46, loading: null, update: { date: '2026-09-03T10:00:00Z', changes: [], incomplete: true }, stepsFor })
  assert.equal(partial.update?.note, "IAMAI could not read every changed file in the author's repository, so this review is incomplete. IAMAI keeps the pinned version.")
  for (const s of tileStrings(partial)) assert.doesNotMatch(s, /take an update/, s)
})

// Phase 2 audit (Connect): the Scan tile promised "about a minute for a small
// tenant" before sign-in and "About ten minutes" after it: one fact, two
// sources, a factor of ten apart, and neither established (the sign-in read
// runs to the window's end with no clock). Neither state names a duration.
test('the Scan tile states no scan duration it cannot know, before sign-in or after', () => {
  const sample = scanTile({ kind: 'sample' })
  const ready = scanTile({ kind: 'ready' })
  assert.equal(sample.state, 'after sign-in')
  assert.equal(ready.note, 'The scan is processed in this browser; nothing is uploaded to IAMAI.')
  for (const t of [sample, ready]) for (const s of [t.state, t.note ?? '']) assert.doesNotMatch(s, /minute|hour|second/i, s)
})

// Phase 2 audit (Connect): the directory audit read, which every automatic
// recovery-test check needs, was never on the unread list: a scan whose audit
// read failed read "complete" with nothing listed. It is listed like any other
// section the scan did not read, with its own label.
test('a directory audit read that failed is listed with the sections the scan did not read', () => {
  const s = structuredClone(fixture('small').snapshot)
  assert.deepEqual(unreadSources(s), [], 'the premise: the fixture read everything')
  s.recoveryAuditSource = { status: 'error', reason: 'Directory audit evidence could not be read: access denied (403)', coveredWindow: null, asOf: s.asOf }
  assert.deepEqual(unreadSources(s), [{ source: 'recoveryAudit', partial: false, refused: true }])
  const t = scanTile({ kind: 'complete', at: full.asOf, unread: unreadSources(s) })
  assert.deepEqual(t.rows, [{ name: 'Directory audit log', value: 'refused to this account' }])
  assert.match(t.lead ?? '', /^1 section was not read in full/)
  // A scan from before the read existed recorded no state for it, and is not said to have failed it.
  delete s.recoveryAuditSource
  assert.deepEqual(unreadSources(s), [])
})

// Phase 2 audit (Connect): while the default baseline loaded, the step read
// "Baseline loading Defense in Depth…" and the strip "Next: Baseline none
// loaded": the strip re-derived the tile with no load in flight, because the
// load's state lived inside the tile's component. Both now read one
// baselineTile() over the same load state.
test('the strip and the baseline step read the same load in flight', () => {
  const loading = baselineTile({ name: null, policyCount: 0, loading: 'Defense in Depth — Maintained by Jon Hope', update: null, stepsFor })
  const strip = connectStatus([true, false, false, false], [accountTile({ tenant, upn, role: 'Global Reader' }), loading, scanTile({ kind: 'ready' }), planTile({ kind: 'waiting' })])
  assert.equal(strip.text, loading.state)
  assert.match(strip.text, /^loading Defense in Depth/)
  const CONNECT = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  // The load's state is the page's, handed to the tile and read by the strip.
  assert.equal((CONNECT.match(/baselineStrings\(baseline, baselineBusy\)/g) ?? []).length, 2, 'both states read the strip from the load in flight')
  assert.match(CONNECT, /function baselineStrings\(baseline: BaselineResult \| null, loading: string \| null\)/)
  const tile = CONNECT.slice(CONNECT.indexOf('function BaselineTile('))
  assert.doesNotMatch(tile, /useState<string \| null>\(null\)\s*\n\s*const \[error/, 'the tile keeps no load state of its own')
  assert.match(tile, /busy, setBusy/)
})

// Phase 2 audit (Connect): the scan's age ("complete · 3 days ago", "from the
// scan 3 days ago") was formatted in the browser's default locale, so a
// German browser read "complete · vor 3 Tagen" inside English sentences. The
// relative formatter speaks the content's language, as monthDay already does.
test('the scan age is English inside English sentences, whatever the browser locale', async () => {
  const Real = Intl.RelativeTimeFormat
  class BrowserDefault extends Real {
    constructor(locale?: Intl.LocalesArgument, options?: Intl.RelativeTimeFormatOptions) {
      super(locale ?? 'de-DE', options)
    }
  }
  ;(Intl as unknown as { RelativeTimeFormat: unknown }).RelativeTimeFormat = BrowserDefault
  try {
    // A fresh copy of the formatter module, built under the German default.
    const { relative } = (await import(new URL('../../copy/dates.ts?browser=de-DE', import.meta.url).href)) as { relative: (iso: string, now?: number) => string }
    const at = '2026-09-08T00:00:00Z'
    assert.equal(relative(at, Date.parse(at) + 3 * 86_400_000), '3 days ago')
    assert.equal(relative(at, Date.parse(at) + 2 * 3_600_000), '2 hours ago')
  } finally {
    ;(Intl as unknown as { RelativeTimeFormat: typeof Real }).RelativeTimeFormat = Real
  }
})

// Phase 2 audit (Connect): an author change to a setting the baseline model
// does not represent opened its line with the raw Graph path
// ("conditions.times.included: outside what IAMAI's baseline model reads…"),
// a key where a sentence should start. The sentence now leads with words and
// keeps the path, the one precise name the setting has, as a detail.
test('an unreviewed author change leads with words and keeps the Graph path as a detail', () => {
  const t = baselineTile({
    name: 'x',
    policyCount: 1,
    loading: null,
    update: { date: '2026-09-20T00:00:00Z', changes: [change({ kind: 'unknown', newName: 'IAC - X', unreviewed: ['conditions.times.included'], reason: 'unmodelledField' })] },
    stepsFor,
  })
  const [line] = t.update?.rows[0].deltas ?? []
  assert.equal(line, "A setting IAMAI's baseline model does not read changed (conditions.times.included), so this change is not reviewed.")
  assert.doesNotMatch(line ?? '', /^[a-z]+[A-Z.]/, 'no line opens on a raw key')
})
