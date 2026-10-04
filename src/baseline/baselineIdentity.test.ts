// Every curated baseline carries its id (v2.0 prep, Phase A item 2): a loaded
// baseline's origin names it, a reload restores that one and not another, and
// the author check and its review read that baseline's own repository and pin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BASELINE, baselineOfOrigin } from './registry.ts'
import { checkAuthorHead, loadPinnedBaseline, restoreBaseline } from '../ui/baseline.ts'
import { PINNED_GOAL_MAP, goalMapOf } from '../roadmap/goalMap.ts'
import { pinnedPackage } from './pinned.ts'

test('a loaded curated baseline names itself in its origin, with its own map and package', async () => {
  const b = await loadPinnedBaseline()
  assert.equal(b.origin.kind, 'github')
  if (b.origin.kind !== 'github') return
  assert.equal(b.origin.id, 'jhope188')
  assert.equal(b.origin.commit, DEFAULT_BASELINE.pinned.commit)
  assert.equal(b.source, DEFAULT_BASELINE.label)
  assert.equal(b.goalMap, PINNED_GOAL_MAP)
  assert.equal(goalMapOf(DEFAULT_BASELINE), PINNED_GOAL_MAP, 'one map per baseline, built once')
  assert.equal(b.pkg, pinnedPackage(DEFAULT_BASELINE), 'one package per baseline, built once')
})

test('a reload restores the baseline its origin names: by id, else by repository for a record stored before ids; one not shipped falls back to the default', async () => {
  const { owner, repo } = DEFAULT_BASELINE.index
  assert.equal(baselineOfOrigin({ id: 'jhope188', owner: 'x', repo: 'y' }), DEFAULT_BASELINE)
  assert.equal(baselineOfOrigin({ owner: owner.toUpperCase(), repo }), DEFAULT_BASELINE, 'an old record, matched by its repository')
  assert.equal(baselineOfOrigin({ id: 'not-shipped', owner, repo }), null, 'an id is never second-guessed by its repository')
  assert.equal(baselineOfOrigin({ owner: 'someone', repo: 'else' }), null)
  for (const origin of [{ kind: 'github' as const, owner, repo, commit: 'old' }, { kind: 'github' as const, id: 'jhope188' as const, owner, repo, commit: 'old' }]) {
    const back = await restoreBaseline(origin)
    assert.ok(back.origin.kind === 'github' && back.origin.id === 'jhope188' && back.origin.commit === DEFAULT_BASELINE.pinned.commit)
  }
})

test("the author check reads the baseline's own repository and compares with its own pin", async () => {
  const asked: string[] = []
  const fake = (async (url: string) => {
    asked.push(String(url))
    return new Response(JSON.stringify([{ sha: DEFAULT_BASELINE.pinned.commit, commit: { author: { date: '2026-10-01T00:00:00Z' } } }]), { status: 200 })
  }) as unknown as typeof fetch
  const head = await checkAuthorHead(fake, DEFAULT_BASELINE)
  assert.deepEqual(asked, [`https://api.github.com/repos/${DEFAULT_BASELINE.index.owner}/${DEFAULT_BASELINE.index.repo}/commits?per_page=1`])
  assert.equal(head.updated, false, 'the head is the pin: no update')
  assert.equal(head.pinned, DEFAULT_BASELINE.pinned.commit)
})
