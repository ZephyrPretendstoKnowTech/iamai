// A3: the change-scope lock on the per-step snapshots
// (scripts/check-change-scope.mjs), proven on constructed commits — a package
// edit may change only its own step's snapshots, a src/ edit may change
// snapshots only under [snapshots], anything else is free — and on HEAD, which
// CI runs the same script over.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PACKAGE_PREFIX, REGISTRY, SNAPSHOT_PREFIX, TAG, commitsInRange, violationsOf } from '../../scripts/check-change-scope.mjs'
import type { ScopedCommit } from '../../scripts/check-change-scope.mjs'

const snap = (fixture: string, stepId: string): string => `${SNAPSHOT_PREFIX}${fixture}/${stepId}.json`
const pkg = (stepId: string, file = 'package.json'): string => `${PACKAGE_PREFIX}${stepId}/${file}`
const commit = (message: string, files: string[]): ScopedCommit => ({ sha: 'abcdef0123456789', message, files })

test('a package commit may change only its own step’s snapshots', () => {
  assert.deepEqual(violationsOf(commit('token protection: reword the Entra block', [pkg('s-goal-token-protection', 'blocks/entra.md'), snap('demo', 's-goal-token-protection'), snap('demo-week2', 's-goal-token-protection')])), [])
  const bad = violationsOf(commit('token protection: reword the Entra block', [pkg('s-goal-token-protection', 'blocks/entra.md'), snap('demo', 's-goal-token-protection'), snap('demo', 's-goal-mfa-all-users')]))
  assert.equal(bad.length, 1)
  assert.match(bad[0], /abcdef0 · docs\/qa\/step-snapshots\/demo\/s-goal-mfa-all-users\.json · outside the package\(s\) this commit edits \(s-goal-token-protection\)/)
  // Two packages in one commit: either's snapshots, nobody else's.
  assert.deepEqual(violationsOf(commit('two packages', [pkg('a'), pkg('b'), snap('mid', 'a'), snap('large', 'b')])), [])
  assert.equal(violationsOf(commit('two packages', [pkg('a'), pkg('b'), snap('mid', 'c')])).length, 1)
  // The compiled registry travels with a package edit and is not a src/ change.
  assert.deepEqual(violationsOf(commit('recompile', [pkg('a'), REGISTRY, snap('small', 'a')])), [])
  // The library index at the root of the folder names no package.
  assert.equal(violationsOf(commit('index', [`${PACKAGE_PREFIX}LIBRARY.json`, snap('small', 'a')])).length, 0)
})

test('a src/ commit may change snapshots only when its message says [snapshots]', () => {
  const files = ['src/ui/surfaces/planBoard.ts', snap('demo', 's-goal-mfa-all-users'), snap('hostile', 's-prereq-break-glass')]
  const bad = violationsOf(commit('A9: the board reads the lane differently', files))
  assert.equal(bad.length, 2, 'every snapshot the commit changes is named')
  for (const line of bad) assert.match(line, /src\/ changed \(src\/ui\/surfaces\/planBoard\.ts\) and the message does not say \[snapshots\]/)
  assert.deepEqual(violationsOf(commit(`A9: the board reads the lane differently ${TAG}`, files)), [])
  assert.equal(TAG, '[snapshots]')
  // src/ and a package in one commit: the tag governs, since the src/ change may move any step.
  assert.equal(violationsOf(commit('both', [...files, pkg('a')])).length, 2)
  assert.deepEqual(violationsOf(commit(`both ${TAG}`, [...files, pkg('a')])), [])
  // A src/ commit that changes no snapshot needs no tag.
  assert.deepEqual(violationsOf(commit('no snapshots', ['src/ui/surfaces/planBoard.ts', 'src/ui/surfaces/planBoard.test.ts'])), [])
})

test('any other commit may change snapshots freely: a regeneration, a content change', () => {
  assert.deepEqual(violationsOf(commit('regenerate', [snap('demo', 'a'), snap('mid', 'b')])), [])
  assert.deepEqual(violationsOf(commit('words', ['docs/design/content.json', snap('demo', 'a')])), [])
  assert.deepEqual(violationsOf(commit('nothing to do with snapshots', ['README.md'])), [])
})

test('the scope script passes on HEAD', (t) => {
  let commits: ScopedCommit[]
  try {
    commits = commitsInRange('HEAD^..HEAD')
  } catch {
    t.skip('no parent commit to diff against (a shallow or root checkout)')
    return
  }
  const problems = commits.flatMap(violationsOf)
  assert.deepEqual(problems, [], `HEAD changes snapshots out of scope:\n${problems.join('\n')}`)
})
