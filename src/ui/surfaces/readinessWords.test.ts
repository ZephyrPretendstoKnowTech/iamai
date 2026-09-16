// B10 P0-11 and P1-1 to P1-6: what the Readiness tiles and the Implementation
// channels say on the exclusions group, a decision, an unsaved input, a
// transitive prerequisite, the two account checks, and a policy waiting on an
// exclusions group the scan found but nobody confirmed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { directoryEvidenceFromGroups, exclusionsGroupChoice } from '../../mapping/safetyChoice.ts'
import { laneViewFor, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { channelTabsOf, stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { CONTRACT, readinessOf } from './stepContract.ts'
import type { PrerequisiteBlocker } from './stepContract.ts'
import { waitingLine } from './stepJson.ts'
import type { Step } from '../../roadmap/types.ts'

const CONTRACT_SRC = readFileSync(new URL('./stepContract.ts', import.meta.url), 'utf8')
const T = CONTRACT.readiness.tiles
const EXCLUSIONS = 's-prereq-exclusion-group'
const EMERGENCY = 's-prereq-break-glass'
const LEGACY = 's-goal-block-legacy-auth'

/** Every step's body on a fixture, as the Plan composes it (stepSnapshots.ts). */
function bodiesOf(f: Fixture): Map<string, StepBody> {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const out = new Map<string, StepBody>()
  for (const step of r.steps) {
    const reading = readings.get(step.id)
    const lane = reading ? laneViewOf(reading, titleOf) : laneViewFor(step, r.steps, titleOf)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
  }
  return out
}

const allTiles = (b: StepBody) => [...b.readiness.tiles, ...b.readiness.satisfied]
const lc = (s: string): string => s.toLowerCase()

/** Mid with the exclusions question unanswered and one qualifying group left (pickerPrefill.test.ts's tenant). */
function oneGroup(): Fixture {
  const base = noExclusionsAnswer(fixture('mid'))
  const candidates = (f: Fixture) => exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') }).candidates
  const drop = candidates(base).find((c) => /break/i.test(c.name))!
  const strip = (ids: unknown): string[] => (Array.isArray(ids) ? (ids as string[]) : []).filter((g) => lc(g) !== lc(drop.id))
  const rows = (base.snapshot.config.caPolicies?.rows ?? []).map((p) => {
    const raw = p as { conditions?: { users?: Record<string, unknown> } & Record<string, unknown> }
    const users = raw.conditions?.users
    return users ? { ...raw, conditions: { ...raw.conditions, users: { ...users, includeGroups: strip(users.includeGroups), excludeGroups: strip(users.excludeGroups) } } } : p
  })
  const f = { ...base, name: 'mid-b10-one-group', groups: new Map([...base.groups].filter(([id]) => lc(id) !== lc(drop.id))), snapshot: { ...base.snapshot, config: { ...base.snapshot.config, caPolicies: { ...base.snapshot.config.caPolicies!, rows } } } } as unknown as Fixture
  assert.equal(candidates(f).length, 1, 'the premise: exactly one group qualifies')
  return f
}

test('P0-11: the exclusions group sends nobody to edit existing policies; it states how many exclude it and that each policy step owns the rest', () => {
  for (const [name, f] of [['demo', fixture('demo')], ['mid', fixture('mid')]] as const) {
    const b = bodiesOf(f).get(EXCLUSIONS)!
    for (const t of allTiles(b)) assert.doesNotMatch(`${t.value} ${t.note ?? ''}`, /Exclude the group from|open each policy/, `${name}: ${t.key}`)
    assert.equal(b.contract.fix.some((x) => x.key.endsWith(':excluded-from-every-policy')), false, `${name}: the check is still a fix`)
    const reach = allTiles(b).find((t) => t.key === 'exclusions-reach')
    assert.ok(reach, `${name}: no reach tile`)
    assert.equal(reach.tone, 'info')
    assert.match(reach.value, /^\d+ of \d+ policies exclude the group$/)
    assert.equal(reach.note, T.exclusionsReachNote)
  }
  assert.equal(allTiles(bodiesOf(fixture('mid')).get(EXCLUSIONS)!).find((t) => t.key === 'exclusions-reach')?.value, '11 of 11 policies exclude the group')
})

test('P1-1: the Decision tile reads Decision, explains the ask, and names the one group IAMAI found', () => {
  const devices = bodiesOf(fixture('demo')).get('s-prereq-device-plan')!
  const decision = devices.readiness.tiles.find((t) => t.key === 'decision')!
  assert.equal(decision.value, 'Choose device management')
  // Editorial batch C: the help also says the inventory informs the choice and does not make it.
  assert.equal(decision.note, 'Save your choices for Phone Management, Phone App Protection and Computer Management.')
  const f = oneGroup()
  const group = bodiesOf(f).get(EXCLUSIONS)!
  assert.equal(group.contract.state.condition, 'needs-decision', 'the premise: the question is open')
  const name = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') }).candidates[0].name
  const tile = group.readiness.tiles.find((t) => t.key === 'decision')!
  assert.equal(tile.value, 'Decision')
  assert.equal(tile.note, `IAMAI found ${name}. Confirm this is the right group.`)
  for (const t of allTiles(group)) assert.doesNotMatch(t.value, /Needs decision/)
})

test('P1-2: an unsaved conditional input is its own Readiness tile, asking for confirmation', () => {
  const legacy = bodiesOf(fixture('demo')).get(LEGACY)!
  assert.deepEqual(legacy.contract ? (legacy.readiness.tiles.find((t) => t.key === 'unsaved:Mail-sending devices') ?? null)?.value : null, 'Not confirmed')
  const campaign = bodiesOf(fixture('demo')).get('s-verify-mfa')!
  assert.ok(campaign.readiness.tiles.some((t) => t.key === 'unsaved:People Needing Help' && t.value === 'Not confirmed'))
})

test('P1-3: a prerequisite another prerequisite tile already waits on is not drawn beside it, by the dependency graph', () => {
  const demo = fixture('demo')
  const r = runFixture(demo)
  const step = r.steps.find((s) => s.id === LEGACY)!
  const body = bodiesOf(demo).get(LEGACY)!
  const edge = (id: string): PrerequisiteBlocker => ({ kind: 'step', id, abnormal: false, label: 'Prerequisite', title: null })
  // The exclusions group waits on emergency access (dependency-data.json): with both named, only the exclusions group is drawn.
  const tiles = readinessOf(step, body.contract, [edge(EMERGENCY), edge(EXCLUSIONS)]).tiles
  const steps = tiles.map((t) => /^(?:step|missing|engine:step|engine:suspendedPrerequisite):(.+)$/.exec(t.key)?.[1]).filter(Boolean)
  assert.ok(steps.includes(EXCLUSIONS), tiles.map((t) => t.key).join(', '))
  assert.equal(steps.includes(EMERGENCY), false, 'the transitive prerequisite is drawn beside the direct one')
  assert.equal(new Set(steps).size, steps.length, 'a step is drawn twice')
  assert.doesNotMatch(CONTRACT_SRC, /function directFixes/, 'the emergency special case is still there')
  // Two prerequisites that wait on each other (the security-defaults cutover pair) are neither's ancestor: both stay.
  const cutover = bodiesOf(fixture('messy')).get('s-prereq-security-defaults')
  assert.ok(cutover, 'the premise: messy carries the security-defaults step')
  assert.ok(cutover.readiness.tiles.length >= 2, `a reciprocal pair suppressed each other: ${cutover.readiness.tiles.map((t) => t.key).join(', ')}`)
})

test('P1-4 and P1-5: Separate Accounts and Dormant Accounts offer Entra and AI Info', () => {
  const demo = bodiesOf(fixture('demo'))
  // The channels with content; every channel is a tab (content review D2).
  for (const id of ['s-check-separate-admin-accounts', 's-check-dormant-accounts']) assert.deepEqual(channelTabsOf(demo.get(id)!.artifacts.filter((a) => !a.unavailable)).map((t) => String(t.label)), ['Entra', 'PowerShell', 'AI Info', 'Email'], id)
  const dormant = demo.get('s-check-dormant-accounts')!.artifacts
  assert.match(dormant.find((a) => a.id === 'portal')!.text(), /Account enabled: No/)
  assert.match(dormant.find((a) => a.id === 'ai')!.text(), /dormant accounts/i)
})

test('P1-6: a policy waiting on an exclusions group the scan found asks to confirm it, once', () => {
  const legacy = bodiesOf(noExclusionsAnswer(fixture('mid'))).get(LEGACY)!
  const group = legacy.readiness.tiles.filter((t) => t.key.endsWith(`:${EXCLUSIONS}`))
  assert.equal(group.length, 1, group.map((t) => t.key).join(', '))
  assert.equal(group[0].note, `Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.`)
  // Where the group is confirmed, nothing says so.
  for (const b of bodiesOf(fixture('mid')).values()) for (const t of allTiles(b)) assert.doesNotMatch(t.note ?? '', /IAMAI found a matching group/)
})

test('P1-6 (B11): the readiness bar and the Implementation reason ask to confirm the group too; no line calls it a missing object', () => {
  const confirm = 'Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.'
  const bodies = bodiesOf(noExclusionsAnswer(fixture('mid')))
  for (const id of [LEGACY, 's-goal-admins-phishing-resistant', 's-goal-guests-mfa']) {
    const b = bodies.get(id)!
    // The bar's sub-line is the contract's one action (stepContract.ts readinessOf).
    assert.equal(b.contract.whatToDo.text, confirm, `${id}: the bar's sub-line`)
    assert.equal(b.contract.implementation.offered ? null : b.contract.implementation.because, confirm, `${id}: the Implementation reason`)
    const lines = [b.contract.whatToDo.text, ...b.contract.fix.map((f) => f.text), ...b.contract.doneWhen, ...allTiles(b).map((t) => t.note ?? '')]
    for (const line of lines) assert.doesNotMatch(line, /does not have yet/, `${id}: ${line}`)
  }
  // Where the group is confirmed, the action never asks for it.
  for (const [id, b] of bodiesOf(fixture('mid'))) assert.doesNotMatch(b.contract.whatToDo.text, /IAMAI found a matching group/, id)
})

test('P1-6 (B12 re-audit): the confirmation covers every object the exclusions group step makes; a genuinely missing object still reads as one', () => {
  // The real tenant's Require MFA to Register a Device: two objects the
  // exclusions group step makes, and an authentication strength nobody has made.
  const step = { action: { missing: [
    { token: '{exclusionsGroup}', stepId: EXCLUSIONS },
    { token: '{exclusionsGroupSecond}', stepId: EXCLUSIONS },
    { token: '{authStrength}', stepId: 's-prereq-auth-strength' },
  ] } } as unknown as Step
  const line = waitingLine(step, 'Contoso', true)
  assert.match(line, /^Complete the Exclusions Group step first\. IAMAI found a matching group, but needs your confirmation before this policy can reference it\. /)
  assert.match(line, /Create the Baseline's Authentication Strength first: this policy names an object Contoso does not have yet\.$/)
  assert.doesNotMatch(line, /Exclusions Group and /)
  // Answered, the group is an object like any other.
  assert.match(waitingLine(step, 'Contoso', false), /^Create or Correct Exclusions Group and Create the Baseline's Authentication Strength first: /)
})
