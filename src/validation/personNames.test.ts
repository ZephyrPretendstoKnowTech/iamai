// The emergency-access checks name accounts by the one naming rule (names.ts
// personLabels): a display name another account shares carries its address.
// Every other surface did since the hygiene branch; the validation findings on
// the frozen Emergency Access steps still printed the bare display name, so two
// accounts called "Kai Brown" read the same in one finding.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { buildContext, reportFor } from './report.ts'

test('an emergency account is labelled with its address only where another account shares its display name', () => {
  const f = structuredClone(fixture('small'))
  const run0 = runFixture(f)
  const bg = run0.input.mapping.breakGlassUserIds[0] ?? f.snapshot.users[0].id
  const other = f.snapshot.users.find((u) => u.id !== bg && u.userPrincipalName)!
  const mine = f.snapshot.users.find((u) => u.id === bg)!
  other.displayName = mine.displayName
  const run = runFixture(f)
  const ctx = buildContext({ snapshot: f.snapshot, state: run.input.mapping, groupMembers: [], viability: run.viability })
  const report = reportFor('breakGlass', [bg], ctx)
  const label = report.targets[0].label
  assert.notEqual(label, mine.displayName, `a shared display name is printed bare: ${label}`)
  assert.ok(mine.userPrincipalName && label.includes(mine.userPrincipalName), `the label carries the address: ${label}`)
  // An account whose display name is its own keeps the name alone.
  const own = fixture('small')
  const ownRun = runFixture(own)
  const ownId = ownRun.input.mapping.breakGlassUserIds[0] ?? own.snapshot.users[0].id
  const unique = own.snapshot.users.find((u) => u.id === ownId)!
  assert.equal(own.snapshot.users.filter((u) => u.displayName === unique.displayName).length, 1, 'the premise: the name is unique')
  const ownCtx = buildContext({ snapshot: own.snapshot, state: ownRun.input.mapping, groupMembers: [], viability: ownRun.viability })
  assert.equal(reportFor('breakGlass', [ownId], ownCtx).targets[0].label, unique.displayName)
})
