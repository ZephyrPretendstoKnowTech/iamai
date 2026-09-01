// Prompt 51 §3.2, the replaced per-goal test (owner resolution): the baseline
// wins, so the translator's output is not asserted equal to content.json's
// reference lines. Instead, over every pinned baseline policy, the translator
// must render non-empty portal lines that carry a grant or session control and
// leave no `{placeholder}` unresolved. A policy that fails is a build failure
// (shape-01); the per-goal content-vs-translator differences are enumerated in
// docs/reports/51.md once the goal map pairs a goal with its policy (Unit 3).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { policyFacts } from '../coverage/facts.ts'
import type { StrengthLookup } from '../coverage/strength.ts'
import { buildNameDirectory } from '../names.ts'
import { shared } from '../content/content.ts'
import { portalLines, portalLinesAB, endsInControl, hasUnresolvedPlaceholder } from './portalLines.ts'
import type { PortalContext } from './portalLines.ts'

type Pol = (typeof pinned.policies)[number]

const TOKEN_NAME: Record<string, string> = {
  exclusionsGroup: 'the exclusions group',
  serviceAccountsGroup: 'the service accounts group',
  travellersGroup: 'the travellers group',
  allowedCountries: 'the allowed countries',
  trustedLocation: 'the trusted network',
}

/** A resolving context for a pinned policy, from its own placeholders. */
function contextFor(p: Pol): PortalContext {
  const placeholders = (p.placeholders ?? {}) as Record<string, string>
  const strengthName = (p.grantControls as { authenticationStrength?: { displayName?: string } } | null)?.authenticationStrength?.displayName ?? null
  const extra = new Map<string, string>()
  let exclusionsGroupId: string | null = null
  let serviceAccountsGroupId: string | null = null
  for (const [id, token] of Object.entries(placeholders)) {
    if (token === 'strength') extra.set(id, strengthName ?? "the baseline's authentication strength")
    else if (TOKEN_NAME[token]) extra.set(id, TOKEN_NAME[token])
    if (token === 'exclusionsGroup') exclusionsGroupId = id.toLowerCase()
    if (token === 'serviceAccountsGroup') serviceAccountsGroupId = id.toLowerCase()
  }
  const dir = buildNameDirectory(null, [], extra)
  return {
    policyName: p.displayName || 'Baseline policy',
    nameOf: (id) => dir.label(id),
    strengthName,
    portalRoot: shared.portalRoot as string,
    portalOpen: (shared.portalOpen as string).replace('{policy}', p.displayName || ''),
    reportOnlyLine: shared.reportOnlyLine as string,
    exclusionsLine: (shared.exclusionsLine as string).replace('{exclusionsGroup}', 'the exclusions group'),
    exclusionsGroupId,
    serviceAccountsGroupId,
  }
}

const EMPTY: StrengthLookup = new Map()

test('every pinned baseline policy renders non-empty portal lines that end in a grant or session control, with no unresolved placeholder', () => {
  const failures: string[] = []
  for (const p of pinned.policies as Pol[]) {
    const facts = policyFacts(p, EMPTY)
    const lines = portalLines(facts, contextFor(p))
    if (lines.length === 0) failures.push(`${p.displayName}: no portal lines`)
    if (!endsInControl(lines)) failures.push(`${p.displayName}: no grant or session control`)
    if (hasUnresolvedPlaceholder(lines)) failures.push(`${p.displayName}: unresolved placeholder in ${lines.find((l) => hasUnresolvedPlaceholder([l]))}`)
  }
  assert.deepEqual(failures, [], 'a policy the translator cannot render is a build failure — reconcile, never hand-patch')
})

test('a two-policy goal renders Policy A and Policy B, each a full block', () => {
  const a = pinned.policies[0] as Pol
  const b = pinned.policies[1] as Pol
  const lines = portalLinesAB(
    { facts: policyFacts(a, EMPTY), ctx: contextFor(a) },
    { facts: policyFacts(b, EMPTY), ctx: contextFor(b) },
    { a: 'A', b: 'B' },
  )
  assert.ok(lines.some((l) => l.startsWith('Policy A — ')), 'Policy A block present')
  assert.ok(lines.some((l) => l.startsWith('Policy B — ')), 'Policy B block present')
  assert.ok(endsInControl(lines), 'both blocks carry a control')
  assert.ok(!hasUnresolvedPlaceholder(lines), 'no unresolved placeholder across both blocks')
})

test('the registration fallback swaps Block access for Require multifactor authentication', () => {
  // A block policy (register-info-protected shape): with the mfa override the
  // grant becomes Require multifactor authentication, everything else unchanged.
  const blocker = (pinned.policies as Pol[]).find((p) => {
    const g = p.grantControls as { builtInControls?: string[] } | null
    return (g?.builtInControls ?? []).some((c) => /^block$/i.test(c))
  })
  assert.ok(blocker, 'the pinned baseline has at least one block policy')
  if (!blocker) return
  const facts = policyFacts(blocker, EMPTY)
  const ctx = contextFor(blocker)
  const withBlock = portalLines(facts, ctx)
  const withMfa = portalLines(facts, ctx, { grantOverride: 'mfa' })
  assert.ok(withBlock.includes('Grant → Block access'))
  assert.ok(withMfa.includes('Grant → Require multifactor authentication'))
  assert.ok(!withMfa.includes('Grant → Block access'))
})
