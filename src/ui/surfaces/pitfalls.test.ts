// Round 1's pitfalls on Prepare Your Team for MFA (owner, 2026-09-24): the card
// names everyone not ready with MFA Readiness's own next step, five on the card
// and the rest under its fold; Temporary Access Pass off is a card where people
// with no method need one; and the people whose only method is a text or a call
// are named, because Microsoft retires both. Nothing on a finished step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { CAMPAIGN_STEP_ID } from '../../roadmap/followUp.ts'
import { smsRetirementOf } from '../../derive/smsRetirement.ts'
import { readinessContextOf } from '../../derive/readinessContext.ts'
import { readinessOf, stepContract } from './stepContract.ts'
import { prepareReadingOf } from './prepareSteps.ts'
import { readinessNextOf } from './personNext.ts'
import { pitfallTilesOf } from './pitfalls.ts'
import type { StepVarContext } from './stepVars.ts'

function campaign(f: Fixture) {
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === CAMPAIGN_STEP_ID)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { step, ctx, tiles: readinessOf(step, stepContract(step, ctx)).tiles }
}

test('3.4 names everyone not ready with their next step on MFA Readiness: five on the card, the rest under its fold, and the link kept', () => {
  const { step, ctx } = campaign(curatedFixture('demo'))
  const missing = step.preparation!.missingIds
  assert.ok(missing.length > 5, 'the premise: the demo has more than five people not ready')
  const card = prepareReadingOf(step, ctx, false)!.card!
  const shown = card.detail.split('\n')
  assert.equal(shown.length, 5, 'five on the card')
  const lines = [...shown, ...(card.more ?? [])]
  assert.equal(lines.length, missing.length, 'everyone named, nobody twice')
  const next = readinessNextOf(ctx.snapshot, ctx.now, ctx.mapping)
  let worded = 0
  for (const id of missing) {
    const n = next.get(id)
    if (!n) continue
    worded++
    assert.ok(lines.some((l) => l.includes(ctx.nameOf(id)) && l.endsWith(`: ${n}`)), `${id}: named with MFA Readiness's own next step`)
  }
  assert.ok(worded > 0, 'the page words at least one of them')
  assert.doesNotMatch(lines.join('\n'), /MFA Readiness lists each one/, 'no pointer in place of the names')
  assert.equal(card.link?.href, `#/readiness/step/${CAMPAIGN_STEP_ID}`, 'the card still opens MFA Readiness')
})

test('Temporary Access Pass off is a card while people with no method need it, and goes when it is on', () => {
  const f = curatedFixture('demo')
  const off = campaign(f).tiles.find((t) => t.key === 'pitfall:tap-off')
  assert.ok(off, 'the demo reads Temporary Access Pass off')
  assert.match(off.value, /^Off, and \d+ (person has|people have) no method to register with$/)
  assert.match(off.note ?? '', /Temporary Access Pass, select Enable, include All users/, 'it says how to turn it on, as plain text: a card draws no bold')
  // The same tenant with Temporary Access Pass on draws no card.
  const snapshot = structuredClone(f.snapshot)
  const row = snapshot.config.authMethodsPolicy!.rows![0] as { authenticationMethodConfigurations?: { id?: string; state?: string }[] }
  const tap = (row.authenticationMethodConfigurations ?? []).find((c) => c.id?.toLowerCase() === 'temporaryaccesspass')
  if (tap) tap.state = 'enabled'
  else row.authenticationMethodConfigurations = [...(row.authenticationMethodConfigurations ?? []), { id: 'TemporaryAccessPass', state: 'enabled' }]
  assert.equal(campaign({ ...f, snapshot }).tiles.find((t) => t.key === 'pitfall:tap-off'), undefined)
})

test('the people whose only method is a text or a call are named, with the retirement and the fix', () => {
  const { step, ctx, tiles } = campaign(curatedFixture('demo'))
  const only = smsRetirementOf(ctx.snapshot, step.preparation!.ids, readinessContextOf(ctx.snapshot, ctx.mapping, ctx.now).windowStart).people.filter((p) => p.onlySmsVoice).map((p) => p.userId)
  assert.ok(only.length > 0, 'the premise: the demo holds someone with text or call only')
  const tile = tiles.find((t) => t.key === 'pitfall:text-only')
  assert.ok(tile)
  assert.equal(tile.names?.length, only.length)
  for (const id of only) assert.ok(tile.names!.some((l) => l.includes(ctx.nameOf(id))), `${id} is named`)
  assert.match(tile.note ?? '', /February 1, 2027/)
  assert.match(tile.note ?? '', /Set each one up now with the method named beside them\./, "the fix is each person's own next step, never a second instruction")
})

test('a finished step draws no pitfall card', () => {
  const { step, ctx } = campaign(curatedFixture('demo'))
  assert.deepEqual(pitfallTilesOf(step, ctx, true), [])
  assert.deepEqual(pitfallTilesOf({ ...step, status: 'done' }, ctx, false), [])
})
