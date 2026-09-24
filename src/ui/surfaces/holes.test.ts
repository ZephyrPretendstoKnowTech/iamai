// No line renders around a hole (render.ts whole()): on the demo and GetIAMAI,
// every line a step renders, and every picker row, is whole — no dangling comma,
// no unfilled variable; a line may end in a preposition's object.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// On the curated baseline (fixtures/index.ts `curatedFixture`): this is about a
// policy that can be written, not about the source groups this baseline has not
// settled (roadmap/sourceIdentity.test.ts).
import { curatedFixture as fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepLines } from './stepExport.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { fillText, listCountVars, missingVars, whole } from '../../content/render.ts'
import { contentStepFor } from '../../content/stepTitle.ts'

const HOLE = / ,|,,|,\.|\bfrom is\b|\{[a-zA-Z:]+\}/
/** Names fillText resolves from the shared strings rather than the step's own values. */
const SHARED = new Set(['portalRoot', 'reportOnlyLine', 'exclusionsLine', 'signature', 'policyIfWrong', 'changeIfWrong', 'datesNew', 'datesChange', 'portalOpen', 'existingCoverage', 'syncRoleNote', 'strengthName', 'certificatePrompt'])

test('whole() treats an empty value or list as missing, judges a line that counts and lists on the count it fills, and still suppresses a genuinely unresolved variable', () => {
  {
    assert.equal(whole('{a} and {list:b}', { a: 'x', b: ['y'] }), true)
    for (const a of ['', null, undefined]) assert.equal(whole('{a}', { a }), false, String(a))
    assert.equal(whole('{list:b}', { b: [] }), false)
    assert.equal(whole('{list:b}', { b: ['y', ''] }), false)
    assert.equal(whole('{list:b}', { b: ['y', null] }), false)
  }
  // A line that counts and lists counts its own list (render.ts listCountVars).
  // That is part of *filling* a line, so `whole` judges it on the same values
  // `fillText` will use: the gate and the render cannot disagree, which is the
  // only reason the softening is safe. A step with no count of its own — one whose
  // policy scope IAMAI could not settle, so it claims no population — kept its
  // evidence lines and lost none of the strictness below.
  {
    const line = '{n} people signed in since {from}: {list:who}'
    assert.equal(whole(line, { from: 'Aug 1', who: ['Alex', 'Sam'] }), true, 'the list supplies the count the line names')
    assert.equal(fillText(line, { from: 'Aug 1', who: ['Alex', 'Sam'] }), '2 people signed in since Aug 1: Alex, Sam')
    // And it is the list's count, never a count the step happens to carry: the
    // product must not say three and name two.
    assert.equal(fillText(line, { n: 9, from: 'Aug 1', who: ['Alex', 'Sam'] }), '2 people signed in since Aug 1: Alex, Sam')
    assert.equal(fillText('{n} of one', { n: 9, who: ['Alex'] }), '9 of one', 'a count with no list beside it is still the step’s own')
  }
  {
    const line = '{n} people signed in since {from}: {list:who}'
    assert.equal(whole(line, { who: ['Alex', 'Sam'] }), false, '{from} is unresolved')
    assert.equal(whole('{n} people: {list:who}', { who: [] }), false, 'an empty list is a hole, and its count is not a zero to print')
    assert.equal(whole('{n} people: {list:who}', {}), false, 'no list at all')
    assert.equal(whole('{n} people: {list:who}', { who: ['Alex', ''] }), false, 'a list with an empty item')
    assert.equal(whole('{n} people are ready', {}), false, 'a count with no list is the step’s own, and missing')
    assert.equal(whole('{n} people are ready', { n: 4 }), true)
    // The softening reaches exactly one variable and only beside a list.
    assert.equal(whole('{n} of {total} people: {list:who}', { who: ['Alex'] }), false, '{total} is not supplied by the list')
  }
})

test('no line the gate lets through renders around a missing value, and on the demo and GetIAMAI no rendered line has a hole', () => {
  {
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
  }
  {
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
  }
})
