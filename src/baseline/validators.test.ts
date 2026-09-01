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

// The findings on the pin at commit 8461e0f, each reported in docs/reports/51.md
// for the owner. `must` findings that would stop a fresh import; kept because
// this baseline is the owner's own and the findings are theirs to resolve.
const EXPECTED = [
  'excl-01 · IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations',
  'sess-01 · IAC - P2 - APP - SESSION - PIM - Reauthentication',
  'sess-01 · IAC - P2 - GLOBAL - GRANT - EAM - High-Risk Users - Risk Remediation',
  'sess-01 · IAC - P2 - GLOBAL - GRANT - High-Risk Sign-Ins',
  'sess-01 · IAC - P2 - GLOBAL - GRANT - High-Risk Users - Risk Remediation',
]

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
