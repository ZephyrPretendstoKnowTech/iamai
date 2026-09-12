// The Baseline mappings, truthfully (correction batch 1.1; S4 moved them from a step to Plan settings): each reference is
// answered on its own and can be changed or taken back without the rest; taking one
// back returns the policies that name it to waiting and withdraws their schedule;
// leaving out an exception and leaving out a target say different things; and a
// policy waiting on an unanswered reference says so rather than that an object is
// missing.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import type { StepDecision } from './decisions.ts'
import { answerTextFor, referenceOptions } from './answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf, unresolvedSourceMappings } from './sourceMappings.ts'
import { implementationOffered, operationsOf } from './operations.ts'
import { referenceUsage } from '../baseline/interpretation.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import type { Step } from './types.ts'
import { waitingLine, waitKindOf } from '../ui/surfaces/stepJson.ts'
import { tenantNameOf } from '../ui/surfaces/stepVars.ts'
import { mappingRowOf, mappingRowsOf } from '../ui/surfaces/baselineMappings.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { CONTRACT, stepContract } from '../ui/surfaces/stepContract.ts'
import { app } from '../content/content.ts'

const SOURCE = BASELINE_MAPPINGS_KEY
const OMIT = (): string => referenceOptions()[0]
const MAP = (id: string): string => answerTextFor(referenceOptions()[1], [id])

const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}

/** The plan as the app derives it: the stored mapping with every saved decision applied afresh. */
function withDecisions(f: Fixture, decisions: Record<string, StepDecision>): Fixture {
  return { ...f, mapping: applyStepDecisions(f.mapping, decisions) }
}

const base = fixture('demo')
const pending = sourceMappingsOf(runFixture(base).steps)
const at = base.snapshot.asOf
const group = [...base.groups.keys()].find((id) => !pending.some((r) => r.id.toLowerCase() === id.toLowerCase()))!

/** A reference and the policies that name it and no other pending reference. */
function onlyNaming(id: string): string[] {
  const own = pending.find((r) => r.id === id)?.stepIds ?? []
  return own.filter((s) => !pending.some((r) => r.id !== id && (r.stepIds ?? []).includes(s)))
}

test('each reference is answered on its own; taking one back leaves the others and returns its policies to waiting', () => {
  assert.ok(pending.length >= 2, 'the premise: more than one reference is asked')
  const [a, b] = pending
  const both = runFixture(withDecisions(base, { [SOURCE]: { answers: { [a.id]: OMIT(), [b.id]: MAP(group) }, at } }))
  const refs = (steps: Step[]) => new Map(sourceMappingsOf(steps).map((r) => [r.id, r.answer]))
  assert.equal(refs(both.steps).get(a.id), 'omitted')
  assert.equal(refs(both.steps).get(b.id), 'mapped')
  const cleared = withDecisions(base, { [SOURCE]: { answers: { [b.id]: MAP(group) }, at } })
  const r = runFixture(cleared)
  assert.equal(refs(r.steps).get(a.id), 'pending', 'the answer taken back is unanswered again')
  assert.equal(refs(r.steps).get(b.id), 'mapped', 'the other answer stays')
  assert.equal((cleared.mapping.omittedReferences ?? []).includes(a.id.toLowerCase()), false)
  assert.equal(cleared.mapping.records[b.id.toLowerCase()]?.resolvedId, group)
  const waiting = onlyNaming(a.id).map((id) => stepOf(r.steps, id)).filter((s) => s.status !== 'done')
  for (const s of waiting) {
    assert.ok((s.action.missing ?? []).some((m) => m.decision && m.token.toLowerCase() === a.id.toLowerCase()), `${s.id} waits on the reference again`)
    assert.equal(implementationOffered(s), false, `${s.id} still offers its operations`)
    assert.equal(s.scheduled?.class, 'waiting', `${s.id} keeps a schedule`)
    assert.equal((r.schedule.phases ?? []).some((p) => p.stepIds.includes(s.id)), false, `${s.id} is still in a phase`)
  }
  assert.ok(unresolvedSourceMappings(r.steps).some((x) => x.id === a.id), 'the mapping is asked again')
})

test('changing an answer replaces it in every policy that names the reference', () => {
  const [a] = pending
  const omit = withDecisions(base, { [SOURCE]: { answers: { [a.id]: OMIT() }, at } })
  const map = withDecisions(base, { [SOURCE]: { answers: { [a.id]: MAP(group) }, at } })
  assert.ok((omit.mapping.omittedReferences ?? []).includes(a.id.toLowerCase()))
  assert.equal((map.mapping.omittedReferences ?? []).includes(a.id.toLowerCase()), false, 'the old answer is gone')
  const r = runFixture(map)
  for (const id of onlyNaming(a.id)) {
    for (const op of operationsOf(stepOf(r.steps, id))) {
      const text = JSON.stringify(op.body).toLowerCase()
      assert.ok(text.includes(group.toLowerCase()), `${id}: the chosen group is in the body`)
      assert.equal(text.includes(a.id.toLowerCase()), false, `${id}: the author's id is not`)
    }
  }
})

test('taking one answer back keeps every unrelated decision', () => {
  const [a] = pending
  const other = { 's-prereq-device-plan': { option: 'kept', at } }
  const cleared = withDecisions(base, { ...other, [SOURCE]: { answers: {}, at } })
  const kept = withDecisions(base, { ...other, [SOURCE]: { answers: { [a.id]: OMIT() }, at } })
  const answersOf = (f: Fixture) => Object.entries(f.mapping.questionAnswers ?? {}).filter(([k]) => !k.startsWith(SOURCE))
  assert.deepEqual(answersOf(cleared), answersOf(kept))
  assert.ok(answersOf(cleared).some(([, v]) => v === 'kept'))
})

test('no source identifier becomes a tenant object, whichever answers are given or taken back', () => {
  const ids = pending.map((r) => r.id.toLowerCase())
  for (const answers of [{}, Object.fromEntries(pending.map((r) => [r.id, OMIT()])), Object.fromEntries(pending.map((r) => [r.id, MAP(group)]))]) {
    const f = withDecisions(base, { [SOURCE]: { answers, at } })
    for (const rec of Object.values(f.mapping.records)) assert.equal(ids.includes(String(rec.resolvedId ?? '').toLowerCase()), false)
    for (const s of runFixture(f).steps) for (const op of operationsOf(s)) for (const id of ids) assert.equal(JSON.stringify(op.body).toLowerCase().includes(id), false, `${s.id} carries ${id}`)
  }
})

test('each reference says the part it plays, and leaving out an exception reads differently from leaving out a target', () => {
  const r = runFixture(base)
  const ctx: Pick<StepVarContext, 'snapshot' | 'mapping' | 'nameOf'> = { snapshot: base.snapshot, mapping: base.mapping, nameOf: (x) => r.input.names!.label(x) }
  const usage = new Map(referenceUsage(pinnedPackage().policies).map((u) => [u.id, u]))
  const rows = mappingRowsOf(r.steps, ctx)
  assert.equal(rows.length, pending.length)
  for (const row of rows) {
    const u = usage.get(row.id.toLowerCase())
    assert.ok(u, `${row.id} is in the baseline`)
    const expected = u.includedIn.length > 0 && u.excludedFrom.length > 0 ? 'both' : u.includedIn.length > 0 ? 'include' : 'exclude'
    assert.equal(row.role, expected, `${row.id}: the part it plays is read off the baseline`)
    assert.ok(row.roleLine && row.omitLine, `${row.id}: says what it is and what leaving it out does`)
    assert.ok(row.roleLine.includes(String(new Set([...u.includedIn, ...u.excludedFrom]).size)), `${row.id}: says how widely`)
    assert.ok(row.policies.length > 0 && row.policies.every((p) => !/^s-goal-/.test(p)), `${row.id}: names the policies by title`)
    assert.equal(row.roleLine.includes(row.id) || row.omitLine.includes(row.id) || row.answerLine.includes(row.id), false, 'the author’s id is never the words')
  }
  // The same reference, as a target instead of an exception.
  const first = sourceMappingsOf(r.steps)[0]
  const include = mappingRowOf({ ...first, role: 'include' }, ctx)
  const exclude = mappingRowOf({ ...first, role: 'exclude' }, ctx)
  assert.notEqual(include.omitLine, exclude.omitLine)
  assert.notEqual(include.roleLine, exclude.roleLine)
  // Answered, the row says the answer; taken back, it says it has none.
  const answered = runFixture(withDecisions(base, { [SOURCE]: { answers: { [first.id]: OMIT() }, at } }))
  const row = mappingRowsOf(answered.steps, ctx).find((x) => x.id === first.id)!
  assert.ok(row.answerLine.includes(OMIT()))
  assert.notEqual(row.answerLine, rows.find((x) => x.id === first.id)!.answerLine)
})

test('a policy waiting on an unanswered reference says the meaning is unresolved, and one waiting on an object says it is missing', () => {
  const tenant = tenantNameOf(base.snapshot)
  const missingWords = app.plan.jsonWaits.split('{tenant}')[1].trim()
  const decisionWords = app.plan.jsonWaitsDecision.split('{tenant}')[0].trim()
  let references = 0
  let objects = 0
  for (const f of [base, withDecisions(base, { [SOURCE]: { answers: Object.fromEntries(pending.map((p) => [p.id, OMIT()])), at } })]) {
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const s of r.steps) {
      const kinds = new Set((s.action.missing ?? []).map(waitKindOf))
      if (kinds.size === 0) continue
      const line = waitingLine(s, tenant)
      if (kinds.has('referenceUnresolved')) {
        references += 1
        assert.ok(line.includes(decisionWords), `${s.id}: ${line}`)
        // A policy finishes on its end state (owner, 2026-09-11); a step with no policy finishes on the answer itself.
        if (s.kind !== 'create' && s.kind !== 'adjust') assert.ok(stepContract(s, ctx).doneWhen.some((d) => d.includes(CONTRACT.doneMissingDecision.split('{tenant}')[0].trim())), `${s.id}: Done when does not say the answer`)
      }
      if (kinds.has('objectMissing')) objects += 1
      assert.equal(line.includes(missingWords), kinds.has('objectMissing'), `${s.id}: "${line}" says an object is missing exactly where one is`)
    }
  }
  assert.ok(references > 0 && objects > 0, `references ${references}, objects ${objects}`)
})
