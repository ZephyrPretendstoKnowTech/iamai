// The approved 7.x fixes and the 6.2 pitfall (owner, 2026-09-25;
// docs/plans/roadmap-flow/handoff-2026-09-25.md): each item's acceptance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withDirectionApproved, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { createWaitsOnReadiness, implementationOffered } from '../../roadmap/operations.ts'
import { boardReadingsOf, boardWhenOf, laneViewFor, waveStartOf } from './planBoard.ts'
import { membersOf } from '../../roadmap/stepGroups.ts'
import { stepById } from '../../content/content.ts'
import { setDisplayTimeZone } from '../../copy/dates.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }
import { stepContract } from './stepContract.ts'
import { stepBodyOf } from './stepBody.ts'
import { pitfallTilesOf } from './pitfalls.ts'
import type { StepVarContext } from './stepVars.ts'
import { mfaLeavesOutIntune } from '../../roadmap/fixtures/intuneMfa.ts'

const INTUNE_STEP = 's-goal-intune-enrollment-reauth'
const DEVICE_STEP = 's-goal-require-managed-device'
const PLATFORMS_STEP = 's-goal-block-unsupported-platforms'

function contextOf(f: Fixture, run: ReturnType<typeof runFixture>): StepVarContext {
  return { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: run.input.directory }
}

test('7.x finishes on the section completion form: "IAMAI sees {policy} On." and its report-only period', () => {
  const f = curatedFixture('demo')
  const run = runFixture(f)
  const ctx = contextOf(f, run)
  const policies = membersOf('devices-sessions').map((id) => run.steps.find((s) => s.id === id)).filter((s) => s !== undefined && (s.kind === 'create' || s.kind === 'adjust'))
  assert.ok(policies.length >= 4, 'the premise: the demo carries the section’s policy steps')
  for (const step of policies) {
    const done = stepContract(step!, ctx).doneWhen
    assert.match(done[0], /^IAMAI sees .+ On[.,]/, `${step!.id}: ${done.join(' | ')}`)
  }
})

test('7.3: an On policy requiring MFA on All resources is the MFA that prevents the sign-in loop; one leaving out Intune Enrollment is not', () => {
  const f = curatedFixture('demo-week2')
  const loops = (fx: Fixture): boolean => runFixture(fx).steps.find((s) => s.id === INTUNE_STEP)!.blockers.some((b) => b.kind === 'readiness' && b.label === 'session-loop')
  assert.equal(loops(f), false, 'Require MFA for everyone on All resources covers Intune Enrollment: no hold')
  const { fixture: out, changed } = mfaLeavesOutIntune(f)
  assert.ok(changed > 0, 'the premise: the fixture has an On MFA policy on All resources')
  assert.equal(loops(out), true, 'with Intune Enrollment left out of it, nothing asks for MFA on that sign-in: the hold stands')
})

test('7.3: no "Fresh sign-in proof · Unknown" card in the step’s readiness model', () => {
  const text = JSON.stringify(registry)
  assert.ok(text.includes(INTUNE_STEP), 'the premise: the registry carries the step')
  assert.doesNotMatch(text, /prompt-proof|Fresh sign-in proof/)
})

test('7.4: a create held on device readiness shows its procedure, is not offered, and the rail names the readiness', () => {
  const f = curatedFixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === DEVICE_STEP)!
  assert.equal(createWaitsOnReadiness(step as Parameters<typeof createWaitsOnReadiness>[0]), true, 'the premise: the create waits on device readiness')
  assert.equal(implementationOffered(step as Parameters<typeof createWaitsOnReadiness>[0]), false, 'the create is not offered while it waits')
  const body = stepBodyOf(step, contextOf(f, run), {} as never) as unknown as { emergencyAccountTasks: { tasks: { id: string; title: string }[] } | null; rail: { headline: string }; readiness: { tiles: { label: string }[] } }
  const tasks = body.emergencyAccountTasks?.tasks.map((t) => t.id) ?? []
  assert.ok(tasks.includes('create') && tasks.includes('turn-on'), `the procedure stands whole: ${tasks.join(', ')}`)
  assert.equal(body.rail.headline, 'Device readiness reaches 80%')
  assert.ok(body.readiness.tiles.some((t) => t.label === 'Threshold'), 'the hold stays in Tasks Remaining')
})

test('7.1 About is only the why', () => {
  const why = String((stepById['admin-session'] as { why?: string } | undefined)?.why ?? '')
  assert.match(why, /^Shorter admin browser sessions/, 'the premise: the step’s own why')
  assert.doesNotMatch(why, /Test the experience/)
})

/** The 6.2 step on the demo, with sign-in evidence set for the people named. */
function platformCard(evidence: Record<string, { platforms?: { os: string; at: string }[]; noPlatformAt?: string }>, over: (f: Fixture) => void = () => {}) {
  const f = structuredClone(curatedFixture('demo'))
  over(f)
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === PLATFORMS_STEP)!
  const ctx = contextOf(f, run)
  ctx.snapshot = structuredClone(f.snapshot)
  for (const [id, e] of Object.entries(evidence)) ctx.snapshot.signInEvidence![id] = { signInCount: 1, lastSignIn: null, lastMfaSuccess: null, ...(e as object) } as never
  return { step, ctx, f, tiles: pitfallTilesOf(step, ctx, false, () => undefined) }
}

test('6.2 names each person who signs in from a platform it blocks, with the platform, the day and the fix', () => {
  setDisplayTimeZone('UTC')
  try {
    const f = curatedFixture('demo')
    const bg = new Set(f.mapping.breakGlassUserIds)
    const [a, b, c] = f.snapshot.users.filter((u) => u.userType !== 'guest' && !bg.has(u.id)).map((u) => u.id)
    const { tiles, ctx } = platformCard({
      [a]: { platforms: [{ os: 'Windows', at: '2026-09-21T10:00:00Z' }, { os: 'Linux', at: '2026-09-22T10:00:00Z' }] },
      [b]: { noPlatformAt: '2026-09-20T10:00:00Z' },
      [c]: { platforms: [{ os: 'iOS', at: '2026-09-22T10:00:00Z' }] },
    })
    const card = tiles.find((t) => t.key === 'pitfall:unsupported-platform')
    assert.ok(card, 'a card on the step')
    assert.equal(card.value, '2 people sign in from a platform this blocks')
    assert.equal(card.note, 'Once this is On, their next sign-in from that device is blocked. Move each one to Windows, macOS, iOS or Android before you turn it on.')
    const names = card.names ?? []
    assert.equal(names.length, 2, names.join('\n'))
    assert.ok(names.some((l) => l.includes(ctx.nameOf(a).split(' ')[0]) && l.endsWith(': Linux, last Sep 22')), names.join('\n'))
    assert.ok(names.some((l) => l.endsWith(': no platform reported, last Sep 20')), names.join('\n'))
  } finally {
    setDisplayTimeZone(null)
  }
})

test('6.2 draws no card where nobody signs in from a blocked platform, and none once it is On', () => {
  const f = curatedFixture('demo')
  const id = f.snapshot.users.find((u) => u.userType !== 'guest' && !f.mapping.breakGlassUserIds.includes(u.id))!.id
  assert.equal(platformCard({ [id]: { platforms: [{ os: 'macOS', at: '2026-09-22T10:00:00Z' }] } }).tiles.length, 0, 'supported platforms only: no card')
  const { step, ctx } = platformCard({ [id]: { platforms: [{ os: 'Linux', at: '2026-09-22T10:00:00Z' }] } })
  const on = structuredClone(step)
  on.state.lifecycle = 'enforced'
  assert.equal(pitfallTilesOf(on, ctx, false, () => undefined).length, 0, 'an enforced policy has nothing left to warn about')
})

test('7.4 held on device readiness is estimated at the end of the preparation window, never the plan’s first day', () => {
  const f = withDirectionApproved(withFoundationSettled(fixture('demo-week2')))
  const run = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardReadingsOf(run.steps, run.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const step = run.steps.find((s) => s.id === DEVICE_STEP)!
  assert.equal(createWaitsOnReadiness(step as Parameters<typeof createWaitsOnReadiness>[0]), true, 'the premise: the create waits on device readiness')
  const window = step.scheduled!.basis!.window!
  assert.ok(Date.parse(window.prepEnd) > Date.parse(window.start), 'the premise: the preparation window ends after the plan starts')
  const lane = laneViewFor(step, board)
  assert.equal(lane.estimate?.slice(0, 10), window.prepEnd.slice(0, 10), `device readiness is preparation a person does: ${boardWhenOf(step, waveStartOf(step), lane)}`)
})

/** Week two with each On MFA policy on All resources changed by `edit`. */
function editMfa(edit: (p: Record<string, any>) => void): Fixture {
  const f = structuredClone(curatedFixture('demo-week2'))
  let changed = 0
  for (const p of (f.snapshot.config.caPolicies?.rows ?? []) as Record<string, any>[]) {
    if (p.state !== 'enabled' || !(p.grantControls?.builtInControls ?? []).includes('mfa') || !(p.conditions?.applications?.includeApplications ?? []).includes('All')) continue
    edit(p)
    changed++
  }
  assert.ok(changed > 0, 'the premise: an On MFA policy on All resources')
  return f
}
const loopHeld = (f: Fixture): boolean => runFixture(f).steps.find((s) => s.id === INTUNE_STEP)!.blockers.some((b) => b.kind === 'readiness' && b.label === 'session-loop')

test('7.3: an OR grant a compliant device satisfies asks no MFA of that device, so it does not clear the loop hold', () => {
  const f = editMfa((p) => { p.grantControls = { ...p.grantControls, operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] } })
  assert.equal(loopHeld(f), true)
})

test('7.3: an MFA policy the plan will correct to the baseline’s, which leaves Intune Enrollment out, does not clear the loop hold', () => {
  // Leaving another app out makes the plan write the baseline's resources whole: All, except Intune Enrollment.
  const f = editMfa((p) => { p.conditions.applications.excludeApplications = [...(p.conditions.applications.excludeApplications ?? []), '00000002-0000-0ff1-ce00-000000000000'] })
  const mfa = runFixture(f).steps.find((s) => s.id === 's-goal-mfa-all-users')!
  const leaves = (mfa.action.resolution?.policies ?? []).some((o) => o.mode === 'update' && JSON.stringify((o.target as { conditions?: { applications?: unknown } } | undefined)?.conditions?.applications ?? '').includes('d4ebce55'))
  assert.ok(leaves, 'the premise: the plan corrects the MFA policy to leave Intune Enrollment out')
  assert.equal(loopHeld(f), true)
})

test('7.4: the held create’s Tasks Remaining card names the readiness it waits for, never the create', () => {
  const f = curatedFixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === DEVICE_STEP)!
  const body = stepBodyOf(step, contextOf(f, run), {} as never) as unknown as { emergencyAccountTasks: { tasks: { id: string; required: boolean; readinessTitle?: string }[] } | null }
  const next = body.emergencyAccountTasks?.tasks.find((t) => t.required)
  assert.equal(next?.id, 'create', 'the premise: the create is the first task still to do')
  assert.equal(next?.readinessTitle, 'Device readiness reaches 80%')
})
