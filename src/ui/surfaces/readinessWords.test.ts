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
import { laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import type { StepBody } from './stepBody.ts'
import { CONTRACT, readinessOf, readinessSentence, readinessValueOf } from './stepContract.ts'
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
    const lane = laneViewFor(step, { readings, titleOf })
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
    // Each policy is its mode and its group exclusion (cff043a2); a fact the scan
    // did not settle has no row (owner, 2026-09-23). The correction is the step's,
    // not repeated on the tile.
    assert.equal(policies.note ?? null, null)
    assert.ok(policies.items?.length)
    assert.ok(policies.items?.every(item => item.label === 'Mode' || item.label === 'Group exclusion'))
    for (const policy of new Set(policies.items?.map(item => item.subjectLabel))) assert.ok(['Mode,Group exclusion', 'Mode'].includes(String(policies.items?.filter(item => item.subjectLabel === policy).map(item => item.label))), `${name}: ${policy}`)
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
  // The suggestion line names the group IAMAI found (needsDecision.test).
  assert.ok(name)
  for (const t of allTiles(group)) assert.doesNotMatch(t.value, /Needs decision/)
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
  const dormant = demo.get('s-check-dormant-accounts')!.artifacts
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
      // The percentage is the card's value (readinessValueOf); the sentence is
      // the reading behind it (walk list 4.x item 48).
      // An enforced policy is not waiting for the number, so it states the floor
      // alone; the count is the finished-rollout card's (enforced-readiness).
      // The admin card's count is its value, and its sentence names the admins
      // short instead (walk list 4.x item 42).
      if (/^admin/.test(gate.measure)) continue
      assert.ok(said.includes(line), `${name}/${step.id}: the reading is not said`)
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

// A gate that says what it waits for but not what opens it is half a sentence.
// Seven steps of one 4,900-person plan waited on MFA readiness while the one
// campaign that moves it sat Ready on the same board, named by none of them;
// sixteen steps of another waited on a number the scan could not read at all.
// Two routes are legitimate — a step on this plan (`gate.route`, set where
// generate.ts drew the readiness edge) or somewhere outside it
// (CONTRACT.readinessRoute, device readiness in Intune) — and a gate with
// neither names nothing the reader can go and do.
test('every readiness gate holding a step names what moves the number', () => {
  let checked = 0
  for (const name of ['demo', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const titles = new Set(r.steps.map((s) => s.title))
    for (const step of r.steps) {
      const gate = step.action.readinessGate
      if (!gate || step.status === 'done' || step.status === 'skipped' || step.state.lifecycle === 'enforced') continue
      checked++
      const said = readinessSentence(step, gate)
      // A source the scan could not read answers before any of them, and
      // replaces them: nothing moves this number until the source can be read,
      // so naming a step beside it would send the reader to do work that
      // changes nothing.
      if (gate.blind !== undefined) {
        assert.ok(said.endsWith(gate.blind), `${name}/${step.id}: the blind is on the gate and not at the end of the sentence — ${said}`)
        assert.ok(gate.route === undefined || !said.includes(gate.route), `${name}/${step.id}: names a step that moves a number nothing can read — ${said}`)
        continue
      }
      const family = Object.keys(CONTRACT.readinessRoute).find((k) => said.includes(CONTRACT.readinessRoute[k]))
      // The campaign this gate WOULD have named, where finishing it provably
      // cannot reach the threshold (roadmap/readiness.ts routeShortfallOf).
      // This is a stronger answer than the family fallback, not a missing one:
      // it says which step was considered, why it falls short, and what the
      // reader can do instead — including deciding the accounts are not in use,
      // which is the only way out where the work cannot be done at all.
      if (gate.routeShortfall !== undefined) {
        assert.equal(gate.route, undefined, `${name}/${step.id}: names a campaign and says it will not work`)
        assert.ok(said.includes(gate.routeShortfall), `${name}/${step.id}: the shortfall is on the gate and not in the sentence — ${said}`)
        const named = [...titles].find((t) => gate.routeShortfall!.includes(t))
        assert.ok(named !== undefined, `${name}/${step.id}: the shortfall names no step of this plan — ${gate.routeShortfall}`)
        assert.ok(/sign in|not in use/.test(gate.routeShortfall), `${name}/${step.id}: says the campaign falls short and offers nothing instead — ${gate.routeShortfall}`)
        continue
      }
      if (gate.route === undefined) {
        assert.ok(family !== undefined, `${name}/${step.id}: waits for a number and names nothing that moves it — ${said}`)
        continue
      }
      // A route that names a step names a step the reader can actually find.
      assert.ok(titles.has(gate.route), `${name}/${step.id}: routed to "${gate.route}", which is not a step of this plan`)
      assert.ok(said.includes(gate.route), `${name}/${step.id}: the route is on the gate and not in the sentence — ${said}`)
      // Last, after the reading: between a threshold and its own numerator it
      // reads as an interruption.
      assert.ok(said.trim().endsWith(`${gate.route}”.`) || said.trim().endsWith(`${gate.route} gets them ready.`), `${name}/${step.id}: the route is not the last thing said — ${said}`)
    }
  }
  assert.ok(checked > 10, `only ${checked} gates were held`)
})

// Sixteen policies of one tenant were parked behind three data sources the scan
// could not read, and every one of them said only "not measured". The product
// knew which sources, what the read failed with, which permission reads them and
// which licence they need — all four already recorded — and named none of it.
test('a number the scan could not read names the source, the reason and what would open it', () => {
  const f = fixture('hostile')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const blind = r.steps.filter((s) => s.action.readinessGate?.blind !== undefined)
  assert.ok(blind.length > 0, 'the premise: hostile holds steps behind a source it cannot read')
  for (const step of blind) {
    const said = readinessSentence(step, step.action.readinessGate!)
    // The source, by the name the collector registry gives it.
    assert.match(said, /registration details|sign-in logs|devices/i, `${step.id}: names no source — ${said}`)
    // Why the read failed, as the scan recorded it.
    assert.ok(said.includes('access denied (403)'), `${step.id}: does not say why — ${said}`)
    // And what would open it: the permission that reads it.
    assert.ok(said.includes('AuditLog.Read.All'), `${step.id}: names nothing that would open it — ${said}`)
    assert.match(said, /scan again/, `${step.id}: does not say to scan again — ${said}`)
  }
})

// A tenant whose sources are all readable says none of this: a number that is
// unreadable because a policy's own scope could not be settled is not a blind
// anybody clears by granting a permission.
test('a readiness the scan could read names no blind source', () => {
  for (const name of ['demo', 'small', 'mid', 'large', 'midflight'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    for (const step of r.steps) {
      const gate = step.action.readinessGate
      if (!gate) continue
      assert.equal(gate.blind, undefined, `${name}/${step.id}: claims a source it could not read — ${gate.blind}`)
    }
  }
})

// A step named for one group, offering to create a policy that reaches every
// user in the tenant. "Require MFA for Guests", on a tenant with one guest,
// offered the baseline's all-users MFA policy under the name "MFA for guests and
// external users"; `mid` has the same shape one goal along, where a step named
// for service accounts would create the baseline's global country block applied
// to all 285 people. A signature reads the control a policy asks for and never
// who it asks it of, and until now nothing said so.
test('a step whose create reaches further than its own name says so before it is created', () => {
  const f = fixture('mid')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const step = r.steps.find((s) => s.id === 's-goal-service-accounts-trusted-network')!
  assert.equal(step.action.widerThan, 'serviceAccounts', 'the premise: this step creates an all-users policy')
  const found = bodiesOf(f).get(step.id)!.contract.found
  const said = found.find((x) => x.key === 'wider')
  assert.ok(said, `no wider finding on the step: ${found.map((x) => x.key).join(', ')}`)
  assert.equal(said.label, CONTRACT.foundLabel.wider)
  assert.ok(said.text.includes(CONTRACT.foundWiderCohort.serviceAccounts), said.text)
  assert.match(said.text, /everyone in the tenant/, said.text)
  // Before creation, not after: the dimension comparison can only speak once
  // the policy is deployed, and by then the reader has built it.
  assert.notEqual(step.status, 'done')
})

// And it is disclosure, never substitution. Two Foundation A invariants say the
// goal's population must not decide which policy is built; a tool that quietly
// swapped in a narrower policy than the baseline author specified would be worse
// than one that says what this one reaches.
test('naming a wider create changes no operation', () => {
  for (const name of ['demo', 'small', 'mid', 'large', 'messy', 'midflight', 'hostile'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    for (const step of r.steps) {
      if (step.action.widerThan === undefined) continue
      const ops = step.action.resolution?.policies ?? []
      assert.ok(ops.length > 0, `${name}/${step.id}: the disclosure removed the operation`)
      assert.ok(ops.some((op) => op.mode === 'create'), `${name}/${step.id}: the create it discloses is gone`)
    }
  }
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

// Two steps in one scan, measuring the same people: one read "68% MFA-ready" and
// the other "not measured", because the second's target accepts a method set the
// scan cannot judge for nine of them. Both were true and together they read as the
// tool contradicting itself. A floor is strictly more than "not measured" and
// never wrong (roadmap/readiness.ts `atLeast`).
test('a readiness the scan could only put a floor under says the floor, and says it is a floor', () => {
  let floors = 0
  for (const name of ['demo', 'small', 'mid', 'large', 'messy'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    for (const step of r.steps) {
      const gate = step.action.readinessGate
      if (!gate || step.status === 'done' || step.status === 'skipped') continue
      const said = readinessSentence(step, gate)
      if (gate.floor !== true) { assert.doesNotMatch(readinessValueOf(gate), /At least/, `${name}/${step.id}`); continue }
      floors += 1
      // The floor is a real share of a real denominator, and the reading behind it.
      assert.match(readinessValueOf(gate), /^At least [0-9]+%/, `${name}/${step.id}`)
      assert.doesNotMatch(said, /not measured/, `${name}/${step.id}: ${said}`)
      // An enforced policy is not waiting for the number, so it states the floor
      // alone; the count is the finished-rollout card's (enforced-readiness).
      if (step.state.lifecycle !== 'enforced') assert.ok(said.includes(step.readiness.lines[0] ?? '#'), `${name}/${step.id}: the reading is not said`)
      // And it changes no gate: the number is still unknown, which is what holds
      // enforcement, so the step is no nearer being allowed to enforce.
      assert.equal(step.readiness.percent, null, `${name}/${step.id}`)
      assert.equal(step.readiness.unmeasured, 'unreadable', `${name}/${step.id}`)
    }
  }
  assert.ok(floors > 3, `steps reading a floor: ${floors}`)
})

// A floor of zero is not a floor. `hostile` has its registration source switched
// off, so nobody can be judged ready; the floor read "At least 0% of admins
// phishing-resistant" — true of every tenant, and a measurement of the people
// where the fact is about what the scan could not see. Found by a persona run.
test('a tenant whose methods cannot be read states no floor, and no zero percentage', () => {
  const f = fixture('hostile')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  let checked = 0
  for (const step of r.steps) {
    const gate = step.action.readinessGate
    if (!gate || step.status === 'done' || step.status === 'skipped') continue
    checked += 1
    assert.notEqual(gate.floor, true, `${step.id}: a floor where nobody could be judged`)
    assert.doesNotMatch(readinessValueOf(gate), /At least/, step.id)
    assert.doesNotMatch(readinessSentence(step, gate), /At least/, step.id)
    // And the step still says what could not be measured.
    assert.match(readinessSentence(step, gate), /not measured/, step.id)
  }
  assert.ok(checked > 1, `gates on the unreadable tenant: ${checked}`)
})

// R4-24 (Jordan D14). The four policies waiting on MFA readiness said "The step
// that moves this number is “Prepare Your Team for MFA”" and gave nothing to
// click: the generator stored the route's title and dropped its id, so the one
// card on the step that named a step was the one that could not open it. Every
// prerequisite tile beside it links to its step.
test('a readiness gate that names the step moving its number links to that step', () => {
  let checked = 0
  for (const name of ['midflight', 'mid', 'demo'] as const) {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const readings = laneReadings(r.steps, [])
    for (const step of r.steps) {
      const gate = step.action.readinessGate
      if (!gate?.route || gate.blind !== undefined || step.status === 'done' || step.status === 'skipped' || step.state.lifecycle === 'enforced') continue
      checked++
      const route = r.steps.find((s) => s.title === gate.route)!
      assert.equal(gate.routeId, route.id, `${name}/${step.id}: the gate names "${gate.route}" and carries a different id`)
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null, groups: f.groups }
      const tile = stepBodyOf(step, ctx, { lane: laneViewFor(step, { readings, titleOf }), blockers: readinessBlockersOf(readings.get(step.id), titleOf) }).readiness!.tiles.find((t) => t.key === 'gate')
      assert.ok(tile, `${name}/${step.id}: no Threshold card`)
      assert.ok(tile.note!.includes(gate.route), `${name}/${step.id}: the card does not name the route`)
      assert.ok(tile.link && 'href' in tile.link, `${name}/${step.id}: the card names "${gate.route}" and does not link to it`)
      assert.equal(tile.link.href, '#/plan/s-verify-mfa')
    }
  }
  assert.ok(checked >= 4, `only ${checked} gates named a route`)
})

// R4-20 (Priya D5). Which source the scan could not read, why, and the
// permission that would let it was worked out only inside a policy step's
// threshold. The campaign that moves the MFA number has no threshold, so on a
// tenant whose registration details returned 403, Prepare Your Team for MFA read
// Ready with a support-list tile and a count of people, and never said its
// number could not be read, while the four policies waiting on that number each
// said both. The blind is the reading's own fact, worked out once: every
// threshold reads it, and the campaign states it.
test('the campaign that moves an unreadable number names the source the scan could not read', () => {
  const f = fixture('hostile')
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const campaign = r.steps.find((s) => s.id === 's-verify-mfa')!
  assert.equal(campaign.readiness.unmeasured, 'unreadable', 'the premise: the campaign\'s own number could not be read')
  // One source: every threshold's blind is its own step's reading's.
  const gated = r.steps.filter((s) => s.action.readinessGate?.blind !== undefined)
  assert.ok(gated.length > 0, 'the premise: policies wait on a number the scan could not read')
  for (const s of gated) assert.equal(s.action.readinessGate!.blind, s.readiness.blind, `${s.id}: the gate works the blind out apart from its reading`)
  // Where the sources are read, the campaign says nothing of the kind.
  const mid = bodiesOf(fixture('mid')).get('s-verify-mfa')!.readiness.tiles
  assert.equal(mid.some((t) => /could not read/.test(t.note ?? '')), false)
})

// Review of R4-20. The blind card drew on every step whose reading was blind,
// not only on the campaign. On hostile the guests policy is enforced by the
// tenant's "MFA for all users" and has no threshold, so it drew "Readiness ·
// Not measured — None of the 40 people in scope could be judged…". The 40 is the
// all-users policy's population, not a guest scope. Directly below it sat
// "Affected people · Not established — Exact guest-policy reach needs…". The
// card counted a scope the same page says it has not established. Before R4-20
// that line showed nowhere on this step, and it does not now.
test('a step whose reach is not established never counts the people in scope of its reading', () => {
  const f = fixture('hostile')
  const bodies = bodiesOf(f)
  const guests = bodies.get('s-goal-guests-mfa')!
  const tiles = allTiles(guests)
  const counted = tiles.filter((t) => /\d+ (?:people|person) in scope/.test(`${t.value} ${t.note ?? ''}`))
  assert.deepEqual(counted.map((t) => `${t.label} · ${t.value}`), [], 'a count of people in scope beside "Not established"')
})

// R4-20 (Priya D5), the promises. Beside a registration source that returned
// 403, Prepare Your Team for MFA still promised "the record shows it on the next
// scan" and "the lists above shrink as people are seen", and headed its unknown
// people "scan again before assessing readiness". Until the permission is
// granted no scan changes any of it. The Readiness card now names the source
// and what opens it. The promises are left out rather than warned about beside
// it, and the people are still listed.
test('the campaign promises nothing a scan cannot show while its source is refused', async () => {
  const { stepExportView } = await import('./stepExport.ts')
  const PROMISES = [/the record shows it on the next scan/, /the lists above shrink as people are seen/]
  const read = (name: 'hostile') => {
    const f = fixture(name)
    const r = runFixture(f, {}, null, f.snapshot.asOf)
    const step = r.steps.find((s) => s.id === 's-verify-mfa')!
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null, groups: f.groups }
    const body = stepBodyOf(step, ctx, {})
    return { step, portal: body.artifacts.find((a) => a.id === 'portal')!.text(), who: body.whoFull.map((b) => b.lead).join('\n'), exported: stepExportView(step, ctx).whatToDo.join('\n') }
  }
  const hostile = read('hostile')
  assert.notEqual(hostile.step.readiness.blind, undefined, 'the premise: the campaign\'s source was refused')
  for (const p of PROMISES) {
    assert.doesNotMatch(hostile.portal, p, 'the Entra list promises a scan will show progress')
    assert.doesNotMatch(hostile.exported, p, 'the export promises a scan will show progress')
  }
  assert.doesNotMatch(hostile.who, /scan again before assessing readiness/)
})

// R4-26 (Jordan D4), first half. A readiness number is the share of people with
// a method the step's OWN policies accept, and its label was the goal family's.
// The device-registration policy requires the custom strength Modern MFA + TAP,
// and read "At least 27% MFA-ready" and "when MFA readiness reaches 90%" beside
// the registration policy's "At least 68% MFA-ready" on one board: two
// requirements under one label, and a reader acted on the larger number. On the
// pin the admins' policy requires the same strength and read "0% of admins
// phishing-resistant". The measure now names the strength wherever the family's
// words would say another, on the card, the row's reason and the plan header.
test('a readiness number is labelled by the strength its policies require, so two requirements never share a label', async () => {
  const { pinnedPackage } = await import('../../baseline/pinned.ts')
  const { planFinish } = await import('../../derive/finish.ts')
  const f = fixture('demo')
  const bodies = bodiesOf(f)
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const gateTile = (b: StepBody | undefined) => b?.readiness.tiles.find((t) => t.key === 'gate')
  const device = r.steps.find((s) => s.id === 's-goal-device-registration-mfa')!
  // The premise, from the policy itself: it requires the tenant's Modern MFA + TAP strength.
  const { effectOf, strengthNameIn, validOperations } = await import('../../roadmap/operations.ts')
  const required = validOperations(device.action).flatMap((o) => effectOf(o.mode === 'update' ? o.target as Record<string, unknown> : o.body).requirements).filter((q) => q.kind === 'strength').map((q) => strengthNameIn((q as { id: string }).id, f.snapshot, f.mapping))
  assert.deepEqual(required, ['Modern MFA + TAP'], 'the premise: the device-registration policy requires the custom strength')
  const deviceTile = gateTile(bodies.get(device.id))!
  const registerTile = gateTile(bodies.get('s-goal-register-info-protected'))!
  assert.doesNotMatch(deviceTile.value, /MFA-ready/, 'a strength-bound number labelled as plain MFA')
  assert.match(deviceTile.value, /ready for Modern MFA \+ TAP$/)
  assert.match(registerTile.value, /MFA-ready$/, 'the plain-MFA policy keeps its words')
  assert.notEqual(deviceTile.value.replace(/^(At least )?\d+% /, ''), registerTile.value.replace(/^(At least )?\d+% /, ''), 'two requirements under one label')
  // The row's reason states the same measure.
  const binding = device.blockers.find((b) => b.kind === 'readiness' && b.label === 'readiness')?.binding
  assert.match(String(binding), /^when Modern MFA \+ TAP readiness reaches 90%/)
  // The admins' policy keeps "phishing-resistant" where it requires Phishing-resistant MFA...
  // The admins' card counts admins with a method the policy accepts, whatever it requires (walk list 4.x item 42).
  assert.match(gateTile(bodies.get('s-goal-admins-phishing-resistant'))!.value, /^\d+ of \d+ admins? ha(?:s|ve) a method it accepts$/)
  // ...and on the pin, where it requires Modern MFA + TAP, it no longer claims it.
  const pinned = { ...fixture('small'), baseline: pinnedPackage() }
  const admins = gateTile(bodiesOf(pinned).get('s-goal-admins-phishing-resistant'))!
  assert.doesNotMatch(admins.value, /phishing-resistant/, `a Modern MFA + TAP number labelled phishing-resistant: ${admins.value}`)
  assert.match(admins.value, /^\d+ of \d+ admins? ha(?:s|ve) a method it accepts$/)
  // The plan header counts that step under the same words, not the family's.
  assert.deepEqual(planFinish(runFixture(pinned).steps).waiting.map((w) => w.measure), ['admin Modern MFA + TAP readiness'])
})
