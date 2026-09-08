// Prompt 51 Unit 1: the runtime reads the pinned baseline from pinned.json with
// no network; the one network call is the author-head check that drives the
// Connect "Baseline updated" line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
/**
 * A candidate ahead of the pin. It used to be the real 90d9b890, because that
 * was the commit task 021 reviewed and the pin was still behind it; task 022
 * adopted it, so the pin *is* that commit and a candidate has to be a later one.
 * The review is about the mechanism, not about a particular pair of shas.
 */
const HEAD = 'c0ffee11c0ffee22c0ffee33c0ffee44c0ffee55'

/** One commit of the author's repository: the body at each path. A string body is source that is not JSON. */
type Commit = Record<string, unknown>

const textOf = (body: unknown): string => (typeof body === 'string' ? body : JSON.stringify(body))
/** The blob id GitHub would give that body: the same bytes at two commits are one blob, which is how an untouched copy is recognised. */
const blobOf = (body: unknown): string => createHash('sha1').update(textOf(body)).digest('hex')

/**
 * GitHub as it answers this review: a recursive tree per commit, then a raw
 * body per path per commit. Anything the fixture does not hold is a 404.
 */
function githubAt(commits: Record<string, Commit>, seen: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    seen.push(url)
    const tree = url.match(/\/git\/trees\/([0-9a-f]{40})/)
    if (tree) {
      const commit = commits[tree[1]]
      if (!commit) return new Response('Not Found', { status: 404 })
      return new Response(JSON.stringify({ truncated: false, tree: Object.entries(commit).map(([path, body]) => ({ path, type: 'blob', sha: blobOf(body) })) }), { status: 200 })
    }
    const commit = Object.keys(commits).find((c) => url.includes(`/${c}/`)) ?? ''
    const path = decodeURIComponent(url.split(`/${commit}/`)[1] ?? '')
    const body = commits[commit]?.[path]
    return body === undefined ? new Response('Not Found', { status: 404 }) : new Response(textOf(body), { status: 200 })
  }) as typeof fetch
}

/** The audited commits: the policy and its documentation copy both moved, so four file events stand for one policy. */
const AUDITED: Record<string, Commit> = {
  [PINNED.commit]: { [OLD_POLICY]: before, [OLD_DOC]: before, 'Documents/readme.md': 'not a candidate', 'Images/screenshot.png': 'not a candidate' },
  [HEAD]: { [NEW_POLICY]: after, [NEW_DOC]: after, 'Documents/readme.md': 'not a candidate', 'Images/screenshot.png': 'not a candidate' },
}

/** The same commits, with one path the tree still lists but raw will not serve. */
function unfetchable(commits: Record<string, Commit>, path: string): typeof fetch {
  const inner = githubAt(commits)
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (!url.includes('/git/trees/') && decodeURIComponent(url).includes(path)) return new Response('boom', { status: 500 })
    return inner(input)
  }) as typeof fetch
}

test('I. the update is measured from the pinned snapshot commit, never from the commit the index file records', async () => {
  // The situation this guards: the snapshot and the index record naming two
  // different commits, which is what the repository carried until task 022's
  // re-pin ran through the repaired generation path. They agree now, so the
  // guard is on where the review reads its base rather than on the divergence.
  assert.equal(PINNED_BASELINE.commit, PINNED.commit, 'the pair disagrees again')
  const source = readFileSync('src/ui/baseline.ts', 'utf8')
  assert.match(source, /const base = PINNED\.commit/, 'the review no longer measures from the snapshot commit')
  const seen: string[] = []
  await baselineReview(HEAD, githubAt(AUDITED, seen))
  const trees = seen.filter((u) => u.includes('/git/trees/'))
  assert.equal(trees.length, 2, 'one inventory per compared commit')
  assert.ok(trees.some((u) => u.includes(`/git/trees/${PINNED.commit}`)), trees.join(' '))
  assert.ok(trees.some((u) => u.includes(`/git/trees/${HEAD}`)), trees.join(' '))
  // And nothing was fetched at any other commit.
  for (const u of seen) assert.ok(u.includes(PINNED.commit) || u.includes(HEAD), u)
})

test('the review counts policies, not files: four JSON file events for one renamed, strengthened policy are one change', async () => {
  const review = await baselineReview(HEAD, githubAt(AUDITED))
  assert.equal(review.incomplete, false)
  assert.equal(review.changes.length, 1, JSON.stringify(review.changes.map((c) => [c.kind, c.newName])))
  const [c] = review.changes
  assert.equal(c.key, REG_ID)
  assert.equal(c.kind, 'renamedChanged')
  assert.equal(c.oldName, before.displayName)
  assert.equal(c.newName, after.displayName)
  assert.deepEqual(c.deltas, [{ field: 'authenticationStrength', kind: 'set', value: 'Modern MFA + TAP' }])
})

// The duplicate rule. The author keeps one policy in two files, and a commit
// that edits one copy leaves the other where it was — GitHub then leaves the
// untouched copy out of the compare altogether. Discovery is the tree at each
// commit rather than the files that moved, so the copy nobody touched is still
// read, and a head that contradicts itself cannot read as an ordinary change.
const SAME_POLICY = 'Updated/Policies/IAC---INTUNE---GRANT---Device-Registration.json'
const SAME_DOC = 'Updated/Documentation/Device-Registration/policy.json'

test('a stale same-id copy nobody touched is a conflict, not a reviewed change', async () => {
  const commits: Record<string, Commit> = {
    [PINNED.commit]: { [SAME_POLICY]: before, [SAME_DOC]: before },
    // The author strengthened the copy under Policies/ and left the
    // documentation copy of the same id holding the old body.
    [HEAD]: { [SAME_POLICY]: after, [SAME_DOC]: before },
  }
  const seen: string[] = []
  const review = await baselineReview(HEAD, githubAt(commits, seen))
  assert.ok(
    seen.some((u) => !u.includes('/git/trees/') && decodeURIComponent(u).includes(SAME_DOC)),
    'the untouched documentation copy was never read',
  )
  assert.equal(review.changes.length, 1, JSON.stringify(review.changes))
  const [c] = review.changes
  assert.equal(c.key, REG_ID)
  assert.equal(c.kind, 'unknown', 'the head holds two copies of one id that disagree, so the change cannot be established')
  assert.equal(c.reason, 'conflictingCopies')
  assert.deepEqual(c.deltas, [], 'a conflict states no delta it cannot prove')
})

test('a same-id copy that agrees collapses: one row, and the blob both commits share is read once', async () => {
  const commits: Record<string, Commit> = {
    [PINNED.commit]: { [SAME_POLICY]: before, [SAME_DOC]: before },
    [HEAD]: { [SAME_POLICY]: after, [SAME_DOC]: after },
  }
  const seen: string[] = []
  const review = await baselineReview(HEAD, githubAt(commits, seen))
  assert.equal(review.incomplete, false)
  assert.equal(review.changes.length, 1, 'two agreeing copies of one policy are one change, not two')
  assert.equal(review.changes[0].kind, 'renamedChanged')
  // Four path/commit pairs, two distinct blobs: a copy is never fetched twice.
  const bodies = seen.filter((u) => !u.includes('/git/trees/'))
  assert.equal(bodies.length, 2, bodies.join(' '))
})

test('the untouched half of a pair still has to be readable: a body the tree lists and raw will not serve is incomplete', async () => {
  const commits: Record<string, Commit> = {
    [PINNED.commit]: { [SAME_POLICY]: before, [SAME_DOC]: before },
    [HEAD]: { [SAME_POLICY]: after, [SAME_DOC]: before },
  }
  const review = await baselineReview(HEAD, unfetchable(commits, SAME_DOC))
  assert.equal(review.incomplete, true, 'the copy that decides whether the head contradicts itself was not read')
})

// The absence rule. The tree names the blobs a commit holds, so a body that
// does not come back is always source IAMAI could not read — never an addition,
// a removal, or a silence.
test('L. a body the tree lists and raw will not return is unread source, not an addition, a removal or a silence', async () => {
  // An addition whose body will not load: the review has nothing to show and
  // must still say so, or the tile suppresses the whole update (Connect).
  const added: Record<string, Commit> = { [PINNED.commit]: {}, [HEAD]: { [NEW_POLICY]: after } }
  const onlyAdded = await baselineReview(HEAD, unfetchable(added, NEW_POLICY))
  assert.deepEqual(onlyAdded.changes, [])
  assert.equal(onlyAdded.incomplete, true, 'an added policy that would not fetch read as no changes at all')

  // A removal whose *base* body will not load: the old policy is unknown, so the
  // pair cannot be read as an addition of the new one.
  const removal = await baselineReview(HEAD, unfetchable(AUDITED, OLD_POLICY))
  assert.equal(removal.incomplete, true, 'the removed body would not fetch at the base and the rename read as a plain addition')

  // A modification whose head body will not load: not a removal.
  const modified: Record<string, Commit> = { [PINNED.commit]: { [NEW_POLICY]: before }, [HEAD]: { [NEW_POLICY]: after } }
  assert.equal((await baselineReview(HEAD, unfetchable(modified, NEW_POLICY))).incomplete, true, 'a modified policy that would not fetch at the head read as a removal')

  // A rename readable on both sides is complete, and is one change.
  const renamed: Record<string, Commit> = { [PINNED.commit]: { [OLD_POLICY]: before }, [HEAD]: { [NEW_POLICY]: after } }
  const wholeRename = await baselineReview(HEAD, githubAt(renamed))
  assert.equal(wholeRename.incomplete, false, 'a rename that fetched on both sides is complete')
  assert.equal(wholeRename.changes.length, 1)
  const halfRename = await baselineReview(HEAD, unfetchable(renamed, OLD_POLICY))
  assert.equal(halfRename.incomplete, true, 'the renamed policy had no readable old body, so the rename was not proven')
})

test('L. a review with no rows still reaches the tile when it is incomplete', async () => {
  const added: Record<string, Commit> = { [PINNED.commit]: {}, [HEAD]: { [NEW_POLICY]: after } }
  const empty = await baselineReview(HEAD, unfetchable(added, NEW_POLICY))
  assert.deepEqual(empty.changes, [])
  assert.equal(empty.incomplete, true)
  // Connect drops a review only when it is both empty and complete, so this one renders.
  const connect = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.match(connect, /review\.changes\.length === 0 && !review\.incomplete/, 'the tile decides on emptiness alone')
})

test('K. an inventory or a file IAMAI cannot read is an incomplete review, never zero changes', async () => {
  const offline = await baselineReview(HEAD, (async () => {
    throw new Error('offline')
  }) as typeof fetch)
  assert.deepEqual(offline, { changes: [], incomplete: true })

  const rateLimited = await baselineReview(HEAD, (async () => new Response('rate limited', { status: 403 })) as typeof fetch)
  assert.deepEqual(rateLimited, { changes: [], incomplete: true })

  // A tree GitHub truncated is not an inventory: the source it left out could hold another copy of any policy in it.
  const truncated = await baselineReview(HEAD, (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (!url.includes('/git/trees/')) return githubAt(AUDITED)(input)
    return new Response(JSON.stringify({ truncated: true, tree: [{ path: NEW_POLICY, type: 'blob', sha: blobOf(after) }] }), { status: 200 })
  }) as typeof fetch)
  assert.deepEqual(truncated, { changes: [], incomplete: true })

  // The inventories load, one body does not: what parsed is still reported, and the review says it is incomplete.
  const partial = await baselineReview(HEAD, unfetchable(AUDITED, 'IAC---INTUNE---GRANT---Device-Registration---MFA-Strength.json'))
  assert.equal(partial.incomplete, true, 'a file that would not fetch is not silently dropped')

  // Source that does not parse is unreadable, not "no change".
  const half: Record<string, Commit> = { [PINNED.commit]: { [OLD_POLICY]: '{ "displayName": "half' }, [HEAD]: { [NEW_POLICY]: '{ "displayName": "other' } }
  const broken = await baselineReview(HEAD, githubAt(half))
  assert.equal(broken.incomplete, true)
  assert.deepEqual(broken.changes, [])
})

test('two commits whose candidate blobs all match are no update at all, and nothing is fetched to say so', async () => {
  const same: Record<string, Commit> = { [PINNED.commit]: { [OLD_POLICY]: before }, [HEAD]: { [OLD_POLICY]: before } }
  const seen: string[] = []
  const review = await baselineReview(HEAD, githubAt(same, seen))
  assert.deepEqual(review, { changes: [], incomplete: false })
  assert.equal(seen.filter((u) => !u.includes('/git/trees/')).length, 0)
})
