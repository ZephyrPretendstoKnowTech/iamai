// The pinned commit is the only integrity control on baseline content, and it
// did not hold: `encodeURIComponent` leaves `.` alone, so a `../` segment
// survived encoding and the URL parser normalised the owner, repo and commit
// out of the path — while the About card kept displaying them as provenance.
//
// Every assertion below is on the FINAL URL STRING, not on the input. A test
// that asserts "this input throws" passes just as happily if someone later
// makes the function return the escaping URL instead of throwing; a test that
// asserts "nothing this function returns leaves the pinned prefix" does not.
import assert from 'node:assert/strict'
import test from 'node:test'
import { BaselinePathError, pinnedUrl, rawUrl } from './github.ts'
import type { BaselineIndex } from './github.ts'

const COMMIT = 'ceccdc2a6dc2e4a3e1f960fc2d91f05c8963265b'
const INDEX: BaselineIndex = {
  owner: 'Jhope188',
  repo: 'ConditionalAccessPolicies',
  commit: COMMIT,
  label: 'test',
  generatedAt: '2026-08-30T00:00:00.000Z',
  files: ['Policies/policy.json', 'Documents/readme.md'],
}
const PREFIX = `https://raw.githubusercontent.com/${INDEX.owner}/${INDEX.repo}/${COMMIT}/`

/** The URL a call produced, or null when it refused to produce one. */
function urlFor(fn: () => string): string | null {
  try {
    return fn()
  } catch (e) {
    assert.ok(e instanceof BaselinePathError, `refused with the wrong error type: ${String(e)}`)
    return null
  }
}

const ESCAPES: { name: string; path: string }[] = [
  { name: 'a dot-segment traversal', path: '../../../attacker/evil/main/payload.json' },
  { name: 'a traversal in the middle of a path', path: 'Policies/../../../attacker/evil/main/payload.json' },
  { name: 'an absolute path', path: '/attacker/evil/main/payload.json' },
  { name: 'a scheme-prefixed path', path: 'https://attacker.example/payload.json' },
  { name: 'a protocol-relative path', path: '//attacker.example/payload.json' },
  { name: 'a percent-encoded dot-segment', path: '%2e%2e/%2e%2e/%2e%2e/attacker/evil/main/payload.json' },
  { name: 'a backslash separator', path: '..\\..\\attacker\\evil\\main\\payload.json' },
  { name: 'a single-dot segment', path: './Policies/policy.json' },
  { name: 'an empty segment', path: 'Policies//policy.json' },
]

for (const { name, path } of ESCAPES) {
  test(`rawUrl: ${name} cannot leave the pinned prefix`, () => {
    const url = urlFor(() => rawUrl(INDEX, path))
    if (url === null) return // refused outright, which is the intended outcome
    // It returned something. The only acceptable something starts at the pin.
    assert.ok(url.startsWith(PREFIX), `escaped the pinned commit: ${url}`)
    assert.equal(new URL(url).origin, 'https://raw.githubusercontent.com')
  })
}

test('pinnedUrl: a path absent from the index is never fetched', () => {
  const url = urlFor(() => pinnedUrl(INDEX, 'Policies/not-in-the-index.json'))
  assert.equal(url, null, 'a path the index does not name produced a URL')
})

test('pinnedUrl: every escaping path is refused before the index check too', () => {
  for (const { name, path } of ESCAPES) {
    const url = urlFor(() => pinnedUrl(INDEX, path))
    assert.equal(url, null, `${name} produced a URL through pinnedUrl: ${url}`)
  }
})

test('the honest paths still work, and land inside the pin', () => {
  for (const path of INDEX.files) {
    const url = pinnedUrl(INDEX, path)
    assert.ok(url.startsWith(PREFIX), `${path} did not land under the pin: ${url}`)
    assert.ok(url.endsWith(path.split('/').map(encodeURIComponent).join('/')), `${path} was mangled: ${url}`)
  }
})

test('a name with spaces and parentheses survives, because real baselines have them', () => {
  const index = { ...INDEX, files: ['Policies/CA01 - Require MFA (all users).json'] }
  const url = pinnedUrl(index, index.files[0])
  assert.ok(url.startsWith(PREFIX))
  assert.ok(url.includes('CA01%20-%20Require%20MFA%20(all%20users).json'), url)
})

test('the pin itself is checked: a branch name is not a commit', () => {
  for (const commit of ['main', 'HEAD', 'ceccdc2', `${COMMIT}x`, '']) {
    const url = urlFor(() => rawUrl({ ...INDEX, commit }, 'Policies/policy.json'))
    assert.equal(url, null, `commit "${commit}" was accepted as a pin`)
  }
})

test('owner and repo cannot carry a path of their own', () => {
  const cases: Partial<BaselineIndex>[] = [
    { owner: 'Jhope188/../attacker' },
    { repo: 'ConditionalAccessPolicies/../../attacker/evil' },
    { owner: '..' },
    { repo: '' },
  ]
  for (const over of cases) {
    const url = urlFor(() => rawUrl({ ...INDEX, ...over }, 'Policies/policy.json'))
    assert.equal(url, null, `accepted ${JSON.stringify(over)}`)
  }
})

test('the shipped index is itself clean', async () => {
  // The allowlist is only worth having if what ships in it passes the same
  // check every runtime path does.
  const { readdirSync, readFileSync } = await import('node:fs')
  const names = readdirSync('baselines').filter((n) => n.endsWith('.index.json'))
  assert.ok(names.length > 0, 'no baseline index found to check')
  for (const name of names) {
    const index = JSON.parse(readFileSync(`baselines/${name}`, 'utf8')) as BaselineIndex
    for (const path of index.files) {
      const url = pinnedUrl(index, path)
      assert.ok(
        url.startsWith(`https://raw.githubusercontent.com/${index.owner}/${index.repo}/${index.commit}/`),
        `${name}: ${path} escapes the pin`,
      )
    }
  }
})
