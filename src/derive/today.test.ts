// Today's counts add up (prompt 47 Part 5): every enabled person is in
// exactly one state; the three shares are over active people; not active is
// listed, never counted.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../ui/pages/fixtureSnapshot.ts'
import { bigFixtureSnapshot } from '../ui/pages/bigFixture.ts'
import { todayView } from './today.ts'
import { TODAY } from '../copy/today.ts'

test('every enabled person is one row in one state, and the tiles partition them', () => {
  for (const snapshot of [fixtureSnapshot(), bigFixtureSnapshot()]) {
    const v = todayView(snapshot, snapshot.asOf)
    assert.equal(v.rows.length, v.counts.enabled, 'one row per enabled person')
    assert.equal(v.tiles.active, v.counts.active, 'the active count is the rollout denominator')
    assert.equal(v.tiles.notActive, v.counts.notActive, 'not active is the remainder')
    assert.equal(v.tiles.proven + v.tiles.unproven + v.tiles.noMethod, v.tiles.active, 'the three shares partition the active people')
    for (const r of v.rows) {
      if (r.state === 'notActive') assert.equal(r.bucket, null, `${r.user.id}: not active has no share`)
      else assert.ok(r.bucket !== null, `${r.user.id}: an active person is in a share`)
      if (r.state === 'proven') assert.equal(r.evidence.kind, 'mfa', `${r.user.id}: proven means seen`)
    }
  }
})

test('the header line has branches for nobody enabled, one admin, no admins and no records', () => {
  assert.equal(TODAY.line({ active: 4, enabled: 12, admins: 2 }, 'Jul 30 → Aug 29', null), '4 active people of 12 enabled · 2 admins · sign-ins Jul 30 → Aug 29')
  assert.equal(TODAY.line({ active: 1, enabled: 1, admins: 1 }, null, null), '1 active person of 1 enabled · 1 admin · no sign-in records')
  assert.equal(TODAY.line({ active: 0, enabled: 0, admins: 0 }, null, 'needs Entra ID P1 or P2'), 'no enabled people · no admins · no sign-in records (needs Entra ID P1 or P2)')
  assert.equal(TODAY.share(3, 4), '3 · 75%')
  assert.equal(TODAY.share(0, 0), '0')
})
