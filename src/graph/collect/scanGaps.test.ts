// Connect's three refusals: a scan that could not read a core section builds
// and stores no plan (coreSections.ts); a token without the roles does not
// start the scan and names the role to ask for (tokenRoles.ts); the Plan tile's
// facts never render an empty window (connectView.ts). On the fixture whose token
// lacks the roles and whose scan lacks the policies section (testing/gapsFixture.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../../testing/uiSnapshot.ts'
import { REFUSED, USER_ROLE_ID, gapsSnapshot, noRolesToken, tokenWithRoles, tokenWithoutClaim } from '../../testing/gapsFixture.ts'
import { CORE_SOURCES, coreGaps } from './coreSections.ts'
import { coreRoleGap, rolesInToken } from './tokenRoles.ts'
import { READ_EVERYTHING_ROLE } from './roles.ts'
import { planTile } from '../../ui/scan/connectView.ts'
import type { TenantSnapshot } from './types.ts'

const unlicensed = (): TenantSnapshot => {
  const s = fixtureSnapshot()
  s.sources.signInEvidence = { status: 'disabled', coveredWindow: null, reason: 'not available on this licence (needs Entra ID P1)', asOf: s.asOf }
  s.signInEvidence = {}
  return s
}

test('a scan without its policies section or its sign-in records ends with gaps, listed with the roles that read them; a full scan and a licence gate have none', () => {
  const gaps = coreGaps(gapsSnapshot())
  assert.deepEqual(
    gaps.map((g) => g.source),
    ['config:caPolicies', 'signInEvidence'],
  )
  assert.equal(gaps[0].reason, null, 'a section the scan lacks has no reason to quote')
  assert.deepEqual(gaps[0].roles, ['Security Reader'])
  assert.equal(gaps[1].reason, REFUSED)
  assert.deepEqual(gaps[1].roles, ['Reports Reader'])
  assert.deepEqual(coreGaps(fixtureSnapshot()), [], 'the full fixture scan builds a plan')
  assert.deepEqual(coreGaps(unlicensed()), [], 'sign-in records a licence withholds were not there to read: not a gap')
  assert.deepEqual([...CORE_SOURCES], ['config:caPolicies', 'users', 'signInEvidence'])
})

test('a token without the roles does not start the scan and names the role to ask for; Global Reader, Global Administrator or Security Reader start it; a token without the claim says nothing', () => {
  assert.deepEqual(rolesInToken(noRolesToken()), [USER_ROLE_ID])
  const gap = coreRoleGap(rolesInToken(noRolesToken()))
  assert.ok(gap, 'the User role reads none of the core sections')
  assert.deepEqual(gap.sources, ['config:caPolicies', 'users', 'signInEvidence'])
  assert.deepEqual(gap.ask, ['Security Reader'], 'one role reads all three; it is the ask')
  assert.equal(gap.covering, READ_EVERYTHING_ROLE)
  for (const role of [READ_EVERYTHING_ROLE, 'Global Administrator', 'Security Reader']) assert.equal(coreRoleGap(rolesInToken(tokenWithRoles([role]))), null, `${role} starts the scan`)
  const ca = coreRoleGap(rolesInToken(tokenWithRoles(['Conditional Access Administrator'])))
  assert.deepEqual(ca?.sources, ['users', 'signInEvidence'], 'the policies read; the people and the records do not')
  assert.deepEqual(ca?.ask, ['Security Reader'])
  const readers = coreRoleGap(rolesInToken(tokenWithRoles(['Directory Readers', 'Reports Reader'])))
  assert.deepEqual(readers?.sources, ['config:caPolicies'])
  assert.deepEqual(readers?.ask, ['Security Reader'])
  assert.equal(rolesInToken(tokenWithoutClaim()), null)
  assert.equal(coreRoleGap(null), null, 'no claim: the gate has nothing to act on; the scan runs and its gaps decide')
  assert.equal(rolesInToken('not-a-token'), null)
})

test('the Plan tile never renders an empty window: the sign-in records fact reads not read when the records were not read', () => {
  const fact = (s: TenantSnapshot): string => planTile({ kind: 'ready', snapshot: s, at: s.asOf, counts: null }).facts?.[2].value ?? ''
  assert.match(fact(fixtureSnapshot()), /^[A-Z][a-z]{2} \d+ → [A-Z][a-z]{2} \d+$/)
  for (const s of [gapsSnapshot(), unlicensed()]) assert.equal(fact(s), 'not read')
  assert.equal(planTile({ kind: 'ready', snapshot: gapsSnapshot(), at: gapsSnapshot().asOf, counts: null }).facts?.[1].value, '0', 'a scan without the section counts no policies')
})
