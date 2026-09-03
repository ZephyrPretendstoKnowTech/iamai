// No line renders around a hole (render.ts whole()): on the demo and GetIAMAI,
// every line a step renders, and every picker row, is whole — no dangling comma,
// no unfilled variable; a line may end in a preposition's object.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepLines } from './stepExport.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { missingVars, whole } from '../../content/render.ts'
import { contentStepFor } from '../../content/stepTitle.ts'

const HOLE = / ,|,,|,\.|\bfrom is\b|\{[a-zA-Z:]+\}/

test('whole() treats an empty value, an empty list and a list with an empty item as missing', () => {
  assert.equal(whole('{a} and {list:b}', { a: 'x', b: ['y'] }), true)
  for (const a of ['', null, undefined]) assert.equal(whole('{a}', { a }), false, String(a))
  assert.equal(whole('{list:b}', { b: [] }), false)
  assert.equal(whole('{list:b}', { b: ['y', ''] }), false)
  assert.equal(whole('{list:b}', { b: ['y', null] }), false)
})

// The variables an email names are filled, not dropped: a line with a hole is
// dropped whole, so a missing variable on an email body loses the whole email
// without a hole showing. Each entry names a step and the variables its email
// body must fill on the demo (the admin-sessions email's {wantedLong} was left
// unfilled by the merge and the email vanished).
const EMAIL_VARIABLES: [string, string[]][] = [['admin-session', ['enforceLong', 'tenant', 'wantedLong']]]

test('on the demo, an email body fills every variable it names', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  for (const [goalId, vars] of EMAIL_VARIABLES) {
    const s = r.steps.find((x) => x.goalId === goalId)!
    assert.ok(s, `the demo has the ${goalId} step`)
    const cs = contentStepFor(s) as unknown as { comms: { body: string } }
    for (const v of vars) assert.ok(cs.comms.body.includes(`{${v}}`), `${goalId}: the email names {${v}}`)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    const ex = stepVars(s, ctx) as Record<string, unknown>
    assert.deepEqual(missingVars(cs.comms.body, ex), [], `${goalId}: the email body fills every variable`)
    assert.ok(stepLines(s, ctx).some((line) => line.includes(String(ex.wantedLong ?? ex.enforceLong))), `${goalId}: the email renders`)
  }
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
