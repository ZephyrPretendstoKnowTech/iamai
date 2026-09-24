// Connect's three refusals: a scan that could not read a core section builds
// and stores no plan (coreSections.ts); a token without the roles does not
// start the scan and names the role to ask for (tokenRoles.ts); the Plan tile's
// facts never render an empty window (connectView.ts). On the fixture whose token
// lacks the roles and whose scan lacks the policies section (testing/gapsFixture.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../../testing/uiSnapshot.ts'
import { REFUSED, USER_ROLE_ID, gapsSnapshot, noRolesToken, tokenWithRoles, tokenWithoutClaim } from '../../testing/gapsFixture.ts'
import { CORE_SOURCES, coreGaps, unreadSources } from './coreSections.ts'
import { coreRoleGap, rolesInToken } from './tokenRoles.ts'
import { READ_EVERYTHING_ROLE } from './roles.ts'
import { sourceUnreadOf } from '../../roadmap/evidence.ts'
import type { TenantSnapshot } from './types.ts'

const unlicensed = (): TenantSnapshot => {
  const s = fixtureSnapshot()
  s.sources.signInEvidence = { status: 'disabled', coveredWindow: null, reason: 'not available on this licence (needs Entra ID P1)', asOf: s.asOf }
  s.signInEvidence = {}
  return s
}

test('a missing core section is a gap with the roles that read it; a partial read builds a plan and is never counted as read; a licence gate is neither', () => {
  // a scan without its policies section or its sign-in records ends with gaps, listed with the roles that read them; a full scan and a licence gate have none
  {
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
  }

  // a core section read in part still builds a plan, and is never counted as read: unreadSources names it, marked partly read
  // S4-7: a core section read in PART used to count as read, so Connect said the
  // scan was complete and the plan was built from a policy list with a policy
  // missing — the enforced policy IAMAI did not see reads exactly like one the
  // tenant does not have, and the plan says to create it. The plan is still
  // built (a partial read returned real rows, and refusing would leave the
  // operator with nothing), but it is never counted as read.
  {
    const partial = (): TenantSnapshot => {
      const s = fixtureSnapshot()
      s.config.caPolicies = { ...s.config.caPolicies, status: 'partial', reason: 'one policy could not be read' }
      s.sources.users = { ...s.sources.users, status: 'partial', reason: 'some pages failed' }
      return s
    }
    const s = partial()
    assert.deepEqual(coreGaps(s), [], 'a partly read core section is not a gap: what came back still builds a plan')
    assert.deepEqual(unreadSources(s), [
      { source: 'config:caPolicies', partial: true, refused: false },
      { source: 'users', partial: true, refused: false },
    ])
    // Both loops agree on one meaning of read: a configuration section and a
    // source in the same state are reported the same way.
    assert.deepEqual(unreadSources(fixtureSnapshot()), [], 'a scan that read everything reports nothing unread')
    // And a licence gate is still not a shortfall to chase: there was nothing to read.
    assert.deepEqual(unreadSources(unlicensed()), [])
  }
})

test('every unread section reaches the list, and Connect and the plan agree on what a partial sign-in read covered', () => {
  // every section a scan could not read reaches the list, core or not, gaps or none
  {
    const s = fixtureSnapshot()
    s.config.namedLocations = { ...s.config.namedLocations, status: 'error', reason: REFUSED }
    s.config.authStrengths = { ...s.config.authStrengths, status: 'error', reason: 'HTTP 500' }
    s.sources.devices = { ...s.sources.devices, status: 'error', reason: 'HTTP 429 TooManyRequests' }
    assert.deepEqual(coreGaps(s), [], 'no core section is missing: the plan is built')
    // Only Graph refusing the account is a refusal: an error or a throttled read is not the account's doing.
    assert.deepEqual(unreadSources(s), [
      { source: 'config:namedLocations', partial: false, refused: true },
      { source: 'config:authStrengths', partial: false, refused: false },
      { source: 'devices', partial: false, refused: false },
    ])
    // A sign-in read stopped short of its minimum with some hours covered returned those hours: read in part.
    s.sources.signInEvidence = { status: 'insufficient', reason: 'stopped at time budget with only 9 h covered (minimum 24 h)', coveredWindow: { from: '2026-09-07T15:00:00Z', to: '2026-09-08T00:00:00Z' }, asOf: s.asOf }
    assert.deepEqual(unreadSources(s).at(-1), { source: 'signInEvidence', partial: true, refused: false, coveredHours: 9 }, 'the hours it covered, from its covered window')
    s.sources.signInEvidence = { status: 'insufficient', reason: 'no sign-in records could be read', coveredWindow: null, asOf: s.asOf }
    assert.deepEqual(unreadSources(s).at(-1), { source: 'signInEvidence', partial: false, refused: false }, 'no hours covered: nothing was read')
  }

  // a sign-in read that covered some hours is read in part on Connect and a short window in the plan, whatever stopped it
  // Phase 2 review, round 1: Connect's unread list and the plan's evidence
  // (roadmap/evidence.ts sourceUnreadOf) each decided whether the sign-in records
  // were read in part, by two rules. A read interrupted by an error after it had
  // fetched some hours (laneBCore.ts: finalize('error') keeps the window it
  // covered) read "Sign-in records · not read" on Connect while the plan held
  // those hours as a short window. One rule decides both.
  {
    const covered = { from: '2026-09-07T12:00:00Z', to: '2026-09-08T00:00:00Z' }
    const s = fixtureSnapshot()
    s.sources.signInEvidence = { status: 'error', reason: 'HTTP 503 ServiceUnavailable', coveredWindow: covered, asOf: s.asOf }
    assert.deepEqual(unreadSources(s).at(-1), { source: 'signInEvidence', partial: true, refused: false, coveredHours: 12 }, 'an interrupted read that returned 12 hours is a read in part')
    for (const status of ['partial', 'insufficient', 'error', 'disabled'] as const) {
      for (const window of [covered, null]) {
        const t = fixtureSnapshot()
        t.sources.signInEvidence = { status, reason: status === 'disabled' ? REFUSED : 'stopped', coveredWindow: window, asOf: t.asOf }
        const row = unreadSources(t).find((u) => u.source === 'signInEvidence')
        assert.ok(row, `${status}, ${window ? 'hours covered' : 'no hours'}: listed as not read in full`)
        assert.equal(row.partial, sourceUnreadOf(t.sources.signInEvidence) === null, `${status}, ${window ? 'hours covered' : 'no hours'}: Connect and the plan disagree on whether any of it was read`)
      }
    }
  }
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
