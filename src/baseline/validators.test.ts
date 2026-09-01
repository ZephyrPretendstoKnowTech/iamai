// Prompt 51 Part 3: the §3 validators run over the pinned baseline. Findings are
// reported, never patched by hand: the test pins the exact set of findings on the
// current pin, so a baseline change (or a fixed policy) shows up as a diff here
// and in docs/reports/51.md, and a new `must` finding is never silent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { runBaselineValidators } from './validators.ts'
import type { CaPolicy } from './types.ts'

const findings = runBaselineValidators(pinned.policies as unknown as CaPolicy[])
const key = (f: { id: string; policy: string }): string => `${f.id} · ${f.policy}`

// The pinned baseline is clean after the owner's finding resolutions: the four
// P2 grant+reauth policies use every-time frequency (not a lifetime control), and
// the author's break-glass hardening policy is not-assessed. A new finding here
// is a real regression to reconcile in docs/reports/51.md, never hand-patched.
const EXPECTED: string[] = []

test('the §3 validators produce exactly the documented findings on the pinned baseline', () => {
  assert.deepEqual(findings.map(key).sort(), [...EXPECTED].sort(), 'the baseline findings changed — reconcile docs/reports/51.md, never hand-patch content or the baseline')
})

test('every finding names a validator id and a level, and no policy fails shape-01 or ret-01', () => {
  for (const f of findings) {
    assert.match(f.id, /^[a-z]+-\d\d$/, `${f.policy}: a finding has a malformed id`)
    assert.ok(['must', 'warn', 'info'].includes(f.level))
  }
  assert.equal(findings.filter((f) => f.id === 'shape-01').length, 0, 'every pinned policy ends in a grant or session control')
  assert.equal(findings.filter((f) => f.id === 'ret-01').length, 0, 'no pinned policy uses a retired grant')
})
