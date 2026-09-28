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
import { gateNamedIds } from './stepContract.ts'
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
  assert.match(src, /scopedIds\.has\(r\.user\.id\) \? personNextOf\(snapshot, snapshot\.asOf, mapping, r\.user\.id, true\) : nextCell\(r\)/)
  // Exactly the people the card names (review, 2026-09-28): nobody when it names nobody,
  // the unplaced it leaves out keep the page's words, and those it names keep the card's
  // even where the page cannot read their sign-ins.
  assert.match(src, /new Set\(context\?\.cardIds \?\? \[\]\)/)
  assert.match(src, /cardIds: gateNamedIds\(step, null\)/)
  assert.deepEqual([...gateNamedIds(step, null)].sort(), held.filter((id) => !(step.methodPreparation?.readyIds ?? []).includes(id) && !(step.methodPreparation?.unknownIds ?? []).filter((u) => !(step.methodPreparation?.staleIds ?? []).includes(u)).includes(id)).sort(), 'the card names someone the step does not hold, or leaves someone out')
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

test('with the sign-ins unread, the people the device step\'s card names keep the card\'s words on the page (review of F-072)', () => {
  // Review, 2026-09-28: the page's state for them is "unknown" when sign-ins are unread,
  // but the card names them from the registration report, which does not need sign-ins.
  const f = structuredClone(fixture('demo'))
  if (f.snapshot.sources.signInEvidence) f.snapshot.sources.signInEvidence = { ...f.snapshot.sources.signInEvidence, status: 'error' }
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const step = r.steps.find((s) => s.id === 's-goal-device-registration-mfa')!
  const named = gateNamedIds(step, null)
  const rows = readinessView(f.snapshot, f.snapshot.asOf, f.mapping).rows
  const unread = named.filter((id) => rows.find((x) => x.user.id === id)?.state === 'unknown')
  assert.ok(unread.length > 0, 'the premise: the card names someone the page cannot place without sign-ins')
  // The page gives every one of them the card's words (the source test above pins that it reads cardIds).
  for (const id of unread) assert.notEqual(personNextOf(f.snapshot, f.snapshot.asOf, f.mapping, id, true), '')
})
