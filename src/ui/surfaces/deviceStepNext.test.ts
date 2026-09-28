// F-072 (owner, 2026-09-28): the same person was given different next steps on
// Require MFA to Register a Device ("set up a passkey in Microsoft Authenticator"), on
// the MFA Readiness it opened ("Set up Windows Hello for Business", which cannot answer
// a device registration) and on Prepare Your Team for MFA (whose instruction named a
// third). One reading now: personNextOf, which the step's card and the scoped page read.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { readinessView } from '../../derive/mfaReadiness.ts'
import { stepMfaHold } from '../../derive/stepMfaReadiness.ts'
import { nextCell } from './readinessCells.ts'
import { personNextOf } from './personNext.ts'
import { stepById } from '../../content/content.ts'

test('opened from Require MFA to Register a Device, MFA Readiness reads each held person\'s next step as the step\'s card states it', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-goal-device-registration-mfa')!
  const hold = stepMfaHold(step, r.viability ?? [])
  const held = hold?.ids ?? []
  assert.ok(held.length > 0, 'the premise: the step holds people')
  const rows = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows
  const differ = held.filter((id) => { const row = rows.find((x) => x.user.id === id); return row && nextCell(row) !== personNextOf(f.snapshot, f.snapshot.asOf, f.mapping, id, true) })
  assert.ok(differ.length > 0, 'the premise: the page\'s own next step differs from the card\'s for someone the step holds')
  // The page reads the card's words for the people a device-registration step holds: the row, the drawer and the CSV.
  const src = readFileSync(new URL('./MfaReadiness.tsx', import.meta.url), 'utf8')
  assert.match(src, /scopedIds\.has\(r\.user\.id\) && r\.state !== 'unknown' \? personNextOf\(snapshot, snapshot\.asOf, mapping, r\.user\.id, true\) : nextCell\(r\)/, "someone the page cannot place keeps the page's own words (the card names nobody unplaced)")
  // Only while the step holds people: with nobody held, the page is the whole cohort and the card names no one (review, 2026-09-28).
  assert.match(src, /new Set\(context\?\.registersDevice && context\.held \? context\.ids \?\? \[\] : \[\]\)/)
  // The search and the filtered CSV match the words the row shows.
  assert.match(src, /const findIn = \(r: ReadinessRow\): string => searchText\(r, scopedIds\.has\(r\.user\.id\) \? nextOf\(r\) : undefined\)/)
  assert.match(src, /\(!q \|\| findIn\(r\)\.includes\(q\)\)/)
  assert.match(src, /\{nextOf\(r\)\}/, 'the row')
  assert.match(src, /<strong>\{nextOf\(openRow\)\}<\/strong>/, 'the drawer')
  assert.match(src, /rowCells\(r, nextOf\(r\)\)/, 'the CSV')
  assert.doesNotMatch(src, /\{nextCell\(r\)\}|\{nextCell\(openRow\)\}/, 'a place still reads the page\'s own words')
})

test('a guest keeps the guest rule on a device-registration step: passkeys do not work for guests yet', () => {
  const f = fixture('demo')
  const rows = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows
  const guest = rows.find((row) => row.guest && row.state !== null && row.state !== 'unknown')
  assert.ok(guest, 'the premise: the sample has a counted guest')
  assert.equal(personNextOf(f.snapshot, f.snapshot.asOf, f.mapping, guest.user.id, true), nextCell(guest))
})

test('Prepare Your Team for MFA points anyone on text or call only to the method named beside them, never a third', () => {
  const steps = ((stepById['s-verify-mfa'] as unknown as { whatToDo: { steps: string[] } }).whatToDo.steps)
  const line = steps.find((l) => l.startsWith('Anyone on text or call only'))
  assert.equal(line, 'Anyone on text or call only: set up the method named beside them, the same way.')
})
