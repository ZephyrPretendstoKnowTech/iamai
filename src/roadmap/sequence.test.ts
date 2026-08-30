// Sequence safety (audit-program Layer C; guidance-audit-01 Part 4).
//
// Ordering rules that must hold for any tenant, expressed as properties over
// every fixture. Each one is a way somebody gets stranded if the plan runs in
// the wrong order, so a failure here is a safety failure and not a style
// question.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FIXTURE_SPECS, buildFixture, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { Step } from './types.ts'
import { READINESS_THRESHOLD_DEVICES_PERCENT } from './constants.ts'

const NAMES = FIXTURE_SPECS.map((s) => s.name)

const open = (s: Step): boolean => s.status !== 'done' && s.status !== 'skipped'
const offered = (s: Step): boolean => s.status === 'ready' || s.status === 'ready-to-enforce' || s.status === 'in-report-only'

for (const name of NAMES) {
  const { steps } = runFixture(fixture(name))
  const byId = new Map(steps.map((s) => [s.id, s]))
  const order = new Map(steps.map((s, i) => [s.id, i]))

  test(`${name}: nothing that can deny access is offered before the escape hatch is verified`, () => {
    const gates = steps.filter((s) => s.validationBlocker && open(s))
    if (gates.length === 0) return
    for (const s of steps) {
      if (s.denies !== true || !open(s)) continue
      // Ready is the state that invites action, so nothing deny-capable may sit
      // there. A policy the tenant already has in report-only reports reality
      // instead, and still has to carry the gate before it can be enforced.
      assert.notEqual(s.status, 'ready', `${s.id} is Ready while emergency access is unverified`)
      assert.ok(
        gates.some((g) => s.blockedBy.includes(g.id)),
        `${s.id} does not wait on the emergency-access step`,
      )
    }
  })

  test(`${name}: no step waits on an object whose own step is missing or later`, () => {
    for (const s of steps) {
      for (const id of s.blockedBy) {
        const dep = byId.get(id)
        assert.ok(dep, `${s.id} waits on ${id}, which is not in the plan`)
        // A dependency that has already been carried out needs no position.
        if (dep && open(dep)) {
          assert.ok(
            (order.get(id) as number) < (order.get(s.id) as number),
            `${s.id} is ordered before ${id}, which it waits on`,
          )
        }
      }
    }
  })

  test(`${name}: no MFA requirement is offered while people still have no method`, () => {
    for (const s of steps) {
      if (!open(s) || !offered(s)) continue
      // The campaign is the step that runs at low readiness by design: it is
      // how readiness gets to the threshold in the first place.
      if (s.kind === 'verify') continue
      if (s.readiness.family !== 'mfa' && s.readiness.family !== 'guest') continue
      if (s.readiness.percent === null) continue
      assert.ok(
        s.readiness.percent >= 90,
        `${s.id} is offered at ${s.readiness.percent}% readiness`,
      )
    }
  })

  test(`${name}: no device requirement is offered before enrolment coverage`, () => {
    for (const s of steps) {
      if (!open(s) || !offered(s) || s.readiness.family !== 'device') continue
      if (s.readiness.percent === null) continue
      assert.ok(
        s.readiness.percent >= READINESS_THRESHOLD_DEVICES_PERCENT,
        `${s.id} is offered at ${s.readiness.percent}% device readiness`,
      )
    }
  })

  test(`${name}: no country block is offered while the allowed list is unsettled`, () => {
    const gate = steps.find((s) => s.id === 's-blocker-allowed-countries' && open(s))
    if (!gate) return
    for (const s of steps) {
      if (s.readiness.family !== 'location' || !open(s)) continue
      assert.equal(s.status, 'blocked', `${s.id} is offered while the allowed-countries list is unsettled`)
    }
  })

  test(`${name}: no session control can put the person applying it in a loop`, () => {
    for (const s of steps) {
      if (!offered(s)) continue
      const loops = s.unblockNotes.some((n) => /sign-in loop/i.test(n))
      assert.equal(loops, false, `${s.id} is offered with a sign-in-loop hazard`)
    }
  })

  test(`${name}: no Conditional Access policy is offered while security defaults are on`, () => {
    const secDefaults = steps.find((s) => s.id === 's-prereq-security-defaults' && open(s))
    if (!secDefaults) return
    for (const s of steps) {
      if ((s.kind !== 'create' && s.kind !== 'adjust') || !open(s)) continue
      assert.notEqual(s.status, 'ready', `${s.id} is Ready while security defaults are still on`)
      assert.ok(s.blockedBy.includes(secDefaults.id), `${s.id} does not wait on turning security defaults off`)
    }
  })

  test(`${name}: security-info registration waits for a way out to exist`, () => {
    const reg = steps.find((s) => s.goalId === 'register-info-protected')
    if (!reg || !open(reg)) return
    // Offered only when a Temporary Access Pass can be issued, a trusted
    // location means something, and nobody active is without a method.
    if (offered(reg)) {
      const notes = reg.unblockNotes.join(' ')
      assert.doesNotMatch(notes, /Temporary Access Pass is not enabled/, `${reg.id} offered with no way out`)
      assert.doesNotMatch(notes, /no trusted location is confirmed/, `${reg.id} offered with no trusted location`)
    }
  })
}

// ---- the stranding this audit was written for ----

test('a remote-only tenant with no trusted location never offers the registration policy', () => {
  const spec = FIXTURE_SPECS.find((s) => s.name === 'small')
  assert.ok(spec)
  const f = buildFixture(spec)
  const remote = structuredClone(f)
  remote.mapping.trustedLocationIds = []
  const { steps } = runFixture(remote)
  const reg = steps.find((s) => s.goalId === 'register-info-protected')
  if (!reg) return
  assert.equal(reg.status, 'blocked')
  assert.match(reg.unblockNotes.join(' '), /no trusted location is confirmed/)
})

test('with no Temporary Access Pass, the registration step says so in its own words', () => {
  const { steps } = runFixture(fixture('mid'))
  const reg = steps.find((s) => s.goalId === 'register-info-protected')
  assert.ok(reg)
  const modes = reg.failureModes.map((m) => `${m.title} ${m.evidence}`).join(' ')
  assert.match(modes, /Temporary Access Pass/, 'the step names the rescue path')
  assert.match(modes, /Windows Hello for Business/, 'the step names the passwordless registration change')
})
