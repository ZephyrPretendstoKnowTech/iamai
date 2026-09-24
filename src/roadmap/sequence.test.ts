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
import { PINNED_GOAL_MAP } from './goalMap.ts'
import type { Step } from './types.ts'
import { READINESS_THRESHOLD_DEVICES_PERCENT } from './constants.ts'
import { canDenyAccess } from './strand.ts'
import { addsExclusionsToEnforced, enforcesOnRun, enforcementHeld, implementationOffered, operationsOf, unavailableReason } from './operations.ts'
import { GATING_SUBJECTS, blockerStepId } from './blockerSteps.ts'

const NAMES = FIXTURE_SPECS.map((s) => s.name)

const open = (s: Step): boolean => s.status !== 'done' && s.status !== 'skipped'
/**
 * The plan is inviting this step to be done.
 *
 * The word alone does not say so. The lifecycle and the condition are separate
 * axes (roadmap/lifecycle.ts) and the word is a projection in which the
 * lifecycle outranks the condition, so a step the plan is holding behind a
 * readiness threshold still reads Report-only while the tenant's own policy sits
 * in report-only. That is the truth about the policy and it is not an
 * invitation: the row says Blocked and names the threshold, which is what these
 * ordering properties are about.
 *
 * Anything the plan actually offers — Ready, or Ready to enforce — is still
 * held to the gate, whatever stage its policy is at.
 */
const offered = (s: Step): boolean =>
  (s.status === 'ready' || s.status === 'ready-to-enforce' || s.status === 'in-report-only') && s.state.condition === 'healthy'

// Every fixture's plan, built once and shared by the properties below: each
// property is checked on every tenant the fixtures build.
const RUNS = NAMES.map((name) => {
  const { steps } = runFixture(fixture(name))
  return { name, steps, byId: new Map(steps.map((s) => [s.id, s])), order: new Map(steps.map((s, i) => [s.id, i])) }
})

test('every fixture: nothing that can deny access is offered before the escape hatch is verified', () => {
  for (const { name, steps } of RUNS) {
    const gates = steps.filter((s) => GATING_SUBJECTS.some((subject) => blockerStepId(subject) === s.id) && open(s))
    if (gates.length === 0) continue
    for (const s of steps) {
      if (!canDenyAccess(s) || !open(s)) continue
      if (s.manualReview?.readyToConfirm && s.state.lifecycle === 'enforced') {
        assert.deepEqual(operationsOf(s), [], `${name}/${s.id}: workflow review must not write a policy`)
        continue
      }
      // Ready is the state that invites action, so nothing deny-capable may sit
      // there. A policy the tenant already has in report-only reports reality
      // instead, and still has to carry the gate before it can be enforced.
      assert.notEqual(s.status, 'ready', `${name}/${s.id} is Ready while emergency access is unverified`)
      assert.ok(
        gates.some((g) => s.blockedBy.includes(g.id)),
        `${name}/${s.id} does not wait on the emergency-access step`,
      )
    }
  }
})

test('every fixture: no step waits on an object whose own step is missing or later', () => {
  for (const { name, steps, byId, order } of RUNS) {
    for (const s of steps) {
      for (const id of s.blockedBy) {
        const dep = byId.get(id)
        assert.ok(dep, `${name}/${s.id} waits on ${id}, which is not in the plan`)
        // A dependency that has already been carried out needs no position.
        if (dep && open(dep)) {
          assert.ok(
            (order.get(id) as number) < (order.get(s.id) as number),
            `${name}/${s.id} is ordered before ${id}, which it waits on`,
          )
        }
      }
    }
  }
})

test('every fixture: no MFA or device requirement is offered below its readiness threshold', () => {
  for (const { name, steps } of RUNS) {
    for (const s of steps) {
      if (!open(s) || !offered(s)) continue
      if (s.manualReview?.readyToConfirm && s.state.lifecycle === 'enforced') { assert.deepEqual(operationsOf(s), []); continue }
      if (s.readiness.percent === null) continue
      // The campaign is the step that runs at low readiness by design: it is
      // how readiness gets to the threshold in the first place.
      if ((s.readiness.family === 'mfa' || s.readiness.family === 'guest') && s.kind !== 'verify') {
        assert.ok(s.readiness.percent >= 90, `${name}/${s.id} is offered at ${s.readiness.percent}% readiness`)
      }
      if (s.readiness.family === 'device') {
        assert.ok(s.readiness.percent >= READINESS_THRESHOLD_DEVICES_PERCENT, `${name}/${s.id} is offered at ${s.readiness.percent}% device readiness`)
      }
    }
  }
})

test('every fixture: an unmet readiness prerequisite holds every enforcement and its dates, and never the report-only preparation', () => {
  // The plan names a threshold and tells the operator to wait for it. That has
  // to be a fact about the implementation, not a word beside one: the step used
  // to carry the portal lines, the JSON, the PowerShell, the download, its
  // rings, its enforcement event and its calendar entry while the number it
  // named was less than half of what it asked for.
  //
  // Deliberately not "a blocker means no implementation": a safe report-only
  // preparation is still offered, because it denies nobody and it is how
  // readiness reaches the threshold in the first place. What is held is every
  // operation that changes what people have to do the moment it is submitted,
  // and every date that promises one.
  //
  // Nor "an enabled policy is never touched": a correction that only adds
  // exclusions to a policy the tenant already enforces is not stricter (owner,
  // 2026-09-19). It can stop nobody and only makes the way back in safer, so
  // the threshold holds nothing of it and it is offered and dated like any
  // other change. Every operation it runs has to be that, or the step is held.
  for (const { name, steps } of RUNS) {
    for (const s of steps) {
      const gate = s.action.readinessGate
      if (!gate || !open(s)) continue
      const where = `${name}/${s.id} (${gate.measure} is ${gate.value}, wants ${gate.threshold})`
      const ops = s.action.resolution?.policies ?? []
      // The other half of the same rule, so it cannot be satisfied by withholding
      // everything: where a held step's own operations all land in report-only,
      // they stay on offer.
      if (unavailableReason(s) === null && ops.length > 0 && !ops.some(enforcesOnRun)) {
        assert.equal(implementationOffered(s), true, `${where}: a report-only preparation is withheld by a readiness threshold`)
      }
      const bounded = ops.length > 0 && ops.every((o) => o.mode === 'update' && o.addsExclusionsOnly === true && (o.target as { state?: unknown } | undefined)?.state === 'enabled' && (o.body as { state?: unknown }).state === undefined)
      if (bounded) {
        assert.equal(addsExclusionsToEnforced(s), true, `${where}: the exclusions-only correction is read as one`)
        assert.equal(enforcementHeld(s), false, `${where}: an exclusions-only correction to an enforced policy is not held`)
        continue
      }
      for (const o of operationsOf(s)) assert.equal(enforcesOnRun(o), false, `${where} offers an operation that enforces at once`)
      assert.equal(s.events, null, `${where} carries an enforcement date`)
      assert.deepEqual(s.rings, [], `${where} carries a ring plan`)
      assert.equal(enforcementHeld(s), true, `${where} is not recorded as held`)
    }
  }
})

test('every fixture: no session control can put the person applying it in a loop', () => {
  for (const { name, steps } of RUNS) {
    for (const s of steps) {
      if (!offered(s)) continue
      const loops = s.unblockNotes.some((n) => /sign-in loop/i.test(n))
      assert.equal(loops, false, `${name}/${s.id} is offered with a sign-in-loop hazard`)
    }
  }
})

test('every fixture: no Conditional Access policy is offered while security defaults are on', () => {
  for (const { name, steps } of RUNS) {
    const secDefaults = steps.find((s) => s.id === 's-prereq-security-defaults' && open(s))
    if (!secDefaults) continue
    for (const s of steps) {
      if ((s.kind !== 'create' && s.kind !== 'adjust') || !open(s)) continue
      if (s.manualReview?.readyToConfirm && s.state.lifecycle === 'enforced') { assert.deepEqual(operationsOf(s), []); continue }
      assert.notEqual(s.status, 'ready', `${name}/${s.id} is Ready while security defaults are still on`)
      assert.ok(s.blockedBy.includes(secDefaults.id), `${name}/${s.id} does not wait on turning security defaults off`)
    }
  }
})

// ---- the stranding this audit was written for ----

test('no country block or registration policy is offered without its way out, and a remote team\'s registration policy waits for no trusted location', () => {
  for (const { name, steps } of RUNS) {
    const gate = steps.find((s) => s.id === 's-blocker-allowed-countries' && open(s))
    if (gate) {
      for (const s of steps) {
        if (s.readiness.family !== 'location' || !open(s)) continue
        assert.equal(s.status, 'blocked', `${name}/${s.id} is offered while the allowed-countries list is unsettled`)
      }
    }
    // Security-info registration is offered only when a Temporary Access Pass can
    // be issued, a trusted location means something, and nobody active is without a method.
    const reg = steps.find((s) => s.goalId === 'register-info-protected')
    if (reg && open(reg) && offered(reg)) {
      const notes = reg.unblockNotes.join(' ')
      assert.doesNotMatch(notes, /Temporary Access Pass is not enabled/, `${name}/${reg.id} offered with no way out`)
      assert.doesNotMatch(notes, /no trusted location is confirmed/, `${name}/${reg.id} offered with no trusted location`)
    }
  }
  const spec = FIXTURE_SPECS.find((s) => s.name === 'small')
  assert.ok(spec)
  const remote = structuredClone(buildFixture(spec))
  remote.mapping.trustedLocationIds = []
  // A trusted location already in Entra is the way out, whatever the answer (walk list 2.x item 61).
  const locations = remote.snapshot.config.namedLocations
  if (locations) locations.rows = locations.rows.map((l) => ({ ...(l as Record<string, unknown>), isTrusted: false }))
  const reg = runFixture(remote).steps.find((s) => s.goalId === 'register-info-protected')
  if (!reg) return
  // Everyone works remotely: the policy requires MFA to register from anywhere (owner, 2026-09-24).
  assert.ok(!reg.blockers.some((b) => b.label === 'registration-no-trusted-location'), 'a remote team waits for a trusted location that never comes')
})
