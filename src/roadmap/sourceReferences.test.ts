// The baseline's own references nobody can read become one answer a person gives
// (correction batch 1, item 1; S4: in Plan settings → Baseline mappings, not on
// a step of the plan).
//
// Jon Hope's export carves groups of his own out of most of its policies, and
// nothing he published says what they are. Holding every policy that names one
// held most of the default baseline behind a wait nothing in the tenant could
// end. Guessing what they are, or dropping them, writes a different policy. So
// each is asked once: this tenant's own object that plays the same part, or none
// needed here. Only the policies that name an unanswered reference hold, each
// with a `sourceMapping` blocker that states the part the reference plays, and
// the reason "Baseline references an unmapped group". No row of the plan stands
// for the question, and nothing is ever called "Group 1 … N".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import interpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }
import { fixture, withExternalMfa } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { implementationOffered, operationsOf, unavailableReason } from './operations.ts'
import { applyStepDecisions } from './decisions.ts'
import { referenceOptions } from './answers.ts'
import { classificationFor, readInterpretation } from '../baseline/interpretation.ts'
import { implementable, resolveTenantPolicy, tenantObjectsOf } from './resolvePolicy.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { holdWaitsOn } from './stateReason.ts'
import { BLOCKED_REASON } from '../copy/reasons.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf, unresolvedSourceMappings } from './sourceMappings.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import { holdLabelOf, laneLabelOf } from '../ui/surfaces/planBoard.ts'
import { MAPPING_WORDS, mappingRowsOf, shortId } from '../ui/surfaces/baselineMappings.ts'
import type { Step } from './types.ts'

const BROAD = '62d67e66-2bc9-43cd-b00c-6326dae53d18'
// The owner takes it as a second break-glass group (2026-09-19): left out by default, like the other exclude-only groups.
const SECOND_BREAK_GLASS = '5628ad67-f9d1-4495-abe3-99dc8f9074f1'
// The author's EAM population: included by one policy, carved out of High-Risk Users, so a person maps it.
const EAM = '8d0564e5-ab28-4283-9a94-9883c581adde'
const COUNTRIES_ONLY = 'cc7f9bb7-425b-42fc-b025-311a1a3eb0f4'
const EXCLUSIONS = 'b63c3682-06c6-45f0-9692-ee76b604b4f9'
const DEVICE_REGISTRATION = 'aeb49474-5250-4b65-8b0a-56c47127ee0f'
const LEGACY = 's-goal-block-legacy-auth'
const GEO = 's-goal-geo-restriction'
const REMOVED_ROW = 's-prereq-source-references'

const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}

/** The fixture with every pending reference answered the same way, through the real decision path (the Baseline mappings' Save). */
function answered(f: Fixture, answer: (id: string) => string, only?: readonly string[]): Fixture {
  const pending = unresolvedSourceMappings(runFixture(f).steps)
  const answers = Object.fromEntries(pending.filter((r) => !only || only.includes(r.id)).map((r) => [r.id, answer(r.id)]))
  const mapping = applyStepDecisions(f.mapping, { [BASELINE_MAPPINGS_KEY]: { answers, at: f.snapshot.asOf } })
  return { ...f, mapping }
}

test('every interpretation record says what adopting its reference takes, and it agrees with the meaning', () => {
  const read = readInterpretation(interpretation)
  assert.ok(read.references.length > 10)
  for (const r of read.references) assert.equal(r.classification, classificationFor(r.meaning), `${r.id} is classified against its meaning`)
  const decisions = read.references.filter((r) => r.classification === 'decisionRequired').map((r) => r.id)
  for (const id of [BROAD, COUNTRIES_ONLY]) assert.ok(decisions.includes(id), `${id} needs a person's answer`)
  assert.equal(read.references.find((r) => r.id === EXCLUSIONS)?.classification, 'knownSemantic', 'the exclusions group is a known reading')
  // A record that leaves the classification out, or contradicts its meaning, is refused rather than read.
  const raw = structuredClone(interpretation) as { references: Record<string, unknown>[] }
  delete raw.references[0].classification
  assert.throws(() => readInterpretation(raw), /classification/)
  const wrong = structuredClone(interpretation) as { references: Record<string, unknown>[] }
  wrong.references[0].classification = 'sourceOnly'
  assert.throws(() => readInterpretation(wrong), /classified/)
})

test('the known exclusions reference resolves to the tenant’s group; an unread one waits on the mapping, never on a step', () => {
  const pkg = pinnedPackage()
  const policy = pkg.policies.find((p) => p.id === DEVICE_REGISTRATION)
  assert.ok(policy, 'the pinned Device Registration policy')
  const tenant = tenantObjectsOf(emptyMappingState('t'), null, 'tenant-exclusions')
  const resolved = resolveTenantPolicy(policy as never, tenant, 'device-registration-mfa', pkg.policies)
  const excluded = (resolved.body.conditions as { users: { excludeGroups: string[] } }).users.excludeGroups.map((g) => g.toLowerCase())
  assert.ok(excluded.includes('tenant-exclusions'), 'the exclusions group is the tenant’s')
  assert.equal(resolved.decisions.get(BROAD)?.answer, 'omitted', 'approved optional exclusion defaults absent')
  assert.equal(resolved.unresolved.has(BROAD), true, 'and it is unresolved')
  assert.equal(resolved.unresolved.get(BROAD), null, 'with no step of the plan to answer it: the mapping does')
  const whole = implementable(resolved.body, resolved)
  const waiting = whole.missing.find((m) => m.token.toLowerCase() === BROAD)
  assert.equal(waiting, undefined)
  assert.equal(resolved.decisions.get(SECOND_BREAK_GLASS)?.answer, 'omitted', 'the second break-glass group is left out, as the owner decided')
  assert.equal(whole.missing.some(m => m.token.toLowerCase() === SECOND_BREAK_GLASS), false)
  assert.equal(whole.missing.some((m) => m.unreadable), false, 'nothing is left waiting on a reading nobody can give')
  assert.equal(JSON.stringify(whole.policy).toLowerCase().includes(BROAD), false, 'and the author’s id is in no body')
})

test('S4: each policy naming an unmapped reference is On Hold with the reason, and its blocker states the role', () => {
  // mid with an external MFA provider: High-Risk Users carves out the author's EAM population, which nothing maps yet.
  for (const name of ['mid'] as const) {
    const r = runFixture(withExternalMfa(fixture(name)))
    const readings = laneReadings(r.steps)
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.plainTitle ?? null
    const pending = unresolvedSourceMappings(r.steps)
    const broad = pending.find((x) => x.id.toLowerCase() === EAM)
    assert.ok(broad && (broad.stepIds ?? []).length > 0, `${name}: the EAM group is pending, with the steps that name it`)
    assert.equal(broad.role, 'both', `${name}: the companion targets it and High-Risk Users excludes it (§18.1)`)
    for (const s of r.steps) {
      for (const m of s.action.missing ?? []) assert.notEqual(m.unreadable, true, `${name}/${s.id} waits on ${m.token}, which nobody can answer`)
    }
    let checked = 0
    for (const ref of pending) {
      for (const id of ref.stepIds ?? []) {
        const step = stepOf(r.steps, id)
        assert.ok(step.status !== 'done', `${name}/${id} is open work, not a policy already in place`)
        const reading = readings.get(id)
        assert.ok(reading, `${name}/${id} has a lane`)
        // An enforced policy that drifted is corrected next; a reference nobody has
        // mapped does not hold bringing the rest of it back (B1, RUN-CONTEXT-B decision 6).
        if (step.state.lifecycle === 'enforced' && reading.lane === 'Ready') {
          assert.equal(reading.substatus, 'Correct', `${name}/${id}: an enforced policy the mapping names reads Ready · ${reading.substatus}`)
          checked += 1
          continue
        }
        assert.equal(reading.lane, 'On Hold', `${name}/${id}: ${reading.lane}`)
        // A baseline that contradicts itself binds first (§15 order); every other policy is held by the mapping.
        const conflict = step.state.condition === 'baseline-conflict'
        assert.equal(reading.reason?.kind, conflict ? 'sourceConflict' : 'sourceMapping', `${name}/${id}: held by ${reading.reason?.kind}`)
        if (conflict) continue
        // The primary blocker is one of the references this policy names (a policy can name several).
        const named = pending.find((p) => (p.stepIds ?? []).includes(id) && `sourceMapping:${shortId(p.id)}`.toLowerCase() === reading.reason?.id.toLowerCase())
        assert.ok(named, `${name}/${id}: the blocker ${reading.reason?.id} names a reference this policy does not`)
        assert.ok(['include', 'exclude', 'both'].includes(reading.reason?.role ?? ''), `${name}/${id}: the blocker states no role`)
        assert.equal(reading.reason?.role, named.role, `${name}/${id}: the blocker's role is the reference's`)
        assert.equal(holdLabelOf(reading, titleOf), BLOCKED_REASON.sourceMapping)
        assert.equal(laneLabelOf(reading, titleOf), 'On Hold', 'compact state labels keep the cause in the expanded step')
        assert.equal(step.blockedReason, BLOCKED_REASON.sourceMapping, `${name}/${id}: the row's own reason`)
        assert.equal(holdWaitsOn(step).includes(REMOVED_ROW), false, `${name}/${id}: the hold names the removed row`)
        checked += 1
      }
    }
    assert.ok(checked >= 1, `${name}: the preserved required-reference gate was exercised`)
  }
  assert.equal(BLOCKED_REASON.sourceMapping, 'Baseline references an unmapped group')
})

test('S4: the Baseline mappings surface lists each unresolved reference with its policies and role, and never as "Group N"', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x) }
  const rows = mappingRowsOf(r.steps, ctx)
  const refs = sourceMappingsOf(r.steps)
  assert.equal(rows.length, refs.length)
  assert.ok(rows.length >= 2, 'the demo asks more than one')
  assert.deepEqual(referenceOptions(), MAPPING_WORDS.options, 'the answers are the surface’s own two options')
  for (const [i, row] of rows.entries()) {
    const ref = refs[i]
    assert.equal(row.id, ref.id)
    assert.doesNotMatch(row.label, /\b(Group|Named location) \d+$/, `${row.id}: labelled by a running number`)
    assert.ok(row.label.includes(row.policies[0] ?? shortId(ref.id)), `${row.id}: the label names an affected policy`)
    assert.ok(row.label.startsWith(ref.kind === 'group' ? 'Group' : 'Location'))
    assert.equal(row.status, MAPPING_WORDS.status[ref.answer])
    assert.equal(row.role, ref.role ?? null)
    assert.ok(row.role !== null && row.roleWord === MAPPING_WORDS.role[row.role], `${row.id}: the role is stated`)
    assert.deepEqual(row.policies.length, (ref.stepIds ?? []).length)
    assert.ok(row.policies.every((p) => !/^s-goal-/.test(p)), `${row.id}: names the policies by title`)
    if (ref.answer === 'pending') assert.equal(row.answerLine, MAPPING_WORDS.unanswered)
    else assert.ok(row.answerLine.includes(referenceOptions()[0]), 'optional excluded references retain their explicit V1 assumption')
  }
})

test('a reference answered as none needed is left out, reported and holds nothing, and answers that reference only', () => {
  const f = fixture('demo')
  const omit = answered(f, () => referenceOptions()[0])
  const r = runFixture(omit)
  const legacy = stepOf(r.steps, LEGACY)
  assert.equal((legacy.action.missing ?? []).length, 0, 'nothing is missing')
  assert.ok((legacy.action.omitted ?? []).map((x) => x.toLowerCase()).includes(BROAD), 'the left-out reference is named as the person’s answer')
  assert.deepEqual(legacy.action.authorOnly ?? [], [], 'and never as a settled reading of the author’s environment')
  assert.equal(unavailableReason(legacy) === 'missing-object', false)
  for (const op of operationsOf(legacy)) assert.equal(JSON.stringify(op.body).toLowerCase().includes(BROAD), false)

  // An answer for one reference answers that reference only.
  {
    const f = fixture('demo')
    const one = answered(f, () => referenceOptions()[0], [BROAD])
    const r = runFixture(one)
    assert.equal((stepOf(r.steps, LEGACY).action.missing ?? []).some((m) => m.decision), false, 'the policy naming only that group waits on nothing')
    const geo = stepOf(r.steps, GEO)
    assert.deepEqual(
      (geo.action.missing ?? []).filter((m) => m.decision).map((m) => m.token.toLowerCase()),
      [],
      'other optional exclusions use the approved default independently',
    )
    assert.ok(!unresolvedSourceMappings(r.steps).some((x) => x.id.toLowerCase() === COUNTRIES_ONLY), 'optional reference is not an impossible user question')
    assert.ok(!unresolvedSourceMappings(r.steps).some((x) => x.id.toLowerCase() === SECOND_BREAK_GLASS), 'nor is the second break-glass group')
  }
})

test('a reference the interpretation settles as naming nothing fails closed, and nobody is asked about it', () => {
  const pkg = pinnedPackage()
  const policies = pkg.policies.map((p) => ({ ...p, placeholders: { ...((p as { placeholders?: Record<string, string> }).placeholders ?? {}), [BROAD]: 'invalidSource' } }))
  const policy = policies.find((p) => p.id === DEVICE_REGISTRATION)!
  const resolved = resolveTenantPolicy(policy as never, tenantObjectsOf(emptyMappingState('t'), null, 'x'), 'device-registration-mfa', policies as never)
  assert.equal(resolved.decisions.has(BROAD), false, 'it is not a question')
  const whole = implementable(resolved.body, resolved)
  assert.deepEqual(whole.missing.find((m) => m.token.toLowerCase() === BROAD), { token: whole.missing.find((m) => m.token.toLowerCase() === BROAD)?.token, stepId: null, unreadable: true })
})
