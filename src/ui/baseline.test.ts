// Prompt 51 Unit 1: the runtime reads the pinned baseline from pinned.json with
// no network; the one network call is the author-head check that drives the
// Connect "Baseline updated" line.
import { test } from 'node:test'
import assert from 'node:assert/strict'
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

/** GitHub as it answered: four file events, plus documentation and image churn that is not a policy. */
function githubAt(bodies: Record<string, Record<string, unknown>>, seen: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    seen.push(url)
    if (url.includes('/compare/')) {
      return new Response(
        JSON.stringify({
          files: [
            { filename: NEW_POLICY, status: 'added' },
            { filename: NEW_DOC, status: 'added' },
            { filename: OLD_POLICY, status: 'removed' },
            { filename: OLD_DOC, status: 'removed' },
            { filename: 'Documents/readme.md', status: 'modified' },
            { filename: 'Images/screenshot.png', status: 'added' },
          ],
        }),
        { status: 200 },
      )
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
