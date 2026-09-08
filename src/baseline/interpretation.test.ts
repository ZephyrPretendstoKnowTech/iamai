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
import { interpretReferences, noInterpretation, readInterpretation, referenceUsage } from './interpretation.ts'
import type { BaselineInterpretation } from './interpretation.ts'
import { placeholdersFor } from '../../scripts/pin-baseline.ts'
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
    references: [{ id: SVC, kind: 'group', meaning: 'serviceAccountsGroup', basis: 'documented', evidence: 'the policy targets it and its README names CA-ServiceAccounts', includedIn: ['p-svc'] }],
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

const settledSvc: BaselineInterpretation = {
  ...NONE,
  references: [{ id: SVC, kind: 'group', meaning: 'serviceAccountsGroup', basis: 'documented', evidence: 'documented', includedIn: ['p-svc'] }],
}

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

test('a reference used as another kind is held for review', () => {
  const asLocation: BaselineInterpretation = { ...NONE, references: [{ id: PLACE, kind: 'group', meaning: 'exclusionsGroup', basis: 'documented', evidence: 'documented', includedIn: [] }] }
  const read = interpretReferences(asLocation, referenceUsage(SOURCE))
  assert.equal(read.reviewRequired.length, 1)
  assert.match(read.reviewRequired[0].why, /namedLocation/)
})

test('a settled reading whose reference has left the source is reported, not enforced', () => {
  const gone: BaselineInterpretation = { ...NONE, references: [{ id: '99999999-9999-4999-8999-999999999999', kind: 'group', meaning: 'exclusionsGroup', basis: 'documented', evidence: 'documented', includedIn: [] }] }
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
    () => readInterpretation({ version: 1, owner: 'o', repo: 'r', references: [{ id: 'a', kind: 'group', meaning: 'unknown', basis: 'documented', evidence: 'x', includedIn: [] }, { id: 'A', kind: 'group', meaning: 'unknown', basis: 'documented', evidence: 'x', includedIn: [] }] }),
    /twice/,
  )
})

test('structure alone may record that nothing is known and may not claim a role', () => {
  const structural = (meaning: string) => ({ version: 1, owner: 'o', repo: 'r', references: [{ id: 'a', kind: 'group', meaning, basis: 'structural', evidence: 'excluded from a lot of policies', includedIn: [] }] })
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

test('the pin left the author own everything the interpretation settles as unknown', () => {
  const tokened = new Set<string>()
  for (const p of pinned.policies) for (const id of Object.keys(p.placeholders ?? {})) tokened.add(id.toLowerCase())
  for (const r of shipped.references) {
    if (r.meaning !== 'unknown') continue
    assert.equal(tokened.has(r.id), false, `${r.id} is settled as unknown and the pin gave it a token anyway`)
  }
})
