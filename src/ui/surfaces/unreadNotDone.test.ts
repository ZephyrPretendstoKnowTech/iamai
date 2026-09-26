// An unread check on Establish Emergency Access reads as the work not done
// (owner, 2026-09-24; net-new 1 and 2): its card states the task that does the
// work, in the task's own words, and never "Could not verify", "Missing scan
// evidence", "not established" or "check incomplete".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allCuratedFixtures, curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { EMERGENCY_TASK } from '../../roadmap/emergencyTaskTitles.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'

const EMERGENCY = ['s-prereq-break-glass', 's-prereq-exclusion-group', 's-prereq-passkey-settings']
const UNREAD = /Could not verify|Missing scan evidence|not established|Not fully verified|Not checked yet|check incomplete|Not read\b|Not fully read/i

test('no Establish Emergency Access card or account says it could not read, on any fixture', () => {
  for (const f of allCuratedFixtures()) {
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const step of r.steps.filter((s) => EMERGENCY.includes(s.id))) {
      const body = stepBodyOf(step, ctx)
      const said = JSON.stringify([body.readiness, body.emergencyAccountTasks?.accounts ?? []])
      assert.doesNotMatch(said, UNREAD, `${f.name}/${step.id}`)
    }
  }
})

test('hostile: registered methods unread, 1.1 says each account needs its approved passkey and names the task', () => {
  const f = curatedFixture('hostile')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-prereq-break-glass')!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const body = stepBodyOf(step, ctx)
  const card = body.readiness.tiles.find((t) => t.key === 'configuration:recovery-methods')
  assert.ok(card, 'the premise: the passkey card is open')
  assert.equal(card.value, EMERGENCY_TASK.setUpPasskey)
  const accounts = (body.emergencyAccountTasks?.accounts ?? []).filter((a) => a.accountId !== null)
  assert.ok(accounts.length > 0 && accounts.every((a) => a.title === 'Approved passkey needed'))
  assert.equal(body.emergencyAccountTasks?.recommendedTaskId, 'set-up-passkey')
})

test('an emergency account sharing its Authenticator device says so on its card, as the fact alone, and the note holds nothing (owner audit)', () => {
  const f = curatedFixture('getiamai')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-prereq-break-glass')!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const accounts = stepBodyOf(step, ctx).emergencyAccountTasks?.accounts ?? []
  const shared = accounts.filter((a) => (a.notes ?? []).some((n) => /SM-S918U/.test(n.value)))
  assert.equal(shared.length, 2, 'the premise: both getiamai emergency accounts share one phone')
  // The fact alone (owner, 2026-09-26): no instruction, and no "usually means the same phone".
  for (const a of shared) assert.ok(a.notes!.some((n) => /^The Authenticator device "SM-S918U" is also registered by [^:]+[^.]\.$/.test(n.value)), JSON.stringify(a.notes))
  // Its label names the finding, not the rule it fails ("No two emergency accounts share...").
  for (const a of shared) assert.ok(a.notes!.some((n) => n.label === 'Shared Authenticator device' && /SM-S918U/.test(n.value)), JSON.stringify(a.notes))
})
