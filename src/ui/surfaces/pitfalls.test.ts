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
import { personLines, readinessNextOf } from './personNext.ts'
import { unprovenIdsOf } from '../../derive/contentLists.ts'
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
  assert.deepEqual(pitfallTilesOf(step, ctx, true, () => undefined), [])
  assert.deepEqual(pitfallTilesOf({ ...step, status: 'done' }, ctx, false, () => undefined), [])
})

// 4.4: the people Require MFA for Everyone would prompt for the first time.
function stepAt(name: 'getiamai' | 'demo' | 'small', id: string) {
  const f = curatedFixture(name)
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === id)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { step, ctx, tiles: readinessOf(step, stepContract(step, ctx)).tiles }
}

test('4.4 names the people who hold a method and have no MFA sign-in in 30 days, with their next step, and opens 3.4; nothing once the policy is On', () => {
  const { step, ctx, tiles } = stepAt('getiamai', 's-goal-mfa-all-users')
  assert.notEqual(step.state.lifecycle, 'enforced', 'the premise: the policy is not On')
  const ids = unprovenIdsOf({ snapshot: ctx.snapshot, mapping: ctx.mapping, now: ctx.now })
  assert.ok(ids.length > 0, 'the premise: the fixture holds someone with a method and no MFA sign-in')
  const tile = tiles.find((t) => t.key === 'pitfall:unproven')
  assert.ok(tile)
  assert.match(tile.value, /have a method but no MFA sign-in in the last 30 days|has a method but no MFA sign-in in the last 30 days/)
  assert.deepEqual(tile.names, personLines(ctx, ids), 'each named with MFA Readiness’s next step')
  assert.match(tile.note ?? '', /^Before you turn this on, get each one signed in once with the method named beside them\. For a passkey: After the username, choose Other ways to sign in, then Face, fingerprint, PIN or security key\.$/)
  assert.ok(tile.link && 'href' in tile.link && tile.link.href.endsWith(CAMPAIGN_STEP_ID), 'it opens Prepare Your Team for MFA')
  // The policy On: every sign-in completes MFA, and the card goes.
  const on = stepAt('demo', 's-goal-mfa-all-users')
  assert.equal(on.step.state.lifecycle, 'enforced')
  assert.equal(on.tiles.find((t) => t.key === 'pitfall:unproven'), undefined)
})

test('4.3 names each admin it waits for with the method and device MFA Readiness gives, and its sentence says to sign in with that method', () => {
  const { ctx, tiles } = stepAt('small', 's-goal-admins-phishing-resistant')
  const gate = tiles.find((t) => t.key === 'gate')
  assert.ok(gate?.names?.length, 'the premise: small waits on admins')
  const next = readinessNextOf(ctx.snapshot, ctx.now, ctx.mapping)
  for (const line of gate.names) assert.match(line, /^.+ \(.+@.+\): .+$/, 'Name (address): next step')
  assert.ok(gate.names.some((line) => [...next.values()].some((n) => line.endsWith(`: ${n}`))), 'in MFA Readiness’s own words')
  assert.doesNotMatch(gate.names.join('\n'), /needs a passkey, security key or Windows Hello/, 'no generic line in place of the method')
  assert.match(gate.note ?? '', /^Get each one signed in once with the method named beside them\. For a passkey: After the username, choose Other ways to sign in, then Face, fingerprint, PIN or security key\. Prepare Your Team for MFA gets them ready\.$/)
})

test('4.4 names the accounts MFA Readiness sets aside as scripts, with the fix for a person and for a script', () => {
  const f = curatedFixture('getiamai')
  // One person the records show only at PowerShell: MFA Readiness sets them aside.
  const snapshot = structuredClone(f.snapshot)
  const id = Object.keys(snapshot.signInEvidence ?? {})[0]!
  snapshot.signInEvidence[id] = { ...snapshot.signInEvidence[id]!, apps: ['Microsoft Graph Command Line Tools'] }
  const run = runFixture({ ...f, snapshot })
  const step = run.steps.find((s) => s.id === 's-goal-mfa-all-users')!
  assert.notEqual(step.state.lifecycle, 'enforced', 'the premise: the policy is not On')
  const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups }
  const tile = readinessOf(step, stepContract(step, ctx)).tiles.find((t) => t.key === 'pitfall:script')
  assert.ok(tile, 'the account is named on the policy that will prompt it')
  assert.equal(tile.names?.length, 1)
  assert.ok(tile.names![0].includes(ctx.nameOf(id)))
  assert.match(tile.value, /^1 account signs in only from PowerShell or Graph tools$/)
  assert.match(tile.note ?? '', /Set a person up with their method; move a script that signs in with a password to an app registration before you turn this on\./)
})
