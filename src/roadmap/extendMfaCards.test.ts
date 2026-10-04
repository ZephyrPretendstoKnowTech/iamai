// Extend MFA Coverage's readiness cards (owner decision 5, 2026-09-25): one card
// for one fact. Protect Sign-in Method Registration's percentage and its people
// without a method are one Threshold card that names each person short of a
// method, with MFA Readiness's next step; every card in the section that names
// people opens MFA Readiness on them.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { pages } from '../content/content.ts'

test('Protect Sign-in Method Registration has one readiness card, naming each person short of a method, and it opens MFA Readiness', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  for (const id of ['s-goal-register-info-protected', 's-goal-device-registration-mfa']) {
    const step = run.steps.find((s) => s.id === id)!
    const tiles = stepBodyOf(step, ctx).readiness?.tiles ?? []
    assert.equal(tiles.some((t) => t.key === 'readiness:registration-coverage'), false, `${id}: a second card for the people without a method`)
    const gate = tiles.find((t) => t.key === 'gate')
    assert.ok(gate, `${id}: the Threshold card`)
    const p = step.methodPreparation!
    const short = p.ids.filter((x) => !p.readyIds.includes(x) && !p.unknownIds.includes(x) && x.toLowerCase() !== (f.operatorId ?? '').toLowerCase())
    assert.ok(short.length > 0, `${id}: the premise, somebody is short`)
    assert.equal((gate.names ?? []).length, short.length, `${id}: each person short is named`)
    assert.ok((gate.names ?? []).every((l) => /^.+ \(.+\): .+$/.test(l)), `${id}: with their next step`)
    assert.deepEqual(gate.link, { label: 'Open MFA Readiness', href: `#/readiness/step/${id}` })
  }
})

// F-111: the view MFA Readiness opens on the admins said nobody could be seamless
// because "everyone signs in from a device with no built-in option …, such as a
// personal computer", a cause the reading does not establish. The admin gate's card
// keeps opening the campaign that gets its admins ready (walk list 4.x item 42,
// owner 2026-09-24), and that campaign's card is the hand-off to MFA Readiness.
test('the admin MFA step’s Threshold card opens the campaign, whose card opens MFA Readiness; the seamless line names no cause', () => {
  const f = fixture('small')
  const run = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const gate = (stepBodyOf(run.steps.find((s) => s.id === 's-goal-admins-phishing-resistant')!, ctx).readiness?.tiles ?? []).find((t) => t.key === 'gate')
  assert.ok(gate && (gate.names ?? []).length > 0, 'the premise: the admin gate names its admins')
  assert.equal(gate.link && 'href' in gate.link ? gate.link.href : null, '#/plan/s-verify-mfa')
  const campaign = stepBodyOf(run.steps.find((s) => s.id === 's-verify-mfa')!, ctx)
  const handOff = JSON.stringify(campaign)
  assert.ok(handOff.includes('#/readiness/step/s-verify-mfa'), 'the campaign opens MFA Readiness')
  const line = (pages.readiness as unknown as { seamlessNotPossible: string }).seamlessNotPossible
  assert.doesNotMatch(line, /personal computer|everyone signs in|built-in option/)
  assert.match(line, /row/)
})
