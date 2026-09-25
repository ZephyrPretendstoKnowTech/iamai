// Require MFA to Register a Device (5.2), Phase 3 (owner, 2026-09-25):
// - it counts no guest: a device registers in the tenant of the account doing it,
//   which for a guest is their own (owner decision 1);
// - a method on the device being registered does not count, because Microsoft
//   does not support Windows Hello for Business or a device-bound passkey for
//   Register or join devices, and the card names a passkey in Microsoft
//   Authenticator instead (owner decision 2);
// - the tenant-wide device-registration MFA setting is a line of the create only
//   where the scan reads it Yes, and nothing asks to confirm what the scan reads;
// - its cards state facts, and only true ones.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withDirectionApproved } from './fixtures/run.ts'
import { readinessOf, stepContract } from '../ui/surfaces/stepContract.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'

const DEVICE = 's-goal-device-registration-mfa'
const REGISTRATION = 's-goal-register-info-protected'

function opened(f: Fixture, id = DEVICE): { step: Step; ctx: StepVarContext; steps: Step[] } {
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === id)
  assert.ok(step, `${id} is on the plan`)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { step, ctx, steps: run.steps }
}

test('5.2 counts no guest', () => {
  const f = withDirectionApproved(curatedFixture('demo-week2'))
  const { step, steps } = opened(f)
  const guests = new Set(f.snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id))
  // The premise: another step's readiness counts guests the same scan reads.
  const guestsCounted = steps.flatMap((s) => (s.id === DEVICE ? [] : (s.methodPreparation?.ids ?? []))).filter((id) => guests.has(id))
  assert.ok(guestsCounted.length > 0, 'the premise: a guest is counted elsewhere')
  const ids = step.methodPreparation?.ids ?? []
  assert.ok(ids.length > 0, 'the premise: 5.2 counts people')
  assert.equal(ids.filter((id) => guests.has(id)).length, 0, 'a guest is counted on 5.2')
})

test('Windows Hello alone does not count for 5.2, and the card names a passkey in Microsoft Authenticator instead', () => {
  const f = structuredClone(fixture('mid'))
  const before = opened(structuredClone(f)).step
  // Not the signed-in account, which has its own card (walk list 4.x item 43).
  const id = (before.methodPreparation?.ids ?? []).find((x) => x.toLowerCase() !== (f.operatorId ?? '').toLowerCase())
  assert.ok(id, 'the premise: 5.2 counts someone')
  const row = f.snapshot.registrationDetails.find((r) => r.id === id)
  assert.ok(row, 'the premise: their registration is read')
  row.methodsRegistered = ['windowsHelloForBusiness']
  row.isMfaCapable = true
  const device = opened(f)
  const registration = opened(f, REGISTRATION).step
  assert.ok((registration.methodPreparation?.readyIds ?? []).includes(id), 'the premise: Windows Hello answers registering a sign-in method')
  assert.equal((device.step.methodPreparation?.readyIds ?? []).includes(id), false, 'Windows Hello answers registering the device it is on')
  const gate = readinessOf(device.step, stepContract(device.step, device.ctx)).tiles.find((t) => t.key === 'gate')
  assert.ok(gate, 'the threshold card')
  const person = f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const line = (gate.names ?? []).find((l) => l.startsWith(`${person} (`))
  assert.ok(line, `${person} is not named`)
  assert.match(line, /: Set up a passkey in Microsoft Authenticator$/)
  assert.equal((gate.names ?? []).some((l) => /Windows Hello|Platform SSO/.test(l)), false, (gate.names ?? []).join(' | '))
  assert.match(gate.note ?? '', /A passkey on the device being registered can't answer this policy: register a new computer with the phone passkey, and a new phone with a Temporary Access Pass\./)
})

test('the device-registration MFA setting is a line of the create only where the scan reads it Yes; nothing asks to confirm it', () => {
  const setting = /Require multifactor authentication to register or join devices with Microsoft Entra/
  const f = structuredClone(fixture('getiamai'))
  const off = opened(f)
  const createOff = stepBodyOf(off.step, off.ctx).emergencyAccountTasks?.tasks.find((t) => t.id === 'create')
  assert.ok(createOff, 'the create task')
  assert.equal(createOff.steps.some((l) => setting.test(l)), false, 'read No, the create names the setting')
  ;(f.snapshot.config as Record<string, unknown>).deviceRegistrationPolicy = { status: 'ok', reason: null, rows: [{ id: 'deviceRegistrationPolicy', multiFactorAuthConfiguration: 'required' }] }
  const on = opened(f)
  const createOn = stepBodyOf(on.step, on.ctx).emergencyAccountTasks?.tasks.find((t) => t.id === 'create')
  assert.ok(createOn, 'the create task')
  assert.match(createOn.steps[0], /^In Entra ID → Devices → Overview → Device settings, set Require multifactor authentication to register or join devices with Microsoft Entra to No\. It reads Yes/)
  for (const s of [off, on]) {
    assert.equal(stepContract(s.step, s.ctx).doneWhen.some((l) => setting.test(l) || /legacy/i.test(l)), false, 'a completion line IAMAI does not check')
    const tiles = [...(stepBodyOf(s.step, s.ctx).readiness?.tiles ?? []), ...(stepBodyOf(s.step, s.ctx).readiness?.satisfied ?? [])]
    assert.equal(tiles.some((t) => /Enforcement checks|Confirm/.test(`${t.label} ${t.note ?? ''}`)), false, 'a card asks to confirm what the scan reads')
  }
})

test("5.2's cards state facts, and only true ones: the group and the strength, and no create card once it is in place", () => {
  const f = structuredClone(fixture('getiamai'))
  const open = opened(f)
  const satisfied = stepBodyOf(open.step, open.ctx).readiness?.satisfied ?? []
  assert.match(satisfied.find((t) => t.key === 'readiness.exclusions')?.note ?? '', /^.+ is left out of it\.$/)
  assert.equal(satisfied.find((t) => t.key === 'readiness.authentication-strength')?.note, 'It requires Modern MFA + TAP.')
  // In place: the plan's own policy, On.
  const op = open.step.action.resolution!.policies![0]
  ;(f.snapshot.config.caPolicies as { rows: unknown[] }).rows.push({ ...structuredClone(op.body), id: 'tenant-device-registration', displayName: 'Tenant device registration', state: 'enabled', createdDateTime: '2026-01-01T00:00:00Z', modifiedDateTime: '2026-01-01T00:00:00Z' })
  const done = opened(f)
  assert.equal(done.step.status, 'done', 'the premise: in place')
  const tiles = stepBodyOf(done.step, done.ctx).readiness?.tiles ?? []
  assert.equal(tiles.some((t) => t.key.startsWith('readiness.')), false, tiles.map((t) => `${t.label}: ${t.note}`).join(' | '))
})
