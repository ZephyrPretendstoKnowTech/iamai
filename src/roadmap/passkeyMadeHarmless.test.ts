// Configure Passkey Authentication, finished (owner audit, 2026-09-24): the
// Existing passkeys affected card read "No existing passkey stops working under
// this change." on a step whose change was already made. Applied, and it stopped
// nobody's passkey, the card says nothing; before it is applied the line stands.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { FixtureName } from './fixtures/index.ts'
import { journeyPasskeyFindings } from './emergencyJourney.ts'
import { passkeyReadingOf } from './passkeySettings.ts'
import { affectedPasskeysByProposedChange } from './passkeyCompatibility.ts'

const LINE = 'No existing passkey stops working under this change.'

test('an applied passkey change that stopped no passkey draws no Existing passkeys affected card; unapplied, it says so', () => {
  const seen = { applied: 0, pending: 0 }
  for (const name of ['micro', 'small', 'getiamai', 'mid', 'messy', 'midflight', 'demo', 'demo-week2'] as FixtureName[]) {
    const f = fixture(name)
    const affected = affectedPasskeysByProposedChange(f.snapshot, f.mapping, f.groups)
    if (affected.state !== 'known' || affected.users.length > 0) continue
    const finding = journeyPasskeyFindings(f.snapshot, f.mapping, f.groups).find((x) => x.key === 'affected-passkeys')
    if (passkeyReadingOf(f.snapshot, f.mapping).state === 'inPlace') {
      seen.applied++
      assert.equal(finding, undefined, `${name}: ${finding?.value}`)
    } else {
      seen.pending++
      assert.equal(finding?.value, LINE, name)
    }
  }
  assert.ok(seen.applied > 0, `the premise: a sample applied the change harmlessly (${JSON.stringify(seen)})`)
})
