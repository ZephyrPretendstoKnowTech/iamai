// Prompt 51 Unit 1: the runtime reads the pinned baseline from pinned.json with
// no network; the one network call is the author-head check that drives the
// Connect "Baseline updated" line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { loadPinnedBaseline, baselineReview, checkAuthorHead, restoreBaseline, PINNED, PINNED_BASELINE } from './baseline.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { demoTenant } from './demo.ts'

test('one policy count, from the pinned package: signed out (the pinned load) and signed in (a restore, whatever file list the record kept) agree', async () => {
  const pinned = await loadPinnedBaseline()
  assert.equal(pinned.pkg.policies.length, PINNED.policies.length)
  assert.equal(pinnedPackage().policies.length, PINNED.policies.length)
  // A record from before the pin kept the repository's files (many more than the pin holds); the restore reads the pin, not them.
  const stale = Array.from({ length: 46 }, (_, i) => ({ path: `Policies/stale-${i}.json`, text: JSON.stringify({ id: `stale-${i}`, displayName: `Stale ${i}`, state: 'enabled', conditions: {}, grantControls: null, sessionControls: null }) }))
  const restored = await restoreBaseline({ kind: 'github', owner: 'x', repo: 'y', commit: PINNED.commit, files: stale })
  assert.equal(restored.pkg.policies.length, PINNED.policies.length)
  assert.equal(restored.source, pinned.source)
})

test('the count reconciles with the not-assessed Cleanup row on the demo: count − assessed = not assessed', () => {
  const f = fixture('demo')
  const d = demoTenant(false)
  const run = runFixture({ ...f, snapshot: d.snapshot, mapping: d.mapping })
  const count = f.baseline.policies.length
  assert.equal(count, PINNED.policies.length, 'the demo runs on the pinned package')
  const assessed = new Set(run.coverage.assessed).size
  const notAssessed = run.coverage.organisation.notAssessed.length
  const row = run.schedule.cleanup?.rows.find((r) => r.kind === 'notAssessed')
  assert.ok(row, 'the demo has a not-assessed Cleanup row')
  assert.equal(row.lists?.policies?.length, notAssessed, 'the row lists what coverage did not assess')
  assert.equal(count - assessed, notAssessed, `${count} policies − ${assessed} assessed = ${notAssessed} not assessed`)
})

test('the pinned baseline loads offline from pinned.json, at its commit', async () => {
  const r = await loadPinnedBaseline()
  assert.equal(r.fetchFailures, 0)
  assert.equal(r.origin.kind, 'github')
  if (r.origin.kind === 'github') assert.equal(r.origin.commit, PINNED.commit)
  assert.ok(r.pkg.policies.length >= 30, `expected the pinned policy set, got ${r.pkg.policies.length}`)
})

test('checkAuthorHead: a differing head is an update, a matching head is not, a failure is not', async () => {
  const differ = await checkAuthorHead(async () => new Response(JSON.stringify([{ sha: 'newsha', commit: { author: { date: '2026-09-01T00:00:00Z' } } }]), { status: 200 }))
  assert.equal(differ.updated, true)
  assert.equal(differ.head, 'newsha')
  assert.equal(differ.date, '2026-09-01T00:00:00Z')

  const same = await checkAuthorHead(async () => new Response(JSON.stringify([{ sha: PINNED.commit }]), { status: 200 }))
  assert.equal(same.updated, false)

  const failed = await checkAuthorHead(async () => {
    throw new Error('offline')
  })
  assert.equal(failed.updated, false)
  assert.equal(failed.head, null)
})

// ---------------------------------------------------- task 021: the update review

// The audited comparison: the author renamed one policy and strengthened it,
// and his repository keeps every policy twice, so GitHub reported four JSON
// file events for one evolving policy id.
const REG_ID = 'aeb49474-5250-4b65-8b0a-56c47127ee0f'
const before = { id: REG_ID, displayName: 'IAC - INTUNE - GRANT - Device Registration from trusted location', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, applications: { includeUserActions: ['urn:user:registerdevice'] } }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000002', displayName: 'Multifactor authentication' } } }
const after = { ...before, displayName: 'IAC - INTUNE - GRANT - Device Registration - MFA Strength', grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '42de22a7-5339-4a58-b560-28565d53b14d', displayName: 'Modern MFA + TAP' } } }
const OLD_POLICY = 'Updated/Policies/IAC---INTUNE---GRANT---Device-Registration-from-trusted-location.json'
const OLD_DOC = 'Updated/Documentation/Device-Registration/policy.json'
const NEW_POLICY = 'Updated/Policies/IAC---INTUNE---GRANT---Device-Registration---MFA-Strength.json'
const NEW_DOC = 'Updated/Documentation/Device-Registration-MFA-Strength/policy.json'
const HEAD = '90d9b890c4b9af2ac4bc02d97c06bf8900064b4c'

/** The four file events GitHub reported, plus documentation and image churn that is not a policy. */
type CompareFile = { filename: string; previous_filename?: string; status?: string }

const AUDITED_FILES: CompareFile[] = [
  { filename: NEW_POLICY, status: 'added' },
  { filename: NEW_DOC, status: 'added' },
  { filename: OLD_POLICY, status: 'removed' },
  { filename: OLD_DOC, status: 'removed' },
  { filename: 'Documents/readme.md', status: 'modified' },
  { filename: 'Images/screenshot.png', status: 'added' },
]

/** GitHub as it answered: a compare, then a raw body per path per commit — 404 for anything the fixture does not hold. */
function githubAt(bodies: Record<string, Record<string, unknown>>, seen: string[] = [], compareFiles: CompareFile[] = AUDITED_FILES): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    seen.push(url)
    if (url.includes('/compare/')) {
      return new Response(JSON.stringify({ files: compareFiles }), { status: 200 })
    }
    const path = url.split(`/${HEAD}/`)[1] ?? url.split(`/${PINNED.commit}/`)[1] ?? ''
    const commit = url.includes(`/${HEAD}/`) ? HEAD : PINNED.commit
    const body = bodies[`${commit}:${decodeURIComponent(path)}`]
    return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('Not Found', { status: 404 })
  }) as typeof fetch
}

const BODIES: Record<string, Record<string, unknown>> = {
  [`${PINNED.commit}:${OLD_POLICY}`]: before,
  [`${PINNED.commit}:${OLD_DOC}`]: before,
  [`${HEAD}:${NEW_POLICY}`]: after,
  [`${HEAD}:${NEW_DOC}`]: after,
}

test('I. the update is measured from the pinned snapshot commit, never from the older commit the index file records', async () => {
  // The historical situation this guards: the two files name different commits.
  assert.notEqual(PINNED_BASELINE.commit, PINNED.commit, 'the index records an older pin than the snapshot the plan is derived from')
  const seen: string[] = []
  await baselineReview(HEAD, githubAt(BODIES, seen))
  const compare = seen.find((u) => u.includes('/compare/'))!
  assert.ok(compare.includes(`/compare/${PINNED.commit}...${HEAD}`), compare)
  assert.equal(compare.includes(PINNED_BASELINE.commit), false, 'the stale index commit reached the comparison base')
  // And every body was fetched at the pinned commit or the candidate head, never at the index commit.
  for (const u of seen) assert.equal(u.includes(PINNED_BASELINE.commit), false, u)
})

test('the review counts policies, not files: four JSON file events for one renamed, strengthened policy are one change', async () => {
  const review = await baselineReview(HEAD, githubAt(BODIES))
  assert.equal(review.incomplete, false)
  assert.equal(review.changes.length, 1, JSON.stringify(review.changes.map((c) => [c.kind, c.newName])))
  const [c] = review.changes
  assert.equal(c.key, REG_ID)
  assert.equal(c.kind, 'renamedChanged')
  assert.equal(c.oldName, before.displayName)
  assert.equal(c.newName, after.displayName)
  assert.deepEqual(c.deltas, [{ field: 'authenticationStrength', kind: 'set', value: 'Modern MFA + TAP' }])
})

/** The fixture minus the bodies named, so those paths 404 at that commit. */
function without(...keys: string[]): Record<string, Record<string, unknown>> {
  const out = { ...BODIES }
  for (const k of keys) delete out[k]
  return out
}

// The 404 rule. A missing body is only benign where the compare event itself
// establishes the absence — the new path at the base of an addition, the old
// path at the head of a rename or a removal. The audited fixture above proves
// the benign half: every one of its four events 404s on one side and the review
// is complete. These prove the other half, where a 404 used to be read as a
// change rather than as source IAMAI could not fetch.
test('L. a 404 where the compare says the file must exist is unread source, not an addition, a removal or a silence', async () => {
  // An addition whose body will not load: the review has nothing to show and
  // must still say so, or the tile suppresses the whole update (Connect).
  const onlyAdded = await baselineReview(HEAD, githubAt(without(`${HEAD}:${NEW_POLICY}`), [], [{ filename: NEW_POLICY, status: 'added' }]))
  assert.deepEqual(onlyAdded.changes, [])
  assert.equal(onlyAdded.incomplete, true, 'an added policy that would not fetch read as no changes at all')

  // A removal whose *base* body will not load: the old policy is unknown, so the
  // pair cannot be read as an addition of the new one.
  const removal = await baselineReview(HEAD, githubAt(without(`${PINNED.commit}:${OLD_POLICY}`, `${PINNED.commit}:${OLD_DOC}`)))
  assert.equal(removal.incomplete, true, 'the removed bodies 404d at the base and the rename read as a plain addition')

  // A modification whose head body will not load: not a removal.
  const modified = await baselineReview(HEAD, githubAt(without(`${HEAD}:${NEW_POLICY}`), [], [{ filename: NEW_POLICY, status: 'modified' }]))
  assert.equal(modified.incomplete, true, 'a modified policy that 404d at the head read as a removal')

  // A rename: the old path must be readable at the base, the new at the head.
  const renamed: CompareFile[] = [{ filename: NEW_POLICY, previous_filename: OLD_POLICY, status: 'renamed' }]
  const wholeRename = await baselineReview(HEAD, githubAt(BODIES, [], renamed))
  assert.equal(wholeRename.incomplete, false, 'a rename that fetched on both sides is complete')
  assert.equal(wholeRename.changes.length, 1)
  const halfRename = await baselineReview(HEAD, githubAt(without(`${PINNED.commit}:${OLD_POLICY}`), [], renamed))
  assert.equal(halfRename.incomplete, true, 'the renamed policy had no readable old body, so the rename was not proven')

  // A status IAMAI does not know establishes no absence at all, so neither side's 404 is benign.
  const unknownStatus = await baselineReview(HEAD, githubAt(BODIES, [], [{ filename: NEW_POLICY, status: 'unrecognised' }]))
  assert.equal(unknownStatus.incomplete, true)
})

test('L. a review with no rows still reaches the tile when it is incomplete', async () => {
  const empty = await baselineReview(HEAD, githubAt(without(`${HEAD}:${NEW_POLICY}`), [], [{ filename: NEW_POLICY, status: 'added' }]))
  assert.deepEqual(empty.changes, [])
  assert.equal(empty.incomplete, true)
  // Connect drops a review only when it is both empty and complete, so this one renders.
  const connect = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.match(connect, /review\.changes\.length === 0 && !review\.incomplete/, 'the tile decides on emptiness alone')
})

test('K. a compare or a file IAMAI cannot read is an incomplete review, never zero changes', async () => {
  const offline = await baselineReview(HEAD, (async () => {
    throw new Error('offline')
  }) as typeof fetch)
  assert.deepEqual(offline, { changes: [], incomplete: true })

  const rateLimited = await baselineReview(HEAD, (async () => new Response('rate limited', { status: 403 })) as typeof fetch)
  assert.deepEqual(rateLimited, { changes: [], incomplete: true })

  // The compare loads, one body does not: what parsed is still reported, and the review says it is incomplete.
  const partial = await baselineReview(HEAD, (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/compare/')) return githubAt(BODIES)(input)
    if (url.includes(encodeURIComponent('IAC---INTUNE---GRANT---Device-Registration---MFA-Strength.json'))) return new Response('boom', { status: 500 })
    return githubAt(BODIES)(input)
  }) as typeof fetch)
  assert.equal(partial.incomplete, true, 'a file that would not fetch is not silently dropped')

  // Source that parses as JSON but not as a policy is unreadable, not "no change".
  const broken = await baselineReview(HEAD, (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/compare/')) return githubAt(BODIES)(input)
    return new Response('{ "displayName": "half', { status: 200 })
  }) as typeof fetch)
  assert.equal(broken.incomplete, true)
  assert.deepEqual(broken.changes, [])
})
