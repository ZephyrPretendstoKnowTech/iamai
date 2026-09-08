// A specialised meaning needs affirmative evidence (task 022).
//
// The pin used to classify the author's objects by policy display name over a
// fall-through, and the fall-through was `serviceAccountsGroup`. So the author's
// own `CA-GlobalExclusions-GroupID-ReplaceMe` token was read as the service
// accounts, and so were three groups the author's own service-accounts policy
// excludes - and `serviceAccountsGroup` is a token `src/roadmap/resolvePolicy.ts`
// maps, so an adopting tenant's service-accounts group would have been written
// into twenty-three exported policies on that reading. The same pass read a
// group as travelling users because a policy was called "AllowedAVDUsers".
//
// The tests below are about the shape of the rule, not about those four ids: a
// naming heuristic may nominate a candidate and may not settle one, structure
// alone may only record that nothing is known, and a reference nothing settles
// carries no token. Then the shipped interpretation file is checked against the
// shipped pin, so a record and the artifact it produced cannot drift apart.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { interpretReferences, noInterpretation, policyContext, readInterpretation, referenceUsage } from './interpretation.ts'
import type { BaselineInterpretation, InterpretationRecord } from './interpretation.ts'
import { placeholdersFor } from '../../scripts/pin-baseline.ts'
import { pinnedPackage } from './pinned.ts'
import type { CaPolicy } from './types.ts'

const BASE = 'baselines/jhope188-conditionalaccesspolicies'
const SVC = '11111111-1111-4111-8111-111111111111'
const BROAD = '22222222-2222-4222-8222-222222222222'
const AVD = '33333333-3333-4333-8333-333333333333'
const PLACE = '44444444-4444-4444-4444-444444444444'

const policy = (over: Partial<CaPolicy> & { id: string; displayName: string }): CaPolicy =>
  ({ state: 'enabledForReportingButNotEnforced', conditions: {}, grantControls: null, sessionControls: null, ...over }) as CaPolicy

/**
 * The shape the defect lived in: one policy that targets the service accounts
 * and excludes a broad group, and one whose name contains "Allowed" and excludes
 * another. Every group here is excluded somewhere and only the first is targeted.
 */
const SOURCE: CaPolicy[] = [
  policy({
    id: 'p-svc',
    displayName: 'IAC - GLOBAL - BLOCK - Service Accounts',
    conditions: { users: { includeGroups: [SVC], excludeGroups: [BROAD] } },
  }),
  policy({
    id: 'p-avd',
    displayName: 'IAC - APP - BLOCK - AVD - Exclude - AllowedAVDUsers',
    conditions: { users: { includeUsers: ['All'], excludeGroups: [AVD, BROAD] } },
  }),
  policy({
    id: 'p-geo',
    displayName: 'IAC - GLOBAL - BLOCK - Countries not Allowed',
    conditions: { users: { includeUsers: ['All'], excludeGroups: [BROAD] }, locations: { excludeLocations: [PLACE] } },
  }),
]

const NONE = noInterpretation('Jhope188', 'ConditionalAccessPolicies')

/**
 * A record settled against SOURCE as it stands: the policies that include the
 * reference, and what each of those policies was when it was read
 * (`policyContext`). A record that names the policies and not what they were is
 * a record no later package can be checked against.
 */
const settled = (over: Partial<InterpretationRecord> & Pick<InterpretationRecord, 'id' | 'meaning'>, policies: CaPolicy[] = SOURCE): InterpretationRecord => {
  const includedIn = over.includedIn ?? (referenceUsage(policies).find((u) => u.id === over.id.toLowerCase())?.includedIn ?? [])
  const context: Record<string, string> = {}
  for (const p of policies) if (includedIn.includes(p.id ?? p.displayName)) context[p.id ?? p.displayName] = policyContext(p)
  return { kind: 'group', basis: 'documented', evidence: 'documented', ...over, id: over.id.toLowerCase(), includedIn, context }
}

const tokensFor = (interpretation: BaselineInterpretation, policies: CaPolicy[] = SOURCE): Map<string, string> =>
  placeholdersFor(policies, interpretation).placeholderFor

// ---- the rule ----

test('a group nothing settles gets no meaning, however many policies exclude it', () => {
  const tokens = tokensFor(NONE)
  assert.equal(tokens.get(BROAD), undefined, 'the fall-through that made every unexplained exclusion the service accounts is gone')
  assert.equal(tokens.get(AVD), undefined)
  assert.equal(tokens.get(SVC), undefined, 'a policy called "Service Accounts" does not settle what the group it targets is')
  assert.equal([...tokens.values()].includes('serviceAccountsGroup'), false)
})

test('a policy name does not give anything geography', () => {
  const tokens = tokensFor(NONE)
  assert.equal(tokens.get(AVD), undefined, '"AllowedAVDUsers" is about AVD users, not about where anybody is')
  assert.equal(tokens.get(PLACE), undefined, 'nor does "Countries not Allowed" settle which list its location is')
  assert.equal([...tokens.values()].includes('travellersGroup'), false)
  assert.equal([...tokens.values()].includes('allowedCountries'), false)
})

test('only a settled record gives a specialised meaning, and it is scoped to its own reference', () => {
  const interpretation: BaselineInterpretation = {
    ...NONE,
    references: [settled({ id: SVC, meaning: 'serviceAccountsGroup', evidence: 'the policy targets it and its README names CA-ServiceAccounts' })],
  }
  const tokens = tokensFor(interpretation)
  assert.equal(tokens.get(SVC), 'serviceAccountsGroup')
  assert.equal(tokens.get(BROAD), undefined, 'settling one group says nothing about the others beside it')
  assert.equal(tokens.size, 1)
})

test('an authentication strength takes its meaning from the field it sits in, not from a record', () => {
  const withStrength = [...SOURCE, policy({ id: 'p-str', displayName: 'anything at all', grantControls: { authenticationStrength: { id: '42de22a7-5339-4a58-b560-28565d53b14d' } } })]
  assert.equal(tokensFor(NONE, withStrength).get('42de22a7-5339-4a58-b560-28565d53b14d'), 'strength')
})

// ---- reuse across an update ----

const settledSvc: BaselineInterpretation = { ...NONE, references: [settled({ id: SVC, meaning: 'serviceAccountsGroup' })] }

test('one more exclusion does not disturb a settled reading', () => {
  const more = [...SOURCE, policy({ id: 'p-new', displayName: 'IAC - GLOBAL - BLOCK - Something New', conditions: { users: { includeUsers: ['All'], excludeGroups: [SVC] } } })]
  const read = interpretReferences(settledSvc, referenceUsage(more))
  assert.deepEqual(read.reviewRequired, [], 'being excluded from one more policy says nothing new about what a group is')
  assert.equal(read.tokens.get(SVC), 'serviceAccountsGroup')
})

test('a reference that changes role is held for review rather than carried forward', () => {
  const retargeted = SOURCE.map((p) => (p.id === 'p-svc' ? policy({ id: 'p-svc', displayName: p.displayName, conditions: { users: { includeUsers: ['All'], excludeGroups: [SVC, BROAD] } } }) : p))
  const read = interpretReferences(settledSvc, referenceUsage(retargeted))
  assert.equal(read.reviewRequired.length, 1, 'the policy that named it no longer targets it')
  assert.equal(read.reviewRequired[0].id, SVC)
  assert.equal(read.tokens.get(SVC), undefined, 'and the old meaning is not applied while it is in question')
})

test('the policy that gave a reference its meaning changing materially holds the reading for review', () => {
  // Same reference, same policy id, still the only group that policy includes -
  // and the policy now blocks nothing and grants a strength instead. The
  // sentence the meaning rests on ("that policy blocks interactive sign-in for
  // this group") is about a policy that is no longer there.
  const rewritten = SOURCE.map((p) =>
    p.id === 'p-svc'
      ? policy({ id: 'p-svc', displayName: p.displayName, conditions: { users: { includeGroups: [SVC], excludeGroups: [BROAD] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
      : p,
  )
  const read = interpretReferences(settledSvc, referenceUsage(rewritten))
  assert.equal(read.reviewRequired.length, 1, 'the policy the meaning was read off has changed')
  assert.match(read.reviewRequired[0].why, /materially changed/)
  assert.equal(read.tokens.get(SVC), undefined, 'and the old meaning is not applied while it is in question')
})

test('a benign change to that policy does not disturb the reading', () => {
  // One more group excluded, and the policy is renamed, moved out of report-only
  // and re-exported with new timestamps. None of that is what the group is.
  const benign = SOURCE.map((p) =>
    p.id === 'p-svc'
      ? policy({
          id: 'p-svc',
          displayName: 'IAC - GLOBAL - BLOCK - Service Accounts (v2)',
          state: 'enabled',
          conditions: { users: { includeGroups: [SVC], excludeGroups: [BROAD, AVD] } },
        })
      : p,
  )
  const read = interpretReferences(settledSvc, referenceUsage(benign))
  assert.deepEqual(read.reviewRequired, [], 'a rename, a rollout and one more exclusion say nothing about what the group is')
  assert.equal(read.tokens.get(SVC), 'serviceAccountsGroup')
})

test('a reference used as another kind is held for review', () => {
  const asLocation: BaselineInterpretation = { ...NONE, references: [settled({ id: PLACE, meaning: 'exclusionsGroup', includedIn: [] })] }
  const read = interpretReferences(asLocation, referenceUsage(SOURCE))
  assert.equal(read.reviewRequired.length, 1)
  assert.match(read.reviewRequired[0].why, /namedLocation/)
})

test('a settled reading whose reference has left the source is reported, not enforced', () => {
  const gone: BaselineInterpretation = { ...NONE, references: [settled({ id: '99999999-9999-4999-8999-999999999999', meaning: 'exclusionsGroup', includedIn: [] })] }
  const read = interpretReferences(gone, referenceUsage(SOURCE))
  assert.deepEqual(read.reviewRequired, [])
  assert.deepEqual(read.stale, ['99999999-9999-4999-8999-999999999999'])
})

test('every reference the package uses and no record settles comes back to be looked at', () => {
  const read = interpretReferences(settledSvc, referenceUsage(SOURCE))
  assert.deepEqual(read.unsettled.map((u) => u.id).sort(), [AVD, BROAD, PLACE].sort())
})

// ---- the file itself ----

test('a malformed interpretation file is refused, never read as an empty one', () => {
  assert.throws(() => readInterpretation(null), /interpretation/)
  assert.throws(() => readInterpretation({ version: 1, owner: 'o', repo: 'r' }), /references/)
  assert.throws(() => readInterpretation({ version: 1, owner: 'o', repo: 'r', references: [{ id: 'a', kind: 'group', meaning: 'exclusionsGroup', basis: 'documented' }] }), /evidence/)
  assert.throws(
    () =>
      readInterpretation({
        version: 1,
        owner: 'o',
        repo: 'r',
        references: [
          { id: 'a', kind: 'group', meaning: 'unknown', basis: 'documented', evidence: 'x', includedIn: [], context: {} },
          { id: 'A', kind: 'group', meaning: 'unknown', basis: 'documented', evidence: 'x', includedIn: [], context: {} },
        ],
      }),
    /twice/,
  )
  // A record that names the policy its meaning came from and records nothing
  // about what that policy was cannot be checked against a later package, which
  // is the same as having no invalidation rule at all.
  assert.throws(
    () => readInterpretation({ version: 1, owner: 'o', repo: 'r', references: [{ id: 'a', kind: 'group', meaning: 'serviceAccountsGroup', basis: 'documented', evidence: 'the policy targets it', includedIn: ['p-1'], context: {} }] }),
    /records nothing about what that policy was/,
  )
})

test('structure alone may record that nothing is known and may not claim a role', () => {
  const structural = (meaning: string) => ({ version: 1, owner: 'o', repo: 'r', references: [{ id: 'a', kind: 'group', meaning, basis: 'structural', evidence: 'excluded from a lot of policies', includedIn: [], context: {} }] })
  assert.doesNotThrow(() => readInterpretation(structural('unknown')))
  assert.throws(() => readInterpretation(structural('serviceAccountsGroup')), /structure alone/)
  assert.throws(() => readInterpretation(structural('exclusionsGroup')), /structure alone/)
})

// ---- the shipped baseline ----

const shipped = readInterpretation(JSON.parse(readFileSync(`${BASE}.interpretation.json`, 'utf8')))
const pinned = JSON.parse(readFileSync(`${BASE}.pinned.json`, 'utf8')) as { policies: { id: string | null; displayName: string; grantControls: unknown; placeholders: Record<string, string> }[] }

test('the shipped interpretation is about the baseline it ships beside', () => {
  const index = JSON.parse(readFileSync(`${BASE}.index.json`, 'utf8')) as { owner: string; repo: string }
  assert.equal(shipped.owner, index.owner)
  assert.equal(shipped.repo, index.repo)
  assert.ok(shipped.references.length > 0)
})

test('every token in the shipped pin is a settled reading or an authentication strength', () => {
  const meaning = new Map(shipped.references.map((r) => [r.id, r.meaning]))
  for (const p of pinned.policies) {
    for (const [id, token] of Object.entries(p.placeholders ?? {})) {
      const key = id.toLowerCase()
      if (token === 'strength') {
        assert.equal((p.grantControls as { authenticationStrength?: { id?: string } } | null)?.authenticationStrength?.id?.toLowerCase(), key, `${key} is called a strength and does not sit in the strength field`)
        continue
      }
      assert.equal(meaning.get(key), token, `${key} carries ${token} in the pin and the interpretation does not settle it as that`)
    }
  }
})

test('no group in the shipped pin carries a specialised meaning nothing settles', () => {
  const settled = new Map(shipped.references.map((r) => [r.id, r]))
  for (const p of pinned.policies) {
    for (const [id, token] of Object.entries(p.placeholders ?? {})) {
      if (token === 'strength') continue
      const r = settled.get(id.toLowerCase())!
      assert.notEqual(r.meaning, 'unknown', `${id} is settled as unknown and the pin gave it ${token}`)
      assert.notEqual(r.basis, 'structural')
      assert.ok(r.evidence.length > 20, `${id} carries ${token} on a one-word reason`)
    }
  }
})

test('every shipped record that names a policy records what that policy was', () => {
  const usage = new Map(referenceUsage(pinnedPackage().policies).map((u) => [u.id, u]))
  for (const r of shipped.references) {
    assert.deepEqual(Object.keys(r.context).sort(), [...r.includedIn].sort(), `${r.id}: one context per policy it was settled against`)
    for (const k of r.includedIn) assert.equal(r.context[k], usage.get(r.id)?.context[k], `${r.id}: the context recorded for ${k} is not the one this pin's ${k} has`)
  }
  // And the shipped file passes its own reuse rule against the pin beside it:
  // nothing in it is being carried forward into a package it no longer fits.
  const read = interpretReferences(shipped, referenceUsage(pinnedPackage().policies))
  assert.deepEqual(read.reviewRequired, [])
})

test('the pin left the author own everything the interpretation settles as unknown', () => {
  const tokened = new Set<string>()
  for (const p of pinned.policies) for (const id of Object.keys(p.placeholders ?? {})) tokened.add(id.toLowerCase())
  for (const r of shipped.references) {
    if (r.meaning !== 'unknown') continue
    assert.equal(tokened.has(r.id), false, `${r.id} is settled as unknown and the pin gave it a token anyway`)
  }
})
