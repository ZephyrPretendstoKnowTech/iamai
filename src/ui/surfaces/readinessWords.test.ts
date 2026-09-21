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
      // An enforced policy is not waiting for the number, so it states the floor
      // alone; the count is the finished-rollout card's (enforced-readiness).
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
      assert.ok(said.trim().endsWith(`${gate.route}”.`), `${name}/${step.id}: the route is not the last thing said — ${said}`)
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
      assert.match(said, /At least [0-9]+%/, `${name}/${step.id}: ${said}`)
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
