// No line renders around a hole (render.ts whole()): on the demo and GetIAMAI,
// every line a step renders, and every picker row, is whole — no dangling comma
// or preposition, no unfilled variable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepLines } from './stepExport.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { whole } from '../../content/render.ts'

const HOLE = / ,|,,|,\.|\bfrom\.$|\bfrom is\b|\{[a-zA-Z:]+\}/

test('whole() treats an empty value, an empty list and a list with an empty item as missing', () => {
  assert.equal(whole('{a} and {list:b}', { a: 'x', b: ['y'] }), true)
  for (const a of ['', null, undefined]) assert.equal(whole('{a}', { a }), false, String(a))
  assert.equal(whole('{list:b}', { b: [] }), false)
  assert.equal(whole('{list:b}', { b: ['y', ''] }), false)
  assert.equal(whole('{list:b}', { b: ['y', null] }), false)
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
