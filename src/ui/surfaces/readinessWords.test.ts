// B10 P0-11 and P1-1 to P1-6: what the Readiness tiles and the Implementation
// channels say on the exclusions group, a decision, an unsaved input, a
// transitive prerequisite, the two account checks, and a policy waiting on an
// exclusions group the scan found but nobody confirmed.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stepById } from '../../content/content.ts'
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
import { CONTRACT, readinessOf, readinessSentence } from './stepContract.ts'
import type { PrerequisiteBlocker } from './stepContract.ts'
import { waitingLine } from './stepJson.ts'
import type { Step } from '../../roadmap/types.ts'

const CONTRACT_SRC = readFileSync(new URL('./stepContract.ts', import.meta.url), 'utf8')
const T = CONTRACT.readiness.tiles
const EXCLUSIONS = 's-prereq-exclusion-group'
// The confirmation names the exclusions step by its real title. "the Exclusions Group
// step" named no step (quality audit 2026-09-20 §3, `fixConfirmExclusions`), so the
// sentence now carries a {step} slot the contract fills with the step's own title.
const EXCLUSIONS_TITLE = 'Configure Emergency Exclusions'
const CONFIRM = `Complete ${EXCLUSIONS_TITLE} first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.`
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

test('P0-11: the exclusions step owns policy exclusions and states the shared correction once', () => {
  for (const [name, f] of [['demo', fixture('demo')], ['mid', fixture('mid')]] as const) {
    const b = bodiesOf(f).get(EXCLUSIONS)!
    const policies = allTiles(b).find((t) => t.key === 'configuration:group-policies')
    assert.ok(policies, `${name}: no policy-exclusions topic`)
    // Each policy is two facts, its mode and its group exclusion (cff043a2); the correction is the step's, not repeated on the tile.
    assert.equal(policies.note ?? null, null)
    assert.ok(policies.items?.length)
    assert.ok(policies.items?.every(item => item.label === 'Mode' || item.label === 'Group exclusion'))
    for (const policy of new Set(policies.items?.map(item => item.subjectLabel))) assert.deepEqual(policies.items?.filter(item => item.subjectLabel === policy).map(item => item.label), ['Mode', 'Group exclusion'], `${name}: ${policy}`)
    assert.doesNotMatch(JSON.stringify(policies.items), /Add the group exclusion/)
  }
})

test('P1-1: the Decision tile reads Decision, explains the ask, and names the one group IAMAI found', () => {
  // The device-plan step's Decision tile ("Choose device management") left with the step: its
  // questions are Decide How People and Devices Sign In's, which draws Questions and no Readiness.
  const f = oneGroup()
  const group = bodiesOf(f).get(EXCLUSIONS)!
  assert.equal(group.contract.state.condition, 'needs-decision', 'the premise: the question is open')
  const name = exclusionsGroupChoice({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') }).candidates[0].name
  const tile = group.readiness.tiles.find((t) => t.key === 'configuration:group-choice')!
  // The next-check tile asks for the choice; the suggestion line names the group IAMAI found (needsDecision.test).
  assert.ok(name)
  assert.equal(tile.value, 'Choose an exclusions group')
  assert.match(tile.note ?? '', /^Select a group under Exclusions group, then Save\./)
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
  // Account preparation and exclusions are independent prerequisites, so both direct owners remain visible.
  const tiles = readinessOf(step, body.contract, [edge(EMERGENCY), edge(EXCLUSIONS)]).tiles
  const steps = tiles.map((t) => /^(?:step|missing|engine:step|engine:suspendedPrerequisite):(.+)$/.exec(t.key)?.[1]).filter(Boolean)
  assert.ok(steps.includes(EXCLUSIONS), tiles.map((t) => t.key).join(', '))
  assert.equal(steps.includes(EMERGENCY), true, 'the independent account prerequisite is missing')
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
  // The title in the sentence is that step's own, not a phrase written beside it.
  assert.equal(stepById[EXCLUSIONS].title, EXCLUSIONS_TITLE)
  assert.equal(group[0].note, CONFIRM)
  // Where the group is confirmed, nothing says so.
  for (const b of bodiesOf(fixture('mid')).values()) for (const t of allTiles(b)) assert.doesNotMatch(t.note ?? '', /IAMAI found a matching group/)
})

test('P1-6 (B11): the readiness bar and the Implementation reason ask to confirm the group too; no line calls it a missing object', () => {
  const confirm = CONFIRM
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
  assert.equal(line.startsWith(`${CONFIRM} `), true, line)
  assert.match(line, /Create the Baseline's Authentication Strength first: this policy names an object Contoso does not have yet\.$/)
  assert.doesNotMatch(line, new RegExp(`${EXCLUSIONS_TITLE} and `))
  // Answered, the group is an object like any other.
  assert.match(waitingLine(step, 'Contoso', false), /^Configure Emergency Exclusions and Create the Baseline's Authentication Strength first: /)
})

// "67% MFA-ready" says how far off the gate is and nothing about who. The
// reading behind it is computed by roadmap/methodReadiness.ts and reached the
// screen only when the percentage could not be worked out at all, so the number
// a person can act on was withheld exactly when there was one.
test('a readiness threshold stated as a percentage also states the reading behind it', () => {
  let checked = 0
  for (const name of ['demo', 'small', 'mid', 'large', 'messy', 'midflight'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    for (const step of r.steps) {
      const gate = step.action.readinessGate
      if (!gate || !gate.value.endsWith('%') || step.status === 'done' || step.status === 'skipped') continue
      const line = step.readiness.lines[0]
      if (typeof line !== 'string' || !/[0-9]+ of [0-9]+/.test(line)) continue
      if (step.state.lifecycle === 'enforced') continue
      checked++
      const said = readinessSentence(step, gate)
      assert.ok(said.includes(gate.value), `${name}/${step.id}: ${said}`)
      assert.ok(said.includes(line), `${name}/${step.id}: the reading is not said — ${said}`)
    }
  }
  assert.ok(checked > 3, `only ${checked} percentage gates carried a reading`)
})

// A threshold with no route is the Temporary Access Pass dead end in another
// family: device readiness held the managed-device step at 30% of 80% with
// nothing on the plan that enrols a device.
test('a readiness measure this plan runs no step for says where the number is moved', () => {
  const f = fixture('demo')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const step = r.steps.find((s) => s.id === 's-goal-require-managed-device')!
  const gate = step.action.readinessGate!
  assert.ok(gate, 'the premise: the managed-device step carries a device-readiness gate')
  const said = readinessSentence(step, gate)
  assert.ok(said.includes(CONTRACT.readinessRoute.device), said)
  assert.match(CONTRACT.readinessRoute.device, /Intune/)
})

// An engine blocker with no tile of its own said its own label twice and nothing
// else — "Not supported · Not supported ·" — while the reason sat on the contract.
test('every readiness tile says something its label has not already said', () => {
  for (const name of ['demo', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const) {
    for (const [id, body] of bodiesOf(fixture(name))) {
      for (const tile of body.readiness.tiles) {
        if (tile.label !== tile.value) continue
        assert.ok((tile.note ?? '').trim().length > 0, `${name}/${id}: ${tile.label} says only its own label`)
      }
    }
  }
})
