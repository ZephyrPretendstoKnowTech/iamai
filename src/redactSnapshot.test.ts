// Every class of tenant name, in nested positions, because nesting is where the
// old redactor failed.
//
// `redactIdentifiers` matched UPN shapes and GUIDs. The audit found that the
// "redacted" grounding bundle — the artifact the product offers as the safe one
// — still carried policy names, group names, departments and named-location
// CIDRs, and that the one structural substitution it had was built from
// `snapshot.users` alone (redact-02, redact-03, redact-07). The fixture below
// puts one of every field type somewhere awkward: inside prose, three objects
// deep, in an array, and as an object key.
import assert from 'node:assert/strict'
import test from 'node:test'
import type { TenantSnapshot } from './graph/collect/types.ts'
import { redactDeep, redactText, tenantVocabulary } from './redactSnapshot.ts'

/** One value of every class the vocabulary is supposed to know about. */
const SECRETS = {
  user: 'Priya Nair',
  upn: 'priya.nair@contoso.example',
  department: 'Financial Controls',
  jobTitle: 'Treasury Analyst',
  office: 'Manchester Spinningfields',
  device: 'CONTOSO-LAPTOP-0417',
  policy: 'CA012 - Require MFA for Finance',
  group: 'Break Glass Accounts',
  role: 'Privileged Role Administrator',
  app: 'Contoso Expenses Portal',
  location: 'Manchester Head Office',
  cidr: '203.0.113.0/24',
  organisation: 'Contoso Holdings Limited',
  domain: 'contoso.example',
} as const

const SNAPSHOT = {
  tenantId: '3f2b9c14-7d85-4a61-b0e2-5c9a18d4f7e3',
  users: [
    {
      id: 'a1',
      displayName: SECRETS.user,
      userPrincipalName: SECRETS.upn,
      department: SECRETS.department,
      jobTitle: SECRETS.jobTitle,
      officeLocation: SECRETS.office,
    },
  ],
  devices: [{ id: 'd1', displayName: SECRETS.device }],
  appSignInSummary: [{ appId: 'x', appDisplayName: SECRETS.app }],
  config: {
    caPolicies: { rows: [{ id: 'p1', displayName: SECRETS.policy }] },
    groups: { rows: [{ id: 'g1', displayName: SECRETS.group }] },
    roleDefinitions: { rows: [{ id: 'r1', displayName: SECRETS.role }] },
    applications: { rows: [{ id: 'ap1', displayName: SECRETS.app }] },
    namedLocations: { rows: [{ id: 'l1', displayName: SECRETS.location, ipRanges: [{ cidrAddress: SECRETS.cidr }] }] },
    organization: { rows: [{ displayName: SECRETS.organisation, verifiedDomains: [{ name: SECRETS.domain }] }] },
  },
} as unknown as TenantSnapshot

const VOCAB = tenantVocabulary(SNAPSHOT)

test('every class of name is in the vocabulary', () => {
  for (const [kind, value] of Object.entries(SECRETS)) {
    assert.ok(VOCAB.has(value.toLowerCase()), `${kind} ("${value}") is not redacted at all`)
  }
})

test('nested positions: prose, depth, arrays and object keys', () => {
  // The awkward shapes, all at once.
  const artifact = {
    summary: `${SECRETS.policy} excludes the group ${SECRETS.group}, covering ${SECRETS.user} in ${SECRETS.department}.`,
    findings: [
      {
        statement: `Delivered by ${SECRETS.policy}, from ${SECRETS.location} (${SECRETS.cidr}).`,
        detail: { nested: { deeper: { note: `${SECRETS.device} belongs to ${SECRETS.upn}` } } },
      },
    ],
    byGroup: { [SECRETS.group]: { holders: [SECRETS.user, SECRETS.role] } },
    tenant: { name: SECRETS.organisation, domains: [SECRETS.domain] },
  }

  const out = JSON.stringify(redactDeep(artifact, VOCAB))
  for (const [kind, value] of Object.entries(SECRETS)) {
    assert.ok(!out.includes(value), `${kind} ("${value}") survived redaction: ${out.slice(0, 300)}`)
  }
  // And the tenant id, which the identifier regexes handle.
  assert.ok(!out.includes('3f2b9c14-7d85-4a61-b0e2-5c9a18d4f7e3'), 'the tenant id survived')
})

test('the object key itself is redacted, not just the value', () => {
  const out = redactDeep({ [SECRETS.group]: 'x' }, VOCAB)
  assert.deepEqual(Object.keys(out), ['[a group 1]'])
})

test('placeholders say what the thing was, so the sentence still reads', () => {
  const s = redactText(`Excluded by the group ${SECRETS.group} on policy ${SECRETS.policy}.`, VOCAB)
  assert.match(s, /Excluded by the group \[a group \d+\] on policy \[a policy \d+\]\./)
})

test('the longest name wins, so a shorter one cannot leave a fragment behind', () => {
  // "Sales" inside "Sales Managers" would otherwise produce "[a group 1] Managers",
  // which both corrupts the text and leaks the half that did not match.
  const snap = {
    users: [],
    devices: [],
    appSignInSummary: [],
    config: { groups: { rows: [{ displayName: 'Sales' }, { displayName: 'Sales Managers' }] } },
  } as unknown as TenantSnapshot
  const v = tenantVocabulary(snap)
  const out = redactText('Members of Sales Managers and of Sales.', v)
  assert.ok(!out.includes('Sales'), `a fragment survived: ${out}`)
  assert.match(out, /Members of \[a group \d+\] and of \[a group \d+\]\./)
})

test('casing does not matter', () => {
  const out = redactText(`the ${SECRETS.group.toUpperCase()} group`, VOCAB)
  assert.ok(!out.toLowerCase().includes('break glass'), `case-different name survived: ${out}`)
})

test('names with regex metacharacters do not break the substitution', () => {
  const snap = {
    users: [],
    devices: [],
    appSignInSummary: [],
    config: { caPolicies: { rows: [{ displayName: 'CA (all) [prod] +MFA *required*' }] } },
  } as unknown as TenantSnapshot
  const v = tenantVocabulary(snap)
  const out = redactText('Policy CA (all) [prod] +MFA *required* applies.', v)
  assert.ok(!out.includes('[prod]'), `metacharacter name survived: ${out}`)
})

test('short names are left alone rather than corrupting the text', () => {
  // A three-letter group name would rewrite those letters inside every unrelated
  // word. The identifier regexes still cover anything genuinely identifying.
  const snap = { users: [], devices: [], appSignInSummary: [], config: { groups: { rows: [{ displayName: 'IT' }] } } } as unknown as TenantSnapshot
  const v = tenantVocabulary(snap)
  assert.equal(redactText('The situation is critical.', v), 'The situation is critical.')
})

test('redaction is not applied when it is not asked for', () => {
  // The vocabulary is empty for an unredacted export; the identifier regexes
  // still run, because a GUID is never wanted in prose.
  const empty = new Map<string, string>()
  assert.equal(redactText(SECRETS.policy, empty), SECRETS.policy)
  assert.match(redactText('id 3f2b9c14-7d85-4a61-b0e2-5c9a18d4f7e3', empty), /guid-0001/)
})
