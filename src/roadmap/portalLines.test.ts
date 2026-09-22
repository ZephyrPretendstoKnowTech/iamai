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

// An include and an exclude never name the same set on one line: an exclude
// wins in Entra, so a group, a location or a platform on both sides would
// describe a policy that applies to nobody; the translator drops the exclude.
test('portal include/exclude lines never name the same set on both sides', () => {
  const policy = (conditions: Record<string, unknown>): Pol =>
    ({ id: null, displayName: 'Same set', conditions: { applications: { includeApplications: ['All'], excludeApplications: [], includeUserActions: [] }, ...conditions }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null, placeholders: { g1: 'exclusionsGroup' } }) as unknown as Pol
  const both = policy({
    users: { includeUsers: [], excludeUsers: [], includeGroups: ['g1'], excludeGroups: ['g1'], includeRoles: [], excludeRoles: [], includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } }, excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } } },
    locations: { includeLocations: ['l1'], excludeLocations: ['l1'] },
    platforms: { includePlatforms: ['android', 'iOS'], excludePlatforms: ['android'] },
  })
  const lines = portalLines(policyFacts(both, EMPTY), contextFor(both))
  const users = lines.find((l) => l.startsWith('Users → '))!
  assert.ok(users.includes('Groups: the exclusions group'), users)
  assert.ok(!/Exclude → Groups/.test(users), `no exclude of the included group: ${users}`)
  assert.ok(!/Also exclude Guest/.test(users), `no exclude of the included guest type: ${users}`)
  const loc = lines.find((l) => l.startsWith('Conditions → Locations'))!
  assert.ok(!/Exclude/.test(loc), `no exclude of the included location: ${loc}`)
  const plat = lines.find((l) => l.startsWith('Conditions → Device platforms'))!
  assert.ok(/Include: Android, iOS\./.test(plat), `no exclude of an included platform: ${plat}`)
  // The same excludes against a different include stay.
  const apart = policy({
    users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: ['g1'], includeRoles: [], excludeRoles: [], excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } } },
    locations: { includeLocations: ['All'], excludeLocations: ['l1'] },
    platforms: { includePlatforms: ['all'], excludePlatforms: ['android'] },
  })
  const kept = portalLines(policyFacts(apart, EMPTY), contextFor(apart))
  const users2 = kept.find((l) => l.startsWith('Users → '))!
  assert.ok(/Exclude → Groups: the exclusions group/.test(users2) && /Also exclude Guest/.test(users2), users2)
  assert.ok(/Exclude: /.test(kept.find((l) => l.startsWith('Conditions → Locations'))!))
  assert.ok(/Include: Any device; Exclude: Android\./.test(kept.find((l) => l.startsWith('Conditions → Device platforms'))!))
})

// §S4-1: every condition the portal narrows through a Configure toggle is not
// applied at all when the toggle is left at No, so the policy reaches
// everything the condition was meant to narrow. The acceptance is the rule over
// everything conditionLines() emits, never a line per branch: the 2026-09-19
// fix asserted five branches and shipped two conditions without the toggle.
test('every condition line the translator emits names the Configure toggle', () => {
  const CONDITION = /^Conditions → /
  const WITH_TOGGLE = /^Conditions → [^→]+ → Configure: Yes, then \S/
  const offenders: string[] = []
  const conditions = (lines: string[]): string[] => lines.filter((l) => CONDITION.test(l))
  const check = (lines: string[]): string[] => {
    for (const l of conditions(lines)) if (!WITH_TOGGLE.test(l)) offenders.push(l)
    return conditions(lines)
  }
  for (const p of pinned.policies as Pol[]) check(portalLines(policyFacts(p, EMPTY), contextFor(p)))
  // Every branch of the function at once, so the rule is never vacuous: one
  // policy carrying all seven toggled conditions, read whole and as a correction.
  const all = {
    id: null,
    displayName: 'Every condition',
    placeholders: {},
    conditions: {
      users: { includeUsers: ['All'] },
      applications: { includeApplications: ['All'] },
      locations: { includeLocations: ['All'], excludeLocations: ['AllTrusted'] },
      platforms: { includePlatforms: ['windows'], excludePlatforms: ['android'] },
      clientAppTypes: ['exchangeActiveSync', 'other'],
      authenticationFlows: { transferMethods: 'deviceCodeFlow' },
      devices: { deviceFilter: { mode: 'exclude', rule: 'device.trustType -eq "AzureAD"' } },
      signInRiskLevels: ['high'],
      userRiskLevels: ['high'],
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    sessionControls: null,
  } as unknown as Pol
  const facts = policyFacts(all, EMPTY)
  const whole = check(portalLines(facts, contextFor(all)))
  assert.equal(whole.length, 7, `all seven toggled conditions render: ${whole.join(' | ')}`)
  check(portalLines(facts, contextFor(all), { mode: 'change', only: new Set(['conditions']) }))
  assert.deepEqual(offenders, [], 'a condition line with no Configure toggle: at No the condition is not applied and the policy reaches everything it was meant to narrow')
})

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

test('correction instructions retain location and device conditions from the submitted body', () => {
  const p = { id:null, displayName:'Device and location correction', placeholders:{}, conditions:{ users:{includeUsers:['All']}, applications:{includeApplications:['All']}, locations:{includeLocations:['All'],excludeLocations:['AllTrusted']}, platforms:{includePlatforms:['windows'],excludePlatforms:[]} }, grantControls:{operator:'OR',builtInControls:['compliantDevice']}, sessionControls:null } as unknown as Pol
  const lines=portalLines(policyFacts(p,EMPTY),contextFor(p),{mode:'change',only:new Set(['conditions','grant'])})
  assert.ok(lines.some(line=>line.includes('Locations')&&line.includes('All trusted locations')))
  assert.ok(lines.some(line=>line.includes('Device platforms')&&line.includes('Windows')))
  assert.ok(lines.some(line=>line.includes('marked as compliant')))
  assert.ok(!lines.some(line=>line.startsWith('Users →')||line.startsWith('Enable policy:')),'fields outside this correction are not instructed')
})

// R4-18 (Marcus D9). A strength nothing names was written "Require
// authentication strength: Multifactor authentication" — the display name of
// Microsoft's built-in strength (…0002), a different and weaker object than the
// one the request sends. The PIM step's settings said it over a strength IAMAI
// had not resolved while the baseline asks for its own custom one. The line
// names the id the request carries instead.
//
// A planning preview's stand-in is not an id. The first version of this fix
// wrote it as the value ("…: ‹authentication strength›"), a placeholder in the
// settings of a held step, which the portal never carries
// (ui/surfaces/stepResources.test.ts "held and completed tasks …" failed on
// mid): the line states the requirement and names nothing.
test('a strength nothing names is written by its own reference, never as the built-in Multifactor authentication', () => {
  const body = (id: string) => ({ id: null, displayName: 'Activation reauthentication', placeholders: {}, conditions: { users: { includeUsers: ['All'] }, applications: { includeAuthenticationContextClassReferences: ['c1'] } }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id } }, sessionControls: null }) as unknown as Pol
  const unnamed = { ...contextFor(body('x')), strengthName: null }
  const custom = '7a1c2e94-3b5d-4f60-8a2b-9c4d1e6f0a73'
  const lines = portalLines(policyFacts(body(custom), EMPTY), unnamed)
  assert.ok(lines.includes(`Grant → Require authentication strength: ${custom}`), lines.join('\n'))
  const preview = portalLines(policyFacts(body('‹authentication strength›'), EMPTY), unnamed)
  assert.ok(preview.includes('Grant → Require authentication strength'), preview.join('\n'))
  assert.ok(!preview.some((l) => /‹/.test(l)), preview.join('\n'))
  assert.ok(![...lines, ...preview].some((l) => /Multifactor authentication/.test(l)))
  // A strength the context names is still named.
  assert.ok(portalLines(policyFacts(body(custom), EMPTY), { ...unnamed, strengthName: 'Modern MFA + TAP' }).includes('Grant → Require authentication strength: Modern MFA + TAP'))
})
