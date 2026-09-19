import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { rowWho } from './rowWho.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'

const f = fixture('demo')
const run = runFixture(f, {}, null, f.snapshot.asOf)
const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: id => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }

test('MFA preparation row and evidence lead identify the whole cohort before subgroup counts', () => {
  const step = structuredClone(run.steps.find(s => s.id === 's-verify-mfa')!)
  // Guests stay in the MFA campaign (owner, 2026-09-19): the demo's one guest is
  // in the cohort, and both headlines name it beside the people.
  assert.equal(step.preparation!.ids.length, 31)
  assert.equal(step.preparation!.guestIds.length, 1)
  const guest = step.preparation!.guestIds[0]
  assert.equal(f.snapshot.users.find(u => u.id === guest)?.userType, 'guest')
  assert.ok(step.preparation!.ids.includes(guest), 'the guest is in the cohort')
  assert.equal(rowWho(step), '30 people and 1 guest')
  assert.equal(stepBodyOf(step, ctx).lead, '30 people and 1 guest are included in this preparation step.')
  // A quiet account can still require preparation; an activity-only population
  // must not silently remove it from either headline.
  step.preparation!.ids.push('quiet-target-account')
  assert.equal(rowWho(step), '31 people and 1 guest')
  assert.equal(stepBodyOf(step, ctx).lead, '31 people and 1 guest are included in this preparation step.')
  step.preparation!.ids = ['quiet-target-account']
  assert.equal(rowWho(step), '1 person')
  assert.equal(stepBodyOf(step, ctx).lead, '1 person is included in this preparation step.')
  step.preparation!.ids = [guest]
  assert.equal(rowWho(step), '1 guest')
  assert.equal(stepBodyOf(step, ctx).lead, '1 guest is included in this preparation step.')
  step.preparation!.ids = ['quiet-target-account', guest]
  assert.equal(rowWho(step), '1 person and 1 guest')
  assert.equal(stepBodyOf(step, ctx).lead, '1 person and 1 guest are included in this preparation step.', 'a subject of two counts keeps the plural verb')
  step.preparation!.ids = []
  assert.equal(rowWho(step), 'User Authentication', 'empty preparation uses the topic rather than a stale activity count')
})

test('a directory inventory of one guest is singular in both the tile and evidence', () => {
  const snapshot = structuredClone(f.snapshot)
  const guest = snapshot.users.find(u => u.userType === 'guest')!
  snapshot.users = snapshot.users.filter(u => u.userType !== 'guest' || u.id === guest.id)
  const step = run.steps.find(s => s.id === 's-goal-guests-mfa')!
  const body = stepBodyOf(step, { ...ctx, snapshot })
  assert.equal(body.allTiles.find(t => t.key === 'directory-inventory')?.value, '1 guest')
  assert.match(body.contract.found.find(f => f.key === 'directory-inventory')!.text, /^1 guest account\./)
})
