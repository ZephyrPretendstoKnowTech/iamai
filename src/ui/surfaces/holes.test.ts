// No line renders around a hole (render.ts whole()): on the demo and GetIAMAI,
// every line a step renders, and every picker row, is whole — no dangling comma,
// no unfilled variable; a line may end in a preposition's object.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { commsFor, stepExportView, stepLines } from './stepExport.ts'
import { implementationOffered } from './stepJson.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { fillText, listCountVars, missingVars, whole } from '../../content/render.ts'
import { contentStepFor } from '../../content/stepTitle.ts'

const HOLE = / ,|,,|,\.|\bfrom is\b|\{[a-zA-Z:]+\}/

test('whole() treats an empty value, an empty list and a list with an empty item as missing', () => {
  assert.equal(whole('{a} and {list:b}', { a: 'x', b: ['y'] }), true)
  for (const a of ['', null, undefined]) assert.equal(whole('{a}', { a }), false, String(a))
  assert.equal(whole('{list:b}', { b: [] }), false)
  assert.equal(whole('{list:b}', { b: ['y', ''] }), false)
  assert.equal(whole('{list:b}', { b: ['y', null] }), false)
})

// A line that counts and lists counts its own list (render.ts listCountVars).
// That is part of *filling* a line, so `whole` judges it on the same values
// `fillText` will use: the gate and the render cannot disagree, which is the
// only reason the softening is safe. A step with no count of its own — one whose
// policy scope IAMAI could not settle, so it claims no population — kept its
// evidence lines and lost none of the strictness below.
test('a line that counts and lists is judged and filled on the same count', () => {
  const line = '{n} people signed in since {from}: {list:who}'
  assert.equal(whole(line, { from: 'Aug 1', who: ['Alex', 'Sam'] }), true, 'the list supplies the count the line names')
  assert.equal(fillText(line, { from: 'Aug 1', who: ['Alex', 'Sam'] }), '2 people signed in since Aug 1: Alex, Sam')
  // And it is the list's count, never a count the step happens to carry: the
  // product must not say three and name two.
  assert.equal(fillText(line, { n: 9, from: 'Aug 1', who: ['Alex', 'Sam'] }), '2 people signed in since Aug 1: Alex, Sam')
  assert.equal(fillText('{n} of one', { n: 9, who: ['Alex'] }), '9 of one', 'a count with no list beside it is still the step’s own')
})

test('a genuinely unresolved variable still suppresses the whole line', () => {
  const line = '{n} people signed in since {from}: {list:who}'
  assert.equal(whole(line, { who: ['Alex', 'Sam'] }), false, '{from} is unresolved')
  assert.equal(whole('{n} people: {list:who}', { who: [] }), false, 'an empty list is a hole, and its count is not a zero to print')
  assert.equal(whole('{n} people: {list:who}', {}), false, 'no list at all')
  assert.equal(whole('{n} people: {list:who}', { who: ['Alex', ''] }), false, 'a list with an empty item')
  assert.equal(whole('{n} people are ready', {}), false, 'a count with no list is the step’s own, and missing')
  assert.equal(whole('{n} people are ready', { n: 4 }), true)
  // The softening reaches exactly one variable and only beside a list.
  assert.equal(whole('{n} of {total} people: {list:who}', { who: ['Alex'] }), false, '{total} is not supplied by the list')
})

test('no line the gate lets through renders around a missing value', () => {
  // The invariant that makes the pairing safe, over the real content: every line
  // every step renders is filled with exactly the values it was judged on, so a
  // variable can never vanish into an empty substitution and no token can leak.
  const KEYS = /\{(?:list:)?([a-zA-Z0-9_]+)\}/g
  const bad: string[] = []
  for (const name of ['demo', 'demo-week2', 'getiamai'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const s of r.steps) {
      const ex = stepVars(s, ctx) as Record<string, unknown>
      const cs = contentStepFor(s) as Record<string, unknown> | null
      const who = (cs?.who ?? {}) as Record<string, unknown>
      const more = (cs?.more ?? {}) as Record<string, unknown>
      const lines = [who.lead, ...(Array.isArray(who.before) ? who.before : []), ...(Array.isArray(who.evidence) ? who.evidence : []), ...(Array.isArray(more.risks) ? more.risks : []), ...(Array.isArray(more.helpDesk) ? more.helpDesk : []), cs?.ifWrong].filter((x): x is string => typeof x === 'string')
      for (const line of lines) {
        if (!whole(line, ex)) continue
        // Judged whole: every variable it names is filled by the values it will
        // be rendered with, and the rendering carries no token and no hole.
        assert.deepEqual(missingVars(line, listCountVars(line, ex)), [], `${name} ${s.id}: ${line}`)
        const out = fillText(line, ex)
        if (HOLE.test(out)) bad.push(`${name} ${s.id}: ${out}`)
        for (const m of line.matchAll(KEYS)) {
          const value = (listCountVars(line, ex) as Record<string, unknown>)[m[1]]
          if (value === undefined && !SHARED.has(m[1])) bad.push(`${name} ${s.id}: {${m[1]}} vanished from "${out}"`)
        }
      }
    }
  }
  assert.deepEqual(bad, [], 'lines rendered around a missing value')
})

/** Names fillText resolves from the shared strings rather than the step's own values. */
const SHARED = new Set(['portalRoot', 'reportOnlyLine', 'exclusionsLine', 'signature', 'policyIfWrong', 'changeIfWrong', 'datesNew', 'datesChange', 'portalOpen', 'existingCoverage', 'syncRoleNote', 'strengthName', 'certificatePrompt'])

test('the step whose scope IAMAI cannot settle keeps the evidence it does have', () => {
  // The admin-portals step's baseline contradicts itself, so it has no operation,
  // no cohort and claims no population — {n} is not produced for it at all. Its
  // evidence lines count their own lists and must still render: what the records
  // hold about people is not a claim about who a policy reaches.
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const s = r.steps.find((x) => x.goalId === 'admin-portals-protected')!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const ex = stepVars(s, ctx) as Record<string, unknown>
  assert.equal(ex.n, undefined, 'the step claims no count of its own')
  const line = '{n} people without a directory role signed in to Azure since {from}: {list:azureNonAdmins}'
  const cs = contentStepFor(s) as unknown as { who: { evidence: string[] } }
  assert.ok(cs.who.evidence.includes(line), 'the content still carries the line')
  assert.equal(whole(line, ex), true, 'and it renders, counting its own list')
  const out = fillText(line, ex)
  assert.match(out, /^\d+ (?:person|people) without a directory role signed in to Azure since /, out)
  assert.doesNotMatch(out, HOLE, out)
})

// The variables an email names are filled, not dropped: a line with a hole is
// dropped whole, so a missing variable on an email body loses the whole email
// without a hole showing. Each entry names a step and the variables its email
// body must fill on the demo (the admin-sessions email's {wantedLong} was left
// unfilled by the merge and the email vanished).
const EMAIL_VARIABLES: [string, string[]][] = [
  ['admin-session', ['enforceLong', 'tenant', 'wantedLong']],
  // The countries email names the allowed countries through the step's one variable (a second, {countriesLong}, was never filled and the email vanished).
  ['geo-restriction', ['enforceLong', 'tenant', 'countries']],
]

test('on the demo, an email body fills every variable it names', () => {
  // Week two: the objects the policies name exist, so the policies are datable
  // and their announcements render (stepJson.ts implementationOffered).
  const f = fixture('demo-week2')
  const r = runFixture(f)
  let announced = 0
  for (const [goalId, vars] of EMAIL_VARIABLES) {
    const s = r.steps.find((x) => x.goalId === goalId)!
    assert.ok(s, `the demo has the ${goalId} step`)
    const cs = contentStepFor(s) as unknown as { comms: { body: string } }
    for (const v of vars) assert.ok(cs.comms.body.includes(`{${v}}`), `${goalId}: the email names {${v}}`)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    const ex = stepVars(s, ctx) as Record<string, unknown>
    if (!implementationOffered(s)) {
      // A policy naming an object this tenant does not have has no date to
      // announce and nothing to announce yet: no email at all, and no hole.
      assert.equal(commsFor(cs as unknown as Record<string, unknown>, ex), null, `${goalId}: nothing to announce while it waits`)
      assert.deepEqual(stepExportView(s, ctx).doneWhen, [], `${goalId}: no completion criteria while it waits`)
      assert.equal(stepExportView(s, ctx).dates, null, `${goalId}: no dates while it waits`)
      continue
    }
    assert.deepEqual(missingVars(cs.comms.body, ex), [], `${goalId}: the email body fills every variable`)
    assert.ok(stepLines(s, ctx).some((line) => line.includes(String(ex.wantedLong ?? ex.enforceLong))), `${goalId}: the email renders`)
    announced += 1
  }
  assert.ok(announced > 0, 'at least one of the two announces')
})

test('on the demo and GetIAMAI, no rendered line has a hole', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    const bad: string[] = []
    for (const s of r.steps) {
      for (const line of stepLines(s, ctx)) if (HOLE.test(line)) bad.push(`${s.id}: ${line}`)
      const ex = stepVars(s, ctx) as Record<string, unknown>
      const key = typeof ex.pickerKey === 'string' ? ex.pickerKey : null
      for (const row of key && Array.isArray(ex[key]) ? (ex[key] as string[]) : []) if (HOLE.test(row)) bad.push(`${s.id} row: ${row}`)
    }
    assert.deepEqual(bad, [], `${name}: lines with a hole`)
  }
})
