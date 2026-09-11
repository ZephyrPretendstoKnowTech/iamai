// The baseline's own references nobody can read become one answer a person gives
// (correction batch 1, item 1).
//
// Jon Hope's export carves groups of his own out of most of its policies, and
// nothing he published says what they are. Holding every policy that names one
// held most of the default baseline behind a wait nothing in the tenant could
// end. Guessing what they are, or dropping them, writes a different policy. So
// each is asked once, on the source-references step: this tenant's own object
// that plays the same part, or none needed here. Only the policies that name an
// unanswered reference wait, and only on that answer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import interpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { implementationOffered, operationsOf, unavailableReason } from './operations.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { applyStepDecisions } from './decisions.ts'
import { answerTextFor, referenceOptions } from './answers.ts'
import { classificationFor, readInterpretation } from '../baseline/interpretation.ts'
import { implementable, resolveTenantPolicy, tenantObjectsOf } from './resolvePolicy.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { holdWaitsOn } from './stateReason.ts'
import type { Step } from './types.ts'

const SOURCE_STEP = PREREQ_STEP_ID.sourceReferences
const BROAD = '62d67e66-2bc9-43cd-b00c-6326dae53d18'
const COUNTRIES_ONLY = 'cc7f9bb7-425b-42fc-b025-311a1a3eb0f4'
const EXCLUSIONS = 'b63c3682-06c6-45f0-9692-ee76b604b4f9'
const DEVICE_REGISTRATION = 'aeb49474-5250-4b65-8b0a-56c47127ee0f'
const LEGACY = 's-goal-block-legacy-auth'
const GEO = 's-goal-geo-restriction'

const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}

/** The fixture with every pending reference answered the same way, through the real decision path. */
function answered(f: Fixture, answer: (id: string) => string, only?: readonly string[]): Fixture {
  const pending = stepOf(runFixture(f).steps, SOURCE_STEP).action.sourceReferences ?? []
  const answers = Object.fromEntries(pending.filter((r) => !only || only.includes(r.id)).map((r) => [r.id, answer(r.id)]))
  const mapping = applyStepDecisions(f.mapping, { [SOURCE_STEP]: { answers, at: f.snapshot.asOf } })
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

test('the known exclusions reference resolves to the tenant’s group; an unread one waits on the answer, never on nothing', () => {
  const pkg = pinnedPackage()
  const policy = pkg.policies.find((p) => p.id === DEVICE_REGISTRATION)
  assert.ok(policy, 'the pinned Device Registration policy')
  const tenant = tenantObjectsOf(emptyMappingState('t'), null, 'tenant-exclusions')
  const resolved = resolveTenantPolicy(policy as never, tenant, 'device-registration-mfa', pkg.policies)
  const excluded = (resolved.body.conditions as { users: { excludeGroups: string[] } }).users.excludeGroups.map((g) => g.toLowerCase())
  assert.ok(excluded.includes('tenant-exclusions'), 'the exclusions group is the tenant’s')
  assert.equal(resolved.decisions.get(BROAD)?.answer, 'pending', 'the unread group is a question for a person')
  assert.equal(resolved.unresolved.get(BROAD), SOURCE_STEP, 'and it waits on the step where it is answered')
  const whole = implementable(resolved.body, resolved)
  const waiting = whole.missing.find((m) => m.token.toLowerCase() === BROAD)
  assert.deepEqual(waiting, { token: waiting?.token, stepId: SOURCE_STEP, decision: true })
  assert.equal(whole.missing.some((m) => m.unreadable), false, 'nothing is left waiting on a step that does not exist')
  assert.equal(JSON.stringify(whole.policy).toLowerCase().includes(BROAD), false, 'and the author’s id is in no body')
})

test('no policy on the demo is held on a reference nobody can act on', () => {
  for (const name of ['demo', 'demo-week2'] as const) {
    const r = runFixture(fixture(name))
    const ids = new Set(r.steps.map((s) => s.id))
    for (const s of r.steps) {
      for (const m of s.action.missing ?? []) {
        assert.notEqual(m.unreadable, true, `${name}/${s.id} waits on ${m.token}, which no step ends`)
        if (m.decision) assert.ok(ids.has(m.stepId ?? ''), `${name}/${s.id} waits on a step that is on the plan`)
      }
    }
    const source = stepOf(r.steps, SOURCE_STEP)
    assert.equal(source.state.condition, 'needs-decision', `${name}: the answers are a decision, and the step says so`)
    const broad = (source.action.sourceReferences ?? []).find((x) => x.id === BROAD)
    assert.ok(broad && broad.answer === 'pending' && (broad.stepIds ?? []).length > 0, `${name}: it lists the broad group with the steps that name it`)
    for (const id of broad?.stepIds ?? []) {
      const waiting = stepOf(r.steps, id)
      assert.ok(waiting.status !== 'done', `${name}/${id} is open work, not a policy already in place`)
      // A policy whose baseline contradicts itself is held on that first; every other one names the step it waits on.
      if ((waiting.action.missing ?? []).some((m) => m.decision)) assert.ok(holdWaitsOn(waiting).includes(SOURCE_STEP), `${name}/${id}: what holds it names the step`)
    }
    if (name === 'demo') assert.ok(stepOf(r.steps, LEGACY).blockedReason?.includes(source.plainTitle), `${name}: a policy naming it says what it waits on`)
  }
})

test('a reference mapped to a tenant group is that group in every policy that names it', () => {
  const f = fixture('demo')
  const group = [...f.groups.keys()].find((id) => id.toLowerCase() !== EXCLUSIONS)
  assert.ok(group, 'the demo holds a group to choose')
  const mapped = answered(f, () => answerTextFor(referenceOptions()[1], [group]))
  const r = runFixture(mapped)
  const legacy = stepOf(r.steps, LEGACY)
  assert.equal((legacy.action.missing ?? []).some((m) => m.decision), false, 'the policy waits on no answer any more')
  assert.equal(holdWaitsOn(legacy).includes(SOURCE_STEP), false, 'nor on the step')
  assert.equal(stepOf(r.steps, SOURCE_STEP).state.satisfied, true, 'every reference answered: the step is in place')
  for (const op of operationsOf(legacy)) {
    const text = JSON.stringify(op.body).toLowerCase()
    assert.ok(text.includes(group.toLowerCase()), 'the chosen group is in the body')
    assert.equal(text.includes(BROAD), false, 'the author’s id is not')
  }
})

test('a reference answered as none needed is left out, reported, and holds nothing', () => {
  const f = fixture('demo')
  const omit = answered(f, () => referenceOptions()[0])
  const r = runFixture(omit)
  const legacy = stepOf(r.steps, LEGACY)
  assert.equal((legacy.action.missing ?? []).length, 0, 'nothing is missing')
  assert.ok((legacy.action.omitted ?? []).map((x) => x.toLowerCase()).includes(BROAD), 'the left-out reference is named as the person’s answer')
  assert.deepEqual(legacy.action.authorOnly ?? [], [], 'and never as a settled reading of the author’s environment')
  assert.equal(unavailableReason(legacy) === 'missing-object', false)
  for (const op of operationsOf(legacy)) assert.equal(JSON.stringify(op.body).toLowerCase().includes(BROAD), false)
})

test('an answer for one reference answers that reference only', () => {
  const f = fixture('demo')
  const one = answered(f, () => referenceOptions()[0], [BROAD])
  const r = runFixture(one)
  assert.equal((stepOf(r.steps, LEGACY).action.missing ?? []).some((m) => m.decision), false, 'the policy naming only that group waits on nothing')
  const geo = stepOf(r.steps, GEO)
  assert.deepEqual(
    (geo.action.missing ?? []).filter((m) => m.decision).map((m) => m.token.toLowerCase()),
    [COUNTRIES_ONLY],
    'the policy naming another still waits on that one',
  )
  assert.equal(implementationOffered(geo), false)
  assert.equal(stepOf(r.steps, SOURCE_STEP).state.condition, 'needs-decision', 'the step still has a question open')
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
